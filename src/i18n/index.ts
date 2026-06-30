import { useMemo } from "react";
import { useSettings } from "../features/settings/SettingsContext";
import { en } from "./en";
import { es } from "./es";

export const SUPPORTED_LANGUAGES = ["en", "es"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const dictionaries = { en, es } as const;
type Dictionary = typeof en;

export function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return typeof value === "string" && SUPPORTED_LANGUAGES.includes(value as SupportedLanguage);
}

export function translate(language: SupportedLanguage, key: string): string {
  const localized = readPath(dictionaries[language], key);
  if (typeof localized === "string") return localized;
  const fallback = readPath(dictionaries.en, key);
  return typeof fallback === "string" ? fallback : key;
}

export function useI18n() {
  const { settings } = useSettings();
  const language = settings.interfaceLanguage;
  return useMemo(
    () => ({
      language,
      t: (key: string) => translate(language, key),
    }),
    [language],
  );
}

export function statusLabel(
  language: SupportedLanguage,
  status: keyof Dictionary["status"],
) {
  return translate(language, `status.${status}`);
}

function readPath(source: unknown, key: string): unknown {
  return key.split(".").reduce<unknown>((current, segment) => {
    if (typeof current !== "object" || current === null) return undefined;
    return (current as Record<string, unknown>)[segment];
  }, source);
}
