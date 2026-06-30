use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanSummary {
    pub root_path: String,
    pub discovered: usize,
    pub inserted: usize,
    pub updated: usize,
    pub failed: usize,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryQuery {
    pub search: Option<String>,
    pub folder_path: Option<String>,
    pub rating_min: Option<i64>,
    pub rating_max: Option<i64>,
    pub status: Option<String>,
    pub tag_id: Option<i64>,
    pub project_id: Option<i64>,
    pub version_label: Option<String>,
    pub smart_collection: Option<String>,
    pub sort_by: String,
    pub sort_direction: String,
    pub limit: i64,
    pub offset: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackPage {
    pub items: Vec<TrackSummary>,
    pub total: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryRemovalSummary {
    pub requested: usize,
    pub removed: u64,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct ExportOptions {
    pub csv_delimiter: Option<String>,
    pub include_path: bool,
    pub include_internal: bool,
    pub include_technical: bool,
    pub include_curation: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportedFileInfo {
    pub path: String,
    pub file_name: String,
    pub bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportFileSummary {
    pub count: usize,
    pub path: String,
    pub file_name: String,
    pub bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppDiagnostics {
    pub app_version: String,
    pub track_count: i64,
    pub playlist_count: i64,
    pub tag_count: i64,
    pub project_count: i64,
    pub database_path: String,
    pub app_data_path: String,
    pub backup_path: String,
    pub logs_path: String,
    pub generated_at: String,
    pub operating_system: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct TagDeckManifest {
    pub app: String,
    pub manifest_version: i64,
    pub exported_at: String,
    pub device_id: String,
    pub library_roots: Vec<ManifestLibraryRoot>,
    pub tracks: Vec<ManifestTrack>,
    pub playlists: Vec<ManifestPlaylist>,
}

#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "snake_case")]
pub struct ManifestLibraryRoot {
    pub id: i64,
    pub path_label: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct ManifestTrack {
    pub stable_id: String,
    pub relative_path: Option<String>,
    pub file_name: String,
    pub file_hash: Option<String>,
    pub file_size: i64,
    pub duration_ms: Option<i64>,
    pub title: Option<String>,
    pub artist: Option<String>,
    pub rating: Option<i64>,
    pub status: String,
    pub project: Option<String>,
    pub version: Option<String>,
    pub tags: Vec<String>,
    pub mood: Option<String>,
    pub model: Option<String>,
    pub notes: Option<String>,
    pub next_action: Option<String>,
    pub updated_at: String,
    pub updated_by_device: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct ManifestPlaylist {
    pub name: String,
    pub playlist_type: String,
    pub items: Vec<ManifestPlaylistItem>,
}

#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "snake_case")]
pub struct ManifestPlaylistItem {
    pub track_stable_id: String,
    pub position: i64,
}

#[derive(Debug, Clone, Default, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct TrackSummary {
    pub id: i64,
    pub stable_id: Option<String>,
    pub relative_path: Option<String>,
    pub file_path: String,
    pub file_name: String,
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub album_artist: Option<String>,
    pub genre: Option<String>,
    pub year: Option<i64>,
    pub track_number: Option<i64>,
    pub duration_ms: Option<i64>,
    pub audio_format: String,
    pub bpm: Option<f64>,
    pub musical_key: Option<String>,
    pub play_count: i64,
    pub rating: Option<i64>,
    pub status: String,
    pub project_id: Option<i64>,
    pub project_name: Option<String>,
    pub version_label: Option<String>,
    pub tag_names: String,
    pub workflow_notes: Option<String>,
    pub next_action: Option<String>,
    pub strong_part: Option<String>,
    pub main_problem: Option<String>,
    pub intended_use: Option<String>,
    pub mood: Option<String>,
    pub generation_model: Option<String>,
    pub reviewed_at: Option<String>,
    pub last_reviewed_at: Option<String>,
    pub skip_count: i64,
    pub metadata_read_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct TrackDetails {
    pub id: i64,
    pub file_path: String,
    pub file_name: String,
    pub file_extension: String,
    pub file_size: i64,
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub album_artist: Option<String>,
    pub genre: Option<String>,
    pub year: Option<i64>,
    pub track_number: Option<i64>,
    pub track_total: Option<i64>,
    pub disc_number: Option<i64>,
    pub disc_total: Option<i64>,
    pub comment: Option<String>,
    pub lyrics: Option<String>,
    pub bpm: Option<f64>,
    pub musical_key: Option<String>,
    pub duration_ms: Option<i64>,
    pub bitrate_kbps: Option<i64>,
    pub sample_rate_hz: Option<i64>,
    pub channels: Option<i64>,
    pub audio_format: String,
    pub has_cover_art: bool,
    pub rating: Option<i64>,
    pub play_count: i64,
    pub status: String,
    pub workflow_notes: Option<String>,
    pub next_action: Option<String>,
    pub version_label: Option<String>,
    pub project_id: Option<i64>,
    pub project_name: Option<String>,
    pub tag_names: String,
    pub strong_part: Option<String>,
    pub main_problem: Option<String>,
    pub intended_use: Option<String>,
    pub mood: Option<String>,
    pub generation_model: Option<String>,
    pub reviewed_at: Option<String>,
    pub last_reviewed_at: Option<String>,
    pub skip_count: i64,
    pub metadata_read_error: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExplorerQuery {
    pub criterion: String,
    pub limit: i64,
    pub folder_path: Option<String>,
    pub smart_collection: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryFolderOption {
    pub path: String,
    pub name: String,
    pub track_count: i64,
    pub is_root: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CurationSaveRequest {
    pub track_id: i64,
    pub rating: Option<i64>,
    pub organization: OrganizationPatch,
    pub strong_part: Option<String>,
    pub main_problem: Option<String>,
    pub intended_use: Option<String>,
    pub mood: Option<String>,
    pub generation_model: Option<String>,
    pub mark_reviewed: Option<bool>,
}

#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistSummary {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub playlist_type: String,
    pub group_id: Option<i64>,
    pub group_name: Option<String>,
    pub purpose: Option<String>,
    pub song_count: i64,
    pub total_duration_ms: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistSaveRequest {
    pub name: String,
    pub description: Option<String>,
    pub playlist_type: String,
    pub group_id: Option<i64>,
    pub purpose: Option<String>,
}

#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistGroup {
    pub id: i64,
    pub name: String,
    pub position: i64,
    pub playlist_count: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistSong {
    pub playlist_id: i64,
    pub position: i64,
    pub added_at: String,
    pub playlist_notes: Option<String>,
    pub id: i64,
    pub stable_id: Option<String>,
    pub file_path: String,
    pub file_name: String,
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub genre: Option<String>,
    pub duration_ms: Option<i64>,
    pub audio_format: String,
    pub rating: Option<i64>,
    pub status: String,
    pub project_name: Option<String>,
    pub version_label: Option<String>,
    pub tag_names: String,
    pub workflow_notes: Option<String>,
    pub next_action: Option<String>,
    pub strong_part: Option<String>,
    pub main_problem: Option<String>,
    pub intended_use: Option<String>,
    pub mood: Option<String>,
    pub generation_model: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistDetails {
    pub playlist: PlaylistSummary,
    pub songs: Vec<PlaylistSong>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistMutationSummary {
    pub requested: usize,
    pub changed: u64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistCopyRequest {
    pub track_ids: Vec<i64>,
    pub destination_path: String,
    pub numeric_prefix: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistCopyItem {
    pub track_id: i64,
    pub source_path: String,
    pub destination_path: Option<String>,
    pub success: bool,
    pub missing: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistCopySummary {
    pub requested: usize,
    pub copied: usize,
    pub missing: usize,
    pub failed: usize,
    pub destination_path: String,
    pub items: Vec<PlaylistCopyItem>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PackExportRequest {
    pub pack_type: String,
    pub source_kind: String,
    pub playlist_id: Option<i64>,
    pub destination_path: String,
    pub language: Option<String>,
    pub csv_delimiter: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PackExportSummary {
    pub pack_type: String,
    pub requested: usize,
    pub copied: usize,
    pub missing: usize,
    pub failed: usize,
    pub destination_path: String,
    pub csv_path: String,
    pub json_path: String,
    pub m3u_path: String,
    pub readme_path: String,
    pub items: Vec<PlaylistCopyItem>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportPreviewItem {
    pub source_index: usize,
    pub source_name: String,
    pub matched_track_id: Option<i64>,
    pub matched_track_name: Option<String>,
    pub match_method: Option<String>,
    pub changes: Vec<String>,
    pub conflicts: Vec<String>,
    pub ambiguous: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportPreview {
    pub source_path: String,
    pub total: usize,
    pub matched: usize,
    pub not_found: usize,
    pub ambiguous: usize,
    pub would_update: usize,
    pub playlists_found: usize,
    pub items: Vec<ImportPreviewItem>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportApplySummary {
    pub total: usize,
    pub matched: usize,
    pub updated: usize,
    pub not_found: usize,
    pub ambiguous: usize,
    pub playlists_imported: usize,
    pub playlist_songs_added: usize,
    pub backup_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct LibraryBackup {
    pub r#type: String,
    pub backup_version: i64,
    pub app: String,
    pub app_version: String,
    pub exported_at: String,
    pub device_id: String,
    pub library_roots: Vec<LibraryBackupRoot>,
    pub projects: Vec<LibraryBackupProject>,
    pub tags: Vec<LibraryBackupTag>,
    pub tracks: Vec<LibraryBackupTrack>,
    pub playlists: Vec<LibraryBackupPlaylist>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "snake_case")]
pub struct LibraryBackupRoot {
    pub path: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "snake_case")]
pub struct LibraryBackupProject {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "snake_case")]
pub struct LibraryBackupTag {
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct LibraryBackupTrack {
    pub stable_id: Option<String>,
    pub path: String,
    pub relative_path: Option<String>,
    pub file_name: String,
    pub file_size: i64,
    pub duration_ms: Option<i64>,
    pub format: String,
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub album_artist: Option<String>,
    pub genre: Option<String>,
    pub rating: Option<i64>,
    pub status: String,
    pub project: Option<String>,
    pub version: Option<String>,
    pub internal_tags: Vec<String>,
    pub tag_names: String,
    pub mood: Option<String>,
    pub language: Option<String>,
    pub model: Option<String>,
    pub strong_part: Option<String>,
    pub main_problem: Option<String>,
    pub intended_use: Option<String>,
    pub next_action: Option<String>,
    pub notes: Option<String>,
    pub reviewed_at: Option<String>,
    pub last_reviewed_at: Option<String>,
    pub skips: i64,
    pub play_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct LibraryBackupPlaylist {
    pub name: String,
    pub description: Option<String>,
    pub playlist_type: String,
    pub group: Option<String>,
    pub purpose: Option<String>,
    pub items: Vec<LibraryBackupPlaylistItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "snake_case")]
pub struct LibraryBackupPlaylistItem {
    pub track_stable_id: Option<String>,
    pub track_path: Option<String>,
    pub position: i64,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryRestorePreview {
    pub source_path: String,
    pub total_tracks: usize,
    pub found_original: usize,
    pub found_relocated: usize,
    pub missing: usize,
    pub playlists_to_restore: usize,
    pub projects_to_restore: usize,
    pub tags_to_restore: usize,
    pub fields_to_restore: Vec<String>,
    pub missing_items: Vec<LibraryRestoreMissingItem>,
    pub sqlite_backup_required: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryRestoreMissingItem {
    pub source_name: String,
    pub path: String,
    pub relative_path: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryRestoreApplySummary {
    pub total_tracks: usize,
    pub restored: usize,
    pub missing: usize,
    pub playlists_restored: usize,
    pub playlist_songs_restored: usize,
    pub backup_path: String,
}

#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct InternalTag {
    pub id: i64,
    pub name: String,
    pub usage_count: i64,
}

#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub track_count: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SmartCollection {
    pub id: String,
    pub name: String,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OrganizationOptions {
    pub tags: Vec<InternalTag>,
    pub projects: Vec<Project>,
    pub versions: Vec<String>,
    pub models: Vec<String>,
    pub smart_collections: Vec<SmartCollection>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrganizationPatch {
    pub status: Option<MetadataFieldUpdate<String>>,
    pub workflow_notes: Option<MetadataFieldUpdate<String>>,
    pub next_action: Option<MetadataFieldUpdate<String>>,
    pub version_label: Option<MetadataFieldUpdate<String>>,
    pub project_id: Option<MetadataFieldUpdate<i64>>,
    pub tag_names: Option<Vec<String>>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrganizationEditRequest {
    pub track_ids: Vec<i64>,
    pub patch: OrganizationPatch,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OrganizationEditSummary {
    pub updated: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioMetadata {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub album_artist: Option<String>,
    pub genre: Option<String>,
    pub year: Option<i64>,
    pub track_number: Option<i64>,
    pub track_total: Option<i64>,
    pub disc_number: Option<i64>,
    pub disc_total: Option<i64>,
    pub comment: Option<String>,
    pub lyrics: Option<String>,
    pub unsynced_lyrics: Option<String>,
    pub bpm: Option<f64>,
    pub musical_key: Option<String>,
    pub duration_ms: Option<i64>,
    pub bitrate_kbps: Option<i64>,
    pub sample_rate_hz: Option<i64>,
    pub channels: Option<i64>,
    pub audio_format: String,
    pub has_cover_art: bool,
    pub extended_tags: Vec<ExtendedMetadataTag>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtendedMetadataTag {
    pub tag_type: String,
    pub key: String,
    pub value: String,
    pub value_type: String,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MetadataFieldUpdate<T> {
    pub value: Option<T>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MetadataPatch {
    pub title: Option<MetadataFieldUpdate<String>>,
    pub artist: Option<MetadataFieldUpdate<String>>,
    pub album: Option<MetadataFieldUpdate<String>>,
    pub album_artist: Option<MetadataFieldUpdate<String>>,
    pub genre: Option<MetadataFieldUpdate<String>>,
    pub year: Option<MetadataFieldUpdate<i64>>,
    pub track_number: Option<MetadataFieldUpdate<i64>>,
    pub track_total: Option<MetadataFieldUpdate<i64>>,
    pub disc_number: Option<MetadataFieldUpdate<i64>>,
    pub disc_total: Option<MetadataFieldUpdate<i64>>,
    pub comment: Option<MetadataFieldUpdate<String>>,
    pub unsynced_lyrics: Option<MetadataFieldUpdate<String>>,
    pub bpm: Option<MetadataFieldUpdate<f64>>,
    pub musical_key: Option<MetadataFieldUpdate<String>>,
    pub cover_art: Option<MetadataFieldUpdate<String>>,
}

impl MetadataPatch {
    pub fn has_changes(&self) -> bool {
        self.title.is_some()
            || self.artist.is_some()
            || self.album.is_some()
            || self.album_artist.is_some()
            || self.genre.is_some()
            || self.year.is_some()
            || self.track_number.is_some()
            || self.track_total.is_some()
            || self.disc_number.is_some()
            || self.disc_total.is_some()
            || self.comment.is_some()
            || self.unsynced_lyrics.is_some()
            || self.bpm.is_some()
            || self.musical_key.is_some()
            || self.cover_art.is_some()
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MetadataEditRequest {
    pub track_ids: Vec<i64>,
    pub patch: MetadataPatch,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MetadataEditItemResult {
    pub track_id: i64,
    pub success: bool,
    pub backup_path: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MetadataEditSummary {
    pub total: usize,
    pub succeeded: usize,
    pub failed: usize,
    pub items: Vec<MetadataEditItemResult>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum PlayerStatus {
    Stopped,
    Playing,
    Paused,
    Ended,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerState {
    pub track_id: Option<i64>,
    pub status: PlayerStatus,
    pub position_ms: i64,
    pub duration_ms: Option<i64>,
    pub volume: f32,
}

impl AudioMetadata {
    pub fn empty(audio_format: String) -> Self {
        Self {
            title: None,
            artist: None,
            album: None,
            album_artist: None,
            genre: None,
            year: None,
            track_number: None,
            track_total: None,
            disc_number: None,
            disc_total: None,
            comment: None,
            lyrics: None,
            unsynced_lyrics: None,
            bpm: None,
            musical_key: None,
            duration_ms: None,
            bitrate_kbps: None,
            sample_rate_hz: None,
            channels: None,
            audio_format,
            has_cover_art: false,
            extended_tags: Vec::new(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct ScannedTrack {
    pub file_path: String,
    pub file_path_key: String,
    pub file_name: String,
    pub file_extension: String,
    pub file_size: i64,
    pub file_modified_at_ms: i64,
    pub library_root_path: Option<String>,
    pub relative_path: Option<String>,
    pub metadata: AudioMetadata,
    pub metadata_read_error: Option<String>,
}
