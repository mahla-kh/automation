"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/app/context/LanguageContext";
import LanguageSelector from "@/app/components/LanguageSelector";
import DeleteProcessModal from "@/app/components/DeleteProcessModal";
import { WorkflowProcess, ProcessType } from "@/app/types/workflow";
import { AuthGuard } from "@/app/components/AuthGuard";
import { UserNav } from "@/app/components/UserNav";

export default function WorkspaceHomePage() {
  const router = useRouter();
  const { t, isRtl } = useLanguage();

  // Theme State
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

  // Process Creation Form State
  const [processType, setProcessType] = useState<ProcessType>("detailed_answer");
  const [processName, setProcessName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Processes List State
  const [incompleteProcesses, setIncompleteProcesses] = useState<WorkflowProcess[]>([]);
  const [completedProcesses, setCompletedProcesses] = useState<WorkflowProcess[]>([]);
  const [isLoadingProcesses, setIsLoadingProcesses] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  // Deletion Modal State
  const [processToDelete, setProcessToDelete] = useState<WorkflowProcess | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch Processes from Laravel API
  const fetchProcesses = useCallback(async () => {
    setIsLoadingProcesses(true);
    setListError(null);
    try {
      const res = await fetch("/api/processes");
      if (!res.ok) {
        throw new Error(`Failed to load processes (HTTP ${res.status})`);
      }
      const data = await res.json();
      setIncompleteProcesses(data.incomplete || []);
      setCompletedProcesses(data.completed || []);
    } catch (err: any) {
      console.error("Error fetching processes:", err);
      setListError(err.message || t.common.unknownError);
    } finally {
      setIsLoadingProcesses(false);
    }
  }, [t.common.unknownError]);

  useEffect(() => {
    fetchProcesses();
  }, [fetchProcesses]);

  // Name Validation
  const trimmedName = useMemo(() => processName.trim(), [processName]);
  const isNameValid = trimmedName.length >= 2;
  const showNameError = nameTouched && !isNameValid;

  // Handle Create Process
  const handleCreateProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameTouched(true);
    if (!isNameValid || isSubmitting) return;

    setIsSubmitting(true);
    setCreateError(null);

    try {
      const res = await fetch("/api/processes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          type: processType,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create process");
      }

      // Navigate to Process Detail page
      router.push(`/process?id=${data.id}`);
    } catch (err: any) {
      console.error("Process creation error:", err);
      setCreateError(err.message || "Failed to create process.");
      setIsSubmitting(false);
    }
  };

  // Handle Delete Confirmation
  const handleConfirmDelete = async () => {
    if (!processToDelete) return;
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/processes/${processToDelete.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete process");
      }

      setProcessToDelete(null);
      await fetchProcesses();
    } catch (err: any) {
      alert(`Error deleting process: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("fa-IR", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <AuthGuard>
      <div className={`min-h-screen ${isDark ? "bg-[#1A2634] text-[#F5F5F5]" : "bg-[#F5F5F5] text-[#364F6B]"} transition-colors`}>
      {/* Top Header */}
      <header className={`sticky top-0 z-40 border-b backdrop-blur-md transition-colors ${
        isDark ? "bg-[#243447]/90 border-[#364F6B]" : "bg-white/90 border-[#364F6B]/15 shadow-sm"
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#FC5185] to-[#3FC1C9] flex items-center justify-center text-white font-black text-lg shadow-md shadow-[#FC5185]/25">
              W
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`font-extrabold text-base md:text-lg tracking-tight ${isDark ? "text-[#F5F5F5]" : "text-[#364F6B]"}`}>WePass</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#FC5185]/15 text-[#FC5185] border border-[#FC5185]/25">
                  اتوماسیون
                </span>
              </div>
              <p className={`text-[11px] ${isDark ? "text-[#F5F5F5]/60" : "text-[#364F6B]/60"}`}>سامانه مدیریت جریان‌های هوشمند</p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <Link
              href="/pipeline"
              className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                isDark ? "bg-[#1A2634] hover:bg-[#364F6B]/50 text-[#F5F5F5] border-[#364F6B]" : "bg-[#F5F5F5] hover:bg-[#EBEBEB] text-[#364F6B] border-[#364F6B]/20"
              }`}
            >
              <span>{t.workflow.pipelineTool}</span>
            </Link>

            <Link
              href="/tohtml"
              className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                isDark ? "bg-[#1A2634] hover:bg-[#364F6B]/50 text-[#F5F5F5] border-[#364F6B]" : "bg-[#F5F5F5] hover:bg-[#EBEBEB] text-[#364F6B] border-[#364F6B]/20"
              }`}
            >
              <span>{t.workflow.tohtmlTool}</span>
            </Link>

            <button
              onClick={toggleTheme}
              className={`p-2 rounded-xl text-xs border transition-colors ${
                isDark ? "bg-[#1A2634] hover:bg-[#364F6B]/50 text-[#F5F5F5] border-[#364F6B]" : "bg-[#F5F5F5] hover:bg-[#EBEBEB] text-[#364F6B] border-[#364F6B]/20"
              }`}
              title={t.common.toggleTheme}
            >
              {isDark ? "☀️" : "🌙"}
            </button>

            <LanguageSelector />
            <UserNav />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        {/* Workspace Title Hero */}
        <div className="text-center max-w-3xl mx-auto space-y-2">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight bg-gradient-to-r from-[#FC5185] via-[#3FC1C9] to-[#FC5185] bg-clip-text text-transparent">
            {t.workflow.workspaceTitle}
          </h1>
          <p className={`text-xs sm:text-sm md:text-base leading-relaxed ${isDark ? "text-[#F5F5F5]/70" : "text-[#364F6B]/75"}`}>
            {t.workflow.workspaceSubtitle}
          </p>
        </div>

        {/* Section 1: Process Creation Area */}
        <section
          className={`rounded-3xl border p-6 sm:p-8 transition-colors ${
            isDark ? "bg-[#243447] border-[#364F6B] shadow-2xl shadow-black/20" : "bg-white border-[#364F6B]/15 shadow-sm"
          }`}
        >
          <div className="flex items-center gap-2 mb-6">
            <span className="w-2.5 h-6 rounded-full bg-[#FC5185]"></span>
            <h2 className="text-lg md:text-xl font-bold tracking-tight">
              {t.workflow.createProcess}
            </h2>
          </div>

          <form onSubmit={handleCreateProcess} className="space-y-6">
            {/* A. Process Type Selector (Radio Group) */}
            <div>
              <label className={`block text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? "text-[#F5F5F5]/70" : "text-[#364F6B]/70"}`}>
                {t.workflow.processTypeLabel}
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Option 1: Detailed Answer Generation */}
                <label
                  className={`relative flex items-start gap-4 p-5 rounded-2xl border cursor-pointer transition-all ${
                    processType === "detailed_answer"
                      ? isDark
                        ? "bg-[#FC5185]/15 border-[#FC5185] ring-2 ring-[#FC5185]/25 shadow-lg shadow-[#FC5185]/10"
                        : "bg-[#FC5185]/10 border-[#FC5185] ring-2 ring-[#FC5185]/20 shadow-sm"
                      : isDark
                      ? "bg-[#1A2634]/60 border-[#364F6B] hover:border-[#3FC1C9]/40"
                      : "bg-[#F5F5F5] border-[#364F6B]/20 hover:border-[#3FC1C9]/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="process_type"
                    value="detailed_answer"
                    checked={processType === "detailed_answer"}
                    onChange={() => setProcessType("detailed_answer")}
                    className="mt-1 w-4 h-4 text-[#FC5185] focus:ring-[#FC5185]"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-bold text-sm md:text-base ${processType === "detailed_answer" ? (isDark ? "text-[#FC5185] font-extrabold" : "text-[#D9366A] font-extrabold") : isDark ? "text-[#F5F5F5]" : "text-[#364F6B]"}`}>
                        {t.workflow.detailedAnswerTitle}
                      </span>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#FC5185]/15 text-[#FC5185] border border-[#FC5185]/25">
                        ۱۲ مرحله
                      </span>
                    </div>
                    <p className={`text-xs leading-relaxed ${isDark ? "text-[#F5F5F5]/70" : "text-[#364F6B]/75"}`}>
                      {t.workflow.detailedAnswerDesc}
                    </p>
                  </div>
                </label>

                {/* Option 2: Summary Generation */}
                <label
                  className={`relative flex items-start gap-4 p-5 rounded-2xl border cursor-pointer transition-all ${
                    processType === "summary"
                      ? isDark
                        ? "bg-[#FC5185]/15 border-[#FC5185] ring-2 ring-[#FC5185]/25 shadow-lg shadow-[#FC5185]/10"
                        : "bg-[#FC5185]/10 border-[#FC5185] ring-2 ring-[#FC5185]/20 shadow-sm"
                      : isDark
                      ? "bg-[#1A2634]/60 border-[#364F6B] hover:border-[#3FC1C9]/40"
                      : "bg-[#F5F5F5] border-[#364F6B]/20 hover:border-[#3FC1C9]/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="process_type"
                    value="summary"
                    checked={processType === "summary"}
                    onChange={() => setProcessType("summary")}
                    className="mt-1 w-4 h-4 text-[#FC5185] focus:ring-[#FC5185]"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-bold text-sm md:text-base ${processType === "summary" ? (isDark ? "text-[#FC5185] font-extrabold" : "text-[#D9366A] font-extrabold") : isDark ? "text-[#F5F5F5]" : "text-[#364F6B]"}`}>
                        {t.workflow.summaryTitle}
                      </span>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#3FC1C9]/15 text-[#166E74] dark:text-[#3FC1C9] border border-[#3FC1C9]/25">
                        ۷ مرحله
                      </span>
                    </div>
                    <p className={`text-xs leading-relaxed ${isDark ? "text-[#F5F5F5]/70" : "text-[#364F6B]/75"}`}>
                      {t.workflow.summaryDesc}
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* B. Process Name Input */}
            <div>
              <label htmlFor="process_name_input" className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${isDark ? "text-[#F5F5F5]/70" : "text-[#364F6B]/70"}`}>
                {t.workflow.processNameLabel} <span className="text-rose-500">*</span>
              </label>
              <input
                id="process_name_input"
                type="text"
                value={processName}
                onChange={(e) => {
                  setProcessName(e.target.value);
                  if (!nameTouched) setNameTouched(true);
                }}
                onBlur={() => setNameTouched(true)}
                placeholder={t.workflow.processNamePlaceholder}
                disabled={isSubmitting}
                className={`w-full px-4 py-3 rounded-2xl text-sm md:text-base border transition-all focus:outline-none focus:ring-2 focus:ring-[#FC5185] ${
                  showNameError
                    ? "border-rose-500 focus:ring-rose-500 bg-rose-50/10"
                    : isDark
                    ? "bg-[#1A2634] border-[#364F6B] text-[#F5F5F5] placeholder-slate-500"
                    : "bg-white border-[#364F6B]/30 text-[#364F6B] placeholder-slate-400"
                }`}
              />
              {showNameError && (
                <p className="mt-1.5 text-xs text-rose-500 flex items-center gap-1">
                  <span>{t.workflow.processNameRequired}</span>
                </p>
              )}
            </div>

            {/* Error Message */}
            {createError && (
              <div className="p-3.5 rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-400 text-xs flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{createError}</span>
              </div>
            )}

            {/* C. Continue Button */}
            <div className="flex items-center justify-end pt-2">
              <button
                type="submit"
                disabled={!isNameValid || isSubmitting}
                className={`px-8 py-3.5 rounded-2xl text-sm md:text-base font-bold text-white shadow-lg shadow-[#FC5185]/25 transition-all flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#FC5185] focus:ring-offset-2 ${
                  !isNameValid || isSubmitting
                    ? "bg-slate-700 opacity-50 cursor-not-allowed shadow-none"
                    : "bg-[#FC5185] hover:bg-[#E04373] active:scale-[0.99]"
                }`}
              >
                {isSubmitting && (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                )}
                <span>{isSubmitting ? t.workflow.creatingProcess : t.workflow.continueButton}</span>
                <span className="text-lg leading-none">{isRtl ? "←" : "→"}</span>
              </button>
            </div>
          </form>
        </section>

        {/* Section 2: Incomplete Processes */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-5 rounded-full bg-[#3FC1C9]"></span>
              <h2 className="text-lg md:text-xl font-bold tracking-tight">
                {t.workflow.incompleteProcesses}
              </h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#364F6B] text-[#F5F5F5]">
                {incompleteProcesses.length}
              </span>
            </div>

            <button
              onClick={fetchProcesses}
              disabled={isLoadingProcesses}
              className={`p-2 rounded-xl text-xs border transition-colors ${
                isDark ? "bg-[#243447] border-[#364F6B] hover:bg-[#1A2634] text-[#F5F5F5]" : "bg-white border-[#364F6B]/20 hover:bg-[#F5F5F5] text-[#364F6B]"
              }`}
              title={t.common.refresh}
            >
              🔄
            </button>
          </div>

          {isLoadingProcesses ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map((i) => (
                <div key={i} className={`p-6 rounded-2xl border animate-pulse ${isDark ? "bg-[#243447] border-[#364F6B]" : "bg-white border-[#364F6B]/15"}`}>
                  <div className={`h-4 rounded w-1/2 mb-3 ${isDark ? "bg-[#1A2634]" : "bg-[#F5F5F5]"}`}></div>
                  <div className={`h-3 rounded w-3/4 mb-4 ${isDark ? "bg-[#1A2634]" : "bg-[#F5F5F5]"}`}></div>
                  <div className={`h-2 rounded w-full ${isDark ? "bg-[#1A2634]" : "bg-[#F5F5F5]"}`}></div>
                </div>
              ))}
            </div>
          ) : incompleteProcesses.length === 0 ? (
            <div className={`p-8 rounded-2xl border text-center ${isDark ? "bg-[#243447]/40 border-[#364F6B]/80 text-[#F5F5F5]/60" : "bg-white border-[#364F6B]/15 text-[#364F6B]/60"}`}>
              <p className="text-sm">{t.workflow.noIncomplete}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {incompleteProcesses.map((process) => {
                const currentStep = process.steps_data?.find((s) => s.id === process.current_step_id);

                return (
                  <div
                    key={process.id}
                    className={`rounded-2xl border p-5 flex flex-col justify-between transition-all hover:shadow-lg ${
                      isDark ? "bg-[#243447] border-[#364F6B] hover:border-[#3FC1C9]/50" : "bg-white border-[#364F6B]/15 hover:border-[#3FC1C9]/50 shadow-sm"
                    }`}
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                          process.type === "detailed_answer"
                            ? "bg-[#FC5185]/15 text-[#FC5185] border border-[#FC5185]/25"
                            : "bg-[#3FC1C9]/15 text-[#166E74] dark:text-[#3FC1C9] border border-[#3FC1C9]/25"
                        }`}>
                          {process.type === "detailed_answer" ? t.workflow.detailedAnswerTitle : t.workflow.summaryTitle}
                        </span>

                        <span className={`text-[11px] ${isDark ? "text-[#F5F5F5]/60" : "text-[#364F6B]/60"}`}>
                          {formatDate(process.updated_at)}
                        </span>
                      </div>

                      {/* Process Name */}
                      <h3 className={`font-bold text-base md:text-lg tracking-tight mb-2 line-clamp-1 ${isDark ? "text-[#F5F5F5]" : "text-[#364F6B]"}`}>
                        {process.name}
                      </h3>

                      {/* Current Stage */}
                      <div className="text-xs mb-4 flex items-center gap-1.5">
                        <span className={`font-medium ${isDark ? "text-[#F5F5F5]/70" : "text-[#364F6B]/70"}`}>{t.workflow.currentStage}</span>
                        <span className="text-[#3FC1C9] font-semibold line-clamp-1">
                          {currentStep ? currentStep.title : "مرحله اولیه"}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1.5 mb-5">
                        <div className="flex justify-between text-xs">
                          <span className={isDark ? "text-[#F5F5F5]/70" : "text-[#364F6B]/70"}>{t.workflow.progressSummary}</span>
                          <span className="font-bold text-[#FC5185]">{process.progress_percentage}% ({process.completed_steps_count}/{process.total_steps_count})</span>
                        </div>
                        <div className={`h-2 rounded-full overflow-hidden ${isDark ? "bg-[#1A2634]" : "bg-[#F5F5F5]"}`}>
                          <div
                            className="h-full bg-gradient-to-r from-[#FC5185] to-[#3FC1C9] rounded-full transition-all duration-500"
                            style={{ width: `${process.progress_percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#364F6B]/20 dark:border-[#364F6B]/60">
                      <button
                        type="button"
                        onClick={() => setProcessToDelete(process)}
                        className="text-xs text-rose-500 hover:text-rose-400 font-medium py-1 px-2 rounded-lg transition-colors hover:bg-rose-500/10"
                      >
                        {t.workflow.deleteProcess}
                      </button>

                      <Link
                        href={`/process?id=${process.id}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#FC5185] hover:bg-[#E04373] text-white shadow-sm shadow-[#FC5185]/20 transition-colors"
                      >
                        <span>{t.workflow.resumeProcess}</span>
                        <span>{isRtl ? "←" : "→"}</span>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Section 3: Completed Processes */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-5 rounded-full bg-emerald-500"></span>
            <h2 className="text-lg md:text-xl font-bold tracking-tight">
              {t.workflow.completedProcesses}
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {completedProcesses.length}
            </span>
          </div>

          {/* Mandatory Expiration Warning Banner */}
          <div className="p-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 text-amber-200 flex items-start gap-3 shadow-md shadow-amber-950/20">
            <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 text-amber-400 mt-0.5">
              ⚠️
            </div>
            <div>
              <p className="text-xs md:text-sm font-bold text-amber-300 leading-relaxed">
                {t.workflow.expirationWarning}
              </p>
              <p className="text-[11px] text-amber-400/80 mt-1">
                سرور پس از گذشت ۴۸ ساعت، به منظور مدیریت حافظه فایل‌های پردازش را پاک‌سازی می‌نماید.
              </p>
            </div>
          </div>

          {isLoadingProcesses ? (
            <div className={`p-6 rounded-2xl border animate-pulse ${isDark ? "bg-[#243447] border-[#364F6B]" : "bg-white border-[#364F6B]/15"}`}>
              <div className={`h-4 rounded w-1/3 mb-3 ${isDark ? "bg-[#1A2634]" : "bg-[#F5F5F5]"}`}></div>
              <div className={`h-3 rounded w-1/2 ${isDark ? "bg-[#1A2634]" : "bg-[#F5F5F5]"}`}></div>
            </div>
          ) : completedProcesses.length === 0 ? (
            <div className={`p-8 rounded-2xl border text-center ${isDark ? "bg-[#243447]/40 border-[#364F6B]/80 text-[#F5F5F5]/60" : "bg-white border-[#364F6B]/15 text-[#364F6B]/60"}`}>
              <p className="text-sm">{t.workflow.noCompleted}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {completedProcesses.map((process) => (
                <div
                  key={process.id}
                  className={`rounded-2xl border p-5 flex flex-col justify-between transition-all hover:shadow-lg ${
                    isDark ? "bg-[#243447] border-[#364F6B] hover:border-[#3FC1C9]/50" : "bg-white border-[#364F6B]/15 hover:border-[#3FC1C9]/50 shadow-sm"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                        process.type === "detailed_answer"
                          ? "bg-[#FC5185]/15 text-[#FC5185] border border-[#FC5185]/25"
                          : "bg-[#3FC1C9]/15 text-[#166E74] dark:text-[#3FC1C9] border border-[#3FC1C9]/25"
                      }`}>
                        {process.type === "detailed_answer" ? t.workflow.detailedAnswerTitle : t.workflow.summaryTitle}
                      </span>

                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>{t.workflow.statusCompleted}</span>
                      </span>
                    </div>

                    <h3 className={`font-bold text-base md:text-lg tracking-tight mb-2 line-clamp-1 ${isDark ? "text-[#F5F5F5]" : "text-[#364F6B]"}`}>
                      {process.name}
                    </h3>

                    <div className="space-y-1 text-xs mb-4">
                      <div>
                        <span className={isDark ? "text-[#F5F5F5]/60" : "text-[#364F6B]/60"}>{t.workflow.completedAt} </span>
                        <span className={`font-medium ${isDark ? "text-[#F5F5F5]/90" : "text-[#364F6B]"}`}>{formatDate(process.completed_at)}</span>
                      </div>
                      <div className="text-amber-400/90 font-medium">
                        <span>{t.workflow.expiresAt} </span>
                        <span>{formatDate(process.expires_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#364F6B]/20 dark:border-[#364F6B]/60 flex justify-end">
                    <Link
                      href={`/process?id=${process.id}`}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                        isDark ? "bg-[#1A2634] hover:bg-[#364F6B]/40 text-[#F5F5F5] border border-[#364F6B]" : "bg-[#F5F5F5] hover:bg-[#EBEBEB] text-[#364F6B] border border-[#364F6B]/20"
                      }`}
                    >
                      <span>{t.workflow.viewProcess}</span>
                      <span>{isRtl ? "←" : "→"}</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Confirmation Modal for Deletion */}
      <DeleteProcessModal
        isOpen={Boolean(processToDelete)}
        process={processToDelete}
        isDeleting={isDeleting}
        onClose={() => setProcessToDelete(null)}
        onConfirm={handleConfirmDelete}
        isDark={isDark}
      />
    </div>
    </AuthGuard>
  );
}