"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLanguage } from "@/app/context/LanguageContext";
import LanguageSelector from "@/app/components/LanguageSelector";
import WorkflowVisualizer from "@/app/components/WorkflowVisualizer";
import StepDetailPanel from "@/app/components/StepDetailPanel";
import { WorkflowProcess, WorkflowStep } from "@/app/types/workflow";
import { AuthGuard } from "@/app/components/AuthGuard";
import { UserNav } from "@/app/components/UserNav";

function ProcessDetailContent() {
  const searchParams = useSearchParams();
  const { t, isRtl } = useLanguage();

  // Extract Process ID from search params (?id=...) or path fallback
  const [processId, setProcessId] = useState<string | null>(null);

  useEffect(() => {
    const idParam = searchParams.get("id");
    if (idParam) {
      setProcessId(idParam);
      return;
    }

    if (typeof window !== "undefined") {
      const parts = window.location.pathname.split("/").filter(Boolean);
      // e.g. /process/123 -> parts: ['process', '123']
      if (parts.length >= 2 && parts[0] === "process") {
        setProcessId(parts[1]);
      }
    }
  }, [searchParams]);

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

  // Process State
  const [process, setProcess] = useState<WorkflowProcess | null>(null);
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdatingStep, setIsUpdatingStep] = useState(false);

  // Fetch Process from Laravel API
  const fetchProcess = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/processes/${id}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("پروسه مورد نظر یافت نشد یا ممکن است حذف شده باشد.");
        }
        throw new Error(`خطا در بارگذاری اطلاعات پروسه (کد ${res.status})`);
      }

      const data: WorkflowProcess = await res.json();
      setProcess(data);

      // Default active step to current_step_id or first non-completed step
      if (!activeStepId) {
        if (data.current_step_id) {
          setActiveStepId(data.current_step_id);
        } else if (data.steps_data && data.steps_data.length > 0) {
          setActiveStepId(data.steps_data[0].id);
        }
      }
    } catch (err: any) {
      console.error("Error loading process:", err);
      setError(err.message || "خطا در برقراری ارتباط با سرور");
    } finally {
      setIsLoading(false);
    }
  }, [activeStepId]);

  useEffect(() => {
    if (processId) {
      fetchProcess(processId);
    }
  }, [processId, fetchProcess]);

  // Update Step Action (complete, save_inputs, select_branch, mark_satisfied, retry)
  const handleUpdateStep = async (stepId: string, action: string, payload?: any) => {
    if (!processId) return;
    setIsUpdatingStep(true);

    try {
      const body = {
        step_id: stepId,
        action,
        ...(payload || {}),
      };

      const res = await fetch(`/api/processes/${processId}/step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const updatedProcess: WorkflowProcess = await res.json();

      if (!res.ok) {
        throw new Error((updatedProcess as any).error || "Failed to update step");
      }

      setProcess(updatedProcess);

      // If step was completed and there's a new current step, select the new current step
      if (action === "complete" && updatedProcess.current_step_id) {
        setActiveStepId(updatedProcess.current_step_id);
      }
    } catch (err: any) {
      alert(`خطا: ${err.message}`);
    } finally {
      setIsUpdatingStep(false);
    }
  };

  // Upload File for Step
  const handleFileUpload = async (stepId: string, file: File) => {
    if (!processId) return;

    const formData = new FormData();
    formData.append("step_id", stepId);
    formData.append("file", file);
    formData.append("file_type", "output");

    const res = await fetch(`/api/processes/${processId}/upload`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || "خطا در بارگذاری فایل");
    }

    // Refresh process to update files list
    await fetchProcess(processId);
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

  const activeStep: WorkflowStep | undefined = process?.steps_data?.find(
    (s) => s.id === activeStepId
  );

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#1A2634] text-[#F5F5F5]" : "bg-[#F5F5F5] text-[#364F6B]"} transition-colors`}>
      {/* Top Header */}
      <header className={`sticky top-0 z-40 border-b backdrop-blur-md transition-colors ${
        isDark ? "bg-[#243447]/90 border-[#364F6B]" : "bg-white/90 border-[#364F6B]/15 shadow-sm"
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className={`p-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-colors ${
                isDark ? "bg-[#1A2634] hover:bg-[#364F6B]/50 text-[#F5F5F5] border-[#364F6B]" : "bg-[#F5F5F5] hover:bg-[#EBEBEB] text-[#364F6B] border-[#364F6B]/20"
              }`}
            >
              <span>{isRtl ? "→" : "←"}</span>
              <span className="hidden sm:inline">{t.workflow.backToHome}</span>
            </Link>

            <div className={`h-5 w-px ${isDark ? "bg-[#364F6B]" : "bg-[#364F6B]/20"}`}></div>

            <div className="truncate">
              <span className={`font-bold text-sm md:text-base tracking-tight truncate block max-w-xs sm:max-w-md ${isDark ? "text-[#F5F5F5]" : "text-[#364F6B]"}`}>
                {process ? process.name : "در حال بارگذاری..."}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <Link
              href="/pipeline"
              className={`hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                isDark ? "bg-[#1A2634] hover:bg-[#364F6B]/50 text-[#F5F5F5] border-[#364F6B]" : "bg-[#F5F5F5] hover:bg-[#EBEBEB] text-[#364F6B] border-[#364F6B]/20"
              }`}
            >
              <span>{t.workflow.pipelineTool}</span>
            </Link>

            <Link
              href="/tohtml"
              className={`hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                isDark ? "bg-[#1A2634] hover:bg-[#364F6B]/50 text-[#F5F5F5] border-[#364F6B]" : "bg-[#F5F5F5] hover:bg-[#EBEBEB] text-[#364F6B] border-[#364F6B]/20"
              }`}
            >
              <span>{t.workflow.tohtmlTool}</span>
            </Link>
            <button
              onClick={() => processId && fetchProcess(processId)}
              className={`p-2 rounded-xl text-xs border transition-colors ${
                isDark ? "bg-[#1A2634] hover:bg-[#364F6B]/50 text-[#F5F5F5] border-[#364F6B]" : "bg-[#F5F5F5] hover:bg-[#EBEBEB] text-[#364F6B] border-[#364F6B]/20"
              }`}
              title={t.common.refresh}
            >
              🔄
            </button>

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

      {/* Main Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {isLoading ? (
          <div className="space-y-6">
            <div className={`p-8 rounded-3xl border animate-pulse ${isDark ? "bg-[#243447] border-[#364F6B]" : "bg-white border-[#364F6B]/15"}`}>
              <div className={`h-6 rounded w-1/3 mb-4 ${isDark ? "bg-[#1A2634]" : "bg-[#F5F5F5]"}`}></div>
              <div className={`h-4 rounded w-1/2 mb-6 ${isDark ? "bg-[#1A2634]" : "bg-[#F5F5F5]"}`}></div>
              <div className={`h-3 rounded w-full ${isDark ? "bg-[#1A2634]" : "bg-[#F5F5F5]"}`}></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className={`h-32 rounded-2xl border animate-pulse ${isDark ? "bg-[#243447] border-[#364F6B]" : "bg-white border-[#364F6B]/15"}`}></div>
              ))}
            </div>
          </div>
        ) : error || !process ? (
          <div className={`p-10 rounded-3xl border text-center space-y-4 ${isDark ? "bg-[#243447] border-[#364F6B]" : "bg-white border-[#364F6B]/15"}`}>
            <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 mx-auto flex items-center justify-center text-xl">
              ⚠️
            </div>
            <h3 className="text-lg font-bold text-rose-400">
              {error || "پروسه یافت نشد"}
            </h3>
            <p className={`text-sm max-w-md mx-auto ${isDark ? "text-[#F5F5F5]/70" : "text-[#364F6B]/70"}`}>
              ممکن است این پروسه حذف شده باشد یا شناسه وارد شده صحیح نباشد.
            </p>
            <div className="pt-2">
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs md:text-sm font-bold bg-[#FC5185] hover:bg-[#E04373] text-white transition-colors shadow-md shadow-[#FC5185]/20"
              >
                <span>{t.workflow.backToHome}</span>
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Header / Summary Card */}
            <div
              className={`rounded-3xl border p-6 md:p-8 transition-colors ${
                isDark ? "bg-[#243447] border-[#364F6B] shadow-xl" : "bg-white border-[#364F6B]/15 shadow-md"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                  <div className="flex items-center gap-2.5 mb-2">
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                      process.type === "detailed_answer"
                        ? "bg-[#FC5185]/15 text-[#FC5185] border border-[#FC5185]/25"
                        : "bg-[#3FC1C9]/15 text-[#166E74] dark:text-[#3FC1C9] border border-[#3FC1C9]/25"
                    }`}>
                      {process.type === "detailed_answer" ? t.workflow.detailedAnswerTitle : t.workflow.summaryTitle}
                    </span>

                    {process.status === "completed" ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>{t.workflow.statusCompleted}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#3FC1C9]/15 text-[#3FC1C9] border border-[#3FC1C9]/30">
                        <span className="h-2 w-2 rounded-full bg-[#3FC1C9] animate-pulse"></span>
                        <span>در حال انجام</span>
                      </span>
                    )}
                  </div>

                  <h1 className={`text-xl sm:text-2xl md:text-3xl font-black tracking-tight ${isDark ? "text-[#F5F5F5]" : "text-[#364F6B]"}`}>
                    {process.name}
                  </h1>
                </div>

                {/* Expiration warning badge if completed */}
                {process.status === "completed" && process.expires_at && (
                  <div className="p-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 text-amber-200 text-xs flex items-center gap-2 max-w-sm">
                    <span className="text-lg">⚠️</span>
                    <div>
                      <p className="font-bold">{t.workflow.expirationWarning}</p>
                      <p className="text-[11px] text-amber-400 mt-0.5">
                        {t.workflow.expiresAt} {formatDate(process.expires_at)}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Progress Bar & Details */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs md:text-sm">
                  <div className="flex items-center gap-3">
                    <span className={`font-medium ${isDark ? "text-[#F5F5F5]/70" : "text-[#364F6B]/70"}`}>{t.workflow.progressSummary}</span>
                    <span className="font-bold text-[#FC5185]">
                      {process.completed_steps_count} از {process.total_steps_count} مرحله
                    </span>
                  </div>

                  <span className="font-black text-[#FC5185] text-base">
                    {process.progress_percentage}%
                  </span>
                </div>

                <div className={`h-3 rounded-full overflow-hidden ${isDark ? "bg-[#1A2634]" : "bg-[#F5F5F5]"}`}>
                  <div
                    className="h-full bg-gradient-to-r from-[#FC5185] to-[#3FC1C9] rounded-full transition-all duration-500 shadow-sm"
                    style={{ width: `${process.progress_percentage}%` }}
                  />
                </div>

                <div className={`flex justify-between items-center text-[11px] pt-1 ${isDark ? "text-[#F5F5F5]/50" : "text-[#364F6B]/50"}`}>
                  <span>
                    {t.workflow.lastUpdated} {formatDate(process.updated_at)}
                  </span>
                  <span>شناسه یکتا: {process.id}</span>
                </div>
              </div>
            </div>

            {/* Visual Workflow Engine */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-5 rounded-full bg-[#FC5185]"></span>
                <h2 className="text-base md:text-lg font-bold tracking-tight">
                  مراحل فرآیند و نقشه گردش کار
                </h2>
              </div>

              <WorkflowVisualizer
                steps={process.steps_data || []}
                activeStepId={activeStepId}
                onSelectStep={(stepId) => setActiveStepId(stepId)}
                isDark={isDark}
              />
            </section>

            {/* Step Detail Area */}
            {activeStep && (
              <section className="space-y-4 animate-in fade-in duration-300">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-5 rounded-full bg-[#3FC1C9]"></span>
                  <h2 className="text-base md:text-lg font-bold tracking-tight">
                    جزئیات و عملیات مرحله انتخاب‌شده
                  </h2>
                </div>

                <StepDetailPanel
                  processId={process.id}
                  step={activeStep}
                  files={process.files || []}
                  isDark={isDark}
                  onUpdateStep={handleUpdateStep}
                  onFileUpload={handleFileUpload}
                  isUpdating={isUpdatingStep}
                />
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default function ProcessDetailPage() {
  return (
    <AuthGuard>
      <Suspense fallback={<div className="p-8 text-center text-slate-400">در حال بارگذاری...</div>}>
        <ProcessDetailContent />
      </Suspense>
    </AuthGuard>
  );
}
