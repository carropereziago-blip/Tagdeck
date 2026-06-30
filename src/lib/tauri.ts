import { invoke } from "@tauri-apps/api/core";
import type {
  AudioMetadata,
  CurationSaveRequest,
  ExplorerQuery,
  LibraryQuery,
  LibraryRemovalSummary,
  MetadataEditSummary,
  MetadataPatch,
  OrganizationOptions,
  OrganizationPatch,
  PlayerState,
  PlaylistDetails,
  PlaylistGroup,
  PlaylistMutationSummary,
  PlaylistSaveRequest,
  PlaylistSummary,
  ScanSummary,
  TrackDetails,
  TrackPage,
  Project,
  AppDiagnostics,
  ExportedFileInfo,
  ExportOptions,
  ExportFileSummary,
  ImportApplySummary,
  ImportPreview,
  LibraryFolderOption,
  LibraryRestoreApplySummary,
  LibraryRestoreMode,
  LibraryRestorePreview,
  PlaylistCopySummary,
  PackExportRequest,
  PackExportSummary,
  UpdateCheckResult,
} from "../types/track";

export const api = {
  getAppSettings() {
    return invoke<unknown>("get_app_settings");
  },

  saveAppSettings(settings: unknown) {
    return invoke<void>("save_app_settings", { settings });
  },

  getAppDiagnostics() {
    return invoke<AppDiagnostics>("get_app_diagnostics");
  },

  exportDiagnostics(path: string) {
    return invoke<ExportedFileInfo>("export_diagnostics", { path });
  },

  checkForUpdates() {
    return invoke<UpdateCheckResult>("check_for_updates");
  },

  openUpdateUrl(url: string) {
    return invoke<void>("open_update_url", { url });
  },

  getDeviceId() {
    return invoke<string>("get_device_id");
  },

  exportSyncManifest(path: string) {
    return invoke<ExportedFileInfo>("export_sync_manifest", { path });
  },

  backupDatabase() {
    return invoke<string>("backup_database");
  },

  openAppPath(kind: "data" | "backups" | "logs") {
    return invoke<void>("open_app_path", { kind });
  },

  revealFile(path: string) {
    return invoke<void>("reveal_file", { path });
  },

  getDragIconPath() {
    return invoke<string>("get_drag_icon_path");
  },

  scanFolder(path: string) {
    return invoke<ScanSummary>("scan_folder", { path });
  },

  getLibraryFolders() {
    return invoke<LibraryFolderOption[]>("get_library_folders");
  },

  getLibraryTracks(query: LibraryQuery) {
    return invoke<TrackPage>("get_library_tracks", { query });
  },

  getOrganizationOptions() {
    return invoke<OrganizationOptions>("get_organization_options");
  },

  createProject(name: string) {
    return invoke<Project>("create_project", { name });
  },

  updateTrackOrganization(trackIds: number[], patch: OrganizationPatch) {
    return invoke<{ updated: number }>("update_track_organization", {
      request: { trackIds, patch },
    });
  },

  exportLibrary(
    query: LibraryQuery,
    format: "csv" | "json",
    path: string,
    options?: ExportOptions,
  ) {
    return invoke<ExportFileSummary>("export_library", { query, format, path, options });
  },

  exportLibraryBackup(path: string) {
    return invoke<ExportFileSummary>("export_library_backup", { path });
  },

  getTrack(id: number) {
    return invoke<TrackDetails>("get_track", { id });
  },

  getExplorerTracks(query: ExplorerQuery) {
    return invoke<TrackPage>("get_explorer_tracks", { query });
  },

  saveCuration(request: CurationSaveRequest) {
    return invoke<TrackDetails>("save_curation", { request });
  },

  skipCurationTrack(id: number) {
    return invoke<TrackDetails>("skip_curation_track", { id });
  },

  getPlaylists() {
    return invoke<PlaylistSummary[]>("get_playlists");
  },

  getPlaylistGroups() {
    return invoke<PlaylistGroup[]>("get_playlist_groups");
  },

  createPlaylistGroup(name: string) {
    return invoke<PlaylistGroup>("create_playlist_group", { name });
  },

  updatePlaylistGroup(id: number, name: string) {
    return invoke<PlaylistGroup>("update_playlist_group", { id, name });
  },

  deletePlaylistGroup(id: number) {
    return invoke<void>("delete_playlist_group", { id });
  },

  createPlaylist(request: PlaylistSaveRequest) {
    return invoke<PlaylistSummary>("create_playlist", { request });
  },

  updatePlaylist(id: number, request: PlaylistSaveRequest) {
    return invoke<PlaylistSummary>("update_playlist", { id, request });
  },

  deletePlaylist(id: number) {
    return invoke<void>("delete_playlist", { id });
  },

  getPlaylist(id: number) {
    return invoke<PlaylistDetails>("get_playlist", { id });
  },

  addTracksToPlaylist(playlistId: number, trackIds: number[]) {
    return invoke<PlaylistMutationSummary>("add_tracks_to_playlist", {
      playlistId,
      trackIds,
    });
  },

  removeTracksFromPlaylist(playlistId: number, trackIds: number[]) {
    return invoke<PlaylistMutationSummary>("remove_tracks_from_playlist", {
      playlistId,
      trackIds,
    });
  },

  movePlaylistTrack(
    playlistId: number,
    trackId: number,
    direction: "up" | "down",
  ) {
    return invoke<PlaylistDetails>("move_playlist_track", {
      playlistId,
      trackId,
      direction,
    });
  },

  reorderPlaylistTracks(playlistId: number, trackIds: number[]) {
    return invoke<PlaylistDetails>("reorder_playlist_tracks", {
      playlistId,
      trackIds,
    });
  },

  exportPlaylist(
    id: number,
    format: "csv" | "json",
    path: string,
    options?: ExportOptions,
  ) {
    return invoke<ExportFileSummary>("export_playlist", { id, format, path, options });
  },

  copyPlaylistFiles(
    trackIds: number[],
    destinationPath: string,
    numericPrefix = true,
  ) {
    return invoke<PlaylistCopySummary>("copy_playlist_files", {
      request: { trackIds, destinationPath, numericPrefix },
    });
  },

  exportPack(request: PackExportRequest) {
    return invoke<PackExportSummary>("export_pack", { request });
  },

  previewLibraryImport(path: string) {
    return invoke<ImportPreview>("preview_library_import", { path });
  },

  applyLibraryImport(path: string, mode: "safe" | "overwrite") {
    return invoke<ImportApplySummary>("apply_library_import", { path, mode });
  },

  previewLibraryRestore(path: string, relocationRoots?: string[]) {
    return invoke<LibraryRestorePreview>("preview_library_restore", {
      path,
      relocationRoots,
    });
  },

  applyLibraryRestore(
    path: string,
    mode: LibraryRestoreMode,
    relocationRoots?: string[],
  ) {
    return invoke<LibraryRestoreApplySummary>("apply_library_restore", {
      path,
      mode,
      relocationRoots,
    });
  },

  updateTrackRating(id: number, rating: number | null) {
    return invoke<TrackDetails>("update_track_rating", { id, rating });
  },

  removeTracksFromLibrary(trackIds: number[]) {
    return invoke<LibraryRemovalSummary>("remove_tracks_from_library", { trackIds });
  },

  clearLibrary() {
    return invoke<LibraryRemovalSummary>("clear_library");
  },

  updateTrackMetadata(trackIds: number[], patch: MetadataPatch) {
    return invoke<MetadataEditSummary>("update_track_metadata", {
      request: { trackIds, patch },
    });
  },

  readAudioMetadata(path: string) {
    return invoke<AudioMetadata>("read_audio_metadata", { path });
  },

  playTrack(id: number, context: string, reason: string) {
    return invoke<PlayerState>("play_track", { id, context, reason });
  },

  pausePlayer() {
    return invoke<PlayerState>("pause_player");
  },

  resumePlayer() {
    return invoke<PlayerState>("resume_player");
  },

  stopPlayer() {
    return invoke<PlayerState>("stop_player");
  },

  seekPlayer(positionMs: number) {
    return invoke<PlayerState>("seek_player", { positionMs });
  },

  setPlayerVolume(volume: number) {
    return invoke<PlayerState>("set_player_volume", { volume });
  },

  getPlayerState(playCountThreshold?: "30s" | "50" | "70" | "complete") {
    return invoke<PlayerState>("get_player_state", { playCountThreshold });
  },
};
