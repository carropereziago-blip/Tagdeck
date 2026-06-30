import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api } from "../../lib/tauri";
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  type AppSettings,
} from "./settings";

interface SettingsContextValue {
  settings: AppSettings;
  loaded: boolean;
  saving: boolean;
  error: string | null;
  updateSettings: (update: (current: AppSettings) => AppSettings) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);
const FALLBACK_CONTEXT: SettingsContextValue = {
  settings: {
    ...DEFAULT_SETTINGS,
    interfaceLanguage: "es",
    interfaceMode: "advanced",
    hasSeenOnboarding: true,
  },
  loaded: true,
  saving: false,
  error: null,
  updateSettings: () => undefined,
  resetSettings: () => undefined,
};

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    void api
      .getAppSettings()
      .then((stored) => setSettings(normalizeSettings(stored)))
      .catch((loadError) => setError(String(loadError)))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.appearance.theme;
    document.documentElement.dataset.colorScheme =
      settings.appearance.theme.includes("light") ? "light" : "dark";
    document.documentElement.dataset.interfaceSize =
      settings.appearance.interfaceSize;
    document.documentElement.dataset.textSize = settings.appearance.textSize;
  }, [settings.appearance]);

  const updateSettings = useCallback(
    (update: (current: AppSettings) => AppSettings) => {
      setSettings((current) => {
        const next = normalizeSettings(update(current));
        if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
        setSaving(true);
        saveTimer.current = window.setTimeout(() => {
          void api
            .saveAppSettings(next)
            .then(() => setError(null))
            .catch((saveError) => setError(String(saveError)))
            .finally(() => setSaving(false));
        }, 180);
        return next;
      });
    },
    [],
  );

  const resetSettings = useCallback(() => {
    updateSettings(() => structuredClone(DEFAULT_SETTINGS));
  }, [updateSettings]);

  const value = useMemo(
    () => ({ settings, loaded, saving, error, updateSettings, resetSettings }),
    [error, loaded, resetSettings, saving, settings, updateSettings],
  );

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  return context ?? FALLBACK_CONTEXT;
}
