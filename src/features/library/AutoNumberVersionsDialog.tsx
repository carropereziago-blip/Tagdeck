import { useMemo, useState } from "react";
import { useI18n } from "../../i18n";
import type { TrackSummary } from "../../types/track";

export type AutoNumberVersionOrder =
  | "current"
  | "fileName"
  | "natural"
  | "durationAsc"
  | "durationDesc"
  | "format"
  | "path";

export type AutoNumberVersionApplyMode = "empty" | "overwrite";

export interface AutoNumberVersionPlanItem {
  track: TrackSummary;
  versionLabel: string | null;
  skipped: boolean;
}

interface AutoNumberVersionsDialogProps {
  tracks: TrackSummary[];
  onCancel: () => void;
  onApply: (plan: AutoNumberVersionPlanItem[]) => Promise<void>;
}

const PREVIEW_LIMIT = 10;
const FORMAT_OPTIONS = ["v{n}", "take {n}", "version {n}", "remix {n}", "custom"] as const;

const naturalCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

export function orderVersionTracks(
  tracks: TrackSummary[],
  order: AutoNumberVersionOrder,
) {
  const ordered = [...tracks];
  switch (order) {
    case "fileName":
      return ordered.sort((left, right) =>
        left.fileName.localeCompare(right.fileName, undefined, { sensitivity: "base" }),
      );
    case "natural":
      return ordered.sort((left, right) =>
        naturalCollator.compare(left.fileName, right.fileName),
      );
    case "durationAsc":
      return ordered.sort((left, right) => (left.durationMs ?? 0) - (right.durationMs ?? 0));
    case "durationDesc":
      return ordered.sort((left, right) => (right.durationMs ?? 0) - (left.durationMs ?? 0));
    case "format":
      return ordered.sort((left, right) => {
        const formatCompare = left.audioFormat.localeCompare(right.audioFormat, undefined, {
          sensitivity: "base",
        });
        return formatCompare || naturalCollator.compare(left.fileName, right.fileName);
      });
    case "path":
      return ordered.sort((left, right) =>
        left.filePath.localeCompare(right.filePath, undefined, { sensitivity: "base" }),
      );
    case "current":
    default:
      return ordered;
  }
}

export function buildVersionPlan({
  tracks,
  format,
  startAt,
  order,
  applyMode,
  groupByTitleArtist,
}: {
  tracks: TrackSummary[];
  format: string;
  startAt: number;
  order: AutoNumberVersionOrder;
  applyMode: AutoNumberVersionApplyMode;
  groupByTitleArtist: boolean;
}) {
  const counters = new Map<string, number>();
  return orderVersionTracks(tracks, order).map((track) => {
    const hasVersion = Boolean(track.versionLabel?.trim());
    if (applyMode === "empty" && hasVersion) {
      return { track, versionLabel: track.versionLabel, skipped: true };
    }
    const groupKey = groupByTitleArtist ? trackGroupKey(track) : "__all__";
    const nextNumber = counters.get(groupKey) ?? startAt;
    counters.set(groupKey, nextNumber + 1);
    return {
      track,
      versionLabel: format.replaceAll("{n}", String(nextNumber)),
      skipped: false,
    };
  });
}

function trackGroupKey(track: TrackSummary) {
  return `${(track.title || fileStem(track.fileName)).trim().toLocaleLowerCase()}::${(track.artist ?? "").trim().toLocaleLowerCase()}`;
}

function fileStem(fileName: string) {
  return fileName.replace(/\.[^/.\\]+$/, "");
}

export function AutoNumberVersionsDialog({
  tracks,
  onCancel,
  onApply,
}: AutoNumberVersionsDialogProps) {
  const { t } = useI18n();
  const [formatPreset, setFormatPreset] = useState<(typeof FORMAT_OPTIONS)[number]>("v{n}");
  const [customFormat, setCustomFormat] = useState("v{n}");
  const [startAt, setStartAt] = useState(1);
  const [order, setOrder] = useState<AutoNumberVersionOrder>("current");
  const [applyMode, setApplyMode] = useState<AutoNumberVersionApplyMode>("empty");
  const [groupByTitleArtist, setGroupByTitleArtist] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const format = formatPreset === "custom" ? customFormat : formatPreset;
  const formatIsValid = format.includes("{n}");
  const safeStartAt = Number.isFinite(startAt) ? Math.max(1, Math.trunc(startAt)) : 1;
  const plan = useMemo(
    () =>
      formatIsValid
        ? buildVersionPlan({
            tracks,
            format,
            startAt: safeStartAt,
            order,
            applyMode,
            groupByTitleArtist,
          })
        : [],
    [applyMode, format, formatIsValid, groupByTitleArtist, order, safeStartAt, tracks],
  );
  const updatedCount = plan.filter((item) => !item.skipped).length;
  const skippedCount = plan.length - updatedCount;

  async function apply() {
    if (!formatIsValid) {
      setError(t("library.autoNumberFormatError"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onApply(plan);
    } catch (applyError) {
      setError(String(applyError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4">
      <section className="w-full max-w-2xl rounded-xl border border-white/10 bg-[#181b20] shadow-2xl">
        <header className="border-b border-white/8 px-5 py-4">
          <h2 className="text-lg font-semibold">{t("library.autoNumberVersions")}</h2>
          <p className="mt-1 text-xs text-white/45">
            {t("library.selectedSongs")}: {tracks.length}
          </p>
        </header>

        <div className="grid gap-4 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-white/45">
              <span className="mb-1.5 block">{t("library.autoNumberFormat")}</span>
              <select
                value={formatPreset}
                onChange={(event) => setFormatPreset(event.target.value as (typeof FORMAT_OPTIONS)[number])}
                className="field"
              >
                {FORMAT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option === "custom" ? t("library.autoNumberFormatCustom") : option}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-white/45">
              <span className="mb-1.5 block">{t("library.autoNumberStartAt")}</span>
              <input
                type="number"
                min={1}
                value={startAt}
                onChange={(event) => setStartAt(Number(event.target.value))}
                className="field"
              />
            </label>
          </div>

          {formatPreset === "custom" && (
            <label className="text-xs text-white/45">
              <span className="mb-1.5 block">{t("library.autoNumberCustomFormat")}</span>
              <input
                value={customFormat}
                onChange={(event) => setCustomFormat(event.target.value)}
                placeholder="v{n}"
                className="field"
              />
            </label>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-white/45">
              <span className="mb-1.5 block">{t("library.autoNumberOrderBy")}</span>
              <select
                value={order}
                onChange={(event) => setOrder(event.target.value as AutoNumberVersionOrder)}
                className="field"
              >
                <option value="current">{t("library.autoNumberOrderCurrent")}</option>
                <option value="fileName">{t("library.autoNumberOrderFileName")}</option>
                <option value="natural">{t("library.autoNumberOrderNatural")}</option>
                <option value="durationAsc">{t("library.autoNumberOrderDurationAsc")}</option>
                <option value="durationDesc">{t("library.autoNumberOrderDurationDesc")}</option>
                <option value="format">{t("library.autoNumberOrderFormat")}</option>
                <option value="path">{t("library.autoNumberOrderPath")}</option>
              </select>
            </label>
            <label className="text-xs text-white/45">
              <span className="mb-1.5 block">{t("library.autoNumberApplyTo")}</span>
              <select
                value={applyMode}
                onChange={(event) => setApplyMode(event.target.value as AutoNumberVersionApplyMode)}
                className="field"
              >
                <option value="empty">{t("library.autoNumberOnlyEmpty")}</option>
                <option value="overwrite">{t("library.autoNumberOverwrite")}</option>
              </select>
            </label>
          </div>

          <label className="flex items-center gap-2 text-xs text-white/55">
            <input
              type="checkbox"
              checked={groupByTitleArtist}
              onChange={(event) => setGroupByTitleArtist(event.target.checked)}
              className="accent-[#d9ff43]"
            />
            {t("library.autoNumberGroupByTitleArtist")}
          </label>

          {applyMode === "overwrite" && (
            <p className="rounded-md border border-amber-300/15 bg-amber-300/5 px-3 py-2 text-xs text-amber-100/70">
              {t("library.autoNumberOverwriteWarning")}
            </p>
          )}

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/35">
              {t("library.autoNumberPreview")}
            </p>
            <div className="mt-2 max-h-72 overflow-auto rounded-lg border border-white/8 bg-white/[0.02]">
              {plan.slice(0, PREVIEW_LIMIT).map((item) => (
                <div
                  key={item.track.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto_minmax(5rem,auto)] gap-2 border-b border-white/6 px-3 py-2 text-xs last:border-b-0"
                >
                  <span className="truncate text-white/65" title={item.track.fileName}>
                    {item.track.fileName}
                  </span>
                  <span className="text-white/25">-&gt;</span>
                  <span className={item.skipped ? "text-white/35" : "font-semibold text-[#d9ff43]/80"}>
                    {item.skipped
                      ? `${item.versionLabel ?? t("common.notAvailableShort")} (${t("library.autoNumberSkipped")})`
                      : item.versionLabel}
                  </span>
                </div>
              ))}
            </div>
            {plan.length > PREVIEW_LIMIT && (
              <p className="mt-2 text-xs text-white/35">
                {t("library.autoNumberAndMore").replace("{count}", String(plan.length - PREVIEW_LIMIT))}
              </p>
            )}
          </div>

          {error && (
            <p className="rounded-md border border-red-400/20 bg-red-400/7 px-3 py-2 text-xs text-red-200">
              {error}
            </p>
          )}
          {!formatIsValid && (
            <p className="text-xs text-red-200/80">{t("library.autoNumberFormatError")}</p>
          )}
          <p className="text-xs text-white/35">
            {updatedCount} {t("library.autoNumberWillUpdate")}
            {skippedCount > 0 ? `, ${skippedCount} ${t("library.autoNumberWillSkip")}` : ""}.
          </p>
        </div>

        <footer className="flex justify-end gap-2 border-t border-white/8 px-5 py-4">
          <button
            type="button"
            disabled={saving}
            onClick={onCancel}
            className="rounded-md border border-white/10 px-4 py-2 text-sm text-white/60 hover:bg-white/5 disabled:opacity-50"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            disabled={saving || !formatIsValid || updatedCount === 0}
            onClick={() => void apply()}
            className="rounded-md bg-[#d9ff43] px-4 py-2 text-sm font-semibold text-[#101113] hover:bg-[#e4ff72] disabled:opacity-50"
          >
            {saving ? t("common.saving") : t("common.apply")}
          </button>
        </footer>
      </section>
    </div>
  );
}
