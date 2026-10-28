"use client";

import React from "react";
import { WorkflowProcess } from "@/app/types/workflow";
import { useLanguage } from "@/app/context/LanguageContext";

interface DeleteProcessModalProps {
  isOpen: boolean;
  process: WorkflowProcess | null;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDark: boolean;
}

export default function DeleteProcessModal({
  isOpen,
  process,
  isDeleting,
  onClose,
  onConfirm,
  isDark,
}: DeleteProcessModalProps) {
  const { t } = useLanguage();

  if (!isOpen || !process) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl transition-all ${
          isDark ? "bg-[#243447] border-[#364F6B] text-[#F5F5F5]" : "bg-white border-[#364F6B]/20 text-[#364F6B]"
        }`}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-rose-500/10 text-rose-500 border border-rose-500/20">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-bold text-rose-500">
              {t.workflow.confirmDeleteTitle}
            </h3>
            <p className={`text-xs ${isDark ? "text-[#F5F5F5]/70" : "text-[#364F6B]/70"}`}>
              {process.name}
            </p>
          </div>
        </div>

        <p className={`text-sm leading-relaxed mb-6 ${isDark ? "text-[#F5F5F5]/80" : "text-[#364F6B]/80"}`}>
          {t.workflow.confirmDeleteDesc}
        </p>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className={`px-4 py-2 rounded-xl text-xs md:text-sm font-medium transition-colors ${
              isDark
                ? "bg-[#1A2634] hover:bg-[#364F6B]/40 text-[#F5F5F5] border border-[#364F6B]"
                : "bg-[#F5F5F5] hover:bg-[#EBEBEB] text-[#364F6B] border border-[#364F6B]/20"
            }`}
          >
            {t.common.cancel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 rounded-xl text-xs md:text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-colors flex items-center gap-2"
          >
            {isDeleting && (
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            )}
            <span>{isDeleting ? t.workflow.deleting : t.workflow.confirmDelete}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
