"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useLanguage } from "@/app/context/LanguageContext";
import LanguageSelector from "@/app/components/LanguageSelector";
import { AuthGuard } from "@/app/components/AuthGuard";
import { UserNav } from "@/app/components/UserNav";

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
  overallStatus: "not_started" | "pending" | "in_progress" | "success" | "error";
  startedAt?: string;
  completedAt?: string;
  totalDurationMs?: number;
  outputFilename?: string;
  outputPath?: string;
  result?: string;
}

export interface PipelineLog {
  id: string;
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR";
  message: string;
  stage?: "download" | "upload" | "ocr" | "pipeline";
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
  avgOcrDurationMs: number;
}

export interface JobDetailsResponse {
  id: string;
  status: "queued" | "processing" | "completed" | "failed";
  createdAt: string;
  files: FileProcessingStatus[];
  logs: PipelineLog[];
  summary: PipelineSummary;
}

export interface JobSummary {
  id: string;
  status: string;
  createdAt: string;
  totalFiles: number;
}

export default function PipelinePage() {
  const { language, t, isRtl, dir } = useLanguage();

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
      bgMain: isDark ? "bg-[#1A2634] text-[#F5F5F5]" : "bg-[#F5F5F5] text-[#364F6B]",
      bgHeader: isDark ? "bg-[#243447]/90 border-[#364F6B]" : "bg-white/90 border-[#364F6B]/15 shadow-sm",
      bgCard: isDark ? "bg-[#243447] border-[#364F6B] shadow-xl" : "bg-white border-[#364F6B]/15 shadow-md",
      bgSubCard: isDark ? "bg-[#1A2634] border-[#364F6B]" : "bg-[#F5F5F5] border-[#364F6B]/20",
      bgInput: isDark
        ? "bg-[#1A2634] border-[#364F6B] text-[#F5F5F5] placeholder-slate-400 focus:border-[#FC5185] focus:ring-1 focus:ring-[#FC5185]"
        : "bg-white border-[#364F6B]/30 text-[#364F6B] placeholder-slate-400 focus:border-[#FC5185] focus:ring-1 focus:ring-[#FC5185]",
      textTitle: isDark ? "text-[#F5F5F5]" : "text-[#364F6B]",
      textMuted: isDark ? "text-[#F5F5F5]/70" : "text-[#364F6B]/75",
      borderLine: isDark ? "border-[#364F6B]" : "border-[#364F6B]/20",
    };
  }, [isDark]);

  const [folderUrl, setFolderUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [jobsList, setJobsList] = useState<JobSummary[]>([]);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [jobData, setJobData] = useState<JobDetailsResponse | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Filters & Views
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "processing" | "failed" | "pending">("all");
  const [stageFilter, setStageFilter] = useState<"all" | "download" | "upload" | "ocr">("all");
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
  }, [currentJobId]);

  // Fetch job details
  const fetchJobStatus = useCallback(async (id: string, showLoading = false) => {
    if (showLoading) setIsLoading(true);
    setApiError(null);
    try {
      const res = await fetch(`/api/pipelines/status?id=${encodeURIComponent(id)}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
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
    return new Date(dateStr).toLocaleTimeString(language === "fa" ? "fa-IR" : "en-US");
  };

  const successCount = (jobData?.files || []).filter((f) => f.overallStatus === "success").length;
  const failedCount = (jobData?.files || []).filter((f) => f.overallStatus === "error").length;
  const jobFinished = !!jobData && jobData.status !== "processing" && jobData.status !== "queued";

  return (
    <AuthGuard>
      <div dir={dir} className={`min-h-screen font-sans antialiased pb-16 transition-colors duration-200 ${styles.bgMain}`}>
        {/* Top Navigation Bar */}
        <header className={`border-b backdrop-blur sticky top-0 z-40 px-6 py-4 ${styles.bgHeader}`}>
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-[#FC5185] to-[#3FC1C9] flex items-center justify-center font-bold text-white shadow-lg shadow-[#FC5185]/20 shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h1 className={`text-lg font-bold tracking-tight flex items-center gap-2 ${styles.textTitle}`}>
                  {t.pipeline.pageTitle}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-mono font-medium border ${
                    isDark ? "bg-[#1A2634] text-[#3FC1C9] border-[#364F6B]" : "bg-[#F5F5F5] text-[#166E74] border-[#364F6B]/20"
                  }`}>
                    {t.pipeline.engineBadge}
                  </span>
                </h1>
                <p className={`text-xs ${styles.textMuted}`}>{t.pipeline.pageDescription}</p>
              </div>
            </div>

            {/* Actions & Tools */}
            <div className="flex flex-wrap items-center gap-2 md:gap-3">
              <Link
                href="/"
                className={`px-3 py-2 rounded-xl border font-semibold text-xs transition-all flex items-center gap-1.5 shadow-sm ${
                  isDark ? "bg-[#1A2634] border-[#364F6B] text-[#F5F5F5] hover:bg-[#243447]" : "bg-white border-[#364F6B]/20 text-[#364F6B] hover:bg-[#F5F5F5]"
                }`}
              >
                <span>{isRtl ? "→" : "←"}</span>
                <span className="hidden sm:inline">{t.auth.backToDashboard}</span>
              </Link>

              <Link
                href="/tohtml"
                className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
                  isDark ? "bg-[#1A2634] hover:bg-[#243447] text-[#F5F5F5] border-[#364F6B]" : "bg-white hover:bg-[#F5F5F5] text-[#364F6B] border-[#364F6B]/20"
                }`}
              >
                <span>{t.workflow.tohtmlTool}</span>
              </Link>

              <LanguageSelector isDark={isDark} />

              <UserNav />

              {/* Theme Toggle Button */}
              <button
                type="button"
                onClick={toggleTheme}
                className={`p-2 rounded-xl border text-xs transition-colors ${
                  isDark ? "bg-[#1A2634] hover:bg-[#243447] text-[#F5F5F5] border-[#364F6B]" : "bg-white hover:bg-[#F5F5F5] text-[#364F6B] border-[#364F6B]/20"
                }`}
                title={t.common.toggleTheme}
              >
                {isDark ? "☀️" : "🌙"}
              </button>

              {jobsList.length > 0 && (
                <select
                  value={currentJobId || ""}
                  onChange={(e) => setCurrentJobId(e.target.value)}
                  className={`text-xs rounded-xl px-3 py-2 border focus:ring-2 focus:ring-[#FC5185] focus:outline-none ${
                    isDark ? "bg-[#1A2634] border-[#364F6B] text-[#F5F5F5]" : "bg-white border-[#364F6B]/30 text-[#364F6B]"
                  }`}
                >
                  {jobsList.map((j) => (
                    <option key={j.id} value={j.id}>
                      {t.pipeline.jobPrefix} {j.id.slice(0, 8)}... ({j.totalFiles} {t.pipeline.filesCount}, {j.status})
                    </option>
                  ))}
                </select>
              )}

              <button
                onClick={() => currentJobId && fetchJobStatus(currentJobId, true)}
                disabled={isLoading || !currentJobId}
                className={`p-2 rounded-xl border transition-colors disabled:opacity-50 ${
                  isDark
                    ? "bg-[#1A2634] hover:bg-[#243447] border-[#364F6B] text-[#F5F5F5]"
                    : "bg-white hover:bg-[#F5F5F5] border-[#364F6B]/30 text-[#364F6B] shadow-sm"
                }`}
                title={t.common.refresh}
              >
                <svg className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
          {/* Pipeline Controls & Submission Card */}
          <section className={`border rounded-2xl p-5 md:p-6 ${styles.bgCard}`}>
            <form onSubmit={handleStartPipeline} className="space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-end gap-4">
                {/* Folder URL Input */}
                <div className="flex-1 space-y-1.5">
                  <label className={`text-xs font-semibold uppercase tracking-wider ${styles.textMuted}`}>
                    {t.pipeline.folderUrlLabel}
                  </label>
                  <div className="relative">
                    <div className={`absolute inset-y-0 ${isRtl ? "right-0 pr-3.5" : "left-0 pl-3.5"} flex items-center pointer-events-none text-slate-400`}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      dir="ltr"
                      value={folderUrl}
                      onChange={(e) => setFolderUrl(e.target.value)}
                      placeholder={t.pipeline.folderUrlPlaceholder}
                      className={`w-full ${isRtl ? "pr-10 pl-3 text-left" : "pl-10 pr-3 text-left"} rounded-xl py-2.5 text-xs font-mono focus:ring-2 focus:ring-[#FC5185] focus:outline-none transition ${styles.bgInput}`}
                      required
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting || !folderUrl.trim()}
                  className="bg-[#FC5185] hover:bg-[#E04373] text-white font-bold text-xs px-6 py-3 rounded-xl shadow-lg shadow-[#FC5185]/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#FC5185]"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                      </svg>
                      <span>{t.pipeline.startingPipeline}</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{t.pipeline.runPipeline}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>

          {/* API Error Alert */}
          {apiError && (
            <div className="bg-rose-950/80 border border-rose-800 rounded-2xl p-4 text-rose-200 text-xs flex items-center justify-between shadow-lg">
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
              <div className={`p-4 rounded-2xl border ${styles.bgCard}`}>
                <span className={`text-[11px] font-semibold uppercase tracking-wider block mb-1 ${styles.textMuted}`}>{t.pipeline.totalFiles}</span>
                <span className={`text-2xl font-black ${styles.textTitle}`}>{jobData.summary.total}</span>
              </div>
              <div className={`p-4 rounded-2xl border ${styles.bgCard}`}>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400 block mb-1">{t.pipeline.completedFiles}</span>
                <span className="text-2xl font-black text-emerald-400">{jobData.summary.completed}</span>
              </div>
              <div className={`p-4 rounded-2xl border ${styles.bgCard}`}>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400 block mb-1">{t.pipeline.processingFiles}</span>
                <span className="text-2xl font-black text-amber-400">{jobData.summary.processing}</span>
              </div>
              <div className={`p-4 rounded-2xl border ${styles.bgCard}`}>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-400 block mb-1">{t.pipeline.failedFiles}</span>
                <span className="text-2xl font-black text-rose-400">{jobData.summary.failed}</span>
              </div>
              <div className={`p-4 rounded-2xl border ${styles.bgCard}`}>
                <span className={`text-[11px] font-semibold uppercase tracking-wider block mb-1 ${styles.textMuted}`}>{t.pipeline.ocrSuccessRate}</span>
                <span className={`text-2xl font-black ${styles.textTitle}`}>{jobData.summary.ocrSuccessRate}%</span>
              </div>
              <div className={`p-4 rounded-2xl border ${styles.bgCard}`}>
                <span className={`text-[11px] font-semibold uppercase tracking-wider block mb-1 ${styles.textMuted}`}>{t.pipeline.avgOcrTime}</span>
                <span className={`text-2xl font-black ${styles.textTitle}`}>{formatMs(jobData.summary.avgOcrDurationMs)}</span>
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
                    ? "border-[#FC5185] text-[#FC5185]"
                    : `border-transparent ${styles.textMuted} hover:text-white`
                }`}
              >
                {t.pipeline.tabDashboard}
              </button>

              <button
                onClick={() => setActiveTab("logs")}
                className={`pb-3 text-xs font-bold transition-all border-b-2 ${
                  activeTab === "logs"
                    ? "border-[#FC5185] text-[#FC5185]"
                    : `border-transparent ${styles.textMuted} hover:text-white`
                }`}
              >
                {t.pipeline.tabLogs}
              </button>
            </div>
          </div>

          {/* Tab Content: Dashboard View */}
          {activeTab === "dashboard" && (
            <div className="space-y-4">
              {/* Controls bar: Search & Filters & Merge Button */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t.pipeline.searchFiles}
                  className={`rounded-xl px-3.5 py-2 text-xs w-full sm:w-64 focus:outline-none focus:ring-1 focus:ring-[#FC5185] ${styles.bgInput}`}
                />

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  {/* Merge & Download Action */}
                  {jobFinished && successCount > 0 && jobData ? (
                    <a
                      href={`/api/pipelines/merge?jobId=${jobData.id}`}
                      download
                      onClick={(e) => {
                        if (
                          failedCount > 0 &&
                          !window.confirm(
                            t.pipeline.mergeConfirmation
                              .replace("{failedCount}", String(failedCount))
                              .replace("{successCount}", String(successCount))
                          )
                        ) {
                          e.preventDefault();
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition"
                      title={t.pipeline.downloadTooltip}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      {t.pipeline.mergeAndDownload} ({successCount})
                    </a>
                  ) : (
                    <span
                      className={`inline-flex items-center px-3 py-2 rounded-xl text-xs font-semibold border cursor-not-allowed opacity-50 ${styles.bgSubCard} ${styles.textMuted}`}
                      title={t.pipeline.mergeDisabledTooltip}
                    >
                      {t.pipeline.mergeAndDownload}
                    </span>
                  )}

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as "all" | "success" | "processing" | "failed" | "pending")}
                    className={`text-xs rounded-xl px-3 py-2 focus:outline-none ${styles.bgInput}`}
                  >
                    <option value="all">{t.pipeline.filterAllStatuses}</option>
                    <option value="success">{t.pipeline.filterSuccess}</option>
                    <option value="processing">{t.pipeline.filterProcessing}</option>
                    <option value="failed">{t.pipeline.filterFailed}</option>
                    <option value="pending">{t.pipeline.filterPending}</option>
                  </select>

                  <select
                    value={stageFilter}
                    onChange={(e) => setStageFilter(e.target.value as "all" | "download" | "upload" | "ocr")}
                    className={`text-xs rounded-xl px-3 py-2 focus:outline-none ${styles.bgInput}`}
                  >
                    <option value="all">{t.pipeline.filterAllStages}</option>
                    <option value="download">{t.pipeline.filterDownload}</option>
                    <option value="upload">{t.pipeline.filterUpload}</option>
                    <option value="ocr">{t.pipeline.filterOcr}</option>
                  </select>
                </div>
              </div>

              {/* Files List Table */}
              <div className={`overflow-x-auto rounded-2xl border ${styles.borderLine}`}>
                <table className={`w-full text-xs ${isRtl ? "text-right" : "text-left"}`}>
                  <thead className={`uppercase font-semibold border-b ${isDark ? "bg-[#1A2634] text-[#F5F5F5]/70 border-[#364F6B]" : "bg-[#F5F5F5] text-[#364F6B]/70 border-[#364F6B]/20"}`}>
                    <tr>
                      <th className="p-3.5">{t.pipeline.thFileName}</th>
                      <th className="p-3.5">{t.pipeline.thDownload}</th>
                      <th className="p-3.5">{t.pipeline.thUpload}</th>
                      <th className="p-3.5">{t.pipeline.thOcr}</th>
                      <th className="p-3.5">{t.pipeline.thOverallStatus}</th>
                      <th className={`p-3.5 ${isRtl ? "text-left" : "text-right"}`}>{t.pipeline.thAction}</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${styles.borderLine}`}>
                    {!jobData || filteredFiles.length === 0 ? (
                      <tr>
                        <td colSpan={6} className={`text-center py-12 italic ${styles.textMuted}`}>
                          {!jobData ? t.pipeline.noActiveJob : t.pipeline.noMatchingFiles}
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
                                ? "bg-[#3FC1C9]/10"
                                : "bg-[#3FC1C9]/10"
                              : isDark
                              ? "hover:bg-[#1A2634]/60"
                              : "hover:bg-[#F5F5F5]"
                          }`}
                        >
                          <td className={`p-3.5 font-semibold ${styles.textTitle}`} dir="ltr">{file.fileName}</td>
                          <td className="p-3.5">
                            <span className={`px-2 py-0.5 rounded-md font-mono text-[10px] ${
                              file.download.status === "success"
                                ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800"
                                : file.download.status === "in_progress"
                                ? "bg-[#3FC1C9]/20 text-[#3FC1C9] border border-[#3FC1C9]/40"
                                : "bg-slate-800 text-slate-400"
                            }`}>
                              {file.download.status}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <span className={`px-2 py-0.5 rounded-md font-mono text-[10px] ${
                              file.upload.status === "success"
                                ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800"
                                : file.upload.status === "in_progress"
                                ? "bg-[#3FC1C9]/20 text-[#3FC1C9] border border-[#3FC1C9]/40"
                                : "bg-slate-800 text-slate-400"
                            }`}>
                              {file.upload.status}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <span className={`px-2 py-0.5 rounded-md font-mono text-[10px] ${
                              file.ocr.status === "success"
                                ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800"
                                : file.ocr.status === "error"
                                ? "bg-rose-950/80 text-rose-300 border border-rose-800"
                                : file.ocr.status === "in_progress"
                                ? "bg-[#FC5185]/20 text-[#FC5185] border border-[#FC5185]/40"
                                : "bg-slate-800 text-slate-400"
                            }`}>
                              {file.ocr.status} ({formatMs(file.ocr.durationMs)})
                            </span>
                          </td>
                          <td className="p-3.5">
                            <span className={`px-2.5 py-1 rounded-full font-bold uppercase text-[10px] ${
                              file.overallStatus === "success"
                                ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800"
                                : file.overallStatus === "error"
                                ? "bg-rose-950/80 text-rose-300 border border-rose-800"
                                : file.overallStatus === "in_progress"
                                ? "bg-[#3FC1C9]/20 text-[#3FC1C9] border border-[#3FC1C9]/40"
                                : "bg-amber-950/80 text-amber-300 border border-amber-800"
                            }`}>
                              {file.overallStatus}
                            </span>
                          </td>
                          <td className={`p-3.5 ${isRtl ? "text-left" : "text-right"}`}>
                            {file.overallStatus === "success" && jobData ? (
                              <a
                                href={`/api/pipelines/download?jobId=${jobData.id}&fileId=${file.fileId}`}
                                download
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-[#FC5185] hover:bg-[#E04373] text-white shadow-sm transition"
                                title={t.pipeline.downloadOcrTxt}
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                {t.pipeline.downloadOcrTxt}
                              </a>
                            ) : (
                              <span className="text-[11px] text-slate-500">—</span>
                            )}
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
                  placeholder={t.pipeline.searchLogs}
                  className={`rounded-xl px-3.5 py-2 text-xs w-full sm:w-64 focus:outline-none focus:ring-1 focus:ring-[#FC5185] ${styles.bgInput}`}
                />

                <select
                  value={logLevelFilter}
                  onChange={(e) => setLogLevelFilter(e.target.value as "ALL" | "INFO" | "WARN" | "ERROR")}
                  className={`text-xs rounded-xl px-3 py-2 focus:outline-none ${styles.bgInput}`}
                >
                  <option value="ALL">{t.pipeline.filterAllLevels}</option>
                  <option value="INFO">INFO</option>
                  <option value="WARN">WARN</option>
                  <option value="ERROR">ERROR</option>
                </select>
              </div>

              <div
                dir="ltr"
                className={`p-4 rounded-2xl border font-mono text-xs max-h-[500px] overflow-y-auto space-y-1 text-left ${
                  isDark ? "bg-[#1A2634] border-[#364F6B] text-slate-200" : "bg-[#243447] border-[#364F6B] text-slate-200"
                }`}
              >
                {filteredLogs.length === 0 ? (
                  <p className="text-slate-400 italic">{t.pipeline.noLogs}</p>
                ) : (
                  filteredLogs.map((log) => (
                    <div key={log.id} className="flex gap-3 leading-relaxed">
                      <span className="text-slate-400 shrink-0">{formatDate(log.timestamp)}</span>
                      <span className={`font-bold shrink-0 ${
                        log.level === "ERROR" ? "text-rose-400" : log.level === "WARN" ? "text-amber-400" : "text-emerald-400"
                      }`}>
                        [{log.level}]
                      </span>
                      <span className="text-slate-200">{log.message}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
