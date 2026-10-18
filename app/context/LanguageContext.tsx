"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";
import { Language, Direction, translations, TranslationDictionary } from "@/app/i18n/translations";

export interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  dir: Direction;
  isRtl: boolean;
  t: TranslationDictionary;
}

const STORAGE_KEY = "wepass_language";
const DEFAULT_LANGUAGE: Language = "fa";

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Initialize with Persian as default
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);

  // Load language preference from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Language | null;
      if (saved === "fa" || saved === "en") {
        setLanguageState(saved);
      } else {
        // If no saved preference exists, initialize in Persian
        setLanguageState(DEFAULT_LANGUAGE);
      }
    } catch {
      // In case localStorage is blocked/restricted, fallback to default Persian
      setLanguageState(DEFAULT_LANGUAGE);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // ignore storage write errors
    }
  };

  // Sync html lang and dir attributes whenever language changes
  useEffect(() => {
    const isRtl = language === "fa";
    document.documentElement.lang = language;
    document.documentElement.dir = isRtl ? "rtl" : "ltr";
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => {
    const isRtl = language === "fa";
    const dir: Direction = isRtl ? "rtl" : "ltr";
    const t = translations[language] || translations.fa;

    return {
      language,
      setLanguage,
      dir,
      isRtl,
      t,
    };
  }, [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    // Graceful fallback for components or tests rendered without provider
    const t = translations.fa;
    return {
      language: "fa",
      setLanguage: () => {},
      dir: "rtl",
      isRtl: true,
      t,
    };
  }
  return context;
}
