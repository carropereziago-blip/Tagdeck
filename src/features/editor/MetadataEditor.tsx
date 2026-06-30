import { open } from "@tauri-apps/plugin-dialog";
import { ImagePlus, Save, Trash2, X } from "lucide-react";
import { useState } from "react";
import { resolveUnsyncedLyrics } from "../../lib/lyrics";
import { useI18n } from "../../i18n";
import type {
  AudioMetadata,
  MetadataEditSummary,
  MetadataPatch,
  TrackDetails,
} from "../../types/track";

type EditorMode = "single" | "bulk";
type EditableField =
  | "title"
  | "artist"
  | "album"
  | "albumArtist"
  | "genre"
  | "year"
  | "trackNumber"
  | "trackTotal"
  | "discNumber"
  | "discTotal"
  | "comment"
  | "unsyncedLyrics"
  | "bpm"
  | "musicalKey";

interface FieldToggleProps {
  mode: EditorMode;
  field: EditableField;
  enabled: boolean;
  onToggle: (field: EditableField) => void;
  children: React.ReactNode;
}

interface EditorValues {
  title: string;
  artist: string;
  album: string;
  albumArtist: string;
  genre: string;
  year: string;
  trackNumber: string;
  trackTotal: string;
  discNumber: string;
  discTotal: string;
  comment: string;
  unsyncedLyrics: string;
  bpm: string;
  musicalKey: string;
}

interface MetadataEditorProps {
  mode: EditorMode;
  selectedCount: number;
  track: TrackDetails | null;
  metadata: AudioMetadata | null;
  onClose: () => void;
  onSave: (patch: MetadataPatch) => Promise<MetadataEditSummary>;
}

const EDITABLE_FIELDS: EditableField[] = [
  "title",
  "artist",
  "album",
  "albumArtist",
  "genre",
  "year",
  "trackNumber",
  "trackTotal",
  "discNumber",
  "discTotal",
  "comment",
  "unsyncedLyrics",
  "bpm",
  "musicalKey",
];

function FieldToggle({
  mode,
  field,
  enabled,
  onToggle,
  children,
}: FieldToggleProps) {
  if (mode === "single") {
    return children;
  }
  return (
    <div className="grid grid-cols-[auto_1fr] items-center gap-2">
      <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap">
        <input
          type="checkbox"
          checked={enabled}
          onChange={() => onToggle(field)}
          className="accent-[#d9ff43]"
        />
        <span>Aplicar</span>
      </label>
      {children}
    </div>
  );
}

function initialValues(
  mode: EditorMode,
  track: TrackDetails | null,
  metadata: AudioMetadata | null,
): EditorValues {
  if (mode === "bulk" || !track) {
    return {
      title: "",
      artist: "",
      album: "",
      albumArtist: "",
      genre: "",
      year: "",
      trackNumber: "",
      trackTotal: "",
      discNumber: "",
      discTotal: "",
      comment: "",
      unsyncedLyrics: "",
      bpm: "",
      musicalKey: "",
    };
  }

  return {
    title: metadata?.title ?? track.title ?? "",
    artist: metadata?.artist ?? track.artist ?? "",
    album: metadata?.album ?? track.album ?? "",
    albumArtist: metadata?.albumArtist ?? track.albumArtist ?? "",
    genre: metadata?.genre ?? track.genre ?? "",
    year: String(metadata?.year ?? track.year ?? ""),
    trackNumber: String(metadata?.trackNumber ?? track.trackNumber ?? ""),
    trackTotal: String(metadata?.trackTotal ?? track.trackTotal ?? ""),
    discNumber: String(metadata?.discNumber ?? track.discNumber ?? ""),
    discTotal: String(metadata?.discTotal ?? track.discTotal ?? ""),
    comment: metadata?.comment ?? track.comment ?? "",
    unsyncedLyrics: resolveUnsyncedLyrics(metadata, track) ?? "",
    bpm: String(metadata?.bpm ?? track.bpm ?? ""),
    musicalKey: metadata?.musicalKey ?? track.musicalKey ?? "",
  };
}

export function MetadataEditor({
  mode,
  selectedCount,
  track,
  metadata,
  onClose,
  onSave,
}: MetadataEditorProps) {
  const { t } = useI18n();
  const [values, setValues] = useState<EditorValues>(() =>
    initialValues(mode, track, metadata),
  );
  const [enabledFields, setEnabledFields] = useState<Set<EditableField>>(
    () => new Set(mode === "single" ? EDITABLE_FIELDS : []),
  );
  const [coverMode, setCoverMode] = useState<"keep" | "replace" | "remove">("keep");
  const [coverPath, setCoverPath] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<MetadataEditSummary | null>(null);

  function setValue(field: EditableField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    if (mode === "bulk") {
      setEnabledFields((current) => new Set(current).add(field));
    }
  }

  function toggleField(field: EditableField) {
    setEnabledFields((current) => {
      const next = new Set(current);
      if (next.has(field)) {
        next.delete(field);
      } else {
        next.add(field);
      }
      return next;
    });
  }

  async function chooseCover() {
    const selected = await open({
      multiple: false,
      directory: false,
      title: t("editor.selectCoverArt"),
      filters: [
        {
          name: t("editor.images"),
          extensions: ["jpg", "jpeg", "png", "gif", "bmp", "tif", "tiff"],
        },
      ],
    });
    if (typeof selected === "string") {
      setCoverPath(selected);
      setCoverMode("replace");
    }
  }

  function textValue(field: EditableField) {
    const value = values[field].trim();
    return value || null;
  }

  function integerValue(field: EditableField, label: string) {
    const raw = values[field].trim();
    if (!raw) {
      return null;
    }
    const value = Number(raw);
    if (!Number.isInteger(value)) {
      throw new Error(`${label} debe ser un número entero`);
    }
    return value;
  }

  function decimalValue(field: EditableField, label: string) {
    const raw = values[field].trim();
    if (!raw) {
      return null;
    }
    const value = Number(raw.replace(",", "."));
    if (!Number.isFinite(value)) {
      throw new Error(`${label} debe ser un número válido`);
    }
    return value;
  }

  function buildPatch(): MetadataPatch {
    const patch: MetadataPatch = {};
    const enabled = (field: EditableField) => enabledFields.has(field);

    if (enabled("title")) patch.title = { value: textValue("title") };
    if (enabled("artist")) patch.artist = { value: textValue("artist") };
    if (enabled("album")) patch.album = { value: textValue("album") };
    if (enabled("albumArtist")) {
      patch.albumArtist = { value: textValue("albumArtist") };
    }
    if (enabled("genre")) patch.genre = { value: textValue("genre") };
    if (enabled("year")) {
      patch.year = { value: integerValue("year", t("field.year")) };
    }
    if (enabled("trackNumber")) {
      patch.trackNumber = {
        value: integerValue("trackNumber", "Número de pista"),
      };
    }
    if (enabled("trackTotal")) {
      patch.trackTotal = {
        value: integerValue("trackTotal", "Total de pistas"),
      };
    }
    if (enabled("discNumber")) {
      patch.discNumber = {
        value: integerValue("discNumber", "Número de disco"),
      };
    }
    if (enabled("discTotal")) {
      patch.discTotal = {
        value: integerValue("discTotal", "Total de discos"),
      };
    }
    if (enabled("comment")) patch.comment = { value: textValue("comment") };
    if (enabled("unsyncedLyrics")) {
      patch.unsyncedLyrics = {
        value: values.unsyncedLyrics.trim() || null,
      };
    }
    if (enabled("bpm")) {
      patch.bpm = { value: decimalValue("bpm", "BPM") };
    }
    if (enabled("musicalKey")) {
      patch.musicalKey = { value: textValue("musicalKey") };
    }
    if (coverMode === "replace") {
      if (!coverPath) {
        throw new Error(t("editor.selectCoverImage"));
      }
      patch.coverArt = { value: coverPath };
    } else if (coverMode === "remove") {
      patch.coverArt = { value: null };
    }

    if (Object.keys(patch).length === 0) {
      throw new Error(t("editor.selectBulkField"));
    }
    return patch;
  }

  async function handleSubmit() {
    setError(null);
    setSummary(null);
    setSaving(true);
    try {
      const result = await onSave(buildPatch());
      setSummary(result);
    } catch (saveError) {
      setError(String(saveError));
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-md border border-white/10 bg-[#202226] px-3 py-2 text-sm text-white outline-none placeholder:text-white/20 focus:border-[#d9ff43]/50";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-6">
      <section className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-white/10 bg-[#151619] shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-white/8 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold">
              {mode === "single"
                ? `${t("common.edit")} ${track?.title || track?.fileName || t("library.song")}`
                : `${t("common.edit")} ${selectedCount} ${t("library.songs")}`}
            </h2>
            <p className="mt-1 text-xs text-white/40">
              {t("editor.realTagsWarning")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-white/45 hover:bg-white/8 hover:text-white"
            aria-label={t("editor.closeEditor")}
          >
            <X size={18} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <EditorField label={t("field.title")}>
              <FieldToggle
                mode={mode}
                field="title"
                enabled={enabledFields.has("title")}
                onToggle={toggleField}
              >
                <input
                  value={values.title}
                  onChange={(event) => setValue("title", event.target.value)}
                  className={inputClass}
                />
              </FieldToggle>
            </EditorField>
            <EditorField label={t("field.artist")}>
              <FieldToggle
                mode={mode}
                field="artist"
                enabled={enabledFields.has("artist")}
                onToggle={toggleField}
              >
                <input
                  value={values.artist}
                  onChange={(event) => setValue("artist", event.target.value)}
                  className={inputClass}
                />
              </FieldToggle>
            </EditorField>
            <EditorField label={t("field.album")}>
              <FieldToggle
                mode={mode}
                field="album"
                enabled={enabledFields.has("album")}
                onToggle={toggleField}
              >
                <input
                  value={values.album}
                  onChange={(event) => setValue("album", event.target.value)}
                  className={inputClass}
                />
              </FieldToggle>
            </EditorField>
            <EditorField label={t("field.albumArtist")}>
              <FieldToggle
                mode={mode}
                field="albumArtist"
                enabled={enabledFields.has("albumArtist")}
                onToggle={toggleField}
              >
                <input
                  value={values.albumArtist}
                  onChange={(event) => setValue("albumArtist", event.target.value)}
                  className={inputClass}
                />
              </FieldToggle>
            </EditorField>
            <EditorField label={t("field.genre")}>
              <FieldToggle
                mode={mode}
                field="genre"
                enabled={enabledFields.has("genre")}
                onToggle={toggleField}
              >
                <input
                  value={values.genre}
                  onChange={(event) => setValue("genre", event.target.value)}
                  className={inputClass}
                />
              </FieldToggle>
            </EditorField>
            <EditorField label={t("field.year")}>
              <FieldToggle
                mode={mode}
                field="year"
                enabled={enabledFields.has("year")}
                onToggle={toggleField}
              >
                <input
                  type="number"
                  min={1}
                  max={9999}
                  value={values.year}
                  onChange={(event) => setValue("year", event.target.value)}
                  className={inputClass}
                />
              </FieldToggle>
            </EditorField>
            <EditorField label={t("field.trackNumber")}>
              <FieldToggle
                mode={mode}
                field="trackNumber"
                enabled={enabledFields.has("trackNumber")}
                onToggle={toggleField}
              >
                <input
                  type="number"
                  min={1}
                  value={values.trackNumber}
                  onChange={(event) => setValue("trackNumber", event.target.value)}
                  className={inputClass}
                />
              </FieldToggle>
            </EditorField>
            <EditorField label={t("field.trackTotal")}>
              <FieldToggle
                mode={mode}
                field="trackTotal"
                enabled={enabledFields.has("trackTotal")}
                onToggle={toggleField}
              >
                <input
                  type="number"
                  min={1}
                  value={values.trackTotal}
                  onChange={(event) => setValue("trackTotal", event.target.value)}
                  className={inputClass}
                />
              </FieldToggle>
            </EditorField>
            <EditorField label={t("field.discNumber")}>
              <FieldToggle
                mode={mode}
                field="discNumber"
                enabled={enabledFields.has("discNumber")}
                onToggle={toggleField}
              >
                <input
                  type="number"
                  min={1}
                  value={values.discNumber}
                  onChange={(event) => setValue("discNumber", event.target.value)}
                  className={inputClass}
                />
              </FieldToggle>
            </EditorField>
            <EditorField label={t("field.discTotal")}>
              <FieldToggle
                mode={mode}
                field="discTotal"
                enabled={enabledFields.has("discTotal")}
                onToggle={toggleField}
              >
                <input
                  type="number"
                  min={1}
                  value={values.discTotal}
                  onChange={(event) => setValue("discTotal", event.target.value)}
                  className={inputClass}
                />
              </FieldToggle>
            </EditorField>
            <EditorField label="BPM">
              <FieldToggle
                mode={mode}
                field="bpm"
                enabled={enabledFields.has("bpm")}
                onToggle={toggleField}
              >
                <input
                  inputMode="decimal"
                  value={values.bpm}
                  onChange={(event) => setValue("bpm", event.target.value)}
                  className={inputClass}
                />
              </FieldToggle>
            </EditorField>
            <EditorField label={t("field.musicalKey")}>
              <FieldToggle
                mode={mode}
                field="musicalKey"
                enabled={enabledFields.has("musicalKey")}
                onToggle={toggleField}
              >
                <input
                  value={values.musicalKey}
                  onChange={(event) => setValue("musicalKey", event.target.value)}
                  className={inputClass}
                />
              </FieldToggle>
            </EditorField>
          </div>

          <div className="mt-4 grid gap-4">
            <EditorField label={t("field.comment")}>
              <FieldToggle
                mode={mode}
                field="comment"
                enabled={enabledFields.has("comment")}
                onToggle={toggleField}
              >
                <textarea
                  rows={3}
                  value={values.comment}
                  onChange={(event) => setValue("comment", event.target.value)}
                  className={inputClass}
                />
              </FieldToggle>
            </EditorField>
            <EditorField label={t("field.lyrics")}>
              <FieldToggle
                mode={mode}
                field="unsyncedLyrics"
                enabled={enabledFields.has("unsyncedLyrics")}
                onToggle={toggleField}
              >
                <textarea
                  rows={12}
                  value={values.unsyncedLyrics}
                  onChange={(event) => setValue("unsyncedLyrics", event.target.value)}
                  className={`${inputClass} font-mono text-xs leading-relaxed`}
                />
              </FieldToggle>
            </EditorField>

            <EditorField label={t("field.coverArt")}>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void chooseCover()}
                  className="flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm text-white/65 hover:bg-white/5"
                >
                  <ImagePlus size={16} />
                  {t("editor.selectImage")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCoverMode("remove");
                    setCoverPath("");
                  }}
                  className="flex items-center gap-2 rounded-md border border-red-400/15 px-3 py-2 text-sm text-red-200/65 hover:bg-red-400/5"
                >
                  <Trash2 size={16} />
                  {t("editor.removeCoverArt")}
                </button>
                {coverMode !== "keep" && (
                  <button
                    type="button"
                    onClick={() => {
                      setCoverMode("keep");
                      setCoverPath("");
                    }}
                    className="text-xs text-white/35 hover:text-white/60"
                  >
                    {t("editor.keepCurrent")}
                  </button>
                )}
              </div>
              <p className="mt-2 break-all text-xs text-white/35">
                {coverMode === "replace"
                  ? coverPath
                  : coverMode === "remove"
                    ? t("editor.coverWillBeRemoved")
                    : t("editor.coverWillStay")}
              </p>
            </EditorField>
          </div>

          {error && (
            <p className="mt-5 rounded-md border border-red-400/20 bg-red-400/8 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          )}
          {summary && (
            <div className="mt-5 rounded-md border border-[#d9ff43]/15 bg-[#d9ff43]/[0.04] px-4 py-3 text-sm">
              <p className="font-medium text-white/75">
                {summary.succeeded} {t("editor.saved")}, {summary.failed} {t("library.failed")}.
              </p>
              {summary.items
                .filter((item) => item.error)
                .slice(0, 5)
                .map((item) => (
                  <p key={item.trackId} className="mt-1 text-xs text-amber-100/65">
                    ID {item.trackId}: {item.error}
                  </p>
                ))}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-white/8 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-white/10 px-4 py-2 text-sm text-white/60 hover:bg-white/5"
          >
            {t("common.close")}
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={saving}
            className="flex items-center gap-2 rounded-md bg-[#d9ff43] px-4 py-2 text-sm font-semibold text-[#101113] disabled:opacity-45"
          >
            <Save size={16} />
            {saving ? t("common.saving") : t("editor.saveMetadata")}
          </button>
        </footer>
      </section>
    </div>
  );
}

function EditorField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="block text-xs text-white/45">
      <span className="mb-1.5 block font-medium">{label}</span>
      {children}
    </div>
  );
}
