"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { PROMPT_PRESETS, PromptPreset } from "@/server/prompts/notebookPrompts";

export type PromptStatus = "pending" | "sending" | "completed" | "failed";

export interface PromptRecord {
  index: number;
  start: number;
  end: number;
  subject?: string;
  qnumber?: number;
  batch?: number;
  prompt: string;
  status: PromptStatus;
  responseFile?: string;
  errorMessage?: string;
}

export interface NoteBookJob {
  id: string;
  noteBookUrl: string;
  subject?: string;
  folderName: string;
  promptTitle: string;
  promptText?: string;
  promptType: "question" | "jozve";
  status: "queued" | "processing" | "completed" | "failed";
  batch: number;
  qLength: number;
  topics?: string[];
  totalBatches: number;
  completedBatches: number;
  prompts: PromptRecord[];
  responseContent?: string;
  errorMessage?: string;
  retryCount: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

export default function NotebookDashboard() {
  // Theme State: "dark" | "light"
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // Load theme preference from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("wepass_theme") as "dark" | "light" | null;
    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme);
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("wepass_theme", nextTheme);
  };

  const isDark = theme === "dark";

  // Dynamic Theme Style Helpers
  const styles = useMemo(() => {
    return {
      bgMain: isDark ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900",
      bgCard: isDark
        ? "bg-slate-900/90 border-slate-800/80 backdrop-blur-sm shadow-xl"
        : "bg-white border-slate-200 shadow-md",
      bgSubCard: isDark ? "bg-slate-950 border-slate-800" : "bg-slate-100/90 border-slate-200",
      bgInput: isDark
        ? "bg-slate-950 border-slate-800 text-slate-100 placeholder-slate-600 focus:border-indigo-500"
        : "bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-500",
      textTitle: isDark ? "text-white" : "text-slate-900",
      textMuted: isDark ? "text-slate-400" : "text-slate-500",
      borderLine: isDark ? "border-slate-800" : "border-slate-200",
      badgeDefault: isDark ? "bg-slate-900 border-slate-800 text-slate-300" : "bg-slate-100 border-slate-200 text-slate-700",
    };
  }, [isDark]);

  // Mode & Prompt Selection
  const [mode, setMode] = useState<"question" | "jozve">("question");

  const availablePresets = useMemo(() => {
    return PROMPT_PRESETS.filter((p) => p.type === mode);
  }, [mode]);

  const [selectedPresetId, setSelectedPresetId] = useState<string>("");
  const [customPromptText, setCustomPromptText] = useState<string>("");

  // Select first available preset when mode changes
  useEffect(() => {
    if (availablePresets.length > 0) {
      const first = availablePresets[0];
      setSelectedPresetId(first.id);
      setCustomPromptText(first.template);
    } else {
      setSelectedPresetId("");
      setCustomPromptText("");
    }
  }, [availablePresets, mode]);

  const handlePresetSelect = (preset: PromptPreset) => {
    setSelectedPresetId(preset.id);
    setCustomPromptText(preset.template);
  };

  // Form Inputs
  const [noteBookUrl, setNoteBookUrl] = useState<string>("");
  const [subject, setSubject] = useState<string>("Anatomy");
  const [folderName, setFolderName] = useState<string>("");
  const [questionsLength, setQuestionsLength] = useState<number>(100);
  const [batch, setBatch] = useState<number>(15);

  // Topics for Jozve Mode
  const [topics, setTopics] = useState<string[]>([
    "Epidemiology Disease Transmission Patterns",
    "Randomized Controlled Clinical Trials (RCT)",
    "Risk Assessment & Epidemiological Indicators",
  ]);
  const [newTopicInput, setNewTopicInput] = useState<string>("");

  // Submission & API state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<NoteBookJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<NoteBookJob | null>(null);
  const [copiedResponse, setCopiedResponse] = useState<boolean>(false);
  // Map of jobId -> merge state
  const [mergeStatus, setMergeStatus] = useState<Record<string, "idle" | "merging" | "done" | "error">>({});
  const [mergedContent, setMergedContent] = useState<Record<string, string>>({});
  // Set of "jobId:promptIndex" currently being retried (to disable the button while in-flight)
  const [retryingPrompts, setRetryingPrompts] = useState<Set<string>>(new Set());

  // Standalone Answer Extraction State
  const [extractUrl, setExtractUrl] = useState<string>("");
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractStatus, setExtractStatus] = useState<"idle" | "extracting" | "completed" | "failed">("idle");
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<{
    count: number;
    mergedText: string;
    message?: string;
  } | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [modeFilter, setModeFilter] = useState<"all" | "question" | "jozve">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "processing" | "queued" | "failed">("all");

  // Fetch all jobs history
  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/notebook/status");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.jobs)) {
          setJobs(data.jobs);
          if (selectedJob) {
            const updated = data.jobs.find((j: NoteBookJob) => j.id === selectedJob.id);
            if (updated) setSelectedJob(updated);
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch jobs history:", err);
    }
  }, [selectedJob]);

  // Polling for active jobs
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const hasActiveJob = jobs.some(
    (job) =>
      job.status === "queued" ||
      job.status === "processing" ||
      (job.prompts && job.prompts.some((p) => p.status === "sending"))
  );

  useEffect(() => {
    if (!hasActiveJob) return;
    const interval = setInterval(fetchJobs, 2500);
    return () => clearInterval(interval);
  }, [hasActiveJob, fetchJobs]);

  // Topic add / remove
  const handleAddTopic = () => {
    if (!newTopicInput.trim()) return;
    if (!topics.includes(newTopicInput.trim())) {
      setTopics([...topics, newTopicInput.trim()]);
    }
    setNewTopicInput("");
  };

  const handleRemoveTopic = (indexToRemove: number) => {
    setTopics(topics.filter((_, idx) => idx !== indexToRemove));
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const selectedPreset = PROMPT_PRESETS.find((p) => p.id === selectedPresetId);

    if (!noteBookUrl.trim()) {
      setSubmitError("Notebook URL is required");
      return;
    }

    if (!subject.trim()) {
      setSubmitError("Subject is required");
      return;
    }

    if (!folderName.trim()) {
      setSubmitError("Response folder name is required");
      return;
    }

    if (!selectedPreset) {
      setSubmitError("Prompt selection is required");
      return;
    }

    if (mode === "jozve" && topics.length === 0) {
      setSubmitError("At least one topic is required for Jozve Mode");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        noteBookUrl: noteBookUrl.trim(),
        subject: subject.trim(),
        folderName: folderName.trim(),
        promptTitle: selectedPreset.title,
        promptText: customPromptText,
        promptType: mode,
        ...(mode === "question" ? { questionsLength, batch } : { topics }),
      };

      const res = await fetch("/api/notebook/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to start request");
      }

      await fetchJobs();

      if (data.jobId) {
        const newJobRes = await fetch(`/api/notebook/status?jobId=${data.jobId}`);
        if (newJobRes.ok) {
          const newJobData = await newJobRes.json();
          if (newJobData.job) {
            setSelectedJob(newJobData.job);
          }
        }
      }
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Retry Handler (whole job)
  const handleRetry = async (jobId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch("/api/notebook/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchJobs();
      } else {
        alert(data.error || "Retry failed");
      }
    } catch (err) {
      console.error("Retry failed:", err);
    }
  };

  // Retry a single prompt within a job
  const handleRetryPrompt = async (jobId: string, promptIndex: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const key = `${jobId}:${promptIndex}`;
    setRetryingPrompts((prev) => new Set(prev).add(key));
    try {
      const res = await fetch("/api/notebook/prompts/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, promptIndex }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || "Prompt retry failed");
      } else {
        // Refresh immediately to show "sending" status, then rely on polling.
        await fetchJobs();
      }
    } catch (err) {
      console.error("Prompt retry failed:", err);
    } finally {
      setRetryingPrompts((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  // Copy to clipboard
  const handleCopyResponse = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedResponse(true);
    setTimeout(() => setCopiedResponse(false), 2000);
  };

  // Merge responses for a completed job
  const handleMerge = async (jobId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setMergeStatus((prev) => ({ ...prev, [jobId]: "merging" }));
    try {
      const res = await fetch("/api/notebook/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Merge failed");
      }
      setMergedContent((prev) => ({ ...prev, [jobId]: data.merged }));
      setMergeStatus((prev) => ({ ...prev, [jobId]: "done" }));
    } catch (err) {
      console.error("Merge failed:", err);
      setMergeStatus((prev) => ({ ...prev, [jobId]: "error" }));
    }
  };

  // Download merged text as a file
  const handleDownloadMerged = (jobId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const content = mergedContent[jobId];
    if (!content) return;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `merged-${jobId.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Standalone Answer Extraction Handler
  const handleExtractAnswers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extractUrl.trim()) return;

    setIsExtracting(true);
    setExtractStatus("extracting");
    setExtractError(null);
    setExtractedData(null);

    try {
      const res = await fetch("/api/notebook/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteBookUrl: extractUrl.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to extract answers from NotebookLM");
      }

      setExtractedData({
        count: data.count,
        mergedText: data.mergedText,
        message: data.message,
      });
      setExtractStatus("completed");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Extraction failed";
      setExtractError(msg);
      setExtractStatus("failed");
    } finally {
      setIsExtracting(false);
    }
  };

  // Download standalone extracted responses as .txt
  const handleDownloadExtracted = () => {
    if (!extractedData || !extractedData.mergedText) return;
    const blob = new Blob([extractedData.mergedText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `notebooklm-answers-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filtered jobs list
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const matchesSearch =
        searchQuery.trim() === "" ||
        job.promptTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.noteBookUrl.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (job.responseContent && job.responseContent.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesMode = modeFilter === "all" || job.promptType === modeFilter;
      const matchesStatus = statusFilter === "all" || job.status === statusFilter;

      return matchesSearch && matchesMode && matchesStatus;
    });
  }, [jobs, searchQuery, modeFilter, statusFilter]);

  return (
    <div className={`min-h-screen p-4 md:p-8 font-sans transition-colors duration-200 ${styles.bgMain}`}>
      {/* Header Bar */}
      <header className={`mb-8 border-b pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${styles.borderLine}`}>
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/20">
              NB
            </div>
            <div>
              <h1 className={`text-2xl font-extrabold tracking-tight ${styles.textTitle}`}>
                WePass NotebookLM Dashboard
              </h1>
              <p className={`text-sm ${styles.textMuted}`}>
                Prompt execution management, question analysis, and note synthesis with NotebookLM
              </p>
            </div>
          </div>
        </div>

        {/* Right Header Area: Stats + Light/Dark Theme Switcher */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            className={`px-3 py-2 rounded-lg border font-semibold text-xs transition-all flex items-center gap-2 shadow-sm ${isDark
              ? "bg-slate-900 border-slate-800 text-amber-300 hover:bg-slate-800 hover:text-amber-200"
              : "bg-white border-slate-300 text-slate-800 hover:bg-slate-100 shadow-slate-200"
              }`}
            title="Toggle Light/Dark Theme"
          >
            <span>{isDark ? "🌙 Dark Mode" : "☀️ Light Mode"}</span>
          </button>

          {/* Quick Stats Badges */}
          <div className="flex gap-2 text-xs font-medium">
            <div className={`px-3 py-2 border rounded-lg flex items-center gap-2 ${styles.badgeDefault}`}>
              <span className="h-2 w-2 rounded-full bg-slate-400"></span>
              Total: <span className={`font-bold ${styles.textTitle}`}>{jobs.length}</span>
            </div>
            <div className={`px-3 py-2 border rounded-lg flex items-center gap-2 ${styles.badgeDefault}`}>
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Processing:{" "}
              <span className="font-bold text-emerald-500">
                {jobs.filter((j) => j.status === "processing" || j.status === "queued").length}
              </span>
            </div>
            <div className={`px-3 py-2 border rounded-lg flex items-center gap-2 ${styles.badgeDefault}`}>
              <span className="h-2 w-2 rounded-full bg-purple-400"></span>
              Completed:{" "}
              <span className="font-bold text-purple-500">
                {jobs.filter((j) => j.status === "completed").length}
              </span>
            </div>
            <div className={`px-3 py-2 border rounded-lg flex items-center gap-2 ${styles.badgeDefault}`}>
              <span className="h-2 w-2 rounded-full bg-rose-400"></span>
              Failed:{" "}
              <span className="font-bold text-rose-500">
                {jobs.filter((j) => j.status === "failed").length}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Grid: Control Panel + Active Response Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-10">
        {/* Left Column: Form Controls & Modes (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className={`border rounded-2xl p-6 ${styles.bgCard}`}>
            {/* Mode Switch Tabs */}
            <div className="mb-6">
              <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${styles.textMuted}`}>
                Select Execution Mode
              </label>
              <div className={`grid grid-cols-2 gap-2 p-1.5 rounded-xl border ${styles.bgSubCard}`}>
                <button
                  type="button"
                  onClick={() => setMode("question")}
                  className={`py-3 px-4 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 ${mode === "question"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                    : `${styles.textMuted} hover:${styles.textTitle}`
                    }`}
                >
                  <span>❓ Question Mode</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${isDark ? "bg-slate-900/50 text-indigo-200" : "bg-white/70 text-indigo-700 font-bold"}`}>
                    Questions
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("jozve")}
                  className={`py-3 px-4 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 ${mode === "jozve"
                    ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                    : `${styles.textMuted} hover:${styles.textTitle}`
                    }`}
                >
                  <span>📚 Jozve Mode</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${isDark ? "bg-slate-900/50 text-purple-200" : "bg-white/70 text-purple-700 font-bold"}`}>
                    Notes
                  </span>
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Notebook URL Input */}
              <div>
                <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  Notebook URL *
                </label>
                <input
                  type="url"
                  value={noteBookUrl}
                  onChange={(e) => setNoteBookUrl(e.target.value)}
                  placeholder="https://notebooklm.google.com/notebook/..."
                  className={`w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition ${styles.bgInput}`}
                  required
                />
              </div>

              {/* Subject & Folder Name Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                    Subject *
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Anatomy, Pathology, Physiology"
                    className={`w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition ${styles.bgInput}`}
                    required
                  />
                </div>
                <div>
                  <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                    Response Folder Name *
                  </label>
                  <input
                    type="text"
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    placeholder="e.g. Anatomy - Thorax, Anatomy - Chapter 1"
                    className={`w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition ${styles.bgInput}`}
                    required
                  />
                </div>
              </div>

              {/* Prompt Selection Presets */}
              <div>
                <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  Select Prompt Preset *
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                  {availablePresets.map((preset) => {
                    const isSelected = selectedPresetId === preset.id;
                    return (
                      <div
                        key={preset.id}
                        onClick={() => handlePresetSelect(preset)}
                        className={`cursor-pointer p-4 rounded-xl border text-left transition-all flex flex-col justify-between ${isSelected
                          ? isDark
                            ? "bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-500"
                            : "bg-indigo-50/80 border-indigo-500 ring-1 ring-indigo-500"
                          : isDark
                            ? "bg-slate-950 border-slate-800 hover:border-slate-700"
                            : "bg-slate-50 border-slate-200 hover:border-slate-300"
                          }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span
                              className={`text-xs font-bold px-2 py-0.5 rounded ${isSelected
                                ? "bg-indigo-600 text-white"
                                : isDark
                                  ? "bg-slate-800 text-slate-400"
                                  : "bg-slate-200 text-slate-700"
                                }`}
                            >
                              {preset.type.toUpperCase()}
                            </span>
                            <span
                              className={`h-4 w-4 rounded-full border flex items-center justify-center ${isSelected
                                ? "border-indigo-500 bg-indigo-500"
                                : "border-slate-400"
                                }`}
                            >
                              {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white"></span>}
                            </span>
                          </div>
                          <h3 className={`font-bold text-sm mb-1 ${styles.textTitle}`}>{preset.title}</h3>
                          <p className={`text-xs line-clamp-2 ${styles.textMuted}`}>{preset.preview}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Editable Prompt Textarea */}
                {selectedPresetId && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className={`text-xs font-semibold ${styles.textMuted}`}>
                        Customize Prompt Text for this Run
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const p = PROMPT_PRESETS.find((x) => x.id === selectedPresetId);
                          if (p) setCustomPromptText(p.template);
                        }}
                        className="text-xs text-indigo-500 hover:underline"
                      >
                        Reset to Original Template
                      </button>
                    </div>
                    <textarea
                      value={customPromptText}
                      onChange={(e) => setCustomPromptText(e.target.value)}
                      rows={5}
                      className={`w-full rounded-xl p-3 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 ${styles.bgInput}`}
                    />
                  </div>
                )}
              </div>

              {/* Mode Specific Inputs */}
              {mode === "question" ? (
                <div className={`p-4 border rounded-xl space-y-4 ${styles.bgSubCard}`}>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-500">
                    Question Mode Parameters
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-xs font-medium mb-1 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                        Total Questions Length
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={questionsLength}
                        onChange={(e) => setQuestionsLength(Number(e.target.value))}
                        className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 ${styles.bgInput}`}
                      />
                    </div>
                    <div>
                      <label className={`block text-xs font-medium mb-1 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                        Batch Size
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={batch}
                        onChange={(e) => setBatch(Number(e.target.value))}
                        className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 ${styles.bgInput}`}
                      />
                    </div>
                  </div>
                  <p className={`text-xs ${styles.textMuted}`}>
                    Total Batches:{" "}
                    <span className={`font-bold ${styles.textTitle}`}>
                      {Math.max(1, Math.ceil(questionsLength / Math.max(1, batch)))} batches
                    </span>
                  </p>
                </div>
              ) : (
                <div className={`p-4 border rounded-xl space-y-4 ${styles.bgSubCard}`}>
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-purple-500">
                      Topics & Headings (Jozve Mode) *
                    </h4>
                    <span className={`text-xs ${styles.textMuted}`}>
                      Count: <span className={`font-bold ${styles.textTitle}`}>{topics.length}</span>
                    </span>
                  </div>

                  {/* Add Topic Input */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newTopicInput}
                      onChange={(e) => setNewTopicInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddTopic();
                        }
                      }}
                      placeholder="Enter new topic title and press Enter..."
                      className={`flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500 ${styles.bgInput}`}
                    />
                    <button
                      type="button"
                      onClick={handleAddTopic}
                      className="bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs px-4 py-2 rounded-lg transition"
                    >
                      Add
                    </button>
                  </div>

                  {/* Topics Tags List */}
                  <div className={`flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 rounded-lg border ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"}`}>
                    {topics.length === 0 ? (
                      <span className={`text-xs italic p-1 ${styles.textMuted}`}>
                        No topics added yet.
                      </span>
                    ) : (
                      topics.map((topic, idx) => (
                        <span
                          key={idx}
                          className={`inline-flex items-center gap-1.5 border text-xs px-3 py-1.5 rounded-md ${isDark
                            ? "bg-purple-950/80 border-purple-800/50 text-purple-200"
                            : "bg-purple-50 border-purple-200 text-purple-800 font-medium"
                            }`}
                        >
                          <span>{topic}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveTopic(idx)}
                            className="text-purple-500 hover:text-rose-500 font-bold ml-1"
                          >
                            ×
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Submit Error Alert */}
              {submitError && (
                <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-xl text-rose-200 text-xs flex items-center justify-between">
                  <span>⚠️ {submitError}</span>
                  <button
                    type="button"
                    onClick={() => setSubmitError(null)}
                    className="text-rose-400 hover:text-white font-bold"
                  >
                    ×
                  </button>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || !selectedPresetId}
                className={`w-full py-3.5 px-6 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg ${isSubmitting || !selectedPresetId
                  ? "bg-slate-400 text-slate-700 cursor-not-allowed"
                  : mode === "question"
                    ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30"
                    : "bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/30"
                  }`}
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      ></path>
                    </svg>
                    <span>Submitting request...</span>
                  </>
                ) : (
                  <>
                    <span>🚀 Start NotebookLM Execution</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Standalone Answer Extraction Card */}
          <div className={`border rounded-2xl p-6 ${styles.bgCard}`}>
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-800/60">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-emerald-600/20">
                📥
              </div>
              <div>
                <h2 className={`text-base font-bold tracking-tight ${styles.textTitle}`}>
                  Extract NotebookLM Answers
                </h2>
                <p className={`text-xs ${styles.textMuted}`}>
                  Extract all available answers from an existing NotebookLM notebook and merge into a downloadable .txt file
                </p>
              </div>
            </div>

            <form onSubmit={handleExtractAnswers} className="space-y-4">
              <div>
                <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  Notebook URL *
                </label>
                <input
                  type="url"
                  value={extractUrl}
                  onChange={(e) => setExtractUrl(e.target.value)}
                  placeholder="https://notebooklm.google.com/notebook/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className={`w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 transition ${styles.bgInput}`}
                  required
                />
              </div>

              {extractError && (
                <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-xl text-rose-200 text-xs flex items-center justify-between">
                  <span>⚠️ {extractError}</span>
                  <button
                    type="button"
                    onClick={() => setExtractError(null)}
                    className="text-rose-400 hover:text-white font-bold"
                  >
                    ×
                  </button>
                </div>
              )}

              {extractStatus === "completed" && extractedData && (
                <div className="p-4 bg-emerald-950/40 border border-emerald-800/80 rounded-xl text-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-bold">✓ Status:</span>
                      <span className="text-emerald-200 font-medium">Completed</span>
                    </div>
                    <div className="text-emerald-300 font-mono">
                      Responses extracted: <span className="font-bold text-white">{extractedData.count}</span>
                    </div>
                  </div>

                  {extractedData.count > 0 ? (
                    <button
                      type="button"
                      onClick={handleDownloadExtracted}
                      className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-600/30"
                    >
                      <span>⬇ Download merged answers.txt</span>
                    </button>
                  ) : (
                    <p className="text-amber-300 italic text-[11px]">
                      No NotebookLM responses were found in this notebook.
                    </p>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={isExtracting || !extractUrl.trim()}
                className={`w-full py-3 px-6 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg ${
                  isExtracting || !extractUrl.trim()
                    ? "bg-slate-400 text-slate-700 cursor-not-allowed"
                    : "bg-teal-600 hover:bg-teal-500 text-white shadow-teal-600/30"
                }`}
              >
                {isExtracting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      ></path>
                    </svg>
                    <span>Extracting & Merging Answers...</span>
                  </>
                ) : (
                  <>
                    <span>📑 Extract & Merge Answers</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Active Job & Response Viewer (5 cols) */}
        <div className="lg:col-span-5 flex flex-col space-y-6">
          <div className={`border rounded-2xl p-6 flex-1 flex flex-col ${styles.bgCard}`}>
            <div className={`flex items-center justify-between border-b pb-4 mb-4 ${styles.borderLine}`}>
              <h2 className={`text-sm font-bold flex items-center gap-2 ${styles.textTitle}`}>
                <span>📄 Active Output & Response Viewer</span>
              </h2>
              {selectedJob?.responseContent && (
                <button
                  type="button"
                  onClick={() => handleCopyResponse(selectedJob.responseContent || "")}
                  className={`text-xs px-2.5 py-1 rounded-md transition flex items-center gap-1 border ${isDark
                    ? "bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200"
                    : "bg-slate-100 border-slate-300 hover:bg-slate-200 text-slate-800"
                    }`}
                >
                  {copiedResponse ? "✓ Copied" : "📋 Copy Response Text"}
                </button>
              )}
            </div>

            {selectedJob ? (
              <div className="flex-1 flex flex-col space-y-4">
                {/* Status Header */}
                <div className={`p-3 rounded-xl border space-y-2 ${styles.bgSubCard}`}>
                  <div className="flex items-center justify-between text-xs">
                    <span className={`font-bold ${styles.textTitle}`}>{selectedJob.promptTitle}</span>
                    <span
                      className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${selectedJob.status === "completed"
                        ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                        : selectedJob.status === "processing"
                          ? "bg-amber-950 text-amber-300 border border-amber-800 animate-pulse"
                          : selectedJob.status === "failed"
                            ? "bg-rose-950 text-rose-300 border border-rose-800"
                            : "bg-slate-800 text-slate-300"
                        }`}
                    >
                      {selectedJob.status}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div>
                    <div className={`flex justify-between text-[11px] mb-1 ${styles.textMuted}`}>
                      <span>Batch Progress:</span>
                      <span>
                        {selectedJob.completedBatches} / {selectedJob.totalBatches}
                      </span>
                    </div>
                    <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? "bg-slate-800" : "bg-slate-200"}`}>
                      <div
                        className="bg-indigo-500 h-full transition-all duration-500"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round((selectedJob.completedBatches / (selectedJob.totalBatches || 1)) * 100)
                          )}%`,
                        }}
                      ></div>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className={`grid grid-cols-2 gap-2 text-[11px] pt-1 ${styles.textMuted}`}>
                    <div>
                      Subject: <span className={`font-semibold text-indigo-400`}>{selectedJob.subject || "General"}</span>
                    </div>
                    <div>
                      Folder: <span className={`font-medium font-mono text-[10px] ${styles.textTitle}`}>{selectedJob.folderName}</span>
                    </div>
                    <div>
                      Mode: <span className={`font-medium ${styles.textTitle}`}>{selectedJob.promptType}</span>
                    </div>
                    <div>
                      Created At:{" "}
                      <span className={`font-medium ${styles.textTitle}`}>
                        {new Date(selectedJob.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Error Box if failed */}
                {selectedJob.status === "failed" && (
                  <div className="p-3 bg-rose-950/70 border border-rose-800/80 rounded-xl text-xs text-rose-200">
                    <div className="font-bold mb-1">❌ Execution Error:</div>
                    <p className="font-mono text-[11px] leading-relaxed">
                      {selectedJob.errorMessage || "Unknown error communicating with NotebookLM"}
                    </p>
                    <button
                      onClick={(e) => handleRetry(selectedJob.id, e)}
                      className="mt-2 text-xs bg-rose-900 hover:bg-rose-800 text-white font-bold px-3 py-1 rounded transition"
                    >
                      🔄 Retry Job
                    </button>
                  </div>
                )}

                {/* Prompt List — only shown when prompts have been tracked */}
                {selectedJob.prompts && selectedJob.prompts.length > 0 && (
                  <div className={`border rounded-xl overflow-hidden ${styles.bgSubCard}`}>
                    <div className={`px-3 py-2 border-b flex items-center justify-between ${styles.borderLine}`}>
                      <span className={`text-xs font-bold ${styles.textTitle}`}>
                        📋 Prompts ({selectedJob.prompts.length})
                      </span>
                      <span className={`text-[10px] ${styles.textMuted}`}>
                        {selectedJob.prompts.filter((p) => p.status === "completed").length} completed
                        {selectedJob.prompts.filter((p) => p.status === "failed").length > 0 &&
                          ` · ${selectedJob.prompts.filter((p) => p.status === "failed").length} failed`}
                      </span>
                    </div>
                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-800/50 p-1.5 space-y-1">
                      {[...selectedJob.prompts]
                        .sort((a, b) => a.index - b.index)
                        .map((p) => {
                          const isRetrying = retryingPrompts.has(`${selectedJob.id}:${p.index}`);
                          return (
                            <div
                              key={p.index}
                              className={`p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs transition-colors rounded-lg ${
                                p.status === "failed"
                                  ? isDark ? "bg-rose-950/30 border border-rose-800/40" : "bg-rose-50 border border-rose-200"
                                  : p.status === "sending"
                                  ? isDark ? "bg-amber-950/30 border border-amber-800/40" : "bg-amber-50 border border-amber-200"
                                  : isDark ? "bg-slate-900/40" : "bg-white"
                              }`}
                            >
                              {/* Left: Metadata details */}
                              <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-indigo-400">
                                    {p.subject || selectedJob.subject || "General"}
                                  </span>
                                  <span className={`font-mono text-[11px] font-semibold ${styles.textTitle}`}>
                                    Question: {p.qnumber ?? p.start}
                                  </span>
                                  <span className={`text-[10px] ${styles.textMuted}`}>
                                    Batch: {p.batch ?? selectedJob.batch}
                                  </span>
                                  <span className={`font-mono text-[10px] font-bold ${styles.textTitle}`}>
                                    Index: {p.index}
                                  </span>
                                  <span className={`font-mono text-[10px] ${styles.textMuted}`}>
                                    Start: {p.start} · End: {p.end}
                                  </span>
                                </div>
                                {p.responseFile && (
                                  <div className={`text-[10px] font-mono truncate ${styles.textMuted}`} title={p.responseFile}>
                                    📄 {p.responseFile}
                                  </div>
                                )}
                                {p.errorMessage && (
                                  <div className="text-[10px] text-rose-400 truncate" title={p.errorMessage}>
                                    ⚠ {p.errorMessage}
                                  </div>
                                )}
                              </div>

                              {/* Right: status + Resend button */}
                              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                <span
                                  className={`px-1.5 py-0.5 rounded font-bold text-[9px] uppercase ${
                                    p.status === "completed"
                                      ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                                      : p.status === "sending"
                                      ? "bg-amber-950 text-amber-300 border border-amber-800 animate-pulse"
                                      : p.status === "failed"
                                      ? "bg-rose-950 text-rose-300 border border-rose-800"
                                      : isDark
                                      ? "bg-slate-800 text-slate-400"
                                      : "bg-slate-200 text-slate-500"
                                  }`}
                                >
                                  {p.status}
                                </span>
                                {p.status === "failed" && (
                                  <button
                                    type="button"
                                    disabled={isRetrying}
                                    onClick={(e) => handleRetryPrompt(selectedJob.id, p.index, e)}
                                    className="px-2.5 py-1 bg-rose-900/90 hover:bg-rose-800 text-white rounded text-[10px] font-bold transition disabled:opacity-50 shadow-sm"
                                  >
                                    {isRetrying ? "…" : "Resend"}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Response Textbox */}
                <div className={`flex-1 border rounded-xl p-4 overflow-y-auto max-h-[400px] ${styles.bgSubCard}`}>
                  {selectedJob.responseContent ? (
                    <pre className={`text-xs font-mono whitespace-pre-wrap leading-relaxed ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                      {selectedJob.responseContent}
                    </pre>
                  ) : selectedJob.status === "processing" ? (
                    <div className={`h-full flex flex-col items-center justify-center text-xs py-8 space-y-2 ${styles.textMuted}`}>
                      <div className="h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                      <span>Receiving response from NotebookLM...</span>
                    </div>
                  ) : (
                    <div className={`h-full flex items-center justify-center text-xs py-8 italic ${styles.textMuted}`}>
                      No response recorded yet.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className={`flex-1 flex flex-col items-center justify-center text-xs py-16 space-y-2 ${styles.textMuted}`}>
                <span className="text-3xl mb-2">📋</span>
                <span className={`font-medium ${styles.textTitle}`}>No Execution Selected</span>
                <span>Submit a new prompt or select an execution record from history.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Execution History Section */}
      <section className={`border rounded-2xl p-6 ${styles.bgCard}`}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h2 className={`text-lg font-bold ${styles.textTitle}`}>Execution History</h2>
            <p className={`text-xs ${styles.textMuted}`}>Execution history, job status, and retrieved responses</p>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Search Input */}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, URL, or response text..."
              className={`rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500 w-full sm:w-56 ${styles.bgInput}`}
            />

            {/* Mode Filter */}
            <select
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value as "all" | "question" | "jozve")}
              className={`rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500 ${styles.bgInput}`}
            >
              <option value="all">All Modes</option>
              <option value="question">Question Mode</option>
              <option value="jozve">Jozve Mode</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | "completed" | "processing" | "queued" | "failed")}
              className={`rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500 ${styles.bgInput}`}
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="processing">Processing</option>
              <option value="queued">Queued</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        {/* History Table */}
        <div className={`overflow-x-auto rounded-xl border ${styles.borderLine}`}>
          <table className="w-full text-left text-xs">
            <thead className={`uppercase font-semibold border-b ${isDark ? "bg-slate-950 text-slate-400 border-slate-800" : "bg-slate-100 text-slate-600 border-slate-200"}`}>
              <tr>
                <th className="p-3">Prompt Title & Folder</th>
                <th className="p-3">Mode</th>
                <th className="p-3">Batches</th>
                <th className="p-3">Status</th>
                <th className="p-3">Created At</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${styles.borderLine}`}>
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className={`text-center py-12 italic ${styles.textMuted}`}>
                    {jobs.length === 0 ? "No prompts sent yet" : "No executions match your filters."}
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job) => {
                  const isSelected = selectedJob?.id === job.id;
                  return (
                    <tr
                      key={job.id}
                      onClick={() => setSelectedJob(job)}
                      className={`cursor-pointer transition-colors ${isSelected
                        ? isDark
                          ? "bg-indigo-950/40"
                          : "bg-indigo-50/80"
                        : isDark
                          ? "hover:bg-slate-800/40"
                          : "hover:bg-slate-100/80"
                        }`}
                    >
                      <td className={`p-3 font-bold ${styles.textTitle}`}>
                        <div>{job.promptTitle}</div>
                        <div className="flex items-center gap-2 text-[11px] font-normal mt-0.5">
                          <span className="text-indigo-400 font-semibold">{job.subject || "General"}</span>
                          <span className={styles.textMuted}>📁 {job.folderName}</span>
                        </div>
                        <div className={`text-[10px] truncate max-w-xs ${styles.textMuted}`}>{job.noteBookUrl}</div>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[10px] ${job.promptType === "question"
                            ? "bg-indigo-950 text-indigo-300 border border-indigo-800"
                            : "bg-purple-950 text-purple-300 border border-purple-800"
                            }`}
                        >
                          {job.promptType}
                        </span>
                      </td>
                      <td className={`p-3 font-mono ${styles.textMuted}`}>
                        {job.completedBatches} / {job.totalBatches}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase ${job.status === "completed"
                            ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                            : job.status === "processing"
                              ? "bg-amber-950 text-amber-300 border border-amber-800"
                              : job.status === "failed"
                                ? "bg-rose-950 text-rose-300 border border-rose-800"
                                : "bg-slate-800 text-slate-300"
                            }`}
                        >
                          {job.status}
                        </span>
                      </td>
                      <td className={`p-3 ${styles.textMuted}`}>
                        {new Date(job.createdAt).toLocaleString()}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex justify-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedJob(job);
                            }}
                            className={`px-2.5 py-1 rounded font-medium transition border ${isDark
                              ? "bg-slate-800 hover:bg-slate-700 text-white border-slate-700"
                              : "bg-slate-100 hover:bg-slate-200 text-slate-900 border-slate-300"
                              }`}
                          >
                            View Details
                          </button>
                          {job.status === "failed" && (
                            <button
                              type="button"
                              onClick={(e) => handleRetry(job.id, e)}
                              className="px-2.5 py-1 bg-rose-900/80 hover:bg-rose-800 text-white rounded font-medium transition"
                            >
                              Retry
                            </button>
                          )}
                          {job.status === "completed" && mergeStatus[job.id] !== "done" && (
                            <button
                              type="button"
                              onClick={(e) => handleMerge(job.id, e)}
                              disabled={mergeStatus[job.id] === "merging"}
                              className="px-2.5 py-1 bg-indigo-800/80 hover:bg-indigo-700 text-white rounded font-medium transition disabled:opacity-50"
                            >
                              {mergeStatus[job.id] === "merging" ? "Merging..." : mergeStatus[job.id] === "error" ? "⚠ Retry Merge" : "📄 Merge Responses"}
                            </button>
                          )}
                          {job.status === "completed" && mergeStatus[job.id] === "done" && (
                            <button
                              type="button"
                              onClick={(e) => handleDownloadMerged(job.id, e)}
                              className="px-2.5 py-1 bg-emerald-800/80 hover:bg-emerald-700 text-white rounded font-medium transition"
                            >
                              ⬇ Download Merged
                            </button>
                          )}
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}