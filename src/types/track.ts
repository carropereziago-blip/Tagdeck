export type SortDirection = "asc" | "desc";
export type TrackSortField =
  | "title"
  | "artist"
  | "album"
  | "albumArtist"
  | "genre"
  | "year"
  | "trackNumber"
  | "rating"
  | "status"
  | "project"
  | "version"
  | "tags"
  | "mood"
  | "bpm"
  | "musicalKey"
  | "playCount"
  | "nextAction"
  | "reviewedAt"
  | "intendedUse"
  | "audioFormat"
  | "durationMs"
  | "path";

export interface TrackSummary {
  id: number;
  stableId?: string | null;
  relativePath?: string | null;
  filePath: string;
  fileName: string;
  title: string | null;
  artist: string | null;
  album: string | null;
  albumArtist: string | null;
  genre: string | null;
  year: number | null;
  trackNumber: number | null;
  durationMs: number | null;
  audioFormat: string;
  bpm: number | null;
  musicalKey: string | null;
  playCount: number;
  rating: number | null;
  status: SongStatus;
  projectId: number | null;
  projectName: string | null;
  versionLabel: string | null;
  tagNames: string;
  workflowNotes: string | null;
  nextAction: string | null;
  strongPart: string | null;
  mainProblem: string | null;
  intendedUse: string | null;
  mood: string | null;
  generationModel: string | null;
  reviewedAt: string | null;
  lastReviewedAt: string | null;
  skipCount: number;
  metadataReadError: string | null;
}

export interface TrackDetails extends TrackSummary {
  fileExtension: string;
  fileSize: number;
  albumArtist: string | null;
  trackNumber: number | null;
  trackTotal: number | null;
  discNumber: number | null;
  discTotal: number | null;
  comment: string | null;
  lyrics: string | null;
  bpm: number | null;
  musicalKey: string | null;
  bitrateKbps: number | null;
  sampleRateHz: number | null;
  channels: number | null;
  hasCoverArt: boolean;
  playCount: number;
}

export type SongStatus =
  | "idea"
  | "generating"
  | "review"
  | "selected"
  | "editing"
  | "final"
  | "published"
  | "archived";

export interface InternalTag {
  id: number;
  name: string;
  usageCount: number;
}

export interface Project {
  id: number;
  name: string;
  description: string | null;
  trackCount: number;
}

export interface SmartCollection {
  id: string;
  name: string;
  count: number;
}

export interface OrganizationOptions {
  tags: InternalTag[];
  projects: Project[];
  versions: string[];
  models: string[];
  smartCollections: SmartCollection[];
}

export interface OrganizationPatch {
  status?: MetadataFieldUpdate<string>;
  workflowNotes?: MetadataFieldUpdate<string>;
  nextAction?: MetadataFieldUpdate<string>;
  versionLabel?: MetadataFieldUpdate<string>;
  projectId?: MetadataFieldUpdate<number>;
  tagNames?: string[];
}

export type ExplorerCriterion =
  | "unreviewed"
  | "unrated"
  | "no_project"
  | "untagged"
  | "needs_action"
  | "daw_rescue"
  | "radio_ready"
  | "release_ready"
  | "archived"
  | "random"
  | "all";

export interface ExplorerQuery {
  criterion: ExplorerCriterion;
  limit: number;
  folderPath?: string | null;
  smartCollection?: string | null;
}

export interface LibraryFolderOption {
  path: string;
  name: string;
  trackCount: number;
  isRoot: boolean;
}

export interface CurationSaveRequest {
  trackId: number;
  rating: number | null;
  organization: OrganizationPatch;
  strongPart: string | null;
  mainProblem: string | null;
  intendedUse: string | null;
  mood: string | null;
  generationModel: string | null;
  markReviewed?: boolean;
}

export type PlaylistType =
  | "manual"
  | "radio"
  | "album_draft"
  | "review"
  | "daw_rescue"
  | "release_candidates"
  | "session"
  | "other";

export type PlaylistPurpose =
  | "idea_capture"
  | "deep_review"
  | "daw_rescue"
  | "release_candidates"
  | "radio"
  | "custom_model_seed"
  | "rejects_i_like"
  | "archive"
  | "archive_cleanup"
  | "metadata_cleanup"
  | "general";

export interface PlaylistSummary {
  id: number;
  name: string;
  description: string | null;
  playlistType: PlaylistType;
  groupId?: number | null;
  groupName?: string | null;
  purpose?: PlaylistPurpose | null;
  songCount: number;
  totalDurationMs: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlaylistSaveRequest {
  name: string;
  description: string | null;
  playlistType: PlaylistType;
  groupId?: number | null;
  purpose?: PlaylistPurpose | null;
}

export interface PlaylistGroup {
  id: number;
  name: string;
  position: number;
  playlistCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlaylistSong {
  playlistId: number;
  position: number;
  addedAt: string;
  playlistNotes: string | null;
  id: number;
  stableId?: string | null;
  filePath: string;
  fileName: string;
  title: string | null;
  artist: string | null;
  album: string | null;
  genre: string | null;
  durationMs: number | null;
  audioFormat: string;
  rating: number | null;
  status: SongStatus;
  projectName: string | null;
  versionLabel: string | null;
  tagNames: string;
  workflowNotes: string | null;
  nextAction: string | null;
  strongPart: string | null;
  mainProblem: string | null;
  intendedUse: string | null;
  mood: string | null;
  generationModel?: string | null;
}

export interface PlaylistDetails {
  playlist: PlaylistSummary;
  songs: PlaylistSong[];
}

export interface PlaylistMutationSummary {
  requested: number;
  changed: number;
}

export interface PlaylistCopyItem {
  trackId: number;
  sourcePath: string;
  destinationPath: string | null;
  success: boolean;
  missing: boolean;
  error: string | null;
}

export interface PlaylistCopySummary {
  requested: number;
  copied: number;
  missing: number;
  failed: number;
  destinationPath: string;
  items: PlaylistCopyItem[];
}

export type PackType = "release" | "radio" | "daw_rescue" | "model_seed";

export interface PackExportRequest {
  packType: PackType;
  sourceKind: "status" | "playlist";
  playlistId?: number | null;
  destinationPath: string;
  language?: "en" | "es";
  csvDelimiter?: "," | ";";
}

export interface PackExportSummary {
  packType: PackType;
  requested: number;
  copied: number;
  missing: number;
  failed: number;
  destinationPath: string;
  csvPath: string;
  jsonPath: string;
  m3uPath: string;
  readmePath: string;
  items: PlaylistCopyItem[];
}

export interface ExtendedMetadataTag {
  tagType: string;
  key: string;
  value: string;
  valueType: "text" | "locator" | "binary" | "picture";
  description: string | null;
}

export interface AudioMetadata {
  title: string | null;
  artist: string | null;
  album: string | null;
  albumArtist: string | null;
  genre: string | null;
  year: number | null;
  trackNumber: number | null;
  trackTotal: number | null;
  discNumber: number | null;
  discTotal: number | null;
  comment: string | null;
  lyrics: string | null;
  unsyncedLyrics: string | null;
  bpm: number | null;
  musicalKey: string | null;
  durationMs: number | null;
  bitrateKbps: number | null;
  sampleRateHz: number | null;
  channels: number | null;
  audioFormat: string;
  hasCoverArt: boolean;
  extendedTags: ExtendedMetadataTag[];
}

export interface MetadataFieldUpdate<T> {
  value: T | null;
}

export interface MetadataPatch {
  title?: MetadataFieldUpdate<string>;
  artist?: MetadataFieldUpdate<string>;
  album?: MetadataFieldUpdate<string>;
  albumArtist?: MetadataFieldUpdate<string>;
  genre?: MetadataFieldUpdate<string>;
  year?: MetadataFieldUpdate<number>;
  trackNumber?: MetadataFieldUpdate<number>;
  trackTotal?: MetadataFieldUpdate<number>;
  discNumber?: MetadataFieldUpdate<number>;
  discTotal?: MetadataFieldUpdate<number>;
  comment?: MetadataFieldUpdate<string>;
  unsyncedLyrics?: MetadataFieldUpdate<string>;
  bpm?: MetadataFieldUpdate<number>;
  musicalKey?: MetadataFieldUpdate<string>;
  coverArt?: MetadataFieldUpdate<string>;
}

export interface MetadataEditItemResult {
  trackId: number;
  success: boolean;
  backupPath: string | null;
  error: string | null;
}

export interface MetadataEditSummary {
  total: number;
  succeeded: number;
  failed: number;
  items: MetadataEditItemResult[];
}

export type PlayerStatus = "stopped" | "playing" | "paused" | "ended";

export interface PlayerState {
  trackId: number | null;
  status: PlayerStatus;
  positionMs: number;
  durationMs: number | null;
  volume: number;
}

export interface LibraryQuery {
  search?: string | null;
  folderPath?: string | null;
  ratingMin?: number | null;
  ratingMax?: number | null;
  status?: SongStatus | null;
  tagId?: number | null;
  projectId?: number | null;
  versionLabel?: string | null;
  smartCollection?: string | null;
  sortBy: TrackSortField;
  sortDirection: SortDirection;
  limit: number;
  offset: number;
}

export interface TrackPage {
  items: TrackSummary[];
  total: number;
}

export interface LibraryRemovalSummary {
  requested: number;
  removed: number;
}

export interface ScanSummary {
  rootPath: string;
  discovered: number;
  inserted: number;
  updated: number;
  failed: number;
}

export interface ExportOptions {
  csvDelimiter: "," | ";";
  includePath: boolean;
  includeInternal: boolean;
  includeTechnical: boolean;
  includeCuration: boolean;
}

export interface ExportedFileInfo {
  path: string;
  fileName: string;
  bytes: number;
}

export interface ExportFileSummary extends ExportedFileInfo {
  count: number;
}

export interface AppDiagnostics {
  appVersion: string;
  trackCount: number;
  playlistCount: number;
  tagCount: number;
  projectCount: number;
  databasePath: string;
  appDataPath: string;
  backupPath: string;
  logsPath: string;
  generatedAt: string;
  operatingSystem: string;
}

export interface UpdateManifest {
  app: string;
  manifestVersion: number;
  channel: string;
  latestVersion: string;
  releasedAt: string;
  minimumSupportedVersion: string | null;
  downloadUrl: string;
  releaseNotesUrl: string;
  mandatory: boolean;
  sha256: string | null;
  size: number | null;
  notes: Record<string, string[]>;
}

export interface UpdateCheckResult {
  manifestUrl: string;
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  checkedAt: string;
  manifest: UpdateManifest;
}

export interface ImportPreviewItem {
  sourceIndex: number;
  sourceName: string;
  matchedTrackId: number | null;
  matchedTrackName: string | null;
  matchMethod: string | null;
  changes: string[];
  conflicts: string[];
  ambiguous: boolean;
}

export interface ImportPreview {
  sourcePath: string;
  total: number;
  matched: number;
  notFound: number;
  ambiguous: number;
  wouldUpdate: number;
  playlistsFound: number;
  items: ImportPreviewItem[];
}

export interface ImportApplySummary {
  total: number;
  matched: number;
  updated: number;
  notFound: number;
  ambiguous: number;
  playlistsImported: number;
  playlistSongsAdded: number;
  backupPath: string;
}

export interface LibraryRestoreMissingItem {
  sourceName: string;
  path: string;
  relativePath: string | null;
}

export interface LibraryRestorePreview {
  sourcePath: string;
  totalTracks: number;
  foundOriginal: number;
  foundRelocated: number;
  missing: number;
  playlistsToRestore: number;
  projectsToRestore: number;
  tagsToRestore: number;
  fieldsToRestore: string[];
  missingItems: LibraryRestoreMissingItem[];
  sqliteBackupRequired: boolean;
}

export interface LibraryRestoreApplySummary {
  totalTracks: number;
  restored: number;
  missing: number;
  playlistsRestored: number;
  playlistSongsRestored: number;
  backupPath: string;
}

export type LibraryRestoreMode = "keep" | "fill" | "overwrite";
