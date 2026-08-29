"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";

export type StageStatus = "not_started" | "pending" | "in_progress" | "success" | "error" | "skipped";

export interface StageDetails {
  status: StageStatus;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  error?: string;
  retryCount?: number;
}

export interface FileProcessingStatus {
  fileId: string;
  fileName: string;
  download: StageDetails;
  upload: StageDetails;
  ocr: StageDetails;
  reformat: StageDetails;
  overallStatus: "not_started" | "pending" | "in_progress" | "success" | "error";
  startedAt?: string;
  completedAt?: string;
  totalDurationMs?: number;
}

export interface PipelineLog {
  id: string;
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR";
  message: string;
  stage?: "download" | "upload" | "ocr" | "reformat" | "pipeline";
  fileId?: string;
  fileName?: string;
  error?: string;
}

export interface PipelineSummary {
  total: number;
  completed: number;
  processing: number;
  failed: number;
  pending: number;
  ocrSuccessRate: number;
  ocrErrorRate: number;
  reformatSuccessRate: number;
  avgOcrDurationMs: number;
  avgReformatDurationMs: number;
}

export interface JobDetailsResponse {
  id: string;
  status: "queued" | "processing" | "completed" | "failed";
  reformatEnabled: boolean;
  createdAt: string;
  files: FileProcessingStatus[];
  logs: PipelineLog[];
  summary: PipelineSummary;
}

export interface JobSummary {
  id: string;
  status: string;
  reformatEnabled: boolean;
  createdAt: string;
  totalFiles: number;
}

export default function PipelineDashboard() {
  // Theme State: "dark" | "light"
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const savedTheme = localStorage.getItem("wepass_pipeline_theme") as "dark" | "light" | null;
    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme);
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("wepass_pipeline_theme", nextTheme);
  };

  const isDark = theme === "dark";

  // Dynamic Theme Styles for Pipeline Dashboard
  const styles = useMemo(() => {
    return {
      bgMain: isDark ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900",
      bgHeader: isDark ? "bg-slate-900/80 border-slate-800" : "bg-white/80 border-slate-200 shadow-sm",
      bgCard: isDark ? "bg-slate-900 border-slate-800 shadow-xl" : "bg-white border-slate-200 shadow-md",
      bgSubCard: isDark ? "bg-slate-950 border-slate-800" : "bg-slate-100 border-slate-200",
      bgInput: isDark
        ? "bg-slate-950 border-slate-800 text-slate-100 placeholder-slate-600 focus:border-indigo-500"
        : "bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-500",
      textTitle: isDark ? "text-white" : "text-slate-900",
      textMuted: isDark ? "text-slate-400" : "text-slate-500",
      borderLine: isDark ? "border-slate-800" : "border-slate-200",
    };
  }, [isDark]);

  const [folderUrl, setFolderUrl] = useState("");
  const [enableReformat, setEnableReformat] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [jobsList, setJobsList] = useState<JobSummary[]>([]);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [jobData, setJobData] = useState<JobDetailsResponse | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Filters & Views
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "processing" | "failed" | "pending">("all");
  const [stageFilter, setStageFilter] = useState<"all" | "download" | "upload" | "ocr" | "reformat">("all");
  const [selectedFile, setSelectedFile] = useState<FileProcessingStatus | null>(null);

  const [activeTab, setActiveTab] = useState<"dashboard" | "logs">("dashboard");
  const [logLevelFilter, setLogLevelFilter] = useState<"ALL" | "INFO" | "WARN" | "ERROR">("ALL");
  const [logSearchQuery, setLogSearchQuery] = useState("");

  // Fetch jobs list
  const fetchJobsList = useCallback(async () => {
    try {
      const res = await fetch("/api/pipelines/status");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.jobs)) {
          setJobsList(data.jobs);
          if (!currentJobId && data.jobs.length > 0) {
            setCurrentJobId(data.jobs[data.jobs.length - 1].id);
          }
        }
      }
    } catch {
      // silent background fetch catch
    }
  }, []);

  // Fetch job details
  const fetchJobStatus = useCallback(async (id: string, showLoading = false) => {
    if (showLoading) setIsLoading(true);
    setApiError(null);
    try {
      const res = await fetch(`/api/pipelines/status?id=${encodeURIComponent(id)}`);
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to fetch pipeline status");
      }
      const data: JobDetailsResponse = await res.json();
      setJobData(data);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Error connecting to pipeline backend API");
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchJobsList();
  }, [fetchJobsList]);

  useEffect(() => {
    if (currentJobId) {
      fetchJobStatus(currentJobId, true);
    }
  }, [currentJobId, fetchJobStatus]);

  // Polling while active job is processing or queued
  useEffect(() => {
    if (!currentJobId || !jobData) return;
    if (jobData.status === "processing" || jobData.status === "queued") {
      const interval = setInterval(() => {
        fetchJobStatus(currentJobId, false);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [currentJobId, jobData, fetchJobStatus]);

  // Start new pipeline execution
  const handleStartPipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderUrl.trim()) return;

    setIsSubmitting(true);
    setApiError(null);

    try {
      const res = await fetch("/api/pipelines/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folderUrl: folderUrl.trim(),
          enableReformat,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to start pipeline");
      }

      setCurrentJobId(data.jobId);
      setFolderUrl("");
      await fetchJobsList();
      await fetchJobStatus(data.jobId, true);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Could not start pipeline execution");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered files
  const filteredFiles = (jobData?.files || []).filter((file) => {
    if (searchQuery.trim() && !file.fileName.toLowerCase().includes(searchQuery.toLowerCase().trim())) {
      return false;
    }
    if (statusFilter !== "all" && file.overallStatus !== statusFilter) {
      return false;
    }
    if (stageFilter !== "all") {
      const stageData = file[stageFilter];
      if (!stageData || stageData.status === "not_started" || stageData.status === "pending") {
        return false;
      }
    }
    return true;
  });

  // Filtered logs
  const filteredLogs = (jobData?.logs || []).filter((log) => {
    if (logLevelFilter !== "ALL" && log.level !== logLevelFilter) {
      return false;
    }
    if (
      logSearchQuery.trim() &&
      !log.message.toLowerCase().includes(logSearchQuery.toLowerCase().trim()) &&
      !(log.fileName && log.fileName.toLowerCase().includes(logSearchQuery.toLowerCase().trim()))
    ) {
      return false;
    }
    return true;
  });

  const formatMs = (ms?: number) => {
    if (ms === undefined || ms === null) return "—";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleTimeString();
  };

  return (
    <div className={`min-h-screen font-sans antialiased pb-16 transition-colors duration-200 ${styles.bgMain}`}>
      {/* Top Navigation Bar */}
      <header className={`border-b backdrop-blur sticky top-0 z-40 px-6 py-4 ${styles.bgHeader}`}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h1 className={`text-lg font-bold tracking-tight flex items-center gap-2 ${styles.textTitle}`}>
                WePass
                <span className={`text-xs px-2 py-0.5 rounded-full font-mono font-medium border ${isDark ? "bg-slate-800 text-slate-400 border-slate-700" : "bg-slate-100 text-slate-600 border-slate-300"}`}>
                  Engine
                </span>
              </h1>
              <p className={`text-xs ${styles.textMuted}`}>OCR & Document Reformatting Processing Engine</p>
            </div>
          </div>

          {/* Job Selection, Refresh & Theme Toggle */}
          <div className="flex items-center gap-3">
            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              className={`px-3 py-2 rounded-lg border font-semibold text-xs transition-all flex items-center gap-2 shadow-sm ${
                isDark
                  ? "bg-slate-800 border-slate-700 text-amber-300 hover:bg-slate-700"
                  : "bg-white border-slate-300 text-slate-800 hover:bg-slate-100"
              }`}
              title="Toggle Light/Dark Theme"
            >
              <span>{isDark ? "🌙 Dark Mode" : "☀️ Light Mode"}</span>
            </button>

            {jobsList.length > 0 && (
              <select
                value={currentJobId || ""}
                onChange={(e) => setCurrentJobId(e.target.value)}
                className={`text-xs rounded-lg px-3 py-2 border focus:ring-2 focus:ring-indigo-500 focus:outline-none ${
                  isDark ? "bg-slate-900 border-slate-700 text-slate-200" : "bg-white border-slate-300 text-slate-800"
                }`}
              >
                {jobsList.map((j) => (
                  <option key={j.id} value={j.id}>
                    Job: {j.id.slice(0, 8)}... ({j.totalFiles} files, {j.status})
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={() => currentJobId && fetchJobStatus(currentJobId, true)}
              disabled={isLoading || !currentJobId}
              className={`p-2 rounded-lg border transition-colors disabled:opacity-50 ${
                isDark
                  ? "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300"
                  : "bg-white hover:bg-slate-100 border-slate-300 text-slate-700 shadow-sm"
              }`}
              title="Refresh Data"
            >
              <svg className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-6 space-y-6">
        {/* Pipeline Controls & Submission Card */}
        <section className={`border rounded-xl p-5 ${styles.bgCard}`}>
          <form onSubmit={handleStartPipeline} className="space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-end gap-4">
              {/* Folder URL Input */}
              <div className="flex-1 space-y-1.5">
                <label className={`text-xs font-semibold uppercase tracking-wider ${styles.textMuted}`}>
                  Google Drive Folder URL / ID
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={folderUrl}
                    onChange={(e) => setFolderUrl(e.target.value)}
                    placeholder="https://drive.google.com/drive/folders/..."
                    className={`w-full pl-9 rounded-lg px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none transition ${styles.bgInput}`}
                    required
                  />
                </div>
              </div>

              {/* Reformat Checkbox */}
              <div className={`flex items-center gap-2 border px-3 py-2 rounded-lg cursor-pointer ${isDark ? "bg-slate-950 border-slate-800" : "bg-slate-100 border-slate-300"}`}>
                <input
                  type="checkbox"
                  id="enableReformat"
                  checked={enableReformat}
                  onChange={(e) => setEnableReformat(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                <label htmlFor="enableReformat" className={`text-xs font-medium cursor-pointer select-none ${styles.textTitle}`}>
                  Enable Reformat Stage
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || !folderUrl.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-5 py-2.5 rounded-lg shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    <span>Starting...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Run Pipeline</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* API Error Alert */}
        {apiError && (
          <div className="bg-rose-950/80 border border-rose-800 rounded-xl p-4 text-rose-200 text-xs flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-rose-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{apiError}</span>
            </div>
            <button onClick={() => setApiError(null)} className="text-rose-400 hover:text-white font-bold text-sm">
              ×
            </button>
          </div>
        )}

        {/* Metrics & Overview Cards */}
        {jobData && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className={`p-4 rounded-xl border ${styles.bgCard}`}>
              <span className={`text-[11px] font-semibold uppercase tracking-wider block mb-1 ${styles.textMuted}`}>Total Files</span>
              <span className={`text-2xl font-extrabold ${styles.textTitle}`}>{jobData.summary.total}</span>
            </div>
            <div className={`p-4 rounded-xl border ${styles.bgCard}`}>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400 block mb-1">Completed</span>
              <span className="text-2xl font-extrabold text-emerald-400">{jobData.summary.completed}</span>
            </div>
            <div className={`p-4 rounded-xl border ${styles.bgCard}`}>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400 block mb-1">Processing</span>
              <span className="text-2xl font-extrabold text-amber-400">{jobData.summary.processing}</span>
            </div>
            <div className={`p-4 rounded-xl border ${styles.bgCard}`}>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-400 block mb-1">Failed</span>
              <span className="text-2xl font-extrabold text-rose-400">{jobData.summary.failed}</span>
            </div>
            <div className={`p-4 rounded-xl border ${styles.bgCard}`}>
              <span className={`text-[11px] font-semibold uppercase tracking-wider block mb-1 ${styles.textMuted}`}>OCR Success</span>
              <span className={`text-2xl font-extrabold ${styles.textTitle}`}>{jobData.summary.ocrSuccessRate}%</span>
            </div>
            <div className={`p-4 rounded-xl border ${styles.bgCard}`}>
              <span className={`text-[11px] font-semibold uppercase tracking-wider block mb-1 ${styles.textMuted}`}>Avg OCR Time</span>
              <span className={`text-2xl font-extrabold ${styles.textTitle}`}>{formatMs(jobData.summary.avgOcrDurationMs)}</span>
            </div>
          </div>
        )}

        {/* Tabs: Dashboard View vs System Logs */}
        <div className={`border-b flex items-center justify-between ${styles.borderLine}`}>
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`pb-3 text-xs font-bold transition-all border-b-2 ${
                activeTab === "dashboard"
                  ? "border-indigo-500 text-indigo-500"
                  : `border-transparent ${styles.textMuted} hover:${styles.textTitle}`
              }`}
            >
              Files Dashboard
            </button>
            <button
              onClick={() => setActiveTab("logs")}
              className={`pb-3 text-xs font-bold transition-all border-b-2 ${
                activeTab === "logs"
                  ? "border-indigo-500 text-indigo-500"
                  : `border-transparent ${styles.textMuted} hover:${styles.textTitle}`
              }`}
            >
              Pipeline System Logs ({jobData?.logs.length || 0})
            </button>
          </div>
        </div>

        {/* Tab Content: Files Dashboard */}
        {activeTab === "dashboard" && (
          <div className="space-y-4">
            {/* Filters Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search files..."
                className={`rounded-lg px-3 py-1.5 text-xs w-full sm:w-64 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${styles.bgInput}`}
              />

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className={`text-xs rounded-lg px-3 py-1.5 focus:outline-none ${styles.bgInput}`}
                >
                  <option value="all">All Statuses</option>
                  <option value="success">Success</option>
                  <option value="processing">Processing</option>
                  <option value="failed">Failed</option>
                  <option value="pending">Pending</option>
                </select>

                <select
                  value={stageFilter}
                  onChange={(e) => setStageFilter(e.target.value as any)}
                  className={`text-xs rounded-lg px-3 py-1.5 focus:outline-none ${styles.bgInput}`}
                >
                  <option value="all">All Stages</option>
                  <option value="download">Download</option>
                  <option value="upload">Upload</option>
                  <option value="ocr">OCR</option>
                  <option value="reformat">Reformat</option>
                </select>
              </div>
            </div>

            {/* Files List Table */}
            <div className={`overflow-x-auto rounded-xl border ${styles.borderLine}`}>
              <table className="w-full text-left text-xs">
                <thead className={`uppercase font-semibold border-b ${isDark ? "bg-slate-900 text-slate-400 border-slate-800" : "bg-slate-100 text-slate-600 border-slate-200"}`}>
                  <tr>
                    <th className="p-3">File Name</th>
                    <th className="p-3">Download</th>
                    <th className="p-3">Upload</th>
                    <th className="p-3">OCR Extraction</th>
                    <th className="p-3">Reformat</th>
                    <th className="p-3">Overall Status</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${styles.borderLine}`}>
                  {!jobData || filteredFiles.length === 0 ? (
                    <tr>
                      <td colSpan={6} className={`text-center py-12 italic ${styles.textMuted}`}>
                        {!jobData ? "No active pipeline job selected." : "No files match the selected filter criteria."}
                      </td>
                    </tr>
                  ) : (
                    filteredFiles.map((file) => (
                      <tr
                        key={file.fileId}
                        onClick={() => setSelectedFile(file)}
                        className={`cursor-pointer transition-colors ${
                          selectedFile?.fileId === file.fileId
                            ? isDark
                              ? "bg-indigo-950/40"
                              : "bg-indigo-50/80"
                            : isDark
                            ? "hover:bg-slate-800/40"
                            : "hover:bg-slate-100/80"
                        }`}
                      >
                        <td className={`p-3 font-semibold ${styles.textTitle}`}>{file.fileName}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded font-mono text-[10px] ${file.download.status === "success" ? "bg-emerald-950 text-emerald-300" : "bg-slate-800 text-slate-400"}`}>
                            {file.download.status}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded font-mono text-[10px] ${file.upload.status === "success" ? "bg-emerald-950 text-emerald-300" : "bg-slate-800 text-slate-400"}`}>
                            {file.upload.status}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded font-mono text-[10px] ${file.ocr.status === "success" ? "bg-emerald-950 text-emerald-300" : file.ocr.status === "error" ? "bg-rose-950 text-rose-300" : "bg-slate-800 text-slate-400"}`}>
                            {file.ocr.status} ({formatMs(file.ocr.durationMs)})
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded font-mono text-[10px] ${file.reformat.status === "success" ? "bg-emerald-950 text-emerald-300" : file.reformat.status === "skipped" ? "bg-slate-800 text-slate-500" : "bg-slate-800 text-slate-400"}`}>
                            {file.reformat.status}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2.5 py-1 rounded font-bold uppercase text-[10px] ${file.overallStatus === "success" ? "bg-emerald-950 text-emerald-300 border border-emerald-800" : file.overallStatus === "error" ? "bg-rose-950 text-rose-300 border border-rose-800" : "bg-amber-950 text-amber-300 border border-amber-800"}`}>
                            {file.overallStatus}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab Content: System Logs */}
        {activeTab === "logs" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <input
                type="text"
                value={logSearchQuery}
                onChange={(e) => setLogSearchQuery(e.target.value)}
                placeholder="Search log messages..."
                className={`rounded-lg px-3 py-1.5 text-xs w-full sm:w-64 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${styles.bgInput}`}
              />

              <select
                value={logLevelFilter}
                onChange={(e) => setLogLevelFilter(e.target.value as any)}
                className={`text-xs rounded-lg px-3 py-1.5 focus:outline-none ${styles.bgInput}`}
              >
                <option value="ALL">All Levels</option>
                <option value="INFO">INFO</option>
                <option value="WARN">WARN</option>
                <option value="ERROR">ERROR</option>
              </select>
            </div>

            <div className={`p-4 rounded-xl border font-mono text-xs max-h-[500px] overflow-y-auto space-y-1 ${isDark ? "bg-slate-950 border-slate-800" : "bg-slate-900 border-slate-800 text-slate-200"}`}>
              {filteredLogs.length === 0 ? (
                <p className="text-slate-500 italic">No logs recorded.</p>
              ) : (
                filteredLogs.map((log) => (
                  <div key={log.id} className="flex gap-3 leading-relaxed">
                    <span className="text-slate-500 shrink-0">{formatDate(log.timestamp)}</span>
                    <span className={`font-bold shrink-0 ${log.level === "ERROR" ? "text-rose-400" : log.level === "WARN" ? "text-amber-400" : "text-emerald-400"}`}>
                      [{log.level}]
                    </span>
                    <span className="text-slate-300">{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}