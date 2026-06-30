import { Disc3, FileAudio, ImageOff, Pencil } from "lucide-react";
import { type CSSProperties, memo, useEffect, useState } from "react";
import { PanelZoomControls } from "../../components/PanelZoomControls";
import { formatDuration, formatFileSize } from "../../lib/format";
import type { PanelZoomAction } from "../../lib/panelZoom";
import { resolveUnsyncedLyrics } from "../../lib/lyrics";
import { displayTitleWithVersion } from "../../lib/displayTitle";
import { useI18n } from "../../i18n";
import { formatSystemValueList } from "../../i18n/systemLabels";
import type {
  AudioMetadata,
  MetadataPatch,
  OrganizationPatch,
  SongStatus,
  TrackDetails,
} from "../../types/track";
import { SONG_STATUSES } from "../organization/SmartCollections";
import type { FieldVisibilityField } from "../settings/settings";

type CurationInlinePatch = Partial<
  Pick<
    TrackDetails,
    "strongPart" | "mainProblem" | "intendedUse" | "mood" | "generationModel"
  >
>;

interface TrackInspectorProps {
  track: TrackDetails | null;
  metadata: AudioMetadata | null;
  metadataLoading: boolean;
  metadataError: string | null;
  onRatingChange: (id: number, rating: number | null) => Promise<void>;
  onEdit: () => void;
  editSelectionCount: number;
  onMetadataInlineSave?: (patch: MetadataPatch) => Promise<void>;
  onOrganizationInlineSave?: (patch: OrganizationPatch) => Promise<void>;
  onCurationInlineSave?: (patch: CurationInlinePatch) => Promise<void>;
  onProjectNameInlineSave?: (name: string | null) => Promise<void>;
  visibleFields?: Set<FieldVisibilityField>;
  zoom?: number;
  onZoomChange?: (action: PanelZoomAction) => void;
}

function Field({
  label,
  value,
  hidden = false,
}: {
  label: string;
  value: string | number | null;
  hidden?: boolean;
}) {
  const { t } = useI18n();
  if (hidden) return null;
  return (
    <div className="grid grid-cols-[112px_1fr] gap-3 border-b border-white/6 py-2.5 text-xs">
      <dt className="text-white/35">{label}</dt>
      <dd className="min-w-0 break-words text-white/70">{value ?? t("common.notAvailableShort")}</dd>
    </div>
  );
}

function EditableTextField({
  label,
  value,
  displayValue,
  multiline = false,
  hidden = false,
  onSave,
}: {
  label: string;
  value: string | number | null;
  displayValue?: string | number | null;
  multiline?: boolean;
  hidden?: boolean;
  onSave?: (value: string | null) => Promise<void>;
}) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (hidden) return null;
  if (!onSave) return <Field label={label} value={displayValue ?? value} />;
  const save = onSave;

  async function saveDraft() {
    setSaving(true);
    setError(null);
    try {
      await save(draft.trim() || null);
      setEditing(false);
    } catch (saveError) {
      setError(String(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-[112px_1fr] gap-3 border-b border-white/6 py-2.5 text-xs">
      <dt className="text-white/35">{label}</dt>
      <dd className="min-w-0">
        {editing ? (
          <div className="space-y-2">
            {multiline ? (
              <textarea
                autoFocus
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className="field min-h-20 resize-y"
              />
            ) : (
              <input
                autoFocus
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className="field"
              />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveDraft()}
                className="rounded bg-[#d9ff43] px-2 py-1 text-[11px] font-semibold text-[#101113] disabled:opacity-40"
              >
                {t("common.save")}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setDraft(value?.toString() ?? "");
                  setEditing(false);
                  setError(null);
                }}
                className="rounded border border-white/10 px-2 py-1 text-[11px] text-white/55 hover:bg-white/5"
              >
                {t("common.cancel")}
              </button>
            </div>
            {error && <p className="text-[11px] text-red-200/70">{error}</p>}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(value?.toString() ?? "");
              setEditing(true);
            }}
            className="block w-full min-w-0 break-words rounded px-1 py-0.5 text-left text-white/70 hover:bg-white/5"
          >
            {displayValue ?? value ?? t("common.notAvailableShort")}
          </button>
        )}
      </dd>
    </div>
  );
}

function EditableLyricsField({
  value,
  loading,
  metadataError,
  onSave,
}: {
  value: string | null;
  loading: boolean;
  metadataError: string | null;
  onSave?: (value: string | null) => Promise<void>;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const normalizedInitial = value ?? "";
  const dirty = draft !== normalizedInitial;

  useEffect(() => {
    setDraft(value ?? "");
    setSaveError(null);
  }, [value]);

  async function saveDraft() {
    if (!onSave || loading) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(draft.trim() || null);
    } catch (error) {
      setSaveError(String(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border-b border-white/6 py-3 text-xs">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-white/35">{t("field.lyrics")}</span>
        <span className="text-[10px] text-white/30">
          {loading
            ? t("common.reading")
            : draft.trim()
              ? `${draft.length} ${t("common.characters")}`
              : t("library.notEmbeddedInFile")}
        </span>
      </div>
      <textarea
        value={draft}
        disabled={!onSave || loading}
        onChange={(event) => setDraft(event.target.value)}
        rows={8}
        className="field min-h-36 resize-y"
        placeholder={t("library.addLyricsPlaceholder")}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!onSave || loading || saving || !dirty}
          onClick={() => void saveDraft()}
          className="rounded bg-[#d9ff43] px-2.5 py-1.5 text-[11px] font-semibold text-[#101113] disabled:opacity-40"
        >
          {saving ? t("common.saving") : t("library.saveLyrics")}
        </button>
        <button
          type="button"
          disabled={!onSave || loading || saving || draft.length === 0}
          onClick={() => setDraft("")}
          className="rounded border border-white/10 px-2.5 py-1.5 text-[11px] text-white/55 hover:bg-white/5 disabled:opacity-40"
        >
          {t("common.clear")}
        </button>
        {dirty && (
          <span className="text-[11px] text-amber-100/65">
            {t("library.unsavedLyricsChanges")}
          </span>
        )}
      </div>
      {!onSave && (
        <p className="mt-2 text-[11px] leading-relaxed text-amber-100/60">
          {t("library.lyricsWritingUnsupported")}
        </p>
      )}
      {metadataError && (
        <p className="mt-2 text-[11px] leading-relaxed text-red-200/70">
          {t("field.metadataReadError")}: {metadataError}
        </p>
      )}
      {saveError && (
        <p className="mt-2 text-[11px] leading-relaxed text-red-200/70">
          {t("library.lyricsSaveFailed")}: {saveError}
        </p>
      )}
    </div>
  );
}

function EditableNumberField({
  label,
  value,
  integer = false,
  hidden = false,
  onSave,
}: {
  label: string;
  value: number | null;
  integer?: boolean;
  hidden?: boolean;
  onSave?: (value: number | null) => Promise<void>;
}) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (hidden) return null;
  if (!onSave) return <Field label={label} value={value} />;
  const save = onSave;

  async function saveDraft() {
    const trimmed = draft.trim().replace(",", ".");
    const nextValue =
      trimmed === ""
        ? null
        : integer
          ? Math.trunc(Number(trimmed))
          : Number(trimmed);
    if (nextValue !== null && !Number.isFinite(nextValue)) {
      setError(t("common.enterValidNumber"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await save(nextValue);
      setEditing(false);
    } catch (saveError) {
      setError(String(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-[112px_1fr] gap-3 border-b border-white/6 py-2.5 text-xs">
      <dt className="text-white/35">{label}</dt>
      <dd className="min-w-0">
        {editing ? (
          <div className="space-y-2">
            <input
              autoFocus
              inputMode="decimal"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="field"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveDraft()}
                className="rounded bg-[#d9ff43] px-2 py-1 text-[11px] font-semibold text-[#101113] disabled:opacity-40"
              >
                {t("common.save")}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setDraft(value?.toString() ?? "");
                  setEditing(false);
                  setError(null);
                }}
                className="rounded border border-white/10 px-2 py-1 text-[11px] text-white/55 hover:bg-white/5"
              >
                {t("common.cancel")}
              </button>
            </div>
            {error && <p className="text-[11px] text-red-200/70">{error}</p>}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(value?.toString() ?? "");
              setEditing(true);
            }}
            className="block w-full min-w-0 break-words rounded px-1 py-0.5 text-left text-white/70 hover:bg-white/5"
          >
            {value ?? t("common.notAvailableShort")}
          </button>
        )}
      </dd>
    </div>
  );
}

function EditableStatusField({
  value,
  hidden = false,
  onSave,
}: {
  value: SongStatus;
  hidden?: boolean;
  onSave?: (value: SongStatus) => Promise<void>;
}) {
  const { t } = useI18n();
  if (hidden) return null;
  if (!onSave) return <Field label={t("field.status")} value={t(`status.${value}`)} />;
  return (
    <div className="grid grid-cols-[112px_1fr] gap-3 border-b border-white/6 py-2.5 text-xs">
      <dt className="text-white/35">{t("field.status")}</dt>
      <dd>
        <select
          value={value}
          onChange={(event) => void onSave(event.target.value as SongStatus)}
          className="field"
        >
          {SONG_STATUSES.map((status) => (
            <option key={status} value={status}>
              {t(`status.${status}`)}
            </option>
          ))}
        </select>
      </dd>
    </div>
  );
}

export const TrackInspector = memo(function TrackInspector({
  track,
  metadata,
  metadataLoading,
  metadataError,
  onRatingChange,
  onEdit,
  editSelectionCount,
  onMetadataInlineSave,
  onOrganizationInlineSave,
  onCurationInlineSave,
  onProjectNameInlineSave,
  visibleFields,
  zoom = 1,
  onZoomChange,
}: TrackInspectorProps) {
  const { t, language } = useI18n();
  if (!track) {
    return (
      <aside
        data-testid="library-inspector-panel"
        className="panel-surface right-panel-zoom relative grid min-h-0 min-w-0 place-items-center border-l border-white/8 p-8 text-center"
        style={
          { "--right-panel-zoom": zoom } as CSSProperties &
            Record<"--right-panel-zoom", number>
        }
      >
        <div className="absolute right-4 top-4">
          {onZoomChange && <PanelZoomControls value={zoom} onChange={onZoomChange} />}
        </div>
        <div>
          <Disc3 className="mx-auto text-white/15" size={42} />
          <p className="mt-4 text-sm font-medium text-white/45">{t("organization.selectSong")}</p>
          <p className="mt-1 text-xs leading-relaxed text-white/25">
            {t("library.inspectorEmptyHelp")}
          </p>
        </div>
      </aside>
    );
  }

  const unsyncedLyrics = resolveUnsyncedLyrics(metadata, track);
  const show = (field: FieldVisibilityField) => visibleFields?.has(field) ?? true;
  const saveMetadata = (field: keyof MetadataPatch, value: string | number | null) =>
    onMetadataInlineSave?.({ [field]: { value } } as MetadataPatch) ??
    Promise.resolve();
  const saveOrganization = (
    field: keyof OrganizationPatch,
    value: string | number | null,
  ) =>
    onOrganizationInlineSave?.({ [field]: { value } } as OrganizationPatch) ??
    Promise.resolve();
  const saveCuration = <K extends keyof CurationInlinePatch>(
    field: K,
    value: string | null,
  ) => onCurationInlineSave?.({ [field]: value } as CurationInlinePatch) ?? Promise.resolve();
  const clean = (value: string | null | undefined) => value?.trim() || null;
  const pathBaseName = track.filePath.split(/[\\/]/).pop() || track.filePath;
  const displayTitle =
    clean(metadata?.title) ||
    clean(track.title) ||
    clean(track.fileName) ||
    pathBaseName;
  const displayTitleAndVersion = displayTitleWithVersion({
    ...track,
    title: displayTitle,
  });
  const titleTagValue =
    !metadataLoading && metadata && !metadataError
      ? clean(metadata.title)
      : clean(track.title);
  const fileNameTitle = track.fileName.replace(/\.[^/.\\]+$/, "").trim();
  const canUseFileNameAsTitle =
    Boolean(onMetadataInlineSave) &&
    !metadataLoading &&
    !titleTagValue &&
    fileNameTitle.length > 0;

  return (
    <aside
      data-testid="library-inspector-panel"
      className="panel-surface right-panel-zoom min-h-0 min-w-0 overflow-y-auto border-l border-white/8 pb-16"
      style={
        { "--right-panel-zoom": zoom } as CSSProperties &
          Record<"--right-panel-zoom", number>
      }
    >
      <div className="border-b border-white/8 p-5">
        <div className="mb-3 flex justify-end">
          {onZoomChange && <PanelZoomControls value={zoom} onChange={onZoomChange} />}
        </div>
        <div className="flex min-w-0 items-center gap-4">
          <div hidden={!show("coverArt")} className="grid size-24 shrink-0 place-items-center rounded-lg border border-white/8 bg-[#1c1d20]">
            {track.hasCoverArt ? (
              <FileAudio size={34} className="text-[#d9ff43]/55" />
            ) : (
              <ImageOff size={30} className="text-white/15" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3
              className="truncate text-base font-semibold"
              title={displayTitleAndVersion}
            >
              {displayTitleAndVersion}
            </h3>
            <p hidden={!show("artist")} className="mt-1 truncate text-sm text-white/40">
              {track.artist || t("explorer.unknownArtist")}
            </p>
            <button
              type="button"
              onClick={onEdit}
              className="mt-3 flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-white/55 hover:bg-white/5 hover:text-white/75"
            >
              <Pencil size={13} />
              {editSelectionCount > 0
                ? `${t("common.edit")} ${editSelectionCount} ${t("library.checkedSongs")}`
                : t("library.editMetadata")}
            </button>
          </div>
        </div>

        {show("rating") && <label className="mt-4 flex items-center justify-between rounded-md border border-white/8 bg-white/[0.025] px-3 py-2.5">
          <span className="text-xs font-medium text-white/45">{t("field.rating")}</span>
          <select
            value={track.rating ?? ""}
            onChange={(event) =>
              void onRatingChange(
                track.id,
                event.target.value ? Number(event.target.value) : null,
              )
            }
            className="rounded border border-white/10 bg-[#202226] px-2 py-1 text-sm text-white"
          >
            <option value="">{t("organization.noRating")}</option>
            {Array.from({ length: 10 }, (_, index) => index + 1).map((rating) => (
              <option key={rating} value={rating}>
                {rating} / 10
              </option>
            ))}
          </select>
        </label>}

      </div>

      <div className="p-5">
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-200/45">
          {t("library.internalOrganization")}
        </h4>
        <p className="mt-2 rounded-md border border-white/8 bg-white/[0.025] p-2.5 text-[11px] leading-relaxed text-white/40">
          {t("library.internalDataHelp")}
        </p>
        <dl className="mt-2">
          <EditableStatusField
            hidden={!show("status")}
            value={track.status}
            onSave={(value) => saveOrganization("status", value)}
          />
          <EditableTextField
            hidden={!show("project")}
            label={t("field.project")}
            value={track.projectName}
            onSave={onProjectNameInlineSave}
          />
          <EditableTextField
            label={t("field.version")}
            hidden={!show("version")}
            value={track.versionLabel}
            onSave={(value) => saveOrganization("versionLabel", value)}
          />
          <EditableTextField
            hidden={!show("tags")}
            label="Tags"
            value={track.tagNames || null}
            onSave={(value) =>
              onOrganizationInlineSave?.({
                tagNames: splitInlineList(value),
              }) ?? Promise.resolve()
            }
          />
          <EditableTextField
            label={t("field.nextAction")}
            hidden={!show("nextAction")}
            value={track.nextAction}
            onSave={(value) => saveOrganization("nextAction", value)}
          />
          <EditableTextField
            hidden={!show("notes")}
            label={t("field.notes")}
            value={track.workflowNotes}
            multiline
            onSave={(value) => saveOrganization("workflowNotes", value)}
          />
          <EditableTextField
            hidden={!show("strongPart")}
            label={t("field.strongPart")}
            value={track.strongPart}
            displayValue={formatSystemValueList(language, "strongPart", track.strongPart) || null}
            onSave={(value) => saveCuration("strongPart", value)}
          />
          <EditableTextField
            hidden={!show("mainProblem")}
            label={t("field.mainProblem")}
            value={track.mainProblem}
            displayValue={formatSystemValueList(language, "mainProblem", track.mainProblem) || null}
            onSave={(value) => saveCuration("mainProblem", value)}
          />
          <EditableTextField
            hidden={!show("intendedUse")}
            label={t("field.intendedUse")}
            value={track.intendedUse}
            displayValue={formatSystemValueList(language, "intendedUse", track.intendedUse) || null}
            onSave={(value) => saveCuration("intendedUse", value)}
          />
          <EditableTextField
            hidden={!show("mood")}
            label="Mood"
            value={track.mood}
            displayValue={formatSystemValueList(language, "mood", track.mood) || null}
            onSave={(value) => saveCuration("mood", value)}
          />
          <EditableTextField
            hidden={!show("generationModel")}
            label={t("field.generationModel")}
            value={track.generationModel}
            onSave={(value) => saveCuration("generationModel", value)}
          />
          <Field hidden={!show("lastReviewedAt")} label={t("field.lastReviewedAt")} value={track.lastReviewedAt} />
          <Field hidden={!show("skipCount")} label={t("field.skipCount")} value={track.skipCount} />
        </dl>

        {show("extendedTags") && (
          <>
        <h4 className="mt-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/30">
          {t("library.fileMetadata")}
        </h4>
        <p className="mt-2 rounded-md border border-amber-300/15 bg-amber-300/5 p-2.5 text-[11px] leading-relaxed text-amber-100/65">
          {t("library.fileMetadataWriteHelp")}
        </p>
        <dl className="mt-2">
          <EditableTextField
            label={t("field.titleTag")}
            hidden={!show("title")}
            value={track.title}
            displayValue={
              metadataLoading
                ? t("common.reading")
                : titleTagValue ?? t("library.noEmbeddedTitle")
            }
            onSave={(value) => saveMetadata("title", value)}
          />
          <Field
            label={t("field.fileName")}
            hidden={!show("title")}
            value={track.fileName}
          />
          {canUseFileNameAsTitle && (
            <div className="grid grid-cols-[112px_1fr] gap-3 border-b border-white/6 py-2.5 text-xs">
              <dt className="text-white/35" />
              <dd>
                <button
                  type="button"
                  onClick={() => void saveMetadata("title", fileNameTitle)}
                  className="rounded-md border border-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-white/60 hover:bg-white/5 hover:text-white/80"
                >
                  {t("library.useFileNameAsTitle")}
                </button>
              </dd>
            </div>
          )}
          <EditableTextField
            label={t("field.artist")}
            hidden={!show("artist")}
            value={track.artist}
            onSave={(value) => saveMetadata("artist", value)}
          />
          <EditableTextField
            label={t("field.album")}
            hidden={!show("album")}
            value={track.album}
            onSave={(value) => saveMetadata("album", value)}
          />
          <EditableTextField
            label={t("field.albumArtist")}
            hidden={!show("albumArtist")}
            value={track.albumArtist}
            onSave={(value) => saveMetadata("albumArtist", value)}
          />
          <EditableTextField
            label={t("field.genre")}
            hidden={!show("genre")}
            value={track.genre}
            onSave={(value) => saveMetadata("genre", value)}
          />
          <EditableNumberField
            label={t("field.year")}
            hidden={!show("year")}
            value={track.year}
            integer
            onSave={(value) => saveMetadata("year", value)}
          />
          <EditableNumberField
            label={t("field.trackNumber")}
            hidden={!show("trackNumber")}
            value={track.trackNumber}
            integer
            onSave={(value) => saveMetadata("trackNumber", value)}
          />
          <EditableNumberField
            label={t("field.discNumber")}
            hidden={!show("discNumber")}
            value={track.discNumber}
            integer
            onSave={(value) => saveMetadata("discNumber", value)}
          />
          <EditableNumberField
            label="BPM"
            hidden={!show("bpm")}
            value={track.bpm}
            onSave={(value) => saveMetadata("bpm", value)}
          />
          <EditableTextField
            label={t("field.musicalKey")}
            hidden={!show("musicalKey")}
            value={track.musicalKey}
            onSave={(value) => saveMetadata("musicalKey", value)}
          />
          <EditableTextField
            label={t("field.comment")}
            hidden={!show("comment")}
            value={track.comment}
            multiline
            onSave={(value) => saveMetadata("comment", value)}
          />
          {show("lyrics") && (
            <EditableLyricsField
              value={unsyncedLyrics}
              loading={metadataLoading}
              metadataError={metadataError}
              onSave={
                onMetadataInlineSave
                  ? (value) => saveMetadata("unsyncedLyrics", value)
                  : undefined
              }
            />
          )}
        </dl>

        {!metadataLoading && !metadataError && metadata && !unsyncedLyrics && (
          <p className="mt-3 rounded-md border border-amber-400/15 bg-amber-400/[0.045] p-3 text-xs leading-relaxed text-amber-100/55">
            {t("library.noLyricsFrames")}
          </p>
        )}
        {metadataError && (
          <p className="mt-3 rounded-md border border-red-400/20 bg-red-400/[0.06] p-3 text-xs leading-relaxed text-red-200/70">
            {t("library.liveMetadataReadFailed")}: {metadataError}
          </p>
        )}

        <h4 className="mt-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/30">
          {t("library.technicalInformation")}
        </h4>
        <dl className="mt-2">
          <Field hidden={!show("format")} label={t("field.format")} value={track.audioFormat.toUpperCase()} />
          <Field label={t("field.duration")} value={formatDuration(track.durationMs)} />
          <Field hidden={!show("bitrate")} label="Bitrate" value={track.bitrateKbps ? `${track.bitrateKbps} kbps` : null} />
          <Field
            hidden={!show("sampleRate")}
            label="Sample rate"
            value={track.sampleRateHz ? `${track.sampleRateHz} Hz` : null}
          />
          <Field hidden={!show("channels")} label={t("field.channels")} value={track.channels} />
          <Field label={t("field.fileSize")} value={formatFileSize(track.fileSize)} />
          <Field hidden={!show("path")} label={t("field.path")} value={track.filePath} />
        </dl>

        <h4 className="mt-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/30">
          {t("library.extendedTags")}
        </h4>
        {metadataLoading ? (
          <p className="mt-3 text-xs text-white/35">{t("library.readingFileTags")}</p>
        ) : metadata?.extendedTags.length ? (
          <div className="mt-3 space-y-2">
            {metadata.extendedTags.map((tag, index) => (
              <div
                key={`${tag.tagType}-${tag.key}-${index}`}
                className="rounded-md border border-white/7 bg-white/[0.025] p-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 break-all text-xs font-medium text-white/65">
                    {tag.key}
                  </p>
                  <span className="shrink-0 rounded bg-white/6 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-white/30">
                    {tag.tagType}
                  </span>
                </div>
                {tag.description && (
                  <p className="mt-1 text-[10px] text-white/30">{tag.description}</p>
                )}
                <p className="mt-1.5 max-h-28 overflow-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-white/45">
                  {tag.value}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs text-white/30">
            El archivo no contiene etiquetas extendidas legibles.
          </p>
        )}
          </>
        )}

        {show("metadataReadError") && track.metadataReadError && (
          <div className="mt-4 rounded-md border border-amber-400/20 bg-amber-400/8 p-3 text-xs leading-relaxed text-amber-100/75">
            No se pudieron leer todos los metadatos: {track.metadataReadError}
          </div>
        )}
      </div>
    </aside>
  );
});

function splitInlineList(value: string | null) {
  return (value ?? "")
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}
