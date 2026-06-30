import { memo } from "react";
import type { TrackSummary } from "../../types/track";
import { useI18n } from "../../i18n";
import type { FieldVisibilityField } from "../settings/settings";

interface OrganizationTableProps {
  tracks: TrackSummary[];
  selectedId: number | null;
  selectedIds: Set<number>;
  loading: boolean;
  visibleFields: Set<FieldVisibilityField>;
  onSelect: (track: TrackSummary) => void;
  onPlay: (track: TrackSummary) => void;
  onSelectionChange: (id: number, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
}

export const OrganizationTable = memo(function OrganizationTable({
  tracks,
  selectedId,
  selectedIds,
  loading,
  visibleFields,
  onSelect,
  onPlay,
  onSelectionChange,
  onSelectAll,
}: OrganizationTableProps) {
  const { t } = useI18n();
  const allSelected =
    tracks.length > 0 && tracks.every((track) => selectedIds.has(track.id));
  const show = (field: FieldVisibilityField) => visibleFields.has(field);

  if (!loading && tracks.length === 0) {
    return (
      <div className="grid h-full min-h-60 place-items-center px-6 text-center">
        <div>
          <p className="font-medium text-white/60">{t("organization.noSongsInFilter")}</p>
          <p className="mt-1 text-sm text-white/30">
            {t("organization.changeSmartCollection")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <table className="w-full min-w-[980px] border-collapse text-left text-sm">
      <thead className="card-surface sticky top-0 z-10 text-[11px] uppercase tracking-wider text-white/45 shadow-[0_4px_14px_rgba(0,0,0,0.1)]">
        <tr>
          <th className="border-b border-white/8 px-3 py-2.5">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(event) => onSelectAll(event.target.checked)}
              aria-label={t("organization.selectAllVisible")}
              className="accent-[#d9ff43]"
            />
          </th>
          <th className="border-b border-white/8 px-3 py-2.5 font-medium">{t("library.song")}</th>
          {show("status") && <th className="border-b border-white/8 px-3 py-2.5 font-medium">{t("field.status")}</th>}
          {show("project") && <th className="border-b border-white/8 px-3 py-2.5 font-medium">{t("field.project")}</th>}
          {show("version") && <th className="border-b border-white/8 px-3 py-2.5 font-medium">{t("field.version")}</th>}
          {show("tags") && <th className="border-b border-white/8 px-3 py-2.5 font-medium">Tags</th>}
          {show("nextAction") && <th className="border-b border-white/8 px-3 py-2.5 font-medium">{t("field.nextAction")}</th>}
        </tr>
      </thead>
      <tbody className={loading ? "opacity-45" : ""}>
        {tracks.map((track) => (
          <tr
            key={track.id}
            onClick={() => onSelect(track)}
            onDoubleClick={() => onPlay(track)}
            className={`cursor-pointer border-b border-white/[0.055] hover:bg-white/[0.055] ${
              selectedId === track.id
                ? "bg-[#d9ff43]/9 shadow-[inset_3px_0_0_#d9ff43]"
                : ""
            }`}
          >
            <td className="px-3 py-2.5">
              <input
                type="checkbox"
                checked={selectedIds.has(track.id)}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) =>
                  onSelectionChange(track.id, event.target.checked)
                }
                aria-label={`${t("organization.selectSongAction")} ${track.title ?? track.fileName}`}
                className="accent-[#d9ff43]"
              />
            </td>
            <td className="max-w-64 px-3 py-2.5">
              <p className="truncate text-white/75">{track.title || track.fileName}</p>
              <p hidden={!show("artist")} className="truncate text-[11px] text-white/30">
                {track.artist || track.fileName}
              </p>
            </td>
            {show("status") && <td className="px-3 py-2.5 text-white/65">{t(`status.${track.status}`)}</td>}
            {show("project") && <td className="max-w-44 truncate px-3 py-2.5 text-white/60">{track.projectName || "—"}</td>}
            {show("version") && <td className="max-w-32 truncate px-3 py-2.5 text-white/60">{track.versionLabel || "—"}</td>}
            {show("tags") && <td className="max-w-56 truncate px-3 py-2.5 text-white/55">{track.tagNames || "—"}</td>}
            {show("nextAction") && <td className="max-w-64 truncate px-3 py-2.5 text-white/55">{track.nextAction || "—"}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
});
