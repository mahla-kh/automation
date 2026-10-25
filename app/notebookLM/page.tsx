"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { PROMPT_PRESETS, PromptPreset } from "@/server/prompts/notebookPrompts";
import { useLanguage } from "@/app/context/LanguageContext";
import LanguageSelector from "@/app/components/LanguageSelector";
import { getLocalizedPromptTitle, getLocalizedPromptPreview } from "@/app/i18n/translations";
import { downloadFile } from "@/app/lib/download";

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
  startpoint?: number;
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
  const { language, t, isRtl, dir } = useLanguage();

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
  const [questionsLength, setQuestionsLength] = useState<number | "">("");
  const [batch, setBatch] = useState<number>(20);
  const [startpoint, setStartpoint] = useState<number>(1);

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
      setSubmitError(t.notebookLM.errNotebookUrlRequired);
      return;
    }

    if (!subject.trim()) {
      setSubmitError(t.notebookLM.errSubjectRequired);
      return;
    }

    if (!folderName.trim()) {
      setSubmitError(t.notebookLM.errFolderRequired);
      return;
    }

    if (!selectedPreset) {
      setSubmitError(t.notebookLM.errPromptRequired);
      return;
    }

    if (mode === "jozve" && topics.length === 0) {
      setSubmitError(t.notebookLM.errTopicsRequired);
      return;
    }

    if (mode === "question") {
      if (questionsLength === "" || questionsLength === undefined || questionsLength === null) {
        setSubmitError(t.notebookLM.errQuestionsLengthRequired);
        return;
      }

      if (
        typeof questionsLength !== "number" ||
        isNaN(questionsLength) ||
        !Number.isInteger(questionsLength) ||
        questionsLength < 1
      ) {
        setSubmitError(t.notebookLM.errQuestionsLengthPositive);
        return;
      }

      if (!Number.isInteger(startpoint) || startpoint < 1) {
        setSubmitError(t.notebookLM.errStartpointPositive);
        return;
      }
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
        ...(mode === "question" ? { questionsLength: Number(questionsLength), batch, startpoint } : { topics }),
      };

      const res = await fetch("/api/notebook/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || t.notebookLM.errSubmitFailed);
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
      setSubmitError(err instanceof Error ? err.message : t.notebookLM.errSubmitFailed);
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
        alert(data.error || `${t.common.retry} ${t.common.failed}`);
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
        alert(data.error || `${t.notebookLM.promptResend} ${t.common.failed}`);
      } else {
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
        throw new Error(data.error || `${t.notebookLM.mergeResponses} ${t.common.failed}`);
      }
      setMergedContent((prev) => ({ ...prev, [jobId]: data.merged }));
      setMergeStatus((prev) => ({ ...prev, [jobId]: "done" }));
    } catch (err) {
      console.error("Merge failed:", err);
      setMergeStatus((prev) => ({ ...prev, [jobId]: "error" }));
    }
  };

  // Download merged text as a file (.txt or .md)
  const handleDownloadMerged = async (jobId: string, e?: React.MouseEvent, format: "txt" | "md" = "txt") => {
    if (e) e.stopPropagation();
    const content = mergedContent[jobId];
    if (!content) return;
    const res = await downloadFile({
      filename: `merged-${jobId.slice(0, 8)}.${format}`,
      content,
      format,
    });
    if (!res.success && res.error) {
      alert(res.error);
    }
  };

  // Download individual answer response for a job/prompt
  const handleDownloadIndividual = async (job: NoteBookJob, format: "txt" | "md" = "txt") => {
    if (!job || !job.responseContent) return;
    const titlePart = (job.promptTitle || job.id.slice(0, 8))
      .replace(/[\\/:*?"<>|]+/g, "_")
      .trim();
    const res = await downloadFile({
      filename: `answer-${titlePart}.${format}`,
      content: job.responseContent,
      format,
    });
    if (!res.success && res.error) {
      alert(res.error);
    }
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
        throw new Error(data.error || (language === "fa" ? "استخراج پاسخ‌ها از NotebookLM با خطا مواجه شد" : "Failed to extract answers from NotebookLM"));
      }

      setExtractedData({
        count: data.count,
        mergedText: data.mergedText,
        message: data.message,
      });
      setExtractStatus("completed");
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.notebookLM.errSubmitFailed;
      setExtractError(msg);
      setExtractStatus("failed");
    } finally {
      setIsExtracting(false);
    }
  };

  // Download standalone extracted responses as .txt or .md
  const handleDownloadExtracted = async (format: "txt" | "md" = "txt") => {
    if (!extractedData || !extractedData.mergedText) return;
    const res = await downloadFile({
      filename: `notebooklm-answers-${Date.now()}.${format}`,
      content: extractedData.mergedText,
      format,
    });
    if (!res.success && res.error) {
      alert(res.error);
    }
  };

  // Filtered jobs list
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const localizedTitle = getLocalizedPromptTitle(job.promptTitle, language);
      const matchesSearch =
        searchQuery.trim() === "" ||
        job.promptTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        localizedTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.noteBookUrl.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (job.responseContent && job.responseContent.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesMode = modeFilter === "all" || job.promptType === modeFilter;
      const matchesStatus = statusFilter === "all" || job.status === statusFilter;

      return matchesSearch && matchesMode && matchesStatus;
    });
  }, [jobs, searchQuery, modeFilter, statusFilter, language]);

  return (
    <div dir={dir} className={`min-h-screen p-4 md:p-8 font-sans transition-colors duration-200 ${styles.bgMain}`}>
      {/* Header Bar */}
      <header className={`mb-8 border-b pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${styles.borderLine}`}>
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/20 shrink-0">
              NB
            </div>
            <div>
              <h1 className={`text-2xl font-extrabold tracking-tight ${styles.textTitle}`}>
                {t.notebookLM.pageTitle}
              </h1>
              <p className={`text-sm ${styles.textMuted}`}>
                {t.notebookLM.pageDescription}
              </p>
            </div>
          </div>
        </div>

        {/* Right Header Area: Language Selector + Theme Switcher + Stats */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Language Selector */}
          <LanguageSelector isDark={isDark} />

          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            className={`px-3 py-2 rounded-lg border font-semibold text-xs transition-all flex items-center gap-2 shadow-sm ${
              isDark
                ? "bg-slate-900 border-slate-800 text-amber-300 hover:bg-slate-800 hover:text-amber-200"
                : "bg-white border-slate-300 text-slate-800 hover:bg-slate-100 shadow-slate-200"
            }`}
            title={t.common.toggleTheme}
          >
            <span>{isDark ? t.common.darkMode : t.common.lightMode}</span>
          </button>

          {/* Quick Stats Badges */}
          <div className="flex gap-2 text-xs font-medium">
            <div className={`px-3 py-2 border rounded-lg flex items-center gap-2 ${styles.badgeDefault}`}>
              <span className="h-2 w-2 rounded-full bg-slate-400"></span>
              {t.common.total}: <span className={`font-bold ${styles.textTitle}`}>{jobs.length}</span>
            </div>
            <div className={`px-3 py-2 border rounded-lg flex items-center gap-2 ${styles.badgeDefault}`}>
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              {t.common.processing}:{" "}
              <span className="font-bold text-emerald-500">
                {jobs.filter((j) => j.status === "processing" || j.status === "queued").length}
              </span>
            </div>
            <div className={`px-3 py-2 border rounded-lg flex items-center gap-2 ${styles.badgeDefault}`}>
              <span className="h-2 w-2 rounded-full bg-purple-400"></span>
              {t.common.completed}:{" "}
              <span className="font-bold text-purple-500">
                {jobs.filter((j) => j.status === "completed").length}
              </span>
            </div>
            <div className={`px-3 py-2 border rounded-lg flex items-center gap-2 ${styles.badgeDefault}`}>
              <span className="h-2 w-2 rounded-full bg-rose-400"></span>
              {t.common.failed}:{" "}
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
                {t.notebookLM.selectMode}
              </label>
              <div className={`grid grid-cols-2 gap-2 p-1.5 rounded-xl border ${styles.bgSubCard}`}>
                <button
                  type="button"
                  onClick={() => setMode("question")}
                  className={`py-3 px-4 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                    mode === "question"
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                      : `${styles.textMuted} hover:${styles.textTitle}`
                  }`}
                >
                  <span>{t.notebookLM.questionMode}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${isDark ? "bg-slate-900/50 text-indigo-200" : "bg-white/70 text-indigo-700 font-bold"}`}>
                    {t.notebookLM.questionModeTag}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("jozve")}
                  className={`py-3 px-4 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                    mode === "jozve"
                      ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                      : `${styles.textMuted} hover:${styles.textTitle}`
                  }`}
                >
                  <span>{t.notebookLM.jozveMode}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${isDark ? "bg-slate-900/50 text-purple-200" : "bg-white/70 text-purple-700 font-bold"}`}>
                    {t.notebookLM.jozveModeTag}
                  </span>
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Notebook URL Input */}
              <div>
                <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  {t.notebookLM.notebookUrl}
                </label>
                <input
                  type="url"
                  dir="ltr"
                  value={noteBookUrl}
                  onChange={(e) => setNoteBookUrl(e.target.value)}
                  placeholder={t.notebookLM.notebookUrlPlaceholder}
                  className={`w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition font-mono ${styles.bgInput}`}
                  required
                />
              </div>

              {/* Subject & Folder Name Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                    {t.notebookLM.subject}
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder={t.notebookLM.subjectPlaceholder}
                    className={`w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition ${styles.bgInput}`}
                    required
                  />
                </div>
                <div>
                  <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                    {t.notebookLM.responseFolder}
                  </label>
                  <input
                    type="text"
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    placeholder={t.notebookLM.responseFolderPlaceholder}
                    className={`w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition ${styles.bgInput}`}
                    required
                  />
                </div>
              </div>

              {/* Prompt Selection Presets */}
              <div>
                <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  {t.notebookLM.selectPromptPreset}
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                  {availablePresets.map((preset) => {
                    const isSelected = selectedPresetId === preset.id;
                    const localizedTitle = getLocalizedPromptTitle(preset.id, language);
                    const localizedPreview = getLocalizedPromptPreview(preset.id, language, preset.preview);

                    return (
                      <div
                        key={preset.id}
                        onClick={() => handlePresetSelect(preset)}
                        className={`cursor-pointer p-4 rounded-xl border ${isRtl ? "text-right" : "text-left"} transition-all flex flex-col justify-between ${
                          isSelected
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
                              className={`text-xs font-bold px-2 py-0.5 rounded ${
                                isSelected
                                  ? "bg-indigo-600 text-white"
                                  : isDark
                                  ? "bg-slate-800 text-slate-400"
                                  : "bg-slate-200 text-slate-700"
                              }`}
                            >
                              {preset.type === "question" ? t.notebookLM.questionModeTag : t.notebookLM.jozveModeTag}
                            </span>
                            <span
                              className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                                isSelected ? "border-indigo-500 bg-indigo-500" : "border-slate-400"
                              }`}
                            >
                              {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white"></span>}
                            </span>
                          </div>
                          <h3 className={`font-bold text-sm mb-1 ${styles.textTitle}`}>{localizedTitle}</h3>
                          <p className={`text-xs line-clamp-2 ${styles.textMuted}`}>{localizedPreview}</p>
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
                        {t.notebookLM.customizePrompt}
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const p = PROMPT_PRESETS.find((x) => x.id === selectedPresetId);
                          if (p) setCustomPromptText(p.template);
                        }}
                        className="text-xs text-indigo-500 hover:underline"
                      >
                        {t.notebookLM.resetPrompt}
                      </button>
                    </div>
                    <textarea
                      dir="ltr"
                      value={customPromptText}
                      onChange={(e) => setCustomPromptText(e.target.value)}
                      rows={5}
                      className={`w-full rounded-xl p-3 text-xs font-mono text-left focus:outline-none focus:ring-1 focus:ring-indigo-500 ${styles.bgInput}`}
                    />
                  </div>
                )}
              </div>

              {/* Mode Specific Inputs */}
              {mode === "question" ? (
                <div className={`p-4 border rounded-xl space-y-4 ${styles.bgSubCard}`}>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-500">
                    {t.notebookLM.questionModeParams}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className={`block text-xs font-medium mb-1 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                        {t.notebookLM.totalQuestionsLength}
                      </label>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={questionsLength}
                        onChange={(e) => {
                          const val = e.target.value;
                          setQuestionsLength(val === "" ? "" : Number(val));
                        }}
                        className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 ${styles.bgInput}`}
                      />
                    </div>
                    <div>
                      <label className={`block text-xs font-medium mb-1 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                        {t.notebookLM.batchSize}
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={batch}
                        onChange={(e) => setBatch(Number(e.target.value))}
                        className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 ${styles.bgInput}`}
                      />
                    </div>
                    <div>
                      <label className={`block text-xs font-medium mb-1 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                        {t.notebookLM.startPoint}
                      </label>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={startpoint}
                        onChange={(e) => setStartpoint(Number(e.target.value))}
                        className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 ${styles.bgInput}`}
                      />
                    </div>
                  </div>
                  <p className={`text-xs ${styles.textMuted}`}>
                    {t.notebookLM.totalBatches}{" "}
                    <span className={`font-bold ${styles.textTitle}`}>
                      {typeof questionsLength === "number" && Number.isInteger(questionsLength) && questionsLength > 0
                        ? Math.max(1, Math.ceil(questionsLength / Math.max(1, batch)))
                        : "-"} {t.notebookLM.batchesUnit}
                    </span>
                  </p>
                  <p className={`text-xs ${styles.textMuted}`}>
                    {t.notebookLM.questionsRange
                      .replace("{start}", String(startpoint))
                      .replace(
                        "{end}",
                        typeof questionsLength === "number" && Number.isInteger(questionsLength) && questionsLength > 0
                          ? String(startpoint + questionsLength - 1)
                          : "-"
                      )}
                  </p>
                </div>
              ) : (
                <div className={`p-4 border rounded-xl space-y-4 ${styles.bgSubCard}`}>
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-purple-500">
                      {t.notebookLM.jozveModeParams}
                    </h4>
                    <span className={`text-xs ${styles.textMuted}`}>
                      {t.notebookLM.topicsCount} <span className={`font-bold ${styles.textTitle}`}>{topics.length}</span>
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
                      placeholder={t.notebookLM.newTopicPlaceholder}
                      className={`flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500 ${styles.bgInput}`}
                    />
                    <button
                      type="button"
                      onClick={handleAddTopic}
                      className="bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs px-4 py-2 rounded-lg transition"
                    >
                      {t.notebookLM.addTopic}
                    </button>
                  </div>

                  {/* Topics Tags List */}
                  <div className={`flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 rounded-lg border ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"}`}>
                    {topics.length === 0 ? (
                      <span className={`text-xs italic p-1 ${styles.textMuted}`}>
                        {t.notebookLM.noTopics}
                      </span>
                    ) : (
                      topics.map((topic, idx) => (
                        <span
                          key={idx}
                          className={`inline-flex items-center gap-1.5 border text-xs px-3 py-1.5 rounded-md ${
                            isDark
                              ? "bg-purple-950/80 border-purple-800/50 text-purple-200"
                              : "bg-purple-50 border-purple-200 text-purple-800 font-medium"
                          }`}
                        >
                          <span>{topic}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveTopic(idx)}
                            className="text-purple-500 hover:text-rose-500 font-bold mx-1"
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
                className={`w-full py-3.5 px-6 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg ${
                  isSubmitting || !selectedPresetId
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
                    <span>{t.notebookLM.submittingRequest}</span>
                  </>
                ) : (
                  <>
                    <span>{t.notebookLM.startExecution}</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Standalone Answer Extraction Card */}
          <div className={`border rounded-2xl p-6 ${styles.bgCard}`}>
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-800/60">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-emerald-600/20 shrink-0">
                📥
              </div>
              <div>
                <h2 className={`text-base font-bold tracking-tight ${styles.textTitle}`}>
                  {t.notebookLM.extractCardTitle}
                </h2>
                <p className={`text-xs ${styles.textMuted}`}>
                  {t.notebookLM.extractCardDescription}
                </p>
              </div>
            </div>

            <form onSubmit={handleExtractAnswers} className="space-y-4">
              <div>
                <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  {t.notebookLM.notebookUrl}
                </label>
                <input
                  type="url"
                  dir="ltr"
                  value={extractUrl}
                  onChange={(e) => setExtractUrl(e.target.value)}
                  placeholder={t.notebookLM.extractUrlPlaceholder}
                  className={`w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 transition font-mono ${styles.bgInput}`}
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
                      <span className="text-emerald-400 font-bold">✓ {t.common.status}:</span>
                      <span className="text-emerald-200 font-medium">{t.notebookLM.extractStatusCompleted}</span>
                    </div>
                    <div className="text-emerald-300 font-mono">
                      {t.notebookLM.responsesExtracted} <span className="font-bold text-white">{extractedData.count}</span>
                    </div>
                  </div>

                  {extractedData.count > 0 ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleDownloadExtracted("txt")}
                        className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/30 text-xs"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        <span>{t.notebookLM.downloadAnswersTxt} (.txt)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadExtracted("md")}
                        className="py-2 px-3 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-1 shadow-md shadow-teal-600/30 text-xs"
                        title="Download Markdown (.md)"
                      >
                        <span>.md</span>
                      </button>
                    </div>
                  ) : (
                    <p className="text-amber-300 italic text-[11px]">
                      {t.notebookLM.noResponsesFound}
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
                    <span>{t.notebookLM.extractingBtn}</span>
                  </>
                ) : (
                  <>
                    <span>{t.notebookLM.extractBtn}</span>
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
                <span>{t.notebookLM.activeOutputTitle}</span>
              </h2>
              {selectedJob?.responseContent && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleCopyResponse(selectedJob.responseContent || "")}
                    className={`text-xs px-2.5 py-1 rounded-md transition flex items-center gap-1 border ${
                      isDark
                        ? "bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200"
                        : "bg-slate-100 border-slate-300 hover:bg-slate-200 text-slate-800"
                    }`}
                  >
                    {copiedResponse ? t.common.copied : t.notebookLM.copyResponse}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadIndividual(selectedJob, "txt")}
                    className={`text-xs px-2.5 py-1 rounded-md transition flex items-center gap-1 border ${
                      isDark
                        ? "bg-indigo-900/60 border-indigo-700 hover:bg-indigo-800 text-indigo-200"
                        : "bg-indigo-50 border-indigo-200 hover:bg-indigo-100 text-indigo-800"
                    }`}
                    title={language === "fa" ? "دانلود پاسخ (.txt)" : "Download Answer (.txt)"}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>.txt</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadIndividual(selectedJob, "md")}
                    className={`text-xs px-2.5 py-1 rounded-md transition flex items-center gap-1 border ${
                      isDark
                        ? "bg-teal-900/60 border-teal-700 hover:bg-teal-800 text-teal-200"
                        : "bg-teal-50 border-teal-200 hover:bg-teal-100 text-teal-800"
                    }`}
                    title={language === "fa" ? "دانلود پاسخ (.md)" : "Download Answer (.md)"}
                  >
                    <span>.md</span>
                  </button>
                </div>
              )}
            </div>

            {selectedJob ? (
              <div className="flex-1 flex flex-col space-y-4">
                {/* Status Header */}
                <div className={`p-3 rounded-xl border space-y-2 ${styles.bgSubCard}`}>
                  <div className="flex items-center justify-between text-xs">
                    <span className={`font-bold ${styles.textTitle}`}>
                      {getLocalizedPromptTitle(selectedJob.promptTitle, language)}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                        selectedJob.status === "completed"
                          ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                          : selectedJob.status === "processing"
                          ? "bg-amber-950 text-amber-300 border border-amber-800 animate-pulse"
                          : selectedJob.status === "failed"
                          ? "bg-rose-950 text-rose-300 border border-rose-800"
                          : "bg-slate-800 text-slate-300"
                      }`}
                    >
                      {selectedJob.status === "completed"
                        ? t.common.completed
                        : selectedJob.status === "processing"
                        ? t.common.processing
                        : selectedJob.status === "failed"
                        ? t.common.failed
                        : t.common.queued}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div>
                    <div className={`flex justify-between text-[11px] mb-1 ${styles.textMuted}`}>
                      <span>{t.notebookLM.batchProgress}</span>
                      <span dir="ltr">
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
                      {t.notebookLM.metadataSubject}{" "}
                      <span className={`font-semibold text-indigo-400`}>{selectedJob.subject || "General"}</span>
                    </div>
                    <div>
                      {t.notebookLM.metadataFolder}{" "}
                      <span className={`font-medium font-mono text-[10px] ${styles.textTitle}`}>{selectedJob.folderName}</span>
                    </div>
                    <div>
                      {t.notebookLM.metadataMode}{" "}
                      <span className={`font-medium ${styles.textTitle}`}>
                        {selectedJob.promptType === "question" ? t.notebookLM.questionModeTag : t.notebookLM.jozveModeTag}
                      </span>
                    </div>
                    <div>
                      {t.notebookLM.metadataCreatedAt}{" "}
                      <span className={`font-medium ${styles.textTitle}`}>
                        {new Date(selectedJob.createdAt).toLocaleTimeString(language === "fa" ? "fa-IR" : "en-US")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Error Box if failed */}
                {selectedJob.status === "failed" && (
                  <div className="p-3 bg-rose-950/70 border border-rose-800/80 rounded-xl text-xs text-rose-200">
                    <div className="font-bold mb-1">{t.notebookLM.executionError}</div>
                    <p className="font-mono text-[11px] leading-relaxed" dir="ltr">
                      {selectedJob.errorMessage || (language === "fa" ? "خطای ناشناخته در ارتباط با NotebookLM" : "Unknown error communicating with NotebookLM")}
                    </p>
                    <button
                      onClick={(e) => handleRetry(selectedJob.id, e)}
                      className="mt-2 text-xs bg-rose-900 hover:bg-rose-800 text-white font-bold px-3 py-1 rounded transition"
                    >
                      {t.notebookLM.retryJob}
                    </button>
                  </div>
                )}

                {/* Prompt List — only shown when prompts have been tracked */}
                {selectedJob.prompts && selectedJob.prompts.length > 0 && (
                  <div className={`border rounded-xl overflow-hidden ${styles.bgSubCard}`}>
                    <div className={`px-3 py-2 border-b flex items-center justify-between ${styles.borderLine}`}>
                      <span className={`text-xs font-bold ${styles.textTitle}`}>
                        {t.notebookLM.promptsList} ({selectedJob.prompts.length})
                      </span>
                      <span className={`text-[10px] ${styles.textMuted}`}>
                        {selectedJob.prompts.filter((p) => p.status === "completed").length} {t.notebookLM.promptsCompleted}
                        {selectedJob.prompts.filter((p) => p.status === "failed").length > 0 &&
                          ` · ${selectedJob.prompts.filter((p) => p.status === "failed").length} ${t.notebookLM.promptsFailed}`}
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
                              {/* Metadata details */}
                              <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-indigo-400">
                                    {p.subject || selectedJob.subject || "General"}
                                  </span>
                                  <span className={`font-mono text-[11px] font-semibold ${styles.textTitle}`}>
                                    {t.notebookLM.promptQuestion} {p.qnumber ?? p.start}
                                  </span>
                                  <span className={`text-[10px] ${styles.textMuted}`}>
                                    {t.notebookLM.promptBatch} {p.batch ?? selectedJob.batch}
                                  </span>
                                  <span className={`font-mono text-[10px] font-bold ${styles.textTitle}`}>
                                    {t.notebookLM.promptIndex} {p.index}
                                  </span>
                                  <span className={`font-mono text-[10px] ${styles.textMuted}`}>
                                    {t.notebookLM.promptStart} {p.start} · {t.notebookLM.promptEnd} {p.end}
                                  </span>
                                </div>
                                {p.responseFile && (
                                  <div className={`text-[10px] font-mono truncate ${styles.textMuted}`} dir="ltr" title={p.responseFile}>
                                    📄 {p.responseFile}
                                  </div>
                                )}
                                {p.errorMessage && (
                                  <div className="text-[10px] text-rose-400 truncate" dir="ltr" title={p.errorMessage}>
                                    ⚠ {p.errorMessage}
                                  </div>
                                )}
                              </div>

                              {/* Status + Resend button */}
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
                                  {p.status === "completed"
                                    ? t.common.completed
                                    : p.status === "sending"
                                    ? t.common.processing
                                    : p.status === "failed"
                                    ? t.common.failed
                                    : t.common.pending}
                                </span>
                                {p.status === "failed" && (
                                  <button
                                    type="button"
                                    disabled={isRetrying}
                                    onClick={(e) => handleRetryPrompt(selectedJob.id, p.index, e)}
                                    className="px-2.5 py-1 bg-rose-900/90 hover:bg-rose-800 text-white rounded text-[10px] font-bold transition disabled:opacity-50 shadow-sm"
                                  >
                                    {isRetrying ? "…" : t.notebookLM.promptResend}
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
                    <pre
                      dir="ltr"
                      className={`text-xs font-mono text-left whitespace-pre-wrap leading-relaxed ${
                        isDark ? "text-slate-200" : "text-slate-800"
                      }`}
                    >
                      {selectedJob.responseContent}
                    </pre>
                  ) : selectedJob.status === "processing" ? (
                    <div className={`h-full flex flex-col items-center justify-center text-xs py-8 space-y-2 ${styles.textMuted}`}>
                      <div className="h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                      <span>{t.notebookLM.receivingResponse}</span>
                    </div>
                  ) : (
                    <div className={`h-full flex items-center justify-center text-xs py-8 italic ${styles.textMuted}`}>
                      {t.notebookLM.noResponseRecorded}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className={`flex-1 flex flex-col items-center justify-center text-xs py-16 space-y-2 ${styles.textMuted}`}>
                <span className="text-3xl mb-2">📋</span>
                <span className={`font-medium ${styles.textTitle}`}>{t.notebookLM.noExecutionSelected}</span>
                <span>{t.notebookLM.selectPromptOrHistory}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Execution History Section */}
      <section className={`border rounded-2xl p-6 ${styles.bgCard}`}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h2 className={`text-lg font-bold ${styles.textTitle}`}>{t.notebookLM.executionHistory}</h2>
            <p className={`text-xs ${styles.textMuted}`}>{t.notebookLM.executionHistorySubtitle}</p>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Search Input */}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.notebookLM.searchHistoryPlaceholder}
              className={`rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500 w-full sm:w-56 ${styles.bgInput}`}
            />

            {/* Mode Filter */}
            <select
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value as "all" | "question" | "jozve")}
              className={`rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500 ${styles.bgInput}`}
            >
              <option value="all">{t.notebookLM.filterAllModes}</option>
              <option value="question">{t.notebookLM.filterQuestionMode}</option>
              <option value="jozve">{t.notebookLM.filterJozveMode}</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | "completed" | "processing" | "queued" | "failed")}
              className={`rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500 ${styles.bgInput}`}
            >
              <option value="all">{t.notebookLM.filterAllStatuses}</option>
              <option value="completed">{t.common.completed}</option>
              <option value="processing">{t.common.processing}</option>
              <option value="queued">{t.common.queued}</option>
              <option value="failed">{t.common.failed}</option>
            </select>
          </div>
        </div>

        {/* History Table */}
        <div className={`overflow-x-auto rounded-xl border ${styles.borderLine}`}>
          <table className={`w-full text-xs ${isRtl ? "text-right" : "text-left"}`}>
            <thead className={`uppercase font-semibold border-b ${isDark ? "bg-slate-950 text-slate-400 border-slate-800" : "bg-slate-100 text-slate-600 border-slate-200"}`}>
              <tr>
                <th className="p-3">{t.notebookLM.thPromptAndFolder}</th>
                <th className="p-3">{t.notebookLM.thMode}</th>
                <th className="p-3">{t.notebookLM.thBatches}</th>
                <th className="p-3">{t.notebookLM.thStatus}</th>
                <th className="p-3">{t.notebookLM.thCreatedAt}</th>
                <th className="p-3 text-center">{t.notebookLM.thActions}</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${styles.borderLine}`}>
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className={`text-center py-12 italic ${styles.textMuted}`}>
                    {jobs.length === 0 ? t.notebookLM.noPromptsSent : t.notebookLM.noMatchingExecutions}
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job) => {
                  const isSelected = selectedJob?.id === job.id;
                  const localizedTitle = getLocalizedPromptTitle(job.promptTitle, language);

                  return (
                    <tr
                      key={job.id}
                      onClick={() => setSelectedJob(job)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? isDark
                            ? "bg-indigo-950/40"
                            : "bg-indigo-50/80"
                          : isDark
                          ? "hover:bg-slate-800/40"
                          : "hover:bg-slate-100/80"
                      }`}
                    >
                      <td className={`p-3 font-bold ${styles.textTitle}`}>
                        <div>{localizedTitle}</div>
                        <div className="flex items-center gap-2 text-[11px] font-normal mt-0.5">
                          <span className="text-indigo-400 font-semibold">{job.subject || "General"}</span>
                          <span className={styles.textMuted}>📁 {job.folderName}</span>
                        </div>
                        <div className={`text-[10px] truncate max-w-xs ${styles.textMuted}`} dir="ltr">{job.noteBookUrl}</div>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            job.promptType === "question"
                              ? "bg-indigo-950 text-indigo-300 border border-indigo-800"
                              : "bg-purple-950 text-purple-300 border border-purple-800"
                          }`}
                        >
                          {job.promptType === "question" ? t.notebookLM.questionModeTag : t.notebookLM.jozveModeTag}
                        </span>
                      </td>
                      <td className={`p-3 font-mono ${styles.textMuted}`} dir="ltr">
                        {job.completedBatches} / {job.totalBatches}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase ${
                            job.status === "completed"
                              ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                              : job.status === "processing"
                              ? "bg-amber-950 text-amber-300 border border-amber-800"
                              : job.status === "failed"
                              ? "bg-rose-950 text-rose-300 border border-rose-800"
                              : "bg-slate-800 text-slate-300"
                          }`}
                        >
                          {job.status === "completed"
                            ? t.common.completed
                            : job.status === "processing"
                            ? t.common.processing
                            : job.status === "failed"
                            ? t.common.failed
                            : t.common.queued}
                        </span>
                      </td>
                      <td className={`p-3 ${styles.textMuted}`}>
                        {new Date(job.createdAt).toLocaleString(language === "fa" ? "fa-IR" : "en-US")}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex justify-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedJob(job);
                            }}
                            className={`px-2.5 py-1 rounded font-medium transition border ${
                              isDark
                                ? "bg-slate-800 hover:bg-slate-700 text-white border-slate-700"
                                : "bg-slate-100 hover:bg-slate-200 text-slate-900 border-slate-300"
                            }`}
                          >
                            {t.common.viewDetails}
                          </button>
                          {job.status === "failed" && (
                            <button
                              type="button"
                              onClick={(e) => handleRetry(job.id, e)}
                              className="px-2.5 py-1 bg-rose-900/80 hover:bg-rose-800 text-white rounded font-medium transition"
                            >
                              {t.common.retry}
                            </button>
                          )}
                          {job.status === "completed" && mergeStatus[job.id] !== "done" && (
                            <button
                              type="button"
                              onClick={(e) => handleMerge(job.id, e)}
                              disabled={mergeStatus[job.id] === "merging"}
                              className="px-2.5 py-1 bg-indigo-800/80 hover:bg-indigo-700 text-white rounded font-medium transition disabled:opacity-50"
                            >
                              {mergeStatus[job.id] === "merging"
                                ? t.notebookLM.mergingResponses
                                : mergeStatus[job.id] === "error"
                                ? t.notebookLM.retryMerge
                                : t.notebookLM.mergeResponses}
                            </button>
                          )}
                          {job.status === "completed" && mergeStatus[job.id] === "done" && (
                            <div className="inline-flex rounded-md shadow-sm">
                              <button
                                type="button"
                                onClick={(e) => handleDownloadMerged(job.id, e, "txt")}
                                className="px-2.5 py-1 bg-emerald-800/80 hover:bg-emerald-700 text-white rounded-s font-medium transition text-xs"
                                title="Download merged .txt"
                              >
                                {t.notebookLM.downloadMerged} (.txt)
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleDownloadMerged(job.id, e, "md")}
                                className="px-2 py-1 bg-teal-800/80 hover:bg-teal-700 text-white rounded-e font-medium transition text-xs border-s border-teal-900"
                                title="Download merged .md"
                              >
                                .md
                              </button>
                            </div>
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