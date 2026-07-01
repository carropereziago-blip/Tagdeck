import {
  Compass,
  Database,
  Download,
  FileUp,
  FolderOpen,
  Info,
  Library,
  ListMusic,
  Palette,
  Radio,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Volume2,
} from "lucide-react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { api } from "../../lib/tauri";
import {
  formatShortcut,
  keyComboFromEvent,
  shortcutConflictIds,
} from "../../lib/keyboardShortcuts";
import type {
  AppDiagnostics,
  LibraryQuery,
  OrganizationOptions,
  PackType,
  PlaylistSummary,
  UpdateCheckResult,
} from "../../types/track";
import {
  DEFAULT_LIBRARY_COLUMNS,
  DEFAULT_FIELD_VISIBILITY,
  FIELD_VISIBILITY_CATEGORIES,
  FIELD_VISIBILITY_FIELDS,
  FIELD_VISIBILITY_PRESETS,
  FIELD_VISIBILITY_ZONES,
  LIBRARY_COLUMNS,
  applyFieldVisibilityPreset,
  defaultKeyboardShortcuts,
  isFieldRequiredInZone,
  isFieldSupportedInZone,
  normalizeFieldVisibility,
  normalizeLibraryColumnOrder,
  resetSectionOnboarding,
  setFieldVisibility,
  setZoneVisibility,
  visibleLibraryColumns,
  type AppSettings,
  type FieldVisibilityCategory,
  type FieldVisibilityConfig,
  type FieldVisibilityField,
  type FieldVisibilityPresetId,
  type FieldVisibilityZone,
  type LibraryColumn,
  type ShortcutContext,
  type ShortcutField,
  type ShortcutRule,
} from "./settings";
import { useSettings } from "./SettingsContext";
import { ImportLibraryDialog } from "./ImportLibraryDialog";
import { RestoreLibraryDialog } from "./RestoreLibraryDialog";
import { useI18n, type SupportedLanguage } from "../../i18n";
import { UpdateSettingsPanel } from "./UpdateSettingsPanel";

const LIBRARY_FILTERS_KEY = "tagdeck.library.filters";
const SHORTCUT_CONTEXTS: ShortcutContext[] = ["global", "library", "explorer", "session"];
const SHORTCUT_FIELDS: ShortcutField[] = [
  "rating",
  "status",
  "genre",
  "mood",
  "internal_tag",
  "project",
  "model",
  "language",
  "next_action",
  "action",
];
const EMPTY_ORGANIZATION_OPTIONS: OrganizationOptions = {
  tags: [],
  projects: [],
  versions: [],
  models: [],
  smartCollections: [],
};
const SHORTCUT_STATUS_VALUES = [
  "review",
  "idea",
  "editing",
  "generating",
  "selected",
  "final",
  "archived",
] as const;
const SHORTCUT_ACTION_VALUES = [
  "play_pause",
  "next",
  "previous",
  "save",
  "save_and_next",
  "skip",
  "clear_selection",
  "open_in_explorer",
  "open_in_session",
  "add_to_playlist",
  "reset_zoom",
] as const;
const SHORTCUT_LANGUAGE_VALUES = [
  "en",
  "es",
  "instrumental",
  "pt",
  "fr",
  "de",
  "it",
  "other",
] as const;
const SUGGESTED_GENRES = [
  "House",
  "Piano House",
  "Latin House",
  "Techno",
  "Detroit Techno",
  "Chicago House",
  "Pop",
  "Rock",
  "Funk",
  "Soul",
  "Gospel House",
  "Psytrance",
  "Ambient",
  "Hip Hop",
];
const SUGGESTED_MOODS = [
  "Danceable",
  "Energetic",
  "Happy",
  "Dark",
  "Chill",
  "Emotional",
  "Epic",
  "Funny",
  "Melancholic",
  "Aggressive",
  "Hypnotic",
  "Groovy",
];
const SUGGESTED_TAGS = [
  "Potential",
  "Strong Idea",
  "Maybe Later",
  "Rejects I Like",
  "Custom Model Seed",
  "Release Candidate",
  "Final Version",
  "Needs Stems",
  "Needs Mix",
  "Needs Master",
  "Needs Arrangement",
  "Needs Shorter Edit",
  "Useful Fragment",
  "Core Seed",
  "Reference Only",
  "Vocal Reference",
  "Groove Reference",
  "Lyric Reference",
  "Arrangement Reference",
  "Production Reference",
];
const SUGGESTED_MODELS = ["Suno", "Suno v4", "Suno v4.5", "Udio", "Custom"];

const LIBRARY_FIELD_BY_COLUMN: Partial<Record<LibraryColumn, FieldVisibilityField>> = {
  trackNumber: "trackNumber",
  title: "title",
  artist: "artist",
  album: "album",
  albumArtist: "albumArtist",
  genre: "genre",
  year: "year",
  rating: "rating",
  status: "status",
  project: "project",
  version: "version",
  tags: "tags",
  mood: "mood",
  duration: "duration",
  format: "format",
  bpm: "bpm",
  musicalKey: "musicalKey",
  playCount: "playCount",
  nextAction: "nextAction",
  path: "path",
  reviewedAt: "reviewedAt",
  intendedUse: "intendedUse",
  generationModel: "generationModel",
};

export function SettingsView({
  onOpenOnboarding,
  onOpenDemo,
}: {
  onOpenOnboarding?: () => void;
  onOpenDemo?: () => void;
}) {
  const { settings, updateSettings, resetSettings, saving, error } = useSettings();
  const { t, language } = useI18n();
  const [diagnostics, setDiagnostics] = useState<AppDiagnostics | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [organizationOptions, setOrganizationOptions] =
    useState<OrganizationOptions>(EMPTY_ORGANIZATION_OPTIONS);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lastExportPath, setLastExportPath] = useState<string | null>(null);
  const [lastExportBytes, setLastExportBytes] = useState<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [fieldSearch, setFieldSearch] = useState("");
  const [fieldCategory, setFieldCategory] = useState<FieldVisibilityCategory | "all">("all");
  const [capturingShortcutId, setCapturingShortcutId] = useState<string | null>(null);
  const shortcutImportRef = useRef<HTMLInputElement | null>(null);
  const shortcutConflicts = useMemo(
    () => shortcutConflictIds(settings.customKeyboardShortcuts),
    [settings.customKeyboardShortcuts],
  );

  useEffect(() => {
    void api.getAppDiagnostics().then(setDiagnostics).catch(() => undefined);
    void api.getDeviceId().then(setDeviceId).catch(() => undefined);
    void api
      .getPlaylists()
      .then((items) => {
        setPlaylists(items);
        setSelectedPlaylistId((current) => current ?? items[0]?.id ?? null);
      })
      .catch(() => undefined);
    void api.getOrganizationOptions().then(setOrganizationOptions).catch(() => undefined);
  }, []);

  const selectedPlaylist = useMemo(
    () => playlists.find((playlist) => playlist.id === selectedPlaylistId) ?? null,
    [playlists, selectedPlaylistId],
  );

  function section<K extends keyof AppSettings>(
    key: K,
    patch: Partial<AppSettings[K]>,
  ) {
    updateSettings((current) => ({
      ...current,
      [key]: { ...(current[key] as object), ...patch },
    }));
  }

  function setInterfaceLanguage(interfaceLanguage: SupportedLanguage) {
    updateSettings((current) => ({
      ...current,
      interfaceLanguage,
    }));
  }

  function resetSectionTips() {
    updateSettings((current) => ({
      ...current,
      hiddenSectionOnboarding: resetSectionOnboarding(),
    }));
  }

  function toggleLibraryColumn(column: LibraryColumn, enabled: boolean) {
    if (column === "title" && !enabled) return;
    const field = LIBRARY_FIELD_BY_COLUMN[column];
    if (!field) return;
    saveFieldVisibility(
      setFieldVisibility(settings.fieldVisibility, "libraryTable", field, enabled),
    );
  }

  function saveFieldVisibility(config: FieldVisibilityConfig) {
    const normalized = normalizeFieldVisibility(config);
    updateSettings((current) => ({
      ...current,
      fieldVisibility: normalized,
      library: {
        ...current.library,
        visibleColumns: visibleLibraryColumns(normalized, current.library.columnOrder),
      },
    }));
  }

  function updateLibraryColumnOrder(columnOrder: LibraryColumn[]) {
    const normalizedOrder = normalizeLibraryColumnOrder(columnOrder);
    updateSettings((current) => ({
      ...current,
      library: {
        ...current.library,
        columnOrder: normalizedOrder,
        visibleColumns: visibleLibraryColumns(current.fieldVisibility, normalizedOrder),
      },
    }));
  }

  function moveLibraryColumn(column: LibraryColumn, direction: -1 | 1) {
    const ordered = normalizeLibraryColumnOrder(settings.library.columnOrder);
    const index = ordered.indexOf(column);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= ordered.length) return;
    const next = [...ordered];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    updateLibraryColumnOrder(next);
  }

  function toggleField(
    zone: FieldVisibilityZone,
    field: FieldVisibilityField,
    enabled: boolean,
  ) {
    if (!isFieldSupportedInZone(zone, field) || isFieldRequiredInZone(zone, field)) return;
    saveFieldVisibility(setFieldVisibility(settings.fieldVisibility, zone, field, enabled));
  }

  function markZone(zone: FieldVisibilityZone, enabled: boolean) {
    const fields = filteredVisibilityFields().map((field) => field.id);
    saveFieldVisibility(setZoneVisibility(settings.fieldVisibility, zone, enabled, fields));
  }

  function applyPreset(presetId: FieldVisibilityPresetId) {
    saveFieldVisibility(applyFieldVisibilityPreset(presetId));
  }

  function updateShortcut(id: string, patch: Partial<ShortcutRule>) {
    updateSettings((current) => ({
      ...current,
      customKeyboardShortcuts: current.customKeyboardShortcuts.map((rule) =>
        rule.id === id ? normalizeShortcutRuleForEditor({ ...rule, ...patch }) : rule,
      ),
    }));
  }

  function changeShortcutField(id: string, field: ShortcutField) {
    updateShortcut(id, { field, value: "" });
  }

  function normalizeShortcutRuleForEditor(rule: ShortcutRule): ShortcutRule {
    if (
      (rule.field === "rating" || rule.field === "status" || rule.field === "action" || rule.field === "language") &&
      rule.value &&
      !isShortcutValueAllowed(rule.field, rule.value)
    ) {
      return { ...rule, value: "" };
    }
    return rule;
  }

  function isShortcutValueAllowed(field: ShortcutField, value: string) {
    if (!value) return true;
    if (field === "rating") {
      return value === "clear" || /^(10|[1-9])$/.test(value);
    }
    if (field === "status") {
      return SHORTCUT_STATUS_VALUES.includes(value as typeof SHORTCUT_STATUS_VALUES[number]);
    }
    if (field === "action") {
      return SHORTCUT_ACTION_VALUES.includes(value as typeof SHORTCUT_ACTION_VALUES[number]);
    }
    if (field === "language") {
      return SHORTCUT_LANGUAGE_VALUES.includes(value as typeof SHORTCUT_LANGUAGE_VALUES[number]);
    }
    return true;
  }

  function addShortcut() {
    const id = `custom-${Date.now()}`;
    updateSettings((current) => ({
      ...current,
      customKeyboardShortcuts: [
        ...current.customKeyboardShortcuts,
        {
          id,
          enabled: true,
          context: "explorer",
          field: "mood",
          value: "",
          key: "",
          ctrl: false,
          alt: false,
          shift: false,
          meta: false,
        },
      ],
    }));
    setCapturingShortcutId(id);
  }

  function deleteShortcut(id: string) {
    updateSettings((current) => ({
      ...current,
      customKeyboardShortcuts: current.customKeyboardShortcuts.filter(
        (rule) => rule.id !== id,
      ),
    }));
  }

  function resetShortcuts() {
    updateSettings((current) => ({
      ...current,
      customKeyboardShortcuts: defaultKeyboardShortcuts(),
    }));
  }

  function captureShortcut(event: KeyboardEvent<HTMLButtonElement>, id: string) {
    event.preventDefault();
    event.stopPropagation();
    const combo = keyComboFromEvent(event.nativeEvent);
    updateShortcut(id, combo);
    setCapturingShortcutId(null);
  }

  function exportShortcuts() {
    const payload = JSON.stringify(
      {
        type: "tagdeck_keyboard_shortcuts",
        version: 1,
        shortcuts: settings.customKeyboardShortcuts,
      },
      null,
      2,
    );
    const url = URL.createObjectURL(
      new Blob([payload], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "tagdeck_keyboard_shortcuts.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  function importShortcuts(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(String(reader.result ?? "{}")) as {
          type?: string;
          shortcuts?: ShortcutRule[];
        };
        if (payload.type !== "tagdeck_keyboard_shortcuts" || !Array.isArray(payload.shortcuts)) {
          throw new Error(t("settings.invalidShortcutFile"));
        }
        updateSettings((current) => ({
          ...current,
          customKeyboardShortcuts: payload.shortcuts ?? [],
        }));
        setNotice(t("settings.shortcutsImported"));
      } catch (importError) {
        setNotice(String(importError));
      }
    };
    reader.readAsText(file);
  }

  function openShortcutOptions(field: ShortcutField) {
    if (field === "genre") return SUGGESTED_GENRES;
    if (field === "mood") return SUGGESTED_MOODS;
    if (field === "internal_tag") {
      return uniqueValues([
        ...organizationOptions.tags.map((tag) => tag.name),
        ...SUGGESTED_TAGS,
      ]);
    }
    if (field === "project") {
      return organizationOptions.projects.map((project) => project.name);
    }
    if (field === "model") {
      return uniqueValues([...organizationOptions.models, ...SUGGESTED_MODELS]);
    }
    return [];
  }

  function shortcutValueControl(rule: ShortcutRule) {
    const valueInvalid =
      rule.enabled &&
      (rule.field === "rating" ||
        rule.field === "status" ||
        rule.field === "action" ||
        rule.field === "language") &&
      !rule.value;
    const invalidClass = valueInvalid ? " border-red-400/40" : "";
    if (rule.field === "rating") {
      return (
        <select
          value={rule.value}
          onChange={(event) => updateShortcut(rule.id, { value: event.target.value })}
          className={`field min-w-44${invalidClass}`}
        >
          <option value="">{t("settings.chooseShortcutValue")}</option>
          {Array.from({ length: 10 }, (_, index) => String(index + 1)).map((rating) => (
            <option key={rating} value={rating}>{rating}</option>
          ))}
          <option value="clear">{t("settings.clearRating")}</option>
        </select>
      );
    }
    if (rule.field === "status") {
      return (
        <select
          value={rule.value}
          onChange={(event) => updateShortcut(rule.id, { value: event.target.value })}
          className={`field min-w-44${invalidClass}`}
        >
          <option value="">{t("settings.chooseShortcutValue")}</option>
          {SHORTCUT_STATUS_VALUES.map((status) => (
            <option key={status} value={status}>{t(`status.${status}`)}</option>
          ))}
        </select>
      );
    }
    if (rule.field === "action") {
      return (
        <select
          value={rule.value}
          onChange={(event) => updateShortcut(rule.id, { value: event.target.value })}
          className={`field min-w-44${invalidClass}`}
        >
          <option value="">{t("settings.chooseShortcutValue")}</option>
          {SHORTCUT_ACTION_VALUES.map((action) => (
            <option key={action} value={action}>{t(`shortcutAction.${action}`)}</option>
          ))}
        </select>
      );
    }
    if (rule.field === "language") {
      return (
        <select
          value={rule.value}
          onChange={(event) => updateShortcut(rule.id, { value: event.target.value })}
          className={`field min-w-44${invalidClass}`}
        >
          <option value="">{t("settings.chooseShortcutValue")}</option>
          {SHORTCUT_LANGUAGE_VALUES.map((value) => (
            <option key={value} value={value}>{t(`shortcutLanguage.${value}`)}</option>
          ))}
        </select>
      );
    }
    const datalistId = `shortcut-values-${rule.id}`;
    const options = openShortcutOptions(rule.field);
    return (
      <>
        <input
          value={rule.value}
          list={options.length > 0 ? datalistId : undefined}
          onChange={(event) => updateShortcut(rule.id, { value: event.target.value })}
          placeholder={t("settings.shortcutValuePlaceholder")}
          className="field min-w-44"
        />
        {options.length > 0 && (
          <datalist id={datalistId}>
            {options.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        )}
      </>
    );
  }

  function filteredVisibilityFields() {
    const query = fieldSearch.trim().toLocaleLowerCase();
    return FIELD_VISIBILITY_FIELDS.filter((field) => {
      const label = t(`field.${field.id}`);
      const matchesCategory = fieldCategory === "all" || field.category === fieldCategory;
      const matchesSearch =
        !query || label.toLocaleLowerCase().includes(query) || field.id.includes(query);
      return matchesCategory && matchesSearch;
    });
  }

  async function createDatabaseBackup() {
    try {
      const path = await api.backupDatabase();
      setNotice(`${t("settings.sqliteBackupCreated")}: ${path}`);
    } catch (backupError) {
      setNotice(String(backupError));
    }
  }

  async function exportDiagnostics() {
    const path = await save({
      title: t("settings.exportDiagnosticTitle"),
      defaultPath: timestampedFileName("tagdeck_diagnostics", "json"),
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!path) {
      setNotice(t("settings.exportCancelled"));
      return;
    }
    try {
      const file = await api.exportDiagnostics(path);
      setLastExportPath(file.path);
      setLastExportBytes(file.bytes);
      setNotice(exportSuccessMessage(t, file.path, file.bytes));
    } catch (diagnosticError) {
      setNotice(exportErrorMessage(t, diagnosticError));
    }
  }

  async function checkForUpdates() {
    setCheckingUpdates(true);
    setUpdateError(null);
    try {
      const result = await api.checkForUpdates();
      setUpdateResult(result);
      updateSettings((current) => ({
        ...current,
        updates: {
          ...current.updates,
          lastUpdateCheckAt: result.checkedAt,
          lastKnownLatestVersion: result.latestVersion,
        },
      }));
    } catch (checkError) {
      setUpdateError(String(checkError));
    } finally {
      setCheckingUpdates(false);
    }
  }

  async function openUpdateUrl(url: string) {
    try {
      await api.openUpdateUrl(url);
    } catch (openError) {
      setNotice(String(openError));
    }
  }

  async function exportSyncManifest() {
    const path = await chooseExportPath(
      "json",
      timestampedFileName("tagdeck_manifest", "json"),
      t("settings.exportSyncManifestTitle"),
      settings,
    );
    if (!path) {
      setNotice(t("settings.exportCancelled"));
      return;
    }
    try {
      const file = await api.exportSyncManifest(path);
      setLastExportPath(file.path);
      setLastExportBytes(file.bytes);
      rememberExportPath(file.path);
      setNotice(exportSuccessMessage(t, file.path, file.bytes));
      if (settings.export.openFolderAfterExport) await api.revealFile(file.path);
    } catch (manifestError) {
      setNotice(exportErrorMessage(t, manifestError));
    }
  }

  async function exportLibraryData(format: "csv" | "json", filtered: boolean) {
    const path = await chooseExportPath(
      format,
      timestampedFileName(filtered ? "tagdeck_library_filtered" : "tagdeck_library", format),
      filtered
        ? `${t("settings.exportCurrentFilterTitle")} ${format.toUpperCase()}`
        : `${t("settings.exportFullLibraryTitle")} ${format.toUpperCase()}`,
      settings,
    );
    if (!path) {
      setNotice(t("settings.exportCancelled"));
      return;
    }

    try {
      const summary = await api.exportLibrary(
        buildLibraryExportQuery(settings, filtered),
        format,
        path,
        exportOptions(settings),
      );
      setLastExportPath(summary.path);
      setLastExportBytes(summary.bytes);
      rememberExportPath(summary.path);
      setNotice(`${exportSuccessMessage(t, summary.path, summary.bytes)} · ${summary.count} ${t("settings.songsExported")}`);
      if (settings.export.openFolderAfterExport) await api.revealFile(summary.path);
    } catch (exportError) {
      setNotice(exportErrorMessage(t, exportError));
    }
  }

  async function exportLibraryBackup() {
    const path = await chooseExportPath(
      "json",
      timestampedFileName("tagdeck_library_backup", "json"),
      t("settings.exportLibraryBackupJson"),
      settings,
    );
    if (!path) {
      setNotice(t("settings.exportCancelled"));
      return;
    }
    try {
      const summary = await api.exportLibraryBackup(path);
      setLastExportPath(summary.path);
      setLastExportBytes(summary.bytes);
      rememberExportPath(summary.path);
      setNotice(`${exportSuccessMessage(t, summary.path, summary.bytes)} · ${summary.count} ${t("settings.songsExported")}`);
      if (settings.export.openFolderAfterExport) await api.revealFile(summary.path);
    } catch (exportError) {
      setNotice(exportErrorMessage(t, exportError));
    }
  }

  async function exportPlaylistData(format: "csv" | "json") {
    if (!selectedPlaylist) {
      setNotice(t("settings.selectPlaylistToExport"));
      return;
    }
    const path = await chooseExportPath(
      format,
      timestampedFileName(`tagdeck_playlist_${safeFileName(selectedPlaylist.name)}`, format),
      `${t("settings.exportPlaylistTitle")} ${format.toUpperCase()}`,
      settings,
    );
    if (!path) {
      setNotice(t("settings.exportCancelled"));
      return;
    }

    try {
      const summary = await api.exportPlaylist(
        selectedPlaylist.id,
        format,
        path,
        exportOptions(settings),
      );
      setLastExportPath(summary.path);
      setLastExportBytes(summary.bytes);
      rememberExportPath(summary.path);
      setNotice(`${exportSuccessMessage(t, summary.path, summary.bytes)} · ${summary.count} ${t("settings.playlistSongsExported")}`);
      if (settings.export.openFolderAfterExport) await api.revealFile(summary.path);
    } catch (exportError) {
      setNotice(exportErrorMessage(t, exportError));
    }
  }

  async function exportPack(packType: PackType, sourceKind: "status" | "playlist") {
    if (sourceKind === "playlist" && !selectedPlaylist) {
      setNotice(t("settings.selectPlaylistToExport"));
      return;
    }
    const selected = await open({
      directory: true,
      multiple: false,
      title: t("packs.selectDestination"),
    });
    if (!selected || Array.isArray(selected)) return;
    try {
      const summary = await api.exportPack({
        packType,
        sourceKind,
        playlistId: sourceKind === "playlist" ? selectedPlaylist?.id : null,
        destinationPath: selected,
        language,
        csvDelimiter: settings.export.csvDelimiter,
      });
      setNotice(
        `${packLabel(packType, t)}: ${summary.copied} ${t("packs.filesCopied")}, ${summary.missing} ${t("packs.missing")}, ${summary.failed} ${t("packs.failed")}. ${summary.destinationPath}`,
      );
      setLastExportPath(summary.destinationPath);
      setLastExportBytes(null);
      if (settings.export.openFolderAfterExport) await api.revealFile(summary.destinationPath);
    } catch (packError) {
      setNotice(String(packError));
    }
  }

  function rememberExportPath(path: string) {
    if (!settings.export.rememberFolder) return;
    const separator = Math.max(path.lastIndexOf("\\"), path.lastIndexOf("/"));
    section("export", {
      lastFolder: separator >= 0 ? path.slice(0, separator) : "",
    });
  }

  return (
    <div className="app-surface h-full overflow-y-auto">
      <header className="section-header sticky top-0 z-20 flex items-center justify-between border-b border-white/8 px-6 py-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <SlidersHorizontal size={19} /> {t("settings.title")}
          </h2>
          <p className="mt-1 text-xs text-white/45">
            {t("settings.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/35">
            {saving ? t("common.saving") : t("common.changesSaved")}
          </span>
          <button type="button" onClick={resetSettings} className="toolbar-button">
            <RotateCcw size={14} /> {t("common.restoreValues")}
          </button>
        </div>
      </header>

      <main className="grid w-full gap-5 p-5 lg:p-6">
        {(error || notice) && (
          <p className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/65">
            {error || notice}
          </p>
        )}

        <SettingsCard icon={<Palette size={18} />} title={t("settings.appearance")}>
          <ThemePicker
            value={settings.appearance.theme}
            onChange={(theme) => section("appearance", { theme })}
            t={t}
          />
          <SettingsGrid>
            <SelectSetting
              label={t("settings.interfaceSize")}
              value={settings.appearance.interfaceSize}
              onChange={(value) =>
                section("appearance", {
                  interfaceSize: value as AppSettings["appearance"]["interfaceSize"],
                })
              }
            >
              <option value="compact">{t("settings.sizeCompact")}</option>
              <option value="normal">{t("settings.sizeNormal")}</option>
              <option value="wide">{t("settings.sizeWide")}</option>
            </SelectSetting>
            <SelectSetting
              label={t("settings.textSize")}
              value={settings.appearance.textSize}
              onChange={(value) =>
                section("appearance", {
                  textSize: value as AppSettings["appearance"]["textSize"],
                })
              }
            >
              <option value="small">{t("settings.textSmall")}</option>
              <option value="normal">{t("settings.textNormal")}</option>
              <option value="large">{t("settings.textLarge")}</option>
            </SelectSetting>
            <ReadOnlySetting
              label={t("settings.accentColor")}
              value={accentLabel(settings.appearance.theme, t)}
            />
            <SelectSetting
              label={t("settings.interfaceMode")}
              value={settings.interfaceMode}
              onChange={(value) =>
                updateSettings((current) => ({
                  ...current,
                  interfaceMode: value as AppSettings["interfaceMode"],
                }))
              }
            >
              <option value="simple">{t("settings.simpleMode")}</option>
              <option value="advanced">{t("settings.advancedMode")}</option>
            </SelectSetting>
            <ToggleSetting
              label={t("settings.enableKeyboardShortcuts")}
              checked={settings.keyboardShortcutsEnabled}
              onChange={(value) =>
                updateSettings((current) => ({
                  ...current,
                  keyboardShortcutsEnabled: value,
                }))
              }
            />
          </SettingsGrid>
        </SettingsCard>

        <SettingsCard icon={<SlidersHorizontal size={18} />} title={t("language.sectionTitle")}>
          <SettingsGrid>
            <SelectSetting
              label={t("language.interfaceLanguage")}
              value={settings.interfaceLanguage}
              onChange={(value) => setInterfaceLanguage(value as SupportedLanguage)}
            >
              <option value="en">{t("language.english")}</option>
              <option value="es">{t("language.spanish")}</option>
            </SelectSetting>
          </SettingsGrid>
        </SettingsCard>

        <SettingsCard icon={<SlidersHorizontal size={18} />} title={t("settings.keyboardShortcuts")}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-white/75">
                {t("settings.customQuickKeys")}
              </p>
              <p className="mt-1 text-xs text-white/40">
                {t("settings.shortcutEditorHelp")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={addShortcut} className="toolbar-button">
                {t("settings.addShortcut")}
              </button>
              <button type="button" onClick={resetShortcuts} className="toolbar-button">
                {t("settings.resetShortcutDefaults")}
              </button>
              <button type="button" onClick={exportShortcuts} className="toolbar-button">
                <Download size={14} /> {t("settings.exportShortcuts")}
              </button>
              <button
                type="button"
                onClick={() => shortcutImportRef.current?.click()}
                className="toolbar-button"
              >
                <FileUp size={14} /> {t("settings.importShortcuts")}
              </button>
              <input
                ref={shortcutImportRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(event) => {
                  importShortcuts(event.target.files?.[0] ?? null);
                  event.currentTarget.value = "";
                }}
              />
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-white/8">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="bg-white/[0.035] text-white/45">
                <tr>
                  <th className="px-3 py-2">{t("settings.shortcutEnabled")}</th>
                  <th className="px-3 py-2">{t("settings.shortcutContext")}</th>
                  <th className="px-3 py-2">{t("settings.shortcutField")}</th>
                  <th className="px-3 py-2">{t("settings.shortcutValue")}</th>
                  <th className="px-3 py-2">{t("settings.shortcutKey")}</th>
                  <th className="px-3 py-2">{t("settings.shortcutConflict")}</th>
                  <th className="px-3 py-2">{t("settings.shortcutDelete")}</th>
                </tr>
              </thead>
              <tbody>
                {settings.customKeyboardShortcuts.map((rule) => (
                  <tr key={rule.id} className="border-t border-white/8">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={(event) =>
                          updateShortcut(rule.id, { enabled: event.target.checked })
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={rule.context}
                        onChange={(event) =>
                          updateShortcut(rule.id, {
                            context: event.target.value as ShortcutContext,
                          })
                        }
                        className="field"
                      >
                        {SHORTCUT_CONTEXTS.map((context) => (
                          <option key={context} value={context}>
                            {t(`shortcutContext.${context}`)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={rule.field}
                        onChange={(event) =>
                          changeShortcutField(rule.id, event.target.value as ShortcutField)
                        }
                        className="field"
                      >
                        {SHORTCUT_FIELDS.map((field) => (
                          <option key={field} value={field}>
                            {t(`shortcutField.${field}`)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      {shortcutValueControl(rule)}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        data-ignore-shortcuts="true"
                        onClick={() => setCapturingShortcutId(rule.id)}
                        onKeyDown={(event) => captureShortcut(event, rule.id)}
                        className="min-w-36 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-left text-white/70"
                      >
                        {capturingShortcutId === rule.id
                          ? t("settings.pressKeyCombination")
                          : formatShortcut(rule) || t("settings.clickToCapture")}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      {shortcutConflicts.has(rule.id) ? (
                        <span className="rounded bg-red-400/10 px-2 py-1 text-red-200">
                          {t("settings.shortcutConflict")}
                        </span>
                      ) : (
                        <span className="text-white/25">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => deleteShortcut(rule.id)}
                        className="text-red-200/70 hover:text-red-100"
                      >
                        {t("settings.shortcutDelete")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {shortcutConflicts.size > 0 && (
            <p className="mt-3 rounded-md border border-red-400/20 bg-red-400/8 px-3 py-2 text-xs text-red-100">
              {t("settings.shortcutConflictHelp")}
            </p>
          )}
        </SettingsCard>

        <SettingsCard icon={<Sparkles size={18} />} title={t("settings.updates")}>
          <UpdateSettingsPanel
            currentVersion={diagnostics?.appVersion ?? t("common.reading")}
            lastCheckedAt={formatDateTime(settings.updates.lastUpdateCheckAt, language)}
            checking={checkingUpdates}
            result={updateResult}
            error={updateError}
            language={language}
            t={t}
            onCheck={checkForUpdates}
            onOpenUrl={openUpdateUrl}
          />
        </SettingsCard>

        <SettingsCard icon={<Info size={18} />} title={t("guide.title")}>
          <ol className="grid gap-2 text-sm text-white/60">
            <li>{t("guide.stepScan")}</li>
            <li>{t("guide.stepReview")}</li>
            <li>{t("guide.stepRate")}</li>
            <li>{t("guide.stepStatus")}</li>
            <li>{t("guide.stepExport")}</li>
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={onOpenOnboarding} className="toolbar-button">
              {t("settings.openOnboarding")}
            </button>
            <button type="button" onClick={onOpenDemo} className="toolbar-button">
              {t("onboarding.openDemo")}
            </button>
          </div>
        </SettingsCard>

        <SettingsCard icon={<RotateCcw size={18} />} title={t("sectionOnboarding.settingsTitle")}>
          <p className="text-sm leading-relaxed text-white/50">
            {t("sectionOnboarding.settingsHelp")}
          </p>
          <button type="button" onClick={resetSectionTips} className="toolbar-button mt-4">
            {t("sectionOnboarding.resetAll")}
          </button>
        </SettingsCard>

        <SettingsCard icon={<Library size={18} />} title={t("settings.library")}>
          <SettingsGrid>
            <SelectSetting
              label={t("settings.visibleSongs")}
              value={String(settings.library.visibleLimit)}
              onChange={(value) =>
                section("library", {
                  visibleLimit: Number(value) as AppSettings["library"]["visibleLimit"],
                })
              }
            >
              <option value="1000">1000</option>
              <option value="5000">5000</option>
              <option value="10000">10000</option>
              <option value="20000">20000</option>
            </SelectSetting>
            <ToggleSetting
              label={t("settings.rememberLastFilter")}
              checked={settings.library.rememberFilters}
              onChange={(value) => section("library", { rememberFilters: value })}
            />
            <ToggleSetting
              label={t("settings.rememberScannedFolder")}
              checked={settings.library.rememberScanFolder}
              onChange={(value) => section("library", { rememberScanFolder: value })}
            />
          </SettingsGrid>
          <p
            className={`mt-3 text-xs ${
              settings.library.visibleLimit >= 10000
                ? "text-amber-200/70"
                : "text-white/35"
            }`}
          >
            {settings.library.visibleLimit >= 10000
              ? t("settings.veryHighVisibleLimitWarning")
              : t("settings.highVisibleLimitWarning")}
          </p>
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-white/55">
                {t("settings.visibleColumns")}
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="text-xs text-[#d9ff43]/70"
                  onClick={() =>
                    section("library", { visibleColumns: [...DEFAULT_LIBRARY_COLUMNS] })
                  }
                >
                  {t("common.restoreDefaults")}
                </button>
                <button
                  type="button"
                  className="text-xs text-[#d9ff43]/70"
                  onClick={() => updateLibraryColumnOrder([...LIBRARY_COLUMNS])}
                >
                  {t("settings.resetColumnOrder")}
                </button>
              </div>
            </div>
            <div className="mt-2 grid gap-1.5 md:grid-cols-2 xl:grid-cols-3">
              {normalizeLibraryColumnOrder(settings.library.columnOrder).map((column, index, ordered) => (
                <div
                  key={column}
                  className="flex items-center justify-between gap-2 rounded-md border border-white/8 bg-white/[0.025] px-2.5 py-2"
                >
                  <label className="flex min-w-0 items-center gap-2 text-xs text-white/60">
                    <input
                      type="checkbox"
                      checked={
                        column === "title" ||
                        settings.library.visibleColumns.includes(column)
                      }
                      disabled={column === "title"}
                      onChange={(event) =>
                        toggleLibraryColumn(column, event.target.checked)
                      }
                    />
                    <span className="truncate">
                      {t(`field.${LIBRARY_FIELD_BY_COLUMN[column] ?? column}`)}
                    </span>
                  </label>
                  <span className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveLibraryColumn(column, -1)}
                      className="rounded border border-white/8 px-1.5 py-0.5 text-[10px] text-white/45 hover:text-white disabled:opacity-25"
                      aria-label={t("settings.moveColumnUp")}
                      title={t("settings.moveColumnUp")}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={index === ordered.length - 1}
                      onClick={() => moveLibraryColumn(column, 1)}
                      className="rounded border border-white/8 px-1.5 py-0.5 text-[10px] text-white/45 hover:text-white disabled:opacity-25"
                      aria-label={t("settings.moveColumnDown")}
                      title={t("settings.moveColumnDown")}
                    >
                      ↓
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </SettingsCard>

        {settings.interfaceMode === "advanced" ? (
        <SettingsCard icon={<SlidersHorizontal size={18} />} title={t("settings.fieldVisibility")}>
          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-56 flex-1 text-xs text-white/45">
              <span className="mb-1.5 block">{t("settings.searchField")}</span>
              <span className="flex items-center gap-2 rounded-md border border-white/10 bg-white/4 px-3 py-2">
                <Search size={14} className="text-white/30" />
                <input
                  value={fieldSearch}
                  onChange={(event) => setFieldSearch(event.target.value)}
                  placeholder={t("settings.searchPlaceholder")}
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/25"
                />
              </span>
            </label>
            <SelectSetting
              label={t("settings.category")}
              value={fieldCategory}
              onChange={(value) =>
                setFieldCategory(value as FieldVisibilityCategory | "all")
              }
            >
              <option value="all">{t("settings.allCategories")}</option>
              {FIELD_VISIBILITY_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {t(`fieldCategory.${category}`)}
                </option>
              ))}
            </SelectSetting>
            <button
              type="button"
              onClick={() => saveFieldVisibility(DEFAULT_FIELD_VISIBILITY)}
              className="toolbar-button"
            >
              <RotateCcw size={14} /> {t("common.restoreDefaults")}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {FIELD_VISIBILITY_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset.id)}
                className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/55 hover:bg-white/5 hover:text-white/75"
              >
                {t(`preset.${preset.id}`)}
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-white/40">
            <span className="rounded border border-white/10 bg-white/[0.025] px-2 py-1">
              {t("settings.legendVisible")}
            </span>
            <span className="rounded border border-white/10 bg-white/[0.025] px-2 py-1">
              {t("settings.legendHidden")}
            </span>
            <span className="rounded border border-[#d9ff43]/25 bg-[#d9ff43]/8 px-2 py-1 text-[#d9ff43]/70">
              {t("settings.legendRequired")}
            </span>
            <span className="rounded border border-white/8 bg-white/[0.015] px-2 py-1 text-white/28">
              {t("settings.legendUnavailable")}
            </span>
          </div>

          <div className="mt-4 overflow-auto rounded-xl border border-white/8">
            <table className="min-w-[1280px] border-collapse text-left text-xs">
              <thead className="card-surface sticky top-0 z-20 text-white/55">
                <tr>
                  <th className="sticky left-0 z-30 w-56 border-b border-white/8 bg-[var(--panel-bg)] px-3 py-3 font-semibold">
                    {t("field.title")}
                  </th>
                  {FIELD_VISIBILITY_ZONES.map((zone) => (
                    <th
                      key={zone.id}
                      className="min-w-36 border-b border-white/8 px-3 py-2 align-bottom font-semibold"
                    >
                      <span className="block leading-tight">{t(`zone.${zone.id}`)}</span>
                      <span className="mt-2 flex gap-1">
                        <button
                          type="button"
                          onClick={() => markZone(zone.id, true)}
                          className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-[#d9ff43]/70 hover:bg-white/5"
                        >
                          {t("common.all")}
                        </button>
                        <button
                          type="button"
                          onClick={() => markZone(zone.id, false)}
                          className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-white/45 hover:bg-white/5"
                        >
                          {t("common.hidden")}
                        </button>
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredVisibilityFields().map((field) => (
                  <tr key={field.id} className="border-b border-white/[0.055]">
                    <th className="sticky left-0 z-10 border-r border-white/8 bg-[var(--card-bg)] px-3 py-2 font-medium text-white/65">
                      <span className="block">{t(`field.${field.id}`)}</span>
                      <span className="text-[10px] font-normal text-white/30">
                        {t(`fieldCategory.${field.category}`)}
                      </span>
                    </th>
                    {FIELD_VISIBILITY_ZONES.map((zone) => {
                      const supported = isFieldSupportedInZone(zone.id, field.id);
                      const required = isFieldRequiredInZone(zone.id, field.id);
                      const checked =
                        supported &&
                        (required || settings.fieldVisibility[zone.id].includes(field.id));
                      const tooltip = required
                        ? t("settings.requiredTooltip")
                        : supported
                          ? `${t(`field.${field.id}`)} - ${t(`zone.${zone.id}`)}`
                          : t("settings.unavailableTooltip");
                      return (
                        <td
                          key={zone.id}
                          className={`px-3 py-2 text-center ${
                            supported ? "" : "bg-white/[0.015] opacity-45"
                          }`}
                          title={tooltip}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={required || !supported}
                            onChange={(event) =>
                              toggleField(zone.id, field.id, event.target.checked)
                            }
                            aria-label={`${t(`field.${field.id}`)} - ${t(`zone.${zone.id}`)}`}
                            className={`accent-[#d9ff43] ${
                              supported ? "" : "cursor-not-allowed grayscale"
                            }`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-white/35">
            {t("settings.visibilityHelp")}
          </p>
        </SettingsCard>
        ) : (
          <SettingsCard icon={<SlidersHorizontal size={18} />} title={t("settings.fieldVisibility")}>
            <p className="text-sm leading-relaxed text-white/45">
              {t("settings.fieldVisibilitySimpleHelp")}
            </p>
            <button
              type="button"
              onClick={() =>
                updateSettings((current) => ({ ...current, interfaceMode: "advanced" }))
              }
              className="mt-4 rounded-md border border-[#d9ff43]/30 px-4 py-2 text-sm font-semibold text-[#d9ff43] hover:bg-[#d9ff43]/8"
            >
              {t("settings.showAdvancedFields")}
            </button>
          </SettingsCard>
        )}

        <SettingsCard icon={<SlidersHorizontal size={18} />} title={t("settings.panelsFocus")}>
          <SettingsGrid>
            <SelectSetting
              label={t("settings.leftSidebar")}
              value={settings.layout.sidebarMode}
              onChange={(value) =>
                section("layout", {
                  sidebarMode: value as AppSettings["layout"]["sidebarMode"],
                })
              }
            >
              <option value="expanded">{t("settings.sidebarExpanded")}</option>
              <option value="collapsed">{t("settings.sidebarCollapsed")}</option>
              <option value="hidden">{t("settings.sidebarHidden")}</option>
            </SelectSetting>
            <ToggleSetting
              label={t("settings.showRightInspector")}
              checked={settings.layout.inspectorVisible}
              onChange={(value) => section("layout", { inspectorVisible: value })}
            />
            <ToggleSetting
              label={t("settings.focusMode")}
              checked={settings.layout.focusMode}
              onChange={(value) => section("layout", { focusMode: value })}
            />
          </SettingsGrid>
          <p className="mt-3 text-xs leading-relaxed text-white/40">
            {t("settings.focusHelp")}
          </p>
        </SettingsCard>

        <SettingsCard icon={<Volume2 size={18} />} title={t("settings.player")}>
          <SettingsGrid>
            <RangeSetting
              label={t("settings.defaultVolume")}
              value={settings.player.defaultVolume}
              onChange={(value) => section("player", { defaultVolume: value })}
            />
            <ToggleSetting
              label={t("settings.rememberVolume")}
              checked={settings.player.rememberVolume}
              onChange={(value) => section("player", { rememberVolume: value })}
            />
            <ToggleSetting
              label={t("settings.doubleClickPlay")}
              checked={settings.player.doubleClickPlay}
              onChange={(value) => section("player", { doubleClickPlay: value })}
            />
            <ToggleSetting
              label={t("settings.showBottomBar")}
              checked={settings.player.showGlobalBar}
              onChange={(value) => section("player", { showGlobalBar: value })}
            />
            <ToggleSetting
              label={t("settings.avoidLibraryRepeats")}
              checked={settings.player.avoidLibraryRepeats}
              onChange={(value) => section("player", { avoidLibraryRepeats: value })}
            />
            <SelectSetting
              label={t("settings.playCountThreshold")}
              value={settings.player.playCountThreshold}
              onChange={(value) =>
                section("player", {
                  playCountThreshold: value as AppSettings["player"]["playCountThreshold"],
                })
              }
            >
              <option value="30s">{t("settings.after30Seconds")}</option>
              <option value="50">{t("settings.at50Percent")}</option>
              <option value="70">{t("settings.at70Percent")}</option>
              <option value="complete">{t("common.complete")}</option>
            </SelectSetting>
            <SelectSetting
              label={t("settings.onLibrarySongEnd")}
              value={settings.player.libraryEndAction}
              onChange={(value) =>
                section("player", {
                  libraryEndAction: value as AppSettings["player"]["libraryEndAction"],
                })
              }
            >
              <option value="stop">{t("common.stop")}</option>
              <option value="random">{t("settings.playNextRandom")}</option>
              <option value="ordered">{t("settings.playNextInOrder")}</option>
              <option value="repeat">{t("settings.repeatSong")}</option>
            </SelectSetting>
            <SelectSetting
              label={t("settings.onOtherViewsEnd")}
              value={settings.player.endAction}
              onChange={(value) =>
                section("player", {
                  endAction: value as AppSettings["player"]["endAction"],
                })
              }
            >
              <option value="stop">{t("common.stop")}</option>
              <option value="next">{t("settings.nextInContext")}</option>
              <option value="repeat">{t("settings.repeatSong")}</option>
            </SelectSetting>
          </SettingsGrid>
        </SettingsCard>

        <SettingsCard icon={<Compass size={18} />} title={t("settings.explorer")}>
          <SettingsGrid>
            <SelectSetting
              label={t("settings.defaultCriterion")}
              value={settings.explorer.defaultCriterion}
              onChange={(value) =>
                section("explorer", {
                  defaultCriterion: value as AppSettings["explorer"]["defaultCriterion"],
                })
              }
            >
              <option value="unreviewed">{t("status.review")}</option>
              <option value="unrated">{t("organization.noRating")}</option>
              <option value="no_project">{t("organization.noProject")}</option>
              <option value="untagged">{t("organization.noTags")}</option>
              <option value="random">{t("session.random")}</option>
              <option value="all">{t("common.all")}</option>
            </SelectSetting>
            <ToggleSetting
              label={t("settings.autoplayOnLoad")}
              checked={settings.explorer.autoplayOnLoad}
              onChange={(value) => section("explorer", { autoplayOnLoad: value })}
            />
            <ToggleSetting
              label={t("settings.autoplayAfterSave")}
              checked={settings.explorer.autoplayAfterSave}
              onChange={(value) => section("explorer", { autoplayAfterSave: value })}
            />
            <ToggleSetting
              label={t("settings.autoplayAfterSkip")}
              checked={settings.explorer.autoplayAfterSkip}
              onChange={(value) => section("explorer", { autoplayAfterSkip: value })}
            />
            <ToggleSetting
              label={t("settings.confirmArchive")}
              checked={settings.explorer.confirmArchive}
              onChange={(value) => section("explorer", { confirmArchive: value })}
            />
            <ToggleSetting
              label={t("settings.hideArchived")}
              checked={settings.explorer.hideArchived}
              onChange={(value) => section("explorer", { hideArchived: value })}
            />
            <ToggleSetting
              label={t("settings.randomQueue")}
              checked={settings.explorer.randomQueue}
              onChange={(value) => section("explorer", { randomQueue: value })}
            />
            <ToggleSetting
              label={t("settings.resetQueueOnCriterion")}
              checked={settings.explorer.resetQueueOnCriterion}
              onChange={(value) => section("explorer", { resetQueueOnCriterion: value })}
            />
            <ToggleSetting
              label={t("settings.saveMarksReviewed")}
              checked={settings.explorer.saveMarksReviewed}
              onChange={(value) => section("explorer", { saveMarksReviewed: value })}
            />
          </SettingsGrid>
        </SettingsCard>

        <SettingsCard icon={<Radio size={18} />} title={t("settings.session")}>
          <SettingsGrid>
            <ToggleSetting
              label={t("settings.excludeArchived")}
              checked={settings.session.excludeArchived}
              onChange={(value) => section("session", { excludeArchived: value })}
            />
            <ToggleSetting
              label={t("settings.excludeLowRated")}
              checked={settings.session.excludeLowRated}
              onChange={(value) => section("session", { excludeLowRated: value })}
            />
            <ToggleSetting
              label={t("settings.includePlayed")}
              checked={settings.session.includePlayed}
              onChange={(value) => section("session", { includePlayed: value })}
            />
            <SelectSetting
              label={t("settings.minimumRating")}
              value={String(settings.session.minimumRating)}
              onChange={(value) =>
                section("session", { minimumRating: Number(value) as 0 | 5 | 7 | 8 })
              }
            >
              <option value="0">{t("settings.noMinimum")}</option>
              <option value="5">5+</option>
              <option value="7">7+</option>
              <option value="8">8+</option>
            </SelectSetting>
            <SelectSetting
              label={t("settings.suggestionAction")}
              value={settings.session.suggestionAction}
              onChange={(value) =>
                section("session", { suggestionAction: value as "play" | "queue" })
              }
            >
              <option value="play">{t("session.playNow")}</option>
              <option value="queue">{t("session.addToQueue")}</option>
            </SelectSetting>
            <SelectSetting
              label={t("settings.queueEndAction")}
              value={settings.session.queueEndAction}
              onChange={(value) =>
                section("session", {
                  queueEndAction: value as AppSettings["session"]["queueEndAction"],
                })
              }
            >
              <option value="stop">{t("common.stop")}</option>
              <option value="suggest">{t("settings.findSuggestion")}</option>
              <option value="repeat">{t("settings.repeatQueue")}</option>
            </SelectSetting>
          </SettingsGrid>
          <p className="mt-4 text-xs font-medium text-white/55">
            {t("settings.prioritizeSuggestionsBy")}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(settings.session.priorities).map(([key, enabled]) => (
              <label key={key} className="setting-chip">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(event) =>
                    section("session", {
                      priorities: {
                        ...settings.session.priorities,
                        [key]: event.target.checked,
                      },
                    })
                  }
                />
                {priorityLabel(key, t)}
              </label>
            ))}
          </div>
        </SettingsCard>

        <SettingsCard icon={<ListMusic size={18} />} title={t("settings.playlists")}>
          <SettingsGrid>
            <ToggleSetting
              label={t("settings.avoidDuplicates")}
              checked={settings.playlists.avoidDuplicates}
              disabled
              onChange={() => undefined}
            />
            <ToggleSetting
              label={t("settings.confirmDeletePlaylist")}
              checked={settings.playlists.confirmDelete}
              onChange={(value) => section("playlists", { confirmDelete: value })}
            />
            <ToggleSetting
              label={t("settings.confirmRemoveTracks")}
              checked={settings.playlists.confirmRemoveTracks}
              onChange={(value) => section("playlists", { confirmRemoveTracks: value })}
            />
            <ToggleSetting
              label={t("settings.respectManualOrder")}
              checked={settings.playlists.respectManualOrder}
              onChange={(value) => section("playlists", { respectManualOrder: value })}
            />
            <ToggleSetting
              label={t("settings.showTotalDuration")}
              checked={settings.playlists.showTotalDuration}
              onChange={(value) => section("playlists", { showTotalDuration: value })}
            />
            <SelectSetting
              label={t("settings.filterPlaylistOrder")}
              value={settings.playlists.filterListOrder}
              onChange={(value) =>
                section("playlists", {
                  filterListOrder: value as AppSettings["playlists"]["filterListOrder"],
                })
              }
            >
              <option value="current">{t("settings.keepCurrentOrder")}</option>
              <option value="rating">{t("settings.sortByRating")}</option>
              <option value="title">{t("settings.sortByTitle")}</option>
            </SelectSetting>
          </SettingsGrid>
        </SettingsCard>

        <SettingsCard icon={<ShieldCheck size={18} />} title={t("settings.metadata")}>
          <SettingsGrid>
            <ToggleSetting
              label={t("settings.createBackupBeforeWrite")}
              checked
              disabled
              onChange={() => undefined}
            />
            <ToggleSetting
              label={t("settings.warnBeforeWrite")}
              checked={settings.metadata.warnBeforeWrite}
              onChange={(value) => section("metadata", { warnBeforeWrite: value })}
            />
            <ToggleSetting
              label={t("settings.confirmBulkEdit")}
              checked={settings.metadata.confirmBulkEdit}
              onChange={(value) => section("metadata", { confirmBulkEdit: value })}
            />
            <ToggleSetting
              label={t("settings.confirmExplorerGenreWrite")}
              checked={settings.metadata.confirmExplorerGenreWrite}
              onChange={(value) =>
                section("metadata", { confirmExplorerGenreWrite: value })
              }
            />
          </SettingsGrid>
          <p className="mt-4 rounded-lg border border-amber-300/15 bg-amber-300/5 px-4 py-3 text-xs leading-relaxed text-amber-100/65">
            {t("settings.metadataSafetyHelp")}
          </p>
          <PathActions diagnostics={diagnostics} kind="backups" />
        </SettingsCard>

        <SettingsCard icon={<Download size={18} />} title={t("settings.dataImportExport")}>
          <SettingsGrid>
            <SelectSetting
              label={t("settings.csvSeparator")}
              value={settings.export.csvDelimiter}
              onChange={(value) => section("export", { csvDelimiter: value as "," | ";" })}
            >
              <option value=",">{t("settings.comma")}</option>
              <option value=";">{t("settings.semicolon")}</option>
            </SelectSetting>
            <ToggleSetting
              label={t("settings.includeFullPath")}
              checked={settings.export.includePath}
              onChange={(value) => section("export", { includePath: value })}
            />
            <ToggleSetting
              label={t("settings.includeInternalData")}
              checked={settings.export.includeInternal}
              onChange={(value) => section("export", { includeInternal: value })}
            />
            <ToggleSetting
              label={t("settings.includeTechnicalMetadata")}
              checked={settings.export.includeTechnical}
              onChange={(value) => section("export", { includeTechnical: value })}
            />
            <ToggleSetting
              label={t("settings.includeCuration")}
              checked={settings.export.includeCuration}
              onChange={(value) => section("export", { includeCuration: value })}
            />
            <ToggleSetting
              label={t("settings.rememberFolder")}
              checked={settings.export.rememberFolder}
              onChange={(value) => section("export", { rememberFolder: value })}
            />
            <ToggleSetting
              label={t("settings.openFolderAfterExport")}
              checked={settings.export.openFolderAfterExport}
              onChange={(value) => section("export", { openFolderAfterExport: value })}
            />
          </SettingsGrid>

          <div className="mt-5 grid gap-3 rounded-lg border border-white/8 bg-white/[0.025] p-4">
            <div>
              <p className="text-xs font-semibold text-white/70">{t("settings.exportData")}</p>
              <p className="mt-1 text-xs text-white/35">
                {t("settings.exportDataHelp")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void exportLibraryData("csv", false)}
                className="toolbar-button"
              >
                <Download size={14} /> {t("settings.fullLibraryCsv")}
              </button>
              <button
                type="button"
                onClick={() => void exportLibraryData("json", false)}
                className="toolbar-button"
              >
                <Download size={14} /> {t("settings.fullLibraryJson")}
              </button>
              <button
                type="button"
                onClick={() => void exportLibraryBackup()}
                className="toolbar-button border-[#d9ff43]/25 text-[#d9ff43]/80"
              >
                <Database size={14} /> {t("settings.exportLibraryBackupJson")}
              </button>
              <button
                type="button"
                onClick={() => void exportLibraryData("csv", true)}
                className="toolbar-button"
              >
                <Download size={14} /> {t("settings.currentFilterCsv")}
              </button>
              <button
                type="button"
                onClick={() => void exportLibraryData("json", true)}
                className="toolbar-button"
              >
                <Download size={14} /> {t("settings.currentFilterJson")}
              </button>
            </div>
            <div className="rounded-lg border border-sky-300/15 bg-sky-300/5 p-3">
              <p className="text-xs font-semibold text-white/70">{t("settings.importData")}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-white/35">
                {t("settings.importDataHelp")}
              </p>
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                className="toolbar-button mt-3"
              >
                <FileUp size={14} /> {t("settings.importCsvJson")}
              </button>
            </div>
            <div className="rounded-lg border border-amber-300/15 bg-amber-300/5 p-3">
              <p className="text-xs font-semibold text-white/70">
                {t("settings.restoreLibraryFromBackup")}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-white/40">
                {t("settings.restoreLibraryBackupHelp")}
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-amber-100/60">
                {t("settings.fullRestoreRequiresBackupJson")}
              </p>
              <button
                type="button"
                onClick={() => setRestoreOpen(true)}
                className="toolbar-button mt-3"
              >
                <Database size={14} /> {t("settings.restoreLibraryFromBackup")}
              </button>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <SelectSetting
                label={t("settings.selectedPlaylist")}
                value={selectedPlaylistId ? String(selectedPlaylistId) : ""}
                onChange={(value) => setSelectedPlaylistId(value ? Number(value) : null)}
              >
                <option value="">{t("settings.selectPlaylist")}</option>
                {playlists.map((playlist) => (
                  <option key={playlist.id} value={playlist.id}>
                    {playlist.name}
                  </option>
                ))}
              </SelectSetting>
              <button
                type="button"
                onClick={() => void exportPlaylistData("csv")}
                className="toolbar-button"
              >
                <Download size={14} /> {t("settings.playlistCsv")}
              </button>
              <button
                type="button"
                onClick={() => void exportPlaylistData("json")}
                className="toolbar-button"
              >
                <Download size={14} /> {t("settings.playlistJson")}
              </button>
            </div>
            <div className="rounded-lg border border-[#d9ff43]/15 bg-[#d9ff43]/5 p-3">
              <p className="text-xs font-semibold text-white/70">{t("packs.title")}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-white/35">
                {t("packs.help")}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => void exportPack("release", "status")} className="toolbar-button">
                  <Download size={14} /> {t("packs.exportRelease")}
                </button>
                <button type="button" onClick={() => void exportPack("radio", "status")} className="toolbar-button">
                  <Download size={14} /> {t("packs.exportRadio")}
                </button>
                <button type="button" onClick={() => void exportPack("daw_rescue", "status")} className="toolbar-button">
                  <Download size={14} /> {t("packs.exportDawRescue")}
                </button>
                <button type="button" onClick={() => void exportPack("model_seed", "status")} className="toolbar-button">
                  <Download size={14} /> {t("packs.exportModelSeed")}
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" disabled={!selectedPlaylist} onClick={() => void exportPack("release", "playlist")} className="toolbar-button disabled:opacity-35">
                  <Download size={14} /> {t("packs.releaseFromPlaylist")}
                </button>
                <button type="button" disabled={!selectedPlaylist} onClick={() => void exportPack("radio", "playlist")} className="toolbar-button disabled:opacity-35">
                  <Download size={14} /> {t("packs.radioFromPlaylist")}
                </button>
                <button type="button" disabled={!selectedPlaylist} onClick={() => void exportPack("daw_rescue", "playlist")} className="toolbar-button disabled:opacity-35">
                  <Download size={14} /> {t("packs.dawRescueFromPlaylist")}
                </button>
                <button type="button" disabled={!selectedPlaylist} onClick={() => void exportPack("model_seed", "playlist")} className="toolbar-button disabled:opacity-35">
                  <Download size={14} /> {t("packs.modelSeedFromPlaylist")}
                </button>
              </div>
            </div>
            {settings.export.lastFolder && (
              <p className="break-all text-[11px] text-white/35">
                {t("settings.rememberedFolder")}: {settings.export.lastFolder}
              </p>
            )}
            {lastExportPath && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/8 bg-white/[0.02] p-3">
                <p className="min-w-0 flex-1 truncate text-[11px] text-white/40">
                  {t("settings.savedTo")}: {lastExportPath}
                  {lastExportBytes !== null ? ` · ${t("settings.fileSize")}: ${formatBytes(lastExportBytes)}` : ""}
                </p>
                <button
                  type="button"
                  onClick={() => void api.revealFile(lastExportPath)}
                  className="toolbar-button"
                >
                  <FolderOpen size={14} /> {lastExportBytes !== null ? t("settings.showExportedFile") : t("settings.openFolder")}
                </button>
              </div>
            )}
          </div>
        </SettingsCard>

        <SettingsCard icon={<Database size={18} />} title={t("settings.dataSecurity")}>
          {diagnostics ? (
            <div className="grid gap-2 text-xs text-white/55 sm:grid-cols-2">
              <ReadOnlySetting label={t("settings.database")} value={diagnostics.databasePath} />
              <ReadOnlySetting label={t("settings.appData")} value={diagnostics.appDataPath} />
              <ReadOnlySetting
                label={t("settings.songsPlaylists")}
                value={`${diagnostics.trackCount} / ${diagnostics.playlistCount}`}
              />
              <ReadOnlySetting
                label={t("settings.tagsProjects")}
                value={`${diagnostics.tagCount} / ${diagnostics.projectCount}`}
              />
            </div>
          ) : (
            <p className="text-xs text-white/35">{t("settings.loadingDiagnostics")}</p>
          )}
          <div className="mt-4 grid gap-3 rounded-lg border border-[#d9ff43]/15 bg-[#d9ff43]/5 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-white/75">
                  {t("settings.mobileSyncReadiness")}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-white/40">
                  {t("settings.mobileSyncReadinessHelp")}
                </p>
              </div>
              <span className="rounded-full border border-[#d9ff43]/25 bg-[#d9ff43]/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d9ff43]">
                {t("settings.experimental")}
              </span>
            </div>
            <ReadOnlySetting
              label={t("settings.deviceId")}
              value={deviceId ?? t("settings.loadingDevice")}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void exportSyncManifest()}
                className="toolbar-button"
              >
                <Download size={14} /> {t("settings.exportSyncManifest")}
              </button>
            </div>
            <p className="text-[11px] leading-relaxed text-white/35">
              {t("settings.portablePackagePlanned")}
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <OpenPathButton kind="data" label={t("settings.openData")} />
            <OpenPathButton kind="logs" label={t("settings.openLogs")} />
            <button
              type="button"
              onClick={() => void createDatabaseBackup()}
              className="toolbar-button"
            >
              <Save size={14} /> {t("settings.createSqliteBackup")}
            </button>
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="toolbar-button"
            >
              <FileUp size={14} /> {t("settings.importCsvJson")}
            </button>
            <button
              type="button"
              onClick={() => void exportDiagnostics()}
              className="toolbar-button"
            >
              <Download size={14} /> {t("settings.exportDiagnostics")}
            </button>
          </div>
          <p className="mt-3 text-[11px] text-white/35">
            {t("settings.restoreHelp")}
          </p>
        </SettingsCard>

        <SettingsCard icon={<Info size={18} />} title={t("settings.about")}>
          <div className="space-y-2 text-sm text-white/55">
            <p className="font-semibold text-white/80">
              {t("settings.aboutTitle")}
            </p>
            <p>
              {t("settings.aboutDescription")}
            </p>
            <p className="text-xs leading-relaxed text-white/40">
              {t("settings.aboutStorage")}
            </p>
            <p className="text-xs text-white/35">
              {t("settings.technicalLog")}
            </p>
          </div>
        </SettingsCard>
      </main>
      {importOpen && (
        <ImportLibraryDialog
          onClose={() => setImportOpen(false)}
          onComplete={setNotice}
        />
      )}
      {restoreOpen && (
        <RestoreLibraryDialog
          onClose={() => setRestoreOpen(false)}
          onComplete={setNotice}
        />
      )}
    </div>
  );
}

type AppearanceTheme = AppSettings["appearance"]["theme"];

const THEME_OPTIONS: Array<{
  value: AppearanceTheme;
  name: string;
  description: string;
  swatches: [string, string, string];
}> = [
  {
    value: "studio",
    name: "Oscuro actual",
    description: "Carbón suave con acento verde lima.",
    swatches: ["#15181d", "#222831", "#d9ff43"],
  },
  {
    value: "dark",
    name: "Oscuro profundo",
    description: "La variante más contrastada para entornos oscuros.",
    swatches: ["#101216", "#1d2229", "#d9ff43"],
  },
  {
    value: "soundbender-light",
    name: "Soundbender Light",
    description: "Blanco creativo, violeta azulado y detalles dorados.",
    swatches: ["#f6f3fb", "#ffffff", "#6751c7"],
  },
  {
    value: "soft-light",
    name: "Soft Light Studio",
    description: "Perla y azul grisáceo para sesiones largas.",
    swatches: ["#eef3f7", "#f9fbfd", "#557ca8"],
  },
];

function ThemePicker({
  value,
  onChange,
  t,
}: {
  value: AppearanceTheme;
  onChange: (theme: AppearanceTheme) => void;
  t: (key: string) => string;
}) {
  return (
    <div className="theme-picker mb-5 grid gap-3 sm:grid-cols-2">
      {THEME_OPTIONS.map((theme) => {
        const active = theme.value === value;
        return (
          <button
            key={theme.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(theme.value)}
            className={`theme-option ${active ? "theme-option-active" : ""}`}
          >
            <span className="theme-swatches" aria-hidden="true">
              {theme.swatches.map((swatch) => (
                <span key={swatch} style={{ backgroundColor: swatch }} />
              ))}
            </span>
            <span className="min-w-0 text-left">
              <strong>{t(themeNameKey(theme.value))}</strong>
              <small>{t(themeDescriptionKey(theme.value))}</small>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function themeNameKey(theme: AppearanceTheme) {
  if (theme === "dark") return "theme.darkName";
  if (theme === "soundbender-light") return "theme.soundbenderLightName";
  if (theme === "soft-light") return "theme.softLightName";
  return "theme.studioName";
}

function themeDescriptionKey(theme: AppearanceTheme) {
  if (theme === "dark") return "theme.darkDescription";
  if (theme === "soundbender-light") return "theme.soundbenderLightDescription";
  if (theme === "soft-light") return "theme.softLightDescription";
  return "theme.studioDescription";
}

function accentLabel(theme: AppearanceTheme, t: (key: string) => string) {
  if (theme === "soundbender-light") return t("theme.bluishVioletGold");
  if (theme === "soft-light") return t("theme.softBlueViolet");
  return t("theme.limeGreen");
}

function packLabel(packType: PackType, t: (key: string) => string) {
  const labels: Record<PackType, string> = {
    release: t("packs.releasePack"),
    radio: t("packs.radioPack"),
    daw_rescue: t("packs.dawRescuePack"),
    model_seed: t("packs.modelSeedPack"),
  };
  return labels[packType];
}

function buildLibraryExportQuery(
  settings: AppSettings,
  filtered: boolean,
): LibraryQuery {
  const saved = filtered ? readSavedLibraryFilters() : {};
  return {
    search: typeof saved.search === "string" ? saved.search.trim() || null : null,
    folderPath:
      typeof saved.folderPath === "string" ? saved.folderPath.trim() || null : null,
    ratingMin:
      typeof saved.ratingMin === "number" && Number.isFinite(saved.ratingMin)
        ? saved.ratingMin
        : null,
    ratingMax: null,
    status: null,
    tagId: null,
    projectId: null,
    versionLabel: null,
    smartCollection: null,
    sortBy:
      typeof saved.sortBy === "string"
        ? (saved.sortBy as LibraryQuery["sortBy"])
        : "title",
    sortDirection: saved.sortDirection === "desc" ? "desc" : "asc",
    limit: settings.library.visibleLimit,
    offset: 0,
  };
}

function readSavedLibraryFilters(): {
  search?: string;
  folderPath?: string;
  ratingMin?: number | null;
  sortBy?: string;
  sortDirection?: string;
} {
  try {
    const raw = localStorage.getItem(LIBRARY_FILTERS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function exportOptions(settings: AppSettings) {
  return {
    csvDelimiter: settings.export.csvDelimiter,
    includePath: settings.export.includePath,
    includeInternal: settings.export.includeInternal,
    includeTechnical: settings.export.includeTechnical,
    includeCuration: settings.export.includeCuration,
  };
}

async function chooseExportPath(
  format: "csv" | "json",
  fileName: string,
  title: string,
  settings: AppSettings,
) {
  return save({
    title,
    defaultPath:
      settings.export.rememberFolder && settings.export.lastFolder
        ? `${settings.export.lastFolder}\\${fileName}`
        : fileName,
    filters: [{ name: format.toUpperCase(), extensions: [format] }],
  });
}

function safeFileName(name: string) {
  return name.replace(/[<>:"/\\|?*]/g, "_").trim() || "tagdeck-playlist";
}

function timestampedFileName(stem: string, extension: "csv" | "json") {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `${safeFileName(stem)}_${stamp}.${extension}`;
}

function exportSuccessMessage(t: (key: string) => string, path: string, bytes: number) {
  return `${t("settings.exportCompleted")}. ${t("settings.savedTo")}: ${path}. ${t("settings.fileSize")}: ${formatBytes(bytes)}`;
}

function exportErrorMessage(t: (key: string) => string, error: unknown) {
  return `${t("settings.exportFailed")}. ${t("settings.exportWriteFailed")} ${String(error)}`;
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

function formatDateTime(value: string, language: SupportedLanguage) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(language === "es" ? "es-ES" : "en-US");
}

function SettingsCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card-surface rounded-xl border border-white/8 p-5">
      <h3 className="flex items-center gap-2 font-semibold text-white/80">
        {icon}
        {title}
      </h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function SettingsGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

function ToggleSetting({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`setting-control ${disabled ? "opacity-60" : ""}`}>
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="accent-[#d9ff43]"
      />
    </label>
  );
}

function SelectSetting({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="text-xs text-white/45">
      <span className="mb-1.5 block">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="field"
      >
        {children}
      </select>
    </label>
  );
}

function RangeSetting({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="setting-control">
      <span>
        {label} · {Math.round(value * 100)}%
      </span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-28 accent-[#d9ff43]"
      />
    </label>
  );
}

function ReadOnlySetting({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/8 bg-white/[0.025] p-3">
      <p className="text-[10px] uppercase tracking-wide text-white/30">{label}</p>
      <p className="mt-1 break-all text-xs text-white/60">{value}</p>
    </div>
  );
}

function OpenPathButton({
  kind,
  label,
}: {
  kind: "data" | "backups" | "logs";
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => void api.openAppPath(kind)}
      className="toolbar-button"
    >
      <FolderOpen size={14} /> {label}
    </button>
  );
}

function PathActions({
  diagnostics,
  kind,
}: {
  diagnostics: AppDiagnostics | null;
  kind: "backups";
}) {
  const { t } = useI18n();
  if (!diagnostics) return null;
  return (
    <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-white/8 bg-white/[0.025] p-3">
      <p className="min-w-0 truncate text-xs text-white/45">{diagnostics.backupPath}</p>
      <OpenPathButton kind={kind} label={t("settings.openBackups")} />
    </div>
  );
}

function priorityLabel(key: string, t: (key: string) => string) {
  return (
    {
      genre: t("field.genre"),
      mood: t("field.mood"),
      project: t("field.project"),
      tags: t("field.tags"),
      rating: t("field.rating"),
      radioReady: "Radio Ready",
    } as Record<string, string>
  )[key] ?? key;
}

function uniqueValues(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const normalized = value.trim().toLocaleLowerCase();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}
