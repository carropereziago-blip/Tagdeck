import { Download } from "lucide-react";
import { UPDATE_MANIFEST_URL } from "../../lib/updates";
import type { UpdateCheckResult } from "../../types/track";
import type { SupportedLanguage } from "../../i18n";

export function UpdateSettingsPanel({
  currentVersion,
  lastCheckedAt,
  checking,
  result,
  error,
  language,
  t,
  onCheck,
  onOpenUrl,
}: {
  currentVersion: string;
  lastCheckedAt: string;
  checking: boolean;
  result: UpdateCheckResult | null;
  error: string | null;
  language: SupportedLanguage;
  t: (key: string) => string;
  onCheck: () => void;
  onOpenUrl: (url: string) => void;
}) {
  const notes =
    result?.manifest.notes[language] ??
    result?.manifest.notes.en ??
    Object.values(result?.manifest.notes ?? {})[0] ??
    [];

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-3">
        <UpdateStat label={t("settings.currentVersion")} value={currentVersion} />
        <UpdateStat
          label={t("settings.updateChannel")}
          value={result?.manifest.channel ?? "beta"}
        />
        <UpdateStat
          label={t("settings.lastChecked")}
          value={lastCheckedAt || t("common.notAvailable")}
        />
      </div>

      <p className="text-xs text-white/35">
        {t("settings.updateManifest")}: {UPDATE_MANIFEST_URL}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onCheck}
          disabled={checking}
          className="rounded-md bg-[#d9ff43] px-4 py-2 text-sm font-semibold text-[#101113] disabled:opacity-45"
        >
          {checking ? t("settings.checkingUpdates") : t("settings.checkForUpdates")}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100/75">
          <p className="font-semibold">{t("settings.updateCheckFailed")}</p>
          <p className="mt-1 text-xs text-red-100/60">{t("settings.updateCheckFailedHelp")}</p>
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-white/80">
            <Download size={16} className={result.updateAvailable ? "text-[#d9ff43]" : "text-white/35"} />
            {result.updateAvailable
              ? t("settings.newVersionAvailable")
              : t("settings.tagDeckUpToDate")}
          </p>
          <dl className="mt-3 grid gap-2 text-xs text-white/55 sm:grid-cols-2">
            <div>
              <dt className="text-white/35">{t("settings.installedVersion")}</dt>
              <dd className="font-medium text-white/70">{result.currentVersion}</dd>
            </div>
            <div>
              <dt className="text-white/35">{t("settings.availableVersion")}</dt>
              <dd className="font-medium text-white/70">{result.latestVersion}</dd>
            </div>
          </dl>

          {notes.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-white/60">{t("settings.updateChanges")}</p>
              <ul className="mt-2 grid gap-1 text-sm text-white/55">
                {notes.map((note) => (
                  <li key={note}>- {note}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {result.updateAvailable && (
              <button
                type="button"
                onClick={() => onOpenUrl(result.manifest.downloadUrl)}
                className="toolbar-button"
              >
                {t("settings.downloadUpdate")}
              </button>
            )}
            <button
              type="button"
              onClick={() => onOpenUrl(result.manifest.releaseNotesUrl)}
              className="toolbar-button"
            >
              {t("settings.releaseNotes")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function UpdateStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/8 bg-white/[0.025] p-3">
      <p className="text-[10px] uppercase tracking-wide text-white/30">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-white/70">{value}</p>
    </div>
  );
}
