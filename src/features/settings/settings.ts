import type { ExplorerCriterion } from "../../types/track";
import { clampPanelZoom } from "../../lib/panelZoom";

export type InterfaceLanguage = "en" | "es";

export const LIBRARY_COLUMNS = [
  "title",
  "artist",
  "album",
  "albumArtist",
  "genre",
  "year",
  "trackNumber",
  "rating",
  "status",
  "project",
  "version",
  "tags",
  "mood",
  "duration",
  "format",
  "bpm",
  "musicalKey",
  "playCount",
  "nextAction",
  "path",
  "reviewedAt",
  "intendedUse",
] as const;

export type LibraryColumn = (typeof LIBRARY_COLUMNS)[number];

export const FIELD_VISIBILITY_CATEGORIES = [
  "metadata",
  "organization",
  "curation",
  "playlist",
  "technical",
] as const;

export type FieldVisibilityCategory = (typeof FIELD_VISIBILITY_CATEGORIES)[number];

export const FIELD_VISIBILITY_ZONES = [
  { id: "libraryTable" },
  { id: "libraryInspector" },
  { id: "organizationTable" },
  { id: "organizationPanel" },
  { id: "explorerCard" },
  { id: "explorerEditor" },
  { id: "sessionCurrent" },
  { id: "sessionResults" },
  { id: "sessionQueue" },
  { id: "playlistsTable" },
  { id: "playlistsPanel" },
] as const;

export type FieldVisibilityZone = (typeof FIELD_VISIBILITY_ZONES)[number]["id"];

export const FIELD_VISIBILITY_FIELDS = [
  { id: "title", category: "metadata" },
  { id: "artist", category: "metadata" },
  { id: "album", category: "metadata" },
  { id: "albumArtist", category: "metadata" },
  { id: "genre", category: "metadata" },
  { id: "year", category: "metadata" },
  { id: "trackNumber", category: "metadata" },
  { id: "trackTotal", category: "metadata" },
  { id: "discNumber", category: "metadata" },
  { id: "discTotal", category: "metadata" },
  { id: "comment", category: "metadata" },
  { id: "lyrics", category: "metadata" },
  { id: "bpm", category: "metadata" },
  { id: "musicalKey", category: "metadata" },
  { id: "coverArt", category: "metadata" },
  { id: "duration", category: "metadata" },
  { id: "format", category: "metadata" },
  { id: "bitrate", category: "metadata" },
  { id: "sampleRate", category: "metadata" },
  { id: "channels", category: "metadata" },
  { id: "path", category: "metadata" },
  { id: "fileName", category: "metadata" },
  { id: "extension", category: "metadata" },
  { id: "rating", category: "organization" },
  { id: "status", category: "organization" },
  { id: "project", category: "organization" },
  { id: "version", category: "organization" },
  { id: "tags", category: "organization" },
  { id: "nextAction", category: "organization" },
  { id: "notes", category: "organization" },
  { id: "reviewedAt", category: "organization" },
  { id: "lastReviewedAt", category: "organization" },
  { id: "skipCount", category: "organization" },
  { id: "playCount", category: "organization" },
  { id: "mood", category: "curation" },
  { id: "generationModel", category: "curation" },
  { id: "strongPart", category: "curation" },
  { id: "mainProblem", category: "curation" },
  { id: "intendedUse", category: "curation" },
  { id: "dawRescue", category: "curation" },
  { id: "radioReady", category: "curation" },
  { id: "releaseReady", category: "curation" },
  { id: "archived", category: "curation" },
  { id: "unreviewed", category: "curation" },
  { id: "playlistPosition", category: "playlist" },
  { id: "playlistName", category: "playlist" },
  { id: "playlistType", category: "playlist" },
  { id: "playlistDuration", category: "playlist" },
  { id: "playlistTrackCount", category: "playlist" },
  { id: "affinity", category: "playlist" },
  { id: "suggestionReason", category: "playlist" },
  { id: "sessionQueue", category: "playlist" },
  { id: "playOrder", category: "playlist" },
  { id: "metadataReadError", category: "technical" },
  { id: "extendedTags", category: "technical" },
  { id: "editHistory", category: "technical" },
  { id: "backupPath", category: "technical" },
  { id: "importedAt", category: "technical" },
  { id: "modifiedAt", category: "technical" },
  { id: "hash", category: "technical" },
] as const satisfies ReadonlyArray<{
  id: string;
  category: FieldVisibilityCategory;
}>;

export type FieldVisibilityField = (typeof FIELD_VISIBILITY_FIELDS)[number]["id"];
export type FieldVisibilityConfig = Record<FieldVisibilityZone, FieldVisibilityField[]>;

export const SECTION_ONBOARDING_IDS = [
  "library",
  "organization",
  "explorer",
  "playlists",
  "session",
  "dashboard",
  "settings",
] as const;

export type SectionOnboardingId = (typeof SECTION_ONBOARDING_IDS)[number];
export type SectionOnboardingConfig = Record<SectionOnboardingId, boolean>;

export function resetSectionOnboarding(): SectionOnboardingConfig {
  return SECTION_ONBOARDING_IDS.reduce(
    (config, section) => ({ ...config, [section]: false }),
    {} as SectionOnboardingConfig,
  );
}

type FieldVisibilityCapability = {
  required: readonly FieldVisibilityField[];
  supported: readonly FieldVisibilityField[];
};

export const FIELD_VISIBILITY_CAPABILITIES = {
  libraryTable: {
    required: ["title"],
    supported: [
      "title",
      "artist",
      "album",
      "albumArtist",
      "genre",
      "year",
      "trackNumber",
      "rating",
      "status",
      "project",
      "version",
      "tags",
      "mood",
      "duration",
      "format",
      "bpm",
      "musicalKey",
      "playCount",
      "nextAction",
      "reviewedAt",
      "intendedUse",
      "path",
    ],
  },
  libraryInspector: {
    required: ["title"],
    supported: [
      "coverArt",
      "title",
      "artist",
      "album",
      "albumArtist",
      "genre",
      "year",
      "trackNumber",
      "discNumber",
      "comment",
      "lyrics",
      "bpm",
      "musicalKey",
      "rating",
      "status",
      "project",
      "version",
      "tags",
      "nextAction",
      "notes",
      "strongPart",
      "mainProblem",
      "intendedUse",
      "mood",
      "generationModel",
      "lastReviewedAt",
      "skipCount",
      "duration",
      "format",
      "bitrate",
      "sampleRate",
      "channels",
      "path",
      "extendedTags",
      "metadataReadError",
    ],
  },
  organizationTable: {
    required: ["title"],
    supported: ["title", "artist", "status", "project", "version", "tags", "nextAction"],
  },
  organizationPanel: {
    required: [],
    supported: ["status", "project", "version", "tags", "nextAction", "notes"],
  },
  explorerCard: {
    required: ["title", "album"],
    supported: [
      "coverArt",
      "title",
      "fileName",
      "artist",
      "album",
      "duration",
      "format",
      "skipCount",
      "lastReviewedAt",
      "path",
    ],
  },
  explorerEditor: {
    required: ["rating", "status", "generationModel", "project", "version", "nextAction"],
    supported: [
      "title",
      "artist",
      "album",
      "albumArtist",
      "year",
      "trackNumber",
      "discNumber",
      "comment",
      "lyrics",
      "bpm",
      "musicalKey",
      "coverArt",
      "duration",
      "format",
      "skipCount",
      "lastReviewedAt",
      "playCount",
      "rating",
      "status",
      "generationModel",
      "project",
      "version",
      "tags",
      "strongPart",
      "mainProblem",
      "intendedUse",
      "mood",
      "genre",
      "nextAction",
      "notes",
    ],
  },
  sessionCurrent: {
    required: ["title", "version", "genre", "generationModel"],
    supported: [
      "coverArt",
      "title",
      "fileName",
      "artist",
      "album",
      "rating",
      "status",
      "generationModel",
      "project",
      "version",
      "genre",
      "mood",
      "tags",
      "duration",
      "format",
      "path",
    ],
  },
  sessionResults: {
    required: ["title"],
    supported: [
      "title",
      "fileName",
      "artist",
      "album",
      "project",
      "rating",
      "status",
      "genre",
      "mood",
      "duration",
      "affinity",
      "suggestionReason",
    ],
  },
  sessionQueue: {
    required: [],
    supported: ["title", "fileName", "artist", "mood", "playOrder", "playlistPosition"],
  },
  playlistsTable: {
    required: ["playlistPosition", "title", "album", "duration"],
    supported: [
      "playlistPosition",
      "title",
      "artist",
      "album",
      "rating",
      "status",
      "project",
      "tags",
      "duration",
      "format",
    ],
  },
  playlistsPanel: {
    required: [],
    supported: [],
  },
} as const satisfies Record<FieldVisibilityZone, FieldVisibilityCapability>;

const LIBRARY_COLUMN_BY_FIELD: Partial<Record<FieldVisibilityField, LibraryColumn>> = {
  title: "title",
  artist: "artist",
  album: "album",
  albumArtist: "albumArtist",
  genre: "genre",
  year: "year",
  trackNumber: "trackNumber",
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
};

export interface AppSettings {
  version: 1;
  interfaceLanguage: InterfaceLanguage;
  interfaceMode: "simple" | "advanced";
  hasSeenOnboarding: boolean;
  hiddenSectionOnboarding: SectionOnboardingConfig;
  keyboardShortcutsEnabled: boolean;
  appearance: {
    theme: "dark" | "studio" | "soundbender-light" | "soft-light";
    interfaceSize: "compact" | "normal" | "wide";
    textSize: "small" | "normal" | "large";
  };
  library: {
    visibleLimit: 500 | 1000 | 2000 | 3000 | 5000;
    visibleColumns: LibraryColumn[];
    rememberFilters: boolean;
    rememberScanFolder: boolean;
    lastScanFolder: string;
  };
  fieldVisibility: FieldVisibilityConfig;
  layout: {
    sidebarMode: "expanded" | "collapsed" | "hidden";
    inspectorVisible: boolean;
    focusMode: boolean;
    explorerRightPanelZoom: number;
    libraryInspectorZoom: number;
  };
  player: {
    defaultVolume: number;
    rememberVolume: boolean;
    lastVolume: number;
    doubleClickPlay: boolean;
    playCountThreshold: "30s" | "50" | "70" | "complete";
    endAction: "stop" | "next" | "repeat";
    libraryEndAction: "stop" | "random" | "ordered" | "repeat";
    avoidLibraryRepeats: boolean;
    showGlobalBar: boolean;
  };
  explorer: {
    defaultCriterion: ExplorerCriterion;
    autoplayOnLoad: boolean;
    autoplayAfterSave: boolean;
    autoplayAfterSkip: boolean;
    confirmArchive: boolean;
    hideArchived: boolean;
    randomQueue: boolean;
    resetQueueOnCriterion: boolean;
    saveMarksReviewed: boolean;
  };
  session: {
    excludeArchived: boolean;
    excludeLowRated: boolean;
    minimumRating: 0 | 5 | 7 | 8;
    priorities: {
      genre: boolean;
      mood: boolean;
      project: boolean;
      tags: boolean;
      rating: boolean;
      radioReady: boolean;
    };
    includePlayed: boolean;
    suggestionAction: "play" | "queue";
    queueEndAction: "stop" | "suggest" | "repeat";
  };
  playlists: {
    avoidDuplicates: boolean;
    confirmDelete: boolean;
    confirmRemoveTracks: boolean;
    respectManualOrder: boolean;
    filterListOrder: "current" | "rating" | "title";
    showTotalDuration: boolean;
  };
  metadata: {
    backupBeforeWrite: true;
    warnBeforeWrite: boolean;
    confirmBulkEdit: boolean;
    confirmExplorerGenreWrite: boolean;
  };
  export: {
    csvDelimiter: "," | ";";
    includePath: boolean;
    includeInternal: boolean;
    includeTechnical: boolean;
    includeCuration: boolean;
    rememberFolder: boolean;
    lastFolder: string;
    openFolderAfterExport: boolean;
  };
  updates: {
    lastUpdateCheckAt: string;
    lastKnownLatestVersion: string;
  };
}

export const DEFAULT_LIBRARY_COLUMNS: LibraryColumn[] = [
  "title",
  "artist",
  "album",
  "genre",
  "rating",
  "status",
  "project",
  "duration",
  "format",
];

const DEFAULT_VISIBLE_FIELDS: FieldVisibilityField[] = [
  "title",
  "artist",
  "album",
  "albumArtist",
  "genre",
  "year",
  "trackNumber",
  "discNumber",
  "comment",
  "duration",
  "format",
  "rating",
  "status",
  "project",
  "version",
  "tags",
  "mood",
  "generationModel",
  "nextAction",
  "notes",
  "strongPart",
  "mainProblem",
  "intendedUse",
  "playCount",
  "path",
  "fileName",
  "lyrics",
  "bpm",
  "musicalKey",
  "coverArt",
  "metadataReadError",
  "extendedTags",
];

export const DEFAULT_FIELD_VISIBILITY: FieldVisibilityConfig =
  FIELD_VISIBILITY_ZONES.reduce((config, zone) => {
    config[zone.id] = ensureZoneMinimum(
      zone.id,
      DEFAULT_VISIBLE_FIELDS.filter((field) => isFieldSupportedInZone(zone.id, field)),
    );
    return config;
  }, {} as FieldVisibilityConfig);

export const FIELD_VISIBILITY_PRESETS = [
  {
    id: "basic",
    fields: ["title", "artist", "album", "duration", "rating", "status"],
  },
  {
    id: "aiOrganization",
    fields: [
      "title",
      "rating",
      "status",
      "project",
      "version",
      "genre",
      "mood",
      "generationModel",
      "tags",
      "nextAction",
      "notes",
      "strongPart",
      "mainProblem",
      "intendedUse",
    ],
  },
  {
    id: "technical",
    fields: [
      "title",
      "format",
      "bitrate",
      "sampleRate",
      "channels",
      "duration",
      "path",
      "metadataReadError",
      "extendedTags",
    ],
  },
  {
    id: "radioSession",
    fields: [
      "title",
      "artist",
      "genre",
      "mood",
      "rating",
      "status",
      "duration",
      "playCount",
      "radioReady",
      "sessionQueue",
      "affinity",
    ],
  },
  {
    id: "publication",
    fields: [
      "title",
      "artist",
      "album",
      "genre",
      "year",
      "coverArt",
      "lyrics",
      "bpm",
      "musicalKey",
      "releaseReady",
      "notes",
    ],
  },
  {
    id: "minimal",
    fields: ["title", "artist", "duration"],
  },
] as const satisfies ReadonlyArray<{
  id: string;
  fields: readonly FieldVisibilityField[];
}>;

export type FieldVisibilityPresetId = (typeof FIELD_VISIBILITY_PRESETS)[number]["id"];

export const DEFAULT_SETTINGS: AppSettings = {
  version: 1,
  interfaceLanguage: "en",
  interfaceMode: "simple",
  hasSeenOnboarding: false,
  hiddenSectionOnboarding: resetSectionOnboarding(),
  keyboardShortcutsEnabled: true,
  appearance: {
    theme: "studio",
    interfaceSize: "normal",
    textSize: "normal",
  },
  library: {
    visibleLimit: 1000,
    visibleColumns: visibleLibraryColumns(DEFAULT_FIELD_VISIBILITY),
    rememberFilters: true,
    rememberScanFolder: true,
    lastScanFolder: "",
  },
  fieldVisibility: DEFAULT_FIELD_VISIBILITY,
  layout: {
    sidebarMode: "expanded",
    inspectorVisible: true,
    focusMode: false,
    explorerRightPanelZoom: 1,
    libraryInspectorZoom: 1,
  },
  player: {
    defaultVolume: 0.8,
    rememberVolume: true,
    lastVolume: 0.8,
    doubleClickPlay: true,
    playCountThreshold: "50",
    endAction: "next",
    libraryEndAction: "stop",
    avoidLibraryRepeats: true,
    showGlobalBar: true,
  },
  explorer: {
    defaultCriterion: "unreviewed",
    autoplayOnLoad: false,
    autoplayAfterSave: true,
    autoplayAfterSkip: false,
    confirmArchive: true,
    hideArchived: true,
    randomQueue: true,
    resetQueueOnCriterion: true,
    saveMarksReviewed: true,
  },
  session: {
    excludeArchived: true,
    excludeLowRated: true,
    minimumRating: 0,
    priorities: {
      genre: true,
      mood: true,
      project: true,
      tags: true,
      rating: true,
      radioReady: true,
    },
    includePlayed: false,
    suggestionAction: "play",
    queueEndAction: "stop",
  },
  playlists: {
    avoidDuplicates: true,
    confirmDelete: true,
    confirmRemoveTracks: true,
    respectManualOrder: true,
    filterListOrder: "current",
    showTotalDuration: true,
  },
  metadata: {
    backupBeforeWrite: true,
    warnBeforeWrite: true,
    confirmBulkEdit: true,
    confirmExplorerGenreWrite: true,
  },
  export: {
    csvDelimiter: ",",
    includePath: true,
    includeInternal: true,
    includeTechnical: true,
    includeCuration: true,
    rememberFolder: true,
    lastFolder: "",
    openFolderAfterExport: false,
  },
  updates: {
    lastUpdateCheckAt: "",
    lastKnownLatestVersion: "",
  },
};

export function normalizeSettings(value: unknown): AppSettings {
  const source = isRecord(value) ? value : {};
  const result = mergeDefaults(DEFAULT_SETTINGS, source) as AppSettings;
  result.interfaceLanguage = oneOf(result.interfaceLanguage, ["en", "es"], "en");
  result.interfaceMode = oneOf(result.interfaceMode, ["simple", "advanced"], "simple");
  result.hasSeenOnboarding = Boolean(result.hasSeenOnboarding);
  result.hiddenSectionOnboarding = normalizeSectionOnboarding(
    result.hiddenSectionOnboarding,
  );
  result.keyboardShortcutsEnabled = result.keyboardShortcutsEnabled !== false;
  result.appearance.theme = oneOf(
    result.appearance.theme,
    ["dark", "studio", "soundbender-light", "soft-light"],
    "studio",
  );
  result.appearance.interfaceSize = oneOf(
    result.appearance.interfaceSize,
    ["compact", "normal", "wide"],
    "normal",
  );
  result.appearance.textSize = oneOf(
    result.appearance.textSize,
    ["small", "normal", "large"],
    "normal",
  );
  result.library.visibleLimit = oneOf(
    result.library.visibleLimit,
    [500, 1000, 2000, 3000, 5000],
    1000,
  );
  if (!result.library.visibleColumns.includes("title")) {
    result.library.visibleColumns = ["title", ...result.library.visibleColumns];
  }
  result.library.visibleColumns = result.library.visibleColumns.filter(
    (column, index, columns) =>
      LIBRARY_COLUMNS.includes(column) && columns.indexOf(column) === index,
  );
  result.fieldVisibility = normalizeFieldVisibility(result.fieldVisibility);
  result.library.visibleColumns = visibleLibraryColumns(result.fieldVisibility);
  result.layout.sidebarMode = oneOf(
    result.layout.sidebarMode,
    ["expanded", "collapsed", "hidden"],
    "expanded",
  );
  result.layout.inspectorVisible = result.layout.inspectorVisible !== false;
  result.layout.focusMode = Boolean(result.layout.focusMode);
  result.layout.explorerRightPanelZoom = clampPanelZoom(
    result.layout.explorerRightPanelZoom,
  );
  result.layout.libraryInspectorZoom = clampPanelZoom(
    result.layout.libraryInspectorZoom,
  );
  result.player.defaultVolume = clampVolume(result.player.defaultVolume, 0.8);
  result.player.lastVolume = clampVolume(result.player.lastVolume, 0.8);
  result.player.endAction = oneOf(
    result.player.endAction,
    ["stop", "next", "repeat"],
    "next",
  );
  result.player.libraryEndAction = oneOf(
    result.player.libraryEndAction,
    ["stop", "random", "ordered", "repeat"],
    "stop",
  );
  result.export.csvDelimiter = result.export.csvDelimiter === ";" ? ";" : ",";
  result.updates.lastUpdateCheckAt =
    typeof result.updates.lastUpdateCheckAt === "string"
      ? result.updates.lastUpdateCheckAt
      : "";
  result.updates.lastKnownLatestVersion =
    typeof result.updates.lastKnownLatestVersion === "string"
      ? result.updates.lastKnownLatestVersion
      : "";
  result.metadata.backupBeforeWrite = true;
  return result;
}

export function normalizeSectionOnboarding(value: unknown): SectionOnboardingConfig {
  const input = isRecord(value) ? value : {};
  return SECTION_ONBOARDING_IDS.reduce((config, section) => {
    config[section] = input[section] === true;
    return config;
  }, {} as SectionOnboardingConfig);
}

export function normalizeFieldVisibility(value: unknown): FieldVisibilityConfig {
  const input = isRecord(value) ? value : {};
  const validFields = new Set<FieldVisibilityField>(
    FIELD_VISIBILITY_FIELDS.map((field) => field.id),
  );
  return FIELD_VISIBILITY_ZONES.reduce((config, zone) => {
    const candidate = input[zone.id];
    const raw: readonly unknown[] = Array.isArray(candidate)
      ? candidate
      : DEFAULT_FIELD_VISIBILITY[zone.id];
    const fields = raw.filter(
      (field): field is FieldVisibilityField =>
        typeof field === "string" &&
        validFields.has(field as FieldVisibilityField) &&
        isFieldSupportedInZone(zone.id, field as FieldVisibilityField),
    );
    config[zone.id] = ensureZoneMinimum(zone.id, fields);
    return config;
  }, {} as FieldVisibilityConfig);
}

export function ensureZoneMinimum(
  zone: FieldVisibilityZone,
  fields: FieldVisibilityField[],
) {
  const unique = [...new Set(fields)].filter((field) => isFieldSupportedInZone(zone, field));
  const required = FIELD_VISIBILITY_CAPABILITIES[zone].required;
  for (const field of required) {
    if (!unique.includes(field)) unique.unshift(field);
  }
  return unique.length > 0 ? unique : [...required];
}

export function setFieldVisibility(
  config: FieldVisibilityConfig,
  zone: FieldVisibilityZone,
  field: FieldVisibilityField,
  visible: boolean,
) {
  if (!isFieldSupportedInZone(zone, field) || isFieldRequiredInZone(zone, field)) {
    return config;
  }
  const current = new Set(config[zone]);
  visible ? current.add(field) : current.delete(field);
  return {
    ...config,
    [zone]: ensureZoneMinimum(zone, [...current]),
  };
}

export function setZoneVisibility(
  config: FieldVisibilityConfig,
  zone: FieldVisibilityZone,
  visible: boolean,
  fields: readonly FieldVisibilityField[] = FIELD_VISIBILITY_FIELDS.map((field) => field.id),
) {
  const supported = fields.filter((field) => isFieldSupportedInZone(zone, field));
  return {
    ...config,
    [zone]: ensureZoneMinimum(zone, visible ? [...supported] : []),
  };
}

export function applyFieldVisibilityPreset(
  presetId: FieldVisibilityPresetId,
) {
  const preset = FIELD_VISIBILITY_PRESETS.find((item) => item.id === presetId);
  const fields = preset?.fields ?? DEFAULT_VISIBLE_FIELDS;
  return FIELD_VISIBILITY_ZONES.reduce((config, zone) => {
    config[zone.id] = ensureZoneMinimum(
      zone.id,
      fields.filter((field) => isFieldSupportedInZone(zone.id, field)),
    );
    return config;
  }, {} as FieldVisibilityConfig);
}

export function isFieldVisible(
  config: FieldVisibilityConfig,
  zone: FieldVisibilityZone,
  field: FieldVisibilityField,
) {
  if (!isFieldSupportedInZone(zone, field)) return false;
  if (isFieldRequiredInZone(zone, field)) return true;
  return config[zone]?.includes(field) ?? DEFAULT_FIELD_VISIBILITY[zone].includes(field);
}

export function visibleFieldsForZone(
  config: Partial<FieldVisibilityConfig> | undefined,
  zone: FieldVisibilityZone,
) {
  return new Set(ensureZoneMinimum(zone, config?.[zone] ?? DEFAULT_FIELD_VISIBILITY[zone]));
}

export function visibleLibraryColumns(config: FieldVisibilityConfig) {
  const columns = Array.from(visibleFieldsForZone(config, "libraryTable"))
    .map((field) => LIBRARY_COLUMN_BY_FIELD[field])
    .filter((column): column is LibraryColumn => Boolean(column));
  return [...new Set(["title" as LibraryColumn, ...columns])];
}

export function isFieldSupportedInZone(
  zone: FieldVisibilityZone,
  field: FieldVisibilityField,
) {
  return (FIELD_VISIBILITY_CAPABILITIES[zone].supported as readonly FieldVisibilityField[])
    .includes(field);
}

export function isFieldRequiredInZone(
  zone: FieldVisibilityZone,
  field: FieldVisibilityField,
) {
  return (FIELD_VISIBILITY_CAPABILITIES[zone].required as readonly FieldVisibilityField[])
    .includes(field);
}

function mergeDefaults(defaults: unknown, source: unknown): unknown {
  if (Array.isArray(defaults)) {
    if (!Array.isArray(source)) return [...defaults];
    if (defaults === DEFAULT_LIBRARY_COLUMNS) {
      return source.filter((item): item is LibraryColumn =>
        LIBRARY_COLUMNS.includes(item as LibraryColumn),
      );
    }
    return source;
  }
  if (isRecord(defaults)) {
    const input = isRecord(source) ? source : {};
    return Object.fromEntries(
      Object.entries(defaults).map(([key, fallback]) => [
        key,
        mergeDefaults(fallback, input[key]),
      ]),
    );
  }
  if (typeof defaults === "number") {
    return typeof source === "number" && Number.isFinite(source) ? source : defaults;
  }
  if (typeof defaults === "boolean") {
    return typeof source === "boolean" ? source : defaults;
  }
  if (typeof defaults === "string") {
    return typeof source === "string" ? source : defaults;
  }
  return source ?? defaults;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function oneOf<T>(value: T, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value) ? value : fallback;
}

function clampVolume(value: number, fallback: number) {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
}
