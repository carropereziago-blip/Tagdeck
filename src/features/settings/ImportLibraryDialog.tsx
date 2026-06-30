import { open } from "@tauri-apps/plugin-dialog";
import { AlertTriangle, DatabaseBackup, FileUp, X } from "lucide-react";
import { useState } from "react";
import { useI18n } from "../../i18n";
import { api } from "../../lib/tauri";
import type { ImportPreview } from "../../types/track";

export function ImportLibraryDialog({
  onClose,
  onComplete,
}: {
  onClose: () => void;
  onComplete: (message: string) => void;
}) {
  const { t } = useI18n();
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [mode, setMode] = useState<"safe" | "overwrite">("safe");
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function chooseFile() {
    const path = await open({
      title: t("importDialog.title"),
      multiple: false,
      directory: false,
      filters: [
        { name: t("importDialog.tagdeckExports"), extensions: ["csv", "json"] },
      ],
    });
    if (!path || Array.isArray(path)) return;
    setLoading(true);
    setError(null);
    try {
      setPreview(await api.previewLibraryImport(path));
    } catch (previewError) {
      setError(String(previewError));
    } finally {
      setLoading(false);
    }
  }

  async function applyImport() {
    if (!preview) return;
    if (
      mode === "overwrite" &&
      !window.confirm(
        t("importDialog.overwriteConfirm"),
      )
    ) {
      return;
    }
    setApplying(true);
    setError(null);
    try {
      const result = await api.applyLibraryImport(preview.sourcePath, mode);
      onComplete(
        `${result.updated} ${t("importDialog.songsUpdated")}. ${result.playlistSongsAdded} ${t("importDialog.songsAddedToPlaylists")}. ${t("field.backupPath")}: ${result.backupPath}`,
      );
      onClose();
    } catch (applyError) {
      setError(String(applyError));
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-5">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={t("importDialog.ariaLabel")}
        className="card-surface flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-white/10 shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-white/8 px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 font-semibold">
              <FileUp size={18} /> {t("importDialog.title")}
            </h2>
            <p className="mt-1 text-xs text-white/40">
              {t("importDialog.help")}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label={t("common.close")} className="p-2 text-white/45">
            <X size={18} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void chooseFile()} className="toolbar-button">
              <FileUp size={14} /> {preview ? t("importDialog.chooseAnotherFile") : t("importDialog.selectFile")}
            </button>
            {preview && (
              <p className="min-w-0 flex-1 truncate text-xs text-white/40">
                {preview.sourcePath}
              </p>
            )}
          </div>

          {loading && <p className="mt-5 text-sm text-white/45">{t("importDialog.analyzingMatches")}</p>}
          {error && (
            <p className="mt-4 rounded-lg border border-red-400/20 bg-red-400/8 px-4 py-3 text-xs text-red-200">
              {error}
            </p>
          )}

          {preview && (
            <>
              <div className="mt-5 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                <Stat label={t("importDialog.rows")} value={preview.total} />
                <Stat label={t("importDialog.matched")} value={preview.matched} />
                <Stat label={t("importDialog.wouldUpdate")} value={preview.wouldUpdate} />
                <Stat label={t("importDialog.notFound")} value={preview.notFound} />
                <Stat label={t("importDialog.ambiguous")} value={preview.ambiguous} />
                <Stat label={t("nav.playlists")} value={preview.playlistsFound} />
              </div>

              <div className="mt-5 rounded-lg border border-white/8 p-4">
                <p className="text-xs font-semibold text-white/70">{t("importDialog.importMode")}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <ModeOption
                    checked={mode === "safe"}
                    title={t("importDialog.safeMode")}
                    description={t("importDialog.safeModeDescription")}
                    onChange={() => setMode("safe")}
                  />
                  <ModeOption
                    checked={mode === "overwrite"}
                    title={t("importDialog.overwriteMode")}
                    description={t("importDialog.overwriteModeDescription")}
                    onChange={() => setMode("overwrite")}
                    warning
                  />
                </div>
                <p className="mt-3 flex items-center gap-2 text-[11px] text-sky-100/55">
                  <DatabaseBackup size={14} />
                  {t("importDialog.backupHelp")}
                </p>
              </div>

              <div className="mt-5 overflow-hidden rounded-lg border border-white/8">
                <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 border-b border-white/8 px-3 py-2 text-[10px] uppercase tracking-wide text-white/35">
                  <span>{t("importDialog.source")}</span><span>{t("importDialog.match")}</span><span>{t("importDialog.changesConflicts")}</span>
                </div>
                {preview.items.slice(0, 100).map((item) => (
                  <div
                    key={`${item.sourceIndex}-${item.sourceName}`}
                    className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 border-b border-white/[0.055] px-3 py-2.5 text-xs"
                  >
                    <span className="truncate text-white/65">{item.sourceName}</span>
                    <span className="truncate text-white/45">
                      {item.ambiguous
                        ? t("importDialog.ambiguousMatch")
                        : item.matchedTrackName
                          ? `${item.matchedTrackName} · ${item.matchMethod}`
                          : t("importDialog.notFoundSingular")}
                    </span>
                    <span className="truncate text-white/40">
                      {item.changes.length > 0 ? item.changes.join(", ") : t("importDialog.noSafeChanges")}
                      {item.conflicts.length > 0 ? ` · ${t("importDialog.conflicts")}: ${item.conflicts.join(", ")}` : ""}
                    </span>
                  </div>
                ))}
              </div>
              {preview.items.length > 100 && (
                <p className="mt-2 text-[10px] text-white/30">
                  {t("importDialog.showingFirstRows")} {preview.items.length}.
                </p>
              )}
            </>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-white/8 px-5 py-4">
          <p className="flex items-center gap-2 text-[10px] text-white/35">
            <AlertTriangle size={13} /> {t("importDialog.noNewSongsNoWrites")}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="toolbar-button">{t("common.cancel")}</button>
            <button
              type="button"
              disabled={!preview || preview.matched === 0 || applying}
              onClick={() => void applyImport()}
              className="rounded-md bg-[#d9ff43] px-4 py-2 text-sm font-semibold text-[#101113] disabled:opacity-35"
            >
              {applying ? t("importDialog.importing") : mode === "safe" ? t("importDialog.importSafe") : t("importDialog.overwriteData")}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/8 bg-white/[0.025] p-3">
      <p className="text-[10px] uppercase tracking-wide text-white/30">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white/75">{value}</p>
    </div>
  );
}

function ModeOption({
  checked,
  title,
  description,
  onChange,
  warning = false,
}: {
  checked: boolean;
  title: string;
  description: string;
  onChange: () => void;
  warning?: boolean;
}) {
  return (
    <label className={`rounded-lg border p-3 ${checked ? "border-[#d9ff43]/35 bg-[#d9ff43]/5" : "border-white/8"}`}>
      <span className="flex items-center gap-2 text-xs font-medium text-white/70">
        <input type="radio" checked={checked} onChange={onChange} className="accent-[#d9ff43]" />
        {title}
      </span>
      <span className={`mt-1 block pl-5 text-[11px] ${warning ? "text-amber-100/55" : "text-white/35"}`}>
        {description}
      </span>
    </label>
  );
}
