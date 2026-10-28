"use client";

import React from "react";
import { WorkflowStep, StepStatus } from "@/app/types/workflow";
import { useLanguage } from "@/app/context/LanguageContext";

interface WorkflowVisualizerProps {
  steps: WorkflowStep[];
  activeStepId: string | null;
  onSelectStep: (stepId: string) => void;
  isDark: boolean;
}

export default function WorkflowVisualizer({
  steps,
  activeStepId,
  onSelectStep,
  isDark,
}: WorkflowVisualizerProps) {
  const { t, isRtl } = useLanguage();

  const getStepBadge = (step: WorkflowStep, isCurrent: boolean) => {
    if (step.status === "completed") {
      return {
        label: t.workflow.statusCompleted,
        classes: isDark
          ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800"
          : "bg-emerald-50 text-emerald-700 border border-emerald-200",
        icon: (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        ),
      };
    }

    if (step.status === "failed") {
      return {
        label: t.workflow.statusFailed,
        classes: isDark
          ? "bg-rose-950/80 text-rose-400 border border-rose-800"
          : "bg-rose-50 text-rose-700 border border-rose-200",
        icon: (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ),
      };
    }

    if (isCurrent || step.status === "in_progress") {
      return {
        label: t.workflow.statusCurrent,
        classes: isDark
          ? "bg-[#3FC1C9]/15 text-[#3FC1C9] border border-[#3FC1C9]/30 shadow-sm"
          : "bg-[#3FC1C9]/15 text-[#166E74] border border-[#3FC1C9]/30 shadow-sm",
        icon: (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#3FC1C9] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#3FC1C9]"></span>
          </span>
        ),
      };
    }

    if (step.status === "available") {
      return {
        label: t.workflow.statusAvailable,
        classes: isDark
          ? "bg-[#243447] text-[#3FC1C9] border border-[#364F6B]"
          : "bg-[#F5F5F5] text-[#166E74] border border-[#364F6B]/20",
        icon: (
          <span className="h-1.5 w-1.5 rounded-full bg-[#3FC1C9]"></span>
        ),
      };
    }

    // Blocked / Not started
    return {
      label: t.workflow.statusBlocked,
      classes: isDark
        ? "bg-[#1A2634]/60 text-[#F5F5F5]/40 border border-[#364F6B]/40"
        : "bg-[#F5F5F5]/80 text-[#364F6B]/40 border border-[#364F6B]/15",
      icon: (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
    };
  };

  return (
    <div className="w-full">
      {/* Desktop Stepper / Connected Flow (Visible on md and up) */}
      <div className="hidden md:block">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {steps.map((step) => {
            const isSelected = activeStepId === step.id;
            const isCompleted = step.status === "completed";
            const isFailed = step.status === "failed";
            const isBlocked = step.status === "not_started";
            const isAvailable = step.status === "available" || step.status === "in_progress";
            const isCurrent = isAvailable && !isCompleted;
            const badge = getStepBadge(step, isCurrent);

            let cardClasses = "";
            if (isSelected) {
              cardClasses = isDark
                ? "bg-[#243447] border-[#FC5185] ring-2 ring-[#FC5185]/30 shadow-lg shadow-[#FC5185]/10"
                : "bg-white border-[#FC5185] ring-2 ring-[#FC5185]/20 shadow-md";
            } else if (isCompleted) {
              cardClasses = isDark
                ? "bg-[#243447]/90 border-emerald-900/60 hover:border-emerald-700/80 shadow-sm"
                : "bg-white border-emerald-200 hover:border-emerald-300 shadow-sm";
            } else if (isFailed) {
              cardClasses = isDark
                ? "bg-[#243447]/90 border-rose-900/60 hover:border-rose-700 shadow-sm"
                : "bg-white border-rose-200 hover:border-rose-300 shadow-sm";
            } else if (isCurrent) {
              cardClasses = isDark
                ? "bg-[#243447] border-[#3FC1C9]/70 ring-1 ring-[#3FC1C9]/30 hover:border-[#3FC1C9] shadow-md"
                : "bg-white border-[#3FC1C9]/60 ring-1 ring-[#3FC1C9]/20 hover:border-[#3FC1C9] shadow-sm";
            } else if (isAvailable) {
              cardClasses = isDark
                ? "bg-[#243447]/80 border-[#364F6B] hover:border-[#3FC1C9]/50 shadow-sm"
                : "bg-white border-[#364F6B]/15 hover:border-[#3FC1C9]/40 shadow-sm";
            } else {
              cardClasses = isDark
                ? "bg-[#1A2634]/50 border-[#364F6B]/30 opacity-70 hover:opacity-90"
                : "bg-[#F5F5F5]/80 border-[#364F6B]/10 opacity-75 hover:opacity-90";
            }

            return (
              <div
                key={step.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectStep(step.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectStep(step.id);
                  }
                }}
                className={`group relative flex flex-col justify-between p-4 rounded-xl border text-start cursor-pointer transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#FC5185] ${cardClasses}`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold transition-colors ${
                          isCompleted
                            ? isDark
                              ? "bg-emerald-900 text-emerald-300"
                              : "bg-emerald-100 text-emerald-800"
                            : isSelected
                            ? "bg-[#FC5185] text-white shadow-sm"
                            : isCurrent
                            ? "bg-[#3FC1C9] text-[#16202C] font-black shadow-sm"
                            : isDark
                            ? "bg-[#1A2634] text-[#F5F5F5]/70 border border-[#364F6B]"
                            : "bg-[#F5F5F5] text-[#364F6B] border border-[#364F6B]/20"
                        }`}
                      >
                        {step.number}
                      </span>
                      <span className={`text-[11px] font-medium ${isDark ? "text-[#F5F5F5]/70" : "text-[#364F6B]/70"}`}>
                        {t.workflow.stepNumber} {step.number}
                      </span>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${badge.classes}`}
                    >
                      {badge.icon}
                      <span>{badge.label}</span>
                    </span>
                  </div>

                  <h4
                    className={`font-semibold text-sm line-clamp-1 mb-1.5 transition-colors ${
                      isSelected
                        ? isDark
                          ? "text-[#FC5185]"
                          : "text-[#D9366A]"
                        : isDark
                        ? "text-[#F5F5F5] group-hover:text-white"
                        : "text-[#364F6B] group-hover:text-[#1F2D3E]"
                    }`}
                  >
                    {step.title}
                  </h4>

                  <p
                    className={`text-xs line-clamp-2 leading-relaxed ${
                      isDark ? "text-[#F5F5F5]/70" : "text-[#364F6B]/75"
                    }`}
                  >
                    {step.description}
                  </p>
                </div>

                <div className="mt-3.5 pt-2.5 border-t border-[#364F6B]/20 dark:border-[#364F6B]/60 flex items-center justify-between text-[11px]">
                  {step.type === "conditional_branch" ? (
                    <span className="inline-flex items-center gap-1 text-amber-500 font-medium">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                      {step.selected_branch ? "شاخه انتخاب‌شده" : "شاخه شرطی"}
                    </span>
                  ) : step.already_satisfied ? (
                    <span className="text-emerald-500 font-medium">از قبل آماده است</span>
                  ) : (
                    <span className={isDark ? "text-[#F5F5F5]/50" : "text-[#364F6B]/50"}>
                      {step.completed_at ? "تکمیل‌شده" : isBlocked ? "در انتظار پیش‌نیاز" : "کلیک برای مشاهده"}
                    </span>
                  )}

                  <span
                    className={`text-xs font-semibold ${
                      isSelected
                        ? isDark
                          ? "text-[#FC5185]"
                          : "text-[#D9366A]"
                        : isDark
                        ? "text-[#F5F5F5]/50 group-hover:text-[#F5F5F5]"
                        : "text-[#364F6B]/50 group-hover:text-[#364F6B]"
                    }`}
                  >
                    {isRtl ? "←" : "→"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile Vertical Connected Stepper */}
      <div className="md:hidden space-y-3">
        {steps.map((step, idx) => {
          const isSelected = activeStepId === step.id;
          const isCompleted = step.status === "completed";
          const isAvailable = step.status === "available" || step.status === "in_progress";
          const isCurrent = isAvailable && !isCompleted;
          const badge = getStepBadge(step, isCurrent);

          const isLast = idx === steps.length - 1;

          return (
            <div key={step.id} className="relative flex gap-3">
              {!isLast && (
                <div
                  className={`absolute top-8 ${isRtl ? "right-4" : "left-4"} bottom-0 w-0.5 -mb-3 transition-colors ${
                    isCompleted
                      ? isDark
                        ? "bg-emerald-600/70"
                        : "bg-emerald-500"
                      : isDark
                      ? "bg-[#364F6B]"
                      : "bg-[#364F6B]/20"
                  }`}
                />
              )}

              <div
                className={`relative z-10 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  isCompleted
                    ? isDark
                      ? "bg-emerald-600 text-white shadow-sm shadow-emerald-950"
                      : "bg-emerald-600 text-white shadow-sm"
                    : isSelected
                    ? "bg-[#FC5185] text-white ring-4 ring-[#FC5185]/20 shadow-sm"
                    : isCurrent
                    ? "bg-[#3FC1C9] text-[#16202C] font-black ring-4 ring-[#3FC1C9]/20 shadow-sm"
                    : isDark
                    ? "bg-[#243447] text-[#F5F5F5]/70 border border-[#364F6B]"
                    : "bg-[#F5F5F5] text-[#364F6B] border border-[#364F6B]/20"
                }`}
              >
                {isCompleted ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  step.number
                )}
              </div>

              <div
                role="button"
                tabIndex={0}
                onClick={() => onSelectStep(step.id)}
                className={`flex-1 p-3.5 rounded-xl border text-start cursor-pointer transition-all ${
                  isSelected
                    ? isDark
                      ? "bg-[#243447] border-[#FC5185] ring-1 ring-[#FC5185]/30 shadow-sm"
                      : "bg-white border-[#FC5185] ring-1 ring-[#FC5185]/20 shadow-sm"
                    : isDark
                    ? "bg-[#243447]/90 border-[#364F6B]"
                    : "bg-white border-[#364F6B]/15 shadow-sm"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h4
                    className={`font-semibold text-sm line-clamp-1 ${
                      isSelected
                        ? isDark
                          ? "text-[#FC5185]"
                          : "text-[#D9366A]"
                        : isDark
                        ? "text-[#F5F5F5]"
                        : "text-[#364F6B]"
                    }`}
                  >
                    {step.title}
                  </h4>
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 ${badge.classes}`}>
                    {badge.label}
                  </span>
                </div>
                <p className={`text-xs line-clamp-2 ${isDark ? "text-[#F5F5F5]/70" : "text-[#364F6B]/75"}`}>
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
