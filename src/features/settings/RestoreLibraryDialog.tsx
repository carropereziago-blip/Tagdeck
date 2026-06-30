import { open } from "@tauri-apps/plugin-dialog";
import { AlertTriangle, DatabaseBackup, FileUp, FolderOpen, X } from "lucide-react";
import { useState } from "react";
import { useI18n } from "../../i18n";
import { api } from "../../lib/tauri";
import type { LibraryRestoreMode, LibraryRestorePreview } from "../../types/track";

export function RestoreLibraryDialog({
  onClose,
  onComplete,
}: {
  onClose: () => void;
  onComplete: (message: string) => void;
}) {
  const { t } = useI18n();
  const [preview, setPreview] = useState<LibraryRestorePreview | null>(null);
  const [mode, setMode] = useState<LibraryRestoreMode>("fill");
  const [relocationRoots, setRelocationRoots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function chooseBackup() {
    const path = await open({
      title: t("settings.restoreLibraryFromBackup"),
      multiple: false,
      directory: false,
      filters: [{ name: "TagDeck backup JSON", extensions: ["json"] }],
    });
    if (!path || Array.isArray(path)) return;
    await loadPreview(path, relocationRoots);
  }

  async function locateFolder() {
    if (!preview) return;
    const folder = await open({
      title: t("settings.locateMissingMusicFolder"),
      multiple: false,
      directory: true,
    });
    if (!folder || Array.isArray(folder)) return;
    const roots = [...relocationRoots, folder];
    setRelocationRoots(roots);
    await loadPreview(preview.sourcePath, roots);
  }

  async function loadPreview(path: string, roots: string[]) {
    setLoading(true);
    setError(null);
    try {
      setPreview(await api.previewLibraryRestore(path, roots));
    } catch (previewError) {
      setError(String(previewError));
    } finally {
      setLoading(false);
    }
  }

  async function applyRestore() {
    if (!preview) return;
    setApplying(true);
    setError(null);
    try {
      const result = await api.applyLibraryRestore(
        preview.sourcePath,
        mode,
        relocationRoots,
      );
      onComplete(
        t("settings.libraryRestoredMessage")
          .replace("{restored}", String(result.restored))
          .replace("{missing}", String(result.missing))
          .replace("{backupPath}", result.backupPath),
      );
      onClose();
    } catch (restoreError) {
      setError(String(restoreError));
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-5">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={t("settings.restoreLibraryFromBackup")}
        className="card-surface flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-white/10 shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-white/8 px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 font-semibold">
              <DatabaseBackup size={18} /> {t("settings.restoreLibraryFromBackup")}
            </h2>
            <p className="mt-1 text-xs text-white/40">
              {t("settings.restoreLibraryBackupHelp")}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label={t("common.close")} className="p-2 text-white/45">
            <X size={18} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void chooseBackup()} className="toolbar-button">
              <FileUp size={14} /> {preview ? t("importDialog.chooseAnotherFile") : t("settings.selectBackupJson")}
            </button>
            {preview && (
              <button type="button" onClick={() => void locateFolder()} className="toolbar-button">
                <FolderOpen size={14} /> {t("settings.locateMissingMusicFolder")}
              </button>
            )}
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
              <div className="mt-5 rounded-lg border border-white/8 p-4">
                <p className="text-sm font-semibold text-white/80">{t("settings.restorePreview")}</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <Stat label={t("settings.tracksInBackup")} value={preview.totalTracks} />
                  <Stat label={t("settings.filesFoundOriginal")} value={preview.foundOriginal} />
                  <Stat label={t("settings.filesFoundRelocated")} value={preview.foundRelocated} />
                  <Stat label={t("settings.missingFiles")} value={preview.missing} />
                  <Stat label={t("settings.playlistsToRestore")} value={preview.playlistsToRestore} />
                  <Stat label={t("settings.projectsToRestore")} value={preview.projectsToRestore} />
                </div>
                <p className="mt-4 text-xs leading-relaxed text-white/45">
                  {t("settings.internalFieldsToRestore")}: {preview.fieldsToRestore.join(", ")}
                </p>
                <p className="mt-2 flex items-center gap-2 text-[11px] text-sky-100/60">
                  <DatabaseBackup size={14} />
                  {t("settings.sqliteBackupBeforeRestore")}
                </p>
              </div>

              <div className="mt-5 rounded-lg border border-white/8 p-4">
                <p className="text-xs font-semibold text-white/70">{t("settings.restoreMode")}</p>
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <ModeOption checked={mode === "keep"} title={t("settings.restoreModeKeep")} onChange={() => setMode("keep")} />
                  <ModeOption checked={mode === "fill"} title={t("settings.restoreModeFill")} onChange={() => setMode("fill")} />
                  <ModeOption checked={mode === "overwrite"} title={t("settings.restoreModeOverwrite")} onChange={() => setMode("overwrite")} warning />
                </div>
              </div>

              {preview.missingItems.length > 0 && (
                <div className="mt-5 overflow-hidden rounded-lg border border-amber-300/15">
                  <div className="border-b border-white/8 px-3 py-2 text-xs font-semibold text-amber-100/70">
                    {t("settings.missingFiles")}
                  </div>
                  {preview.missingItems.slice(0, 50).map((item) => (
                    <div key={`${item.path}-${item.sourceName}`} className="grid gap-1 border-b border-white/[0.055] px-3 py-2 text-xs">
                      <span className="text-white/65">{item.sourceName}</span>
                      <span className="truncate text-white/35">{item.path}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-white/8 px-5 py-4">
          <p className="flex items-center gap-2 text-[10px] text-white/35">
            <AlertTriangle size={13} /> {t("settings.restoreDoesNotWriteAudio")}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="toolbar-button">{t("common.cancel")}</button>
            <button
              type="button"
              disabled={!preview || applying}
              onClick={() => void applyRestore()}
              className="rounded-md bg-[#d9ff43] px-4 py-2 text-sm font-semibold text-[#101113] disabled:opacity-35"
            >
              {applying ? t("importDialog.importing") : t("settings.restoreLibrary")}
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
  onChange,
  warning = false,
}: {
  checked: boolean;
  title: string;
  onChange: () => void;
  warning?: boolean;
}) {
  return (
    <label
      className={`rounded-lg border p-3 ${
        checked ? "border-[#d9ff43]/35 bg-[#d9ff43]/5" : warning ? "border-amber-300/15" : "border-white/8"
      }`}
    >
      <span className="flex items-center gap-2 text-xs font-medium text-white/70">
        <input type="radio" checked={checked} onChange={onChange} className="accent-[#d9ff43]" />
        {title}
      </span>
    </label>
  );
}
