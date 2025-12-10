"use client";
import React, { createContext, useContext, useState, useEffect } from "react";

// Supported languages
export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English", dir: "ltr" },
  { code: "ar", label: "العربية", dir: "rtl" },
  // Add more languages here as needed
];

interface LanguageContextType {
  language: string;
  switchLanguage: (lang: string) => void;
  supportedLanguages: typeof SUPPORTED_LANGUAGES;
  direction: "ltr" | "rtl";
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageContextProvider");
  }
  return context;
};

export const LanguageContextProvider = ({ children }: any) => {
  const [language, setLanguage] = useState("en");
  const [direction, setDirection] = useState<"ltr" | "rtl">("ltr");

  useEffect(() => {
    const storedLanguage = localStorage.getItem("language") || "en";
    setLanguage(storedLanguage);
  }, []);

  useEffect(() => {
    const langObj: any = SUPPORTED_LANGUAGES.find(l => l.code === language) || SUPPORTED_LANGUAGES[0];
    setDirection(langObj.dir);
    localStorage.setItem("language", language);
    // Set dir attribute on html
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("dir", langObj.dir);
      document.documentElement.setAttribute("lang", language);
    }
  }, [language]);

  const switchLanguage = (lang: string) => {
    if (SUPPORTED_LANGUAGES.some(l => l.code === lang)) {
      setLanguage(lang);
    }
  };

  return (
    <LanguageContext.Provider value={{ language, switchLanguage, supportedLanguages: SUPPORTED_LANGUAGES, direction }}>
      {children}
    </LanguageContext.Provider>
  );
};