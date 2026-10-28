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
        isDark ? "bg-[#243447] border-[#364F6B]" : "bg-white border-[#364F6B]/20"
      }`}
    >
      <button
        type="button"
        onClick={() => setLanguage("fa")}
        className={`px-2.5 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
          language === "fa"
            ? "bg-[#FC5185] hover:bg-[#E04373] text-white font-bold shadow-sm"
            : isDark
            ? "text-[#F5F5F5]/70 hover:text-[#F5F5F5] hover:bg-[#1A2634]"
            : "text-[#364F6B]/70 hover:text-[#364F6B] hover:bg-[#F5F5F5]"
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
            ? "bg-[#FC5185] hover:bg-[#E04373] text-white font-bold shadow-sm"
            : isDark
            ? "text-[#F5F5F5]/70 hover:text-[#F5F5F5] hover:bg-[#1A2634]"
            : "text-[#364F6B]/70 hover:text-[#364F6B] hover:bg-[#F5F5F5]"
        }`}
        title="Switch language to English"
      >
        <span>English</span>
      </button>
    </div>
  );
}
