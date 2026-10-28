"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { WorkflowStep, WorkflowProcessFile } from "@/app/types/workflow";
import { useLanguage } from "@/app/context/LanguageContext";

interface StepDetailPanelProps {
  processId: string;
  step: WorkflowStep;
  files?: WorkflowProcessFile[];
  isDark: boolean;
  onUpdateStep: (stepId: string, action: string, payload?: any) => Promise<void>;
  onFileUpload: (stepId: string, file: File) => Promise<void>;
  isUpdating: boolean;
}

export default function StepDetailPanel({
  processId,
  step,
  files = [],
  isDark,
  onUpdateStep,
  onFileUpload,
  isUpdating,
}: StepDetailPanelProps) {
  const { t, isRtl } = useLanguage();

  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [localInputs, setLocalInputs] = useState<Record<string, any>>({});
  const [selectedBranch, setSelectedBranch] = useState<string>(step.selected_branch || "");
  const [isSatisfied, setIsSatisfied] = useState<boolean>(Boolean(step.already_satisfied));
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    setLocalInputs(step.inputs || {});
    setSelectedBranch(step.selected_branch || "");
    setIsSatisfied(Boolean(step.already_satisfied));
    setCopiedPrompt(false);
    setUploadError(null);
  }, [step]);

  const handleCopyPrompt = async () => {
    if (!step.prompt_template) return;
    try {
      await navigator.clipboard.writeText(step.prompt_template);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2500);
    } catch (err) {
      console.error("Failed to copy prompt:", err);
    }
  };

  const handleInputChange = (key: string, value: any) => {
    setLocalInputs((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveInputs = async () => {
    await onUpdateStep(step.id, "save_inputs", { inputs: localInputs });
  };

  const handleBranchSelect = async (branchId: string) => {
    setSelectedBranch(branchId);
    await onUpdateStep(step.id, "select_branch", { selected_branch: branchId });
  };

  const handlePrerequisiteToggle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setIsSatisfied(checked);
    await onUpdateStep(step.id, "mark_satisfied", { already_satisfied: checked });
  };

  const handleCompleteStep = async () => {
    await onUpdateStep(step.id, "complete", { inputs: localInputs });
  };

  const handleRetryStep = async () => {
    await onUpdateStep(step.id, "retry");
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setUploadingFile(true);
    setUploadError(null);

    try {
      await onFileUpload(step.id, file);
      e.target.value = "";
    } catch (err: any) {
      setUploadError(err.message || "Failed to upload file");
    } finally {
      setUploadingFile(false);
    }
  };

  const isCompleted = step.status === "completed";
  const isBlocked = step.status === "not_started";
  const isFailed = step.status === "failed";

  const stepFiles = files.filter((f) => f.step_id === step.id);

  return (
    <div
      className={`rounded-2xl border p-5 md:p-6 transition-colors ${
        isDark ? "bg-[#243447] border-[#364F6B] shadow-xl" : "bg-white border-[#364F6B]/15 shadow-md"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-[#364F6B]/20 dark:border-[#364F6B]/60">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold ${
                isCompleted
                  ? "bg-emerald-600 text-white"
                  : "bg-[#FC5185] text-white shadow-sm"
              }`}
            >
              {step.number}
            </span>
            <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? "text-[#FC5185]" : "text-[#D9366A]"}`}>
              {t.workflow.stepNumber} {step.number}
            </span>
          </div>
          <h3 className={`text-lg md:text-xl font-bold ${isDark ? "text-[#F5F5F5]" : "text-[#364F6B]"}`}>
            {step.title}
          </h3>
          <p className={`text-xs md:text-sm mt-1 leading-relaxed ${isDark ? "text-[#F5F5F5]/70" : "text-[#364F6B]/75"}`}>
            {step.description}
          </p>
        </div>

        <div>
          {isCompleted && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              {t.workflow.statusCompleted}
            </span>
          )}
          {isFailed && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/30">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
              {t.workflow.statusFailed}
            </span>
          )}
          {isBlocked && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#1A2634] text-[#F5F5F5]/60 border border-[#364F6B]">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              {t.workflow.statusBlocked}
            </span>
          )}
          {!isCompleted && !isFailed && !isBlocked && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#3FC1C9]/15 text-[#3FC1C9] border border-[#3FC1C9]/30">
              <span className="h-2 w-2 rounded-full bg-[#3FC1C9] animate-pulse"></span>
              {t.workflow.statusCurrent}
            </span>
          )}
        </div>
      </div>

      {isBlocked && (
        <div className="mt-4 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{t.workflow.stageDependencyWarning}</span>
        </div>
      )}

      {step.instructions && (
        <div className="mt-4">
          <h4 className={`text-xs font-semibold uppercase tracking-wider mb-1.5 ${isDark ? "text-[#F5F5F5]/70" : "text-[#364F6B]/70"}`}>
            {t.workflow.instructions}
          </h4>
          <div className={`p-3.5 rounded-xl text-xs md:text-sm leading-relaxed ${isDark ? "bg-[#1A2634]/70 text-[#F5F5F5]/90 border border-[#364F6B]" : "bg-[#F5F5F5] text-[#364F6B] border border-[#364F6B]/20"}`}>
            {step.instructions}
          </div>
        </div>
      )}

      {(step.type === "prerequisite" || step.id === "step_1_ocr") && (
        <div className={`mt-4 p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${isDark ? "bg-[#1A2634]/50 border-[#364F6B]" : "bg-[#F5F5F5] border-[#364F6B]/20"}`}>
          <label htmlFor={`satisfied-${step.id}`} className="flex items-center gap-3 cursor-pointer">
            <input
              id={`satisfied-${step.id}`}
              type="checkbox"
              checked={isSatisfied}
              onChange={handlePrerequisiteToggle}
              disabled={isUpdating}
              className="w-4 h-4 text-[#FC5185] rounded border-[#364F6B] focus:ring-[#FC5185] focus:ring-offset-[#1A2634]"
            />
            <span className={`text-xs md:text-sm font-medium ${isDark ? "text-[#F5F5F5]" : "text-[#364F6B]"}`}>
              {t.workflow.prerequisiteSatisfied}
            </span>
          </label>

          <Link
            href="/pipeline"
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#FC5185] hover:bg-[#E04373] text-white shadow-sm transition"
          >
            <span>{t.workflow.pipelineTool}</span>
            <span>↗</span>
          </Link>
        </div>
      )}

      {step.branch_options && step.branch_options.length > 0 && (
        <div className="mt-5">
          <h4 className={`text-xs font-semibold uppercase tracking-wider mb-2 ${isDark ? "text-[#F5F5F5]/70" : "text-[#364F6B]/70"}`}>
            {t.workflow.branchSelection}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {step.branch_options.map((option) => {
              const isOptionSelected = selectedBranch === option.id;
              return (
                <div
                  key={option.id}
                  onClick={() => !isUpdating && handleBranchSelect(option.id)}
                  className={`p-4 rounded-xl border text-start cursor-pointer transition-all ${
                    isOptionSelected
                      ? isDark
                        ? "bg-[#FC5185]/15 border-[#FC5185] ring-1 ring-[#FC5185]"
                        : "bg-[#FC5185]/10 border-[#FC5185] ring-1 ring-[#FC5185]"
                      : isDark
                      ? "bg-[#1A2634]/60 border-[#364F6B] hover:border-[#3FC1C9]/40"
                      : "bg-[#F5F5F5] border-[#364F6B]/20 hover:border-[#3FC1C9]/40"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`font-semibold text-xs md:text-sm ${isOptionSelected ? (isDark ? "text-[#FC5185]" : "text-[#D9366A]") : isDark ? "text-[#F5F5F5]" : "text-[#364F6B]"}`}>
                      {option.title}
                    </span>
                    <input
                      type="radio"
                      name={`branch-${step.id}`}
                      checked={isOptionSelected}
                      onChange={() => handleBranchSelect(option.id)}
                      disabled={isUpdating}
                      className="text-[#FC5185] focus:ring-[#FC5185]"
                    />
                  </div>
                  <p className={`text-xs leading-relaxed ${isDark ? "text-[#F5F5F5]/70" : "text-[#364F6B]/75"}`}>
                    {option.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {step.prompt_template && (
        <div className="mt-5">
          <div className="flex items-center justify-between mb-1.5">
            <h4 className={`text-xs font-semibold uppercase tracking-wider ${isDark ? "text-[#F5F5F5]/70" : "text-[#364F6B]/70"}`}>
              {t.workflow.copyPrompt}
            </h4>
            <button
              type="button"
              onClick={handleCopyPrompt}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                copiedPrompt
                  ? "bg-emerald-600 text-white"
                  : isDark
                  ? "bg-[#1A2634] hover:bg-[#364F6B]/50 text-[#F5F5F5] border border-[#364F6B]"
                  : "bg-[#F5F5F5] hover:bg-[#EBEBEB] text-[#364F6B] border border-[#364F6B]/20"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              <span>{copiedPrompt ? t.workflow.promptCopied : t.common.copy}</span>
            </button>
          </div>
          <pre
            className={`p-3.5 rounded-xl text-xs font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto ${
              isDark ? "bg-[#1A2634] text-[#F5F5F5]/90 border border-[#364F6B]" : "bg-[#F5F5F5] text-[#364F6B] border border-[#364F6B]/20"
            }`}
          >
            {step.prompt_template}
          </pre>
        </div>
      )}

      {step.inputs && Object.keys(step.inputs).length > 0 && (
        <div className="mt-5 space-y-3">
          <h4 className={`text-xs font-semibold uppercase tracking-wider ${isDark ? "text-[#F5F5F5]/70" : "text-[#364F6B]/70"}`}>
            {t.workflow.inputs}
          </h4>

          {Object.entries(localInputs).map(([key, val]) => {
            if (typeof val === "boolean") return null;

            let label = key;
            if (key === "drive_folder_url") label = "پیوند پوشه گوگل درایو";
            if (key === "notes_folder_url") label = "پیوند پوشه جزوات در درایو";
            if (key === "questions_folder_url") label = "پیوند پوشه نمونه‌سوالات در درایو";
            if (key === "notebook_url") label = "پیوند نوت‌بوک NotebookLM";
            if (key === "website_post_url") label = "پیوند انتشار در وب‌سایت";
            if (key === "notes") label = "یادداشت‌ها و توضیحات";

            return (
              <div key={key}>
                <label className={`block text-xs font-medium mb-1 ${isDark ? "text-[#F5F5F5]/90" : "text-[#364F6B]"}`}>
                  {label}
                </label>
                <input
                  type="text"
                  value={val || ""}
                  onChange={(e) => handleInputChange(key, e.target.value)}
                  disabled={isBlocked || isUpdating}
                  placeholder={`https://...`}
                  className={`w-full px-3 py-2 text-xs md:text-sm rounded-xl border transition-colors focus:outline-none focus:ring-2 focus:ring-[#FC5185] ${
                    isDark
                      ? "bg-[#1A2634] border-[#364F6B] text-[#F5F5F5] placeholder-slate-500"
                      : "bg-white border-[#364F6B]/30 text-[#364F6B] placeholder-slate-400"
                  }`}
                />
              </div>
            );
          })}

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={handleSaveInputs}
              disabled={isBlocked || isUpdating}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isDark
                  ? "bg-[#1A2634] hover:bg-[#364F6B]/50 text-[#F5F5F5] border border-[#364F6B]"
                  : "bg-[#F5F5F5] hover:bg-[#EBEBEB] text-[#364F6B] border border-[#364F6B]/20"
              }`}
            >
              {isUpdating ? t.workflow.saving : t.workflow.saveInputs}
            </button>
          </div>
        </div>
      )}

      <div className="mt-5">
        <h4 className={`text-xs font-semibold uppercase tracking-wider mb-2 ${isDark ? "text-[#F5F5F5]/70" : "text-[#364F6B]/70"}`}>
          {t.workflow.outputs}
        </h4>

        {stepFiles.length > 0 && (
          <div className="space-y-2 mb-3">
            {stepFiles.map((file) => (
              <div
                key={file.id}
                className={`flex items-center justify-between p-2.5 rounded-xl border text-xs ${
                  isDark ? "bg-[#1A2634] border-[#364F6B]" : "bg-[#F5F5F5] border-[#364F6B]/20"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <svg className="w-4 h-4 text-[#3FC1C9] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className={`font-medium truncate ${isDark ? "text-[#F5F5F5]" : "text-[#364F6B]"}`}>
                    {file.original_name}
                  </span>
                  <span className={`text-[10px] ${isDark ? "text-[#F5F5F5]/50" : "text-[#364F6B]/50"}`}>
                    ({Math.round(file.file_size / 1024)} KB)
                  </span>
                </div>

                <a
                  href={`/api/processes/${processId}/download/${file.id}`}
                  download={file.original_name}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[#364F6B] hover:bg-[#2B3F56] text-[#F5F5F5] transition-colors"
                >
                  {t.workflow.downloadFile}
                </a>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3">
          <label className={`cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors ${
            isDark
              ? "bg-[#1A2634] hover:bg-[#364F6B]/50 border-[#364F6B] text-[#F5F5F5]"
              : "bg-[#F5F5F5] hover:bg-[#EBEBEB] border-[#364F6B]/20 text-[#364F6B]"
          }`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span>{uploadingFile ? t.common.loading : t.workflow.uploadOutputFile}</span>
            <input
              type="file"
              onChange={handleFileChange}
              disabled={isBlocked || uploadingFile}
              className="hidden"
            />
          </label>

          {uploadError && (
            <span className="text-xs text-rose-500">{uploadError}</span>
          )}
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-[#364F6B]/20 dark:border-[#364F6B]/60 flex flex-wrap items-center justify-between gap-3">
        {isFailed ? (
          <button
            type="button"
            onClick={handleRetryStep}
            disabled={isUpdating}
            className="px-4 py-2 rounded-xl text-xs md:text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-colors"
          >
            {t.workflow.retry}
          </button>
        ) : (
          <div className="text-xs text-slate-500">
            {isCompleted ? "این مرحله با موفقیت تکمیل شده است." : "پس از انجام دستورالعمل‌ها، دکمه تکمیل را بزنید."}
          </div>
        )}

        {!isCompleted && (
          <button
            type="button"
            onClick={handleCompleteStep}
            disabled={isBlocked || isUpdating}
            className={`px-5 py-2.5 rounded-xl text-xs md:text-sm font-semibold text-white shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#FC5185] focus:ring-offset-2 ${
              isBlocked
                ? "bg-slate-700 opacity-50 cursor-not-allowed"
                : "bg-[#FC5185] hover:bg-[#E04373] active:scale-[0.99] shadow-lg shadow-[#FC5185]/20"
            }`}
          >
            {isUpdating ? t.workflow.completing : t.workflow.markComplete}
          </button>
        )}
      </div>
    </div>
  );
}
