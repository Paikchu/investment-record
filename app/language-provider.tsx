"use client";

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { translate, type Language, languageKey, parseLanguage } from "@/lib/language";

type LanguageContextValue = { language: Language; chooseLanguage: (value: string) => void; t: (text: string) => string };
const LanguageContext = createContext<LanguageContextValue | null>(null);
let chosenLanguage: Language | null = null;
function getSnapshot(): Language {
  if (chosenLanguage) return chosenLanguage;
  try { return parseLanguage(localStorage.getItem(languageKey)); } catch { return "zh-CN"; }
}
const getServerSnapshot = (): Language => "zh-CN";
function subscribe(onChange: () => void) {
  const storageChanged = (event: StorageEvent) => {
    if (event.key === languageKey || event.key === null) { chosenLanguage = null; onChange(); }
  };
  window.addEventListener("storage", storageChanged);
  window.addEventListener("max-language-change", onChange);
  return () => {
    window.removeEventListener("storage", storageChanged);
    window.removeEventListener("max-language-change", onChange);
  };
}
export function LanguageProvider({ children }: { children: ReactNode }) {
  const language = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  const chooseLanguage = useCallback((value: string) => {
    if (value !== "zh-CN" && value !== "en") return;
    chosenLanguage = value;
    try { localStorage.setItem(languageKey, value); } catch {}
    window.dispatchEvent(new Event("max-language-change"));
  }, []);
  const t = useCallback((text: string) => translate(text, language), [language]);
  return <LanguageContext.Provider value={{ language, chooseLanguage, t }}>{children}</LanguageContext.Provider>;
}
export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage requires LanguageProvider");
  return context;
}
export function LocalizedText({ children }: { children: string }) {
  return useLanguage().t(children);
}
