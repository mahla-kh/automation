"use client";

import React from "react";
import { useLanguage } from "@/app/context/LanguageContext";

interface LanguageSelectorProps {
  isDark?: boolean;
}

export default function LanguageSelector({ isDark = true }: LanguageSelectorProps) {
  const { language, setLanguage } = useLanguage();

  return (
    <div
      role="group"
      aria-label="Language selection"
      className={`inline-flex items-center p-0.5 rounded-lg border text-xs font-semibold shadow-sm transition-all ${
        isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-300"
      }`}
    >
      <button
        type="button"
        onClick={() => setLanguage("fa")}
        className={`px-2.5 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
          language === "fa"
            ? "bg-indigo-600 text-white font-bold shadow-sm"
            : isDark
            ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
        }`}
        title="تغییر زبان به فارسی"
      >
        <span>فارسی</span>
      </button>
      <button
        type="button"
        onClick={() => setLanguage("en")}
        className={`px-2.5 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
          language === "en"
            ? "bg-indigo-600 text-white font-bold shadow-sm"
            : isDark
            ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
        }`}
        title="Switch language to English"
      >
        <span>English</span>
      </button>
    </div>
  );
}
