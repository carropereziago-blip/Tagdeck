use crate::importer;
use crate::metadata;
use crate::metadata_writer;
use crate::models::{
    AppDiagnostics, AudioMetadata, CurationSaveRequest, ExplorerQuery, ExportFileSummary,
    ExportOptions, ExportedFileInfo, ImportApplySummary, ImportPreview, LibraryBackup,
    LibraryBackupTrack, LibraryFolderOption, LibraryQuery, LibraryRemovalSummary,
    LibraryRestoreApplySummary, LibraryRestoreMissingItem, LibraryRestorePreview,
    MetadataEditItemResult, MetadataEditRequest, MetadataEditSummary, OrganizationEditRequest,
    OrganizationEditSummary, OrganizationOptions, PackExportRequest, PackExportSummary,
    PlayerState, PlaylistCopyRequest, PlaylistCopySummary, PlaylistDetails, PlaylistGroup,
    PlaylistMutationSummary, PlaylistSaveRequest, PlaylistSummary, Project, ScanSummary,
    TrackDetails, TrackPage, TrackSummary,
};
use crate::scanner;
use crate::state::AppState;
use crate::transfer::{self, CopySource};
use crate::updates::{self, UpdateCheckResult};
use std::collections::{HashMap, HashSet};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::State;

#[tauri::command]
pub async fn get_app_settings(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let raw = state
        .database
        .get_app_settings()
        .await
        .map_err(|error| error.to_string())?;
    Ok(raw
        .and_then(|value| serde_json::from_str::<serde_json::Value>(&value).ok())
        .filter(serde_json::Value::is_object)
        .unwrap_or_else(|| serde_json::json!({})))
}

#[tauri::command]
pub async fn save_app_settings(
    settings: serde_json::Value,
    state: State<'_, AppState>,
) -> Result<(), String> {
    if !settings.is_object() {
        return Err("Los ajustes deben ser un objeto JSON".to_owned());
    }
    let value = serde_json::to_string(&settings).map_err(|error| error.to_string())?;
    state
        .database
        .save_app_settings(&value)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn get_app_diagnostics(state: State<'_, AppState>) -> Result<AppDiagnostics, String> {
    build_diagnostics(&state).await
}

#[tauri::command]
pub async fn check_for_updates() -> Result<UpdateCheckResult, String> {
    updates::check_for_updates(env!("CARGO_PKG_VERSION")).await
}

#[tauri::command]
pub fn open_update_url(url: String) -> Result<(), String> {
    updates::open_external_update_url(&url)
}

async fn build_diagnostics(state: &AppState) -> Result<AppDiagnostics, String> {
    let (track_count, playlist_count, tag_count, project_count) = state
        .database
        .diagnostic_counts()
        .await
        .map_err(|error| error.to_string())?;
    Ok(AppDiagnostics {
        app_version: env!("CARGO_PKG_VERSION").to_owned(),
        track_count,
        playlist_count,
        tag_count,
        project_count,
        database_path: state.database_path.to_string_lossy().into_owned(),
        app_data_path: state.app_data_dir.to_string_lossy().into_owned(),
        backup_path: state.backup_dir.to_string_lossy().into_owned(),
        logs_path: state.logs_dir.to_string_lossy().into_owned(),
        generated_at: chrono::Local::now().to_rfc3339(),
        operating_system: std::env::consts::OS.to_owned(),
    })
}

#[tauri::command]
pub async fn export_diagnostics(
    path: String,
    state: State<'_, AppState>,
) -> Result<ExportedFileInfo, String> {
    let diagnostics = build_diagnostics(&state).await?;
    let content = serde_json::to_string_pretty(&diagnostics).map_err(|error| error.to_string())?;
    let output_path = resolve_export_file_path(&path, "tagdeck_diagnostics", "json")?;
    write_export_file_verified(&output_path, content.as_bytes())
}

#[tauri::command]
pub async fn get_device_id(state: State<'_, AppState>) -> Result<String, String> {
    state
        .database
        .get_or_create_device()
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn export_sync_manifest(
    path: String,
    state: State<'_, AppState>,
) -> Result<ExportedFileInfo, String> {
    let manifest = state
        .database
        .build_sync_manifest()
        .await
        .map_err(|error| error.to_string())?;
    let content = serde_json::to_string_pretty(&manifest).map_err(|error| error.to_string())?;
    let output_path = resolve_export_file_path(&path, "tagdeck_manifest", "json")?;
    write_export_file_verified(&output_path, content.as_bytes())
}

#[tauri::command]
pub async fn backup_database(state: State<'_, AppState>) -> Result<String, String> {
    let name = format!(
        "tagdeck-{}.sqlite3",
        chrono::Local::now().format("%Y%m%d-%H%M%S")
    );
    let path = state.backup_dir.join(name);
    state
        .database
        .backup_to(&path)
        .await
        .map_err(|error| error.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn open_app_path(kind: String, state: State<'_, AppState>) -> Result<(), String> {
    let path = match kind.as_str() {
        "data" => &state.app_data_dir,
        "backups" => &state.backup_dir,
        "logs" => &state.logs_dir,
        _ => return Err("Ruta interna no válida".to_owned()),
    };
    Command::new("explorer")
        .arg(path)
        .spawn()
        .map(|_| ())
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn reveal_file(path: String) -> Result<(), String> {
    Command::new("explorer")
        .arg(format!("/select,{path}"))
        .spawn()
        .map(|_| ())
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_drag_icon_path(state: State<'_, AppState>) -> String {
    state.drag_icon_path.to_string_lossy().into_owned()
}

#[tauri::command]
pub async fn scan_folder(path: String, state: State<'_, AppState>) -> Result<ScanSummary, String> {
    scanner::scan_folder_into_database(&state.database, PathBuf::from(path))
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn get_library_folders(
    state: State<'_, AppState>,
) -> Result<Vec<LibraryFolderOption>, String> {
    state
        .database
        .get_library_folders()
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn get_library_tracks(
    query: LibraryQuery,
    state: State<'_, AppState>,
) -> Result<TrackPage, String> {
    state
        .database
        .get_library_tracks(query)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn get_organization_options(
    state: State<'_, AppState>,
) -> Result<OrganizationOptions, String> {
    state
        .database
        .get_organization_options()
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn create_project(name: String, state: State<'_, AppState>) -> Result<Project, String> {
    state
        .database
        .create_project(&name)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn update_track_organization(
    request: OrganizationEditRequest,
    state: State<'_, AppState>,
) -> Result<OrganizationEditSummary, String> {
    let mut seen = HashSet::new();
    let track_ids = request
        .track_ids
        .into_iter()
        .filter(|track_id| seen.insert(*track_id))
        .collect::<Vec<_>>();
    if track_ids.is_empty() {
        return Err(crate::error::AppError::EmptyTrackSelection.to_string());
    }
    if track_ids.len() > 2_000 {
        return Err("La organización masiva admite hasta 2000 canciones".to_owned());
    }
    state
        .database
        .update_track_organization(&track_ids, &request.patch)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn export_library(
    mut query: LibraryQuery,
    format: String,
    path: String,
    options: Option<ExportOptions>,
    state: State<'_, AppState>,
) -> Result<ExportFileSummary, String> {
    let mut tracks: Vec<TrackSummary> = Vec::new();
    query.limit = 2_000;
    query.offset = 0;
    loop {
        let page = state
            .database
            .get_library_tracks(query.clone())
            .await
            .map_err(|error| error.to_string())?;
        let page_len = page.items.len();
        tracks.extend(page.items);
        if page_len < 2_000 {
            break;
        }
        query.offset += 2_000;
    }

    let options = options.unwrap_or_else(default_export_options);
    let content = match format.as_str() {
        "json" => export_json(&tracks, &options)?,
        "csv" => export_csv(&tracks, &options),
        _ => return Err("Formato de exportación no válido".to_owned()),
    };
    let output_path = resolve_export_file_path(&path, "tagdeck_library", &format)?;
    let file = write_export_file_verified(&output_path, content.as_bytes())?;
    Ok(ExportFileSummary {
        count: tracks.len(),
        path: file.path,
        file_name: file.file_name,
        bytes: file.bytes,
    })
}

#[tauri::command]
pub async fn export_library_backup(
    path: String,
    state: State<'_, AppState>,
) -> Result<ExportFileSummary, String> {
    let backup = state
        .database
        .build_library_backup(env!("CARGO_PKG_VERSION"))
        .await
        .map_err(|error| error.to_string())?;
    let count = backup.tracks.len();
    let content = serde_json::to_string_pretty(&backup).map_err(|error| error.to_string())?;
    let output_path = resolve_export_file_path(&path, "tagdeck_library_backup", "json")?;
    let file = write_export_file_verified(&output_path, content.as_bytes())?;
    Ok(ExportFileSummary {
        count,
        path: file.path,
        file_name: file.file_name,
        bytes: file.bytes,
    })
}

#[tauri::command]
pub async fn preview_library_restore(
    path: String,
    relocation_roots: Option<Vec<String>>,
) -> Result<LibraryRestorePreview, String> {
    let backup = read_library_backup(&path)?;
    let resolved = resolve_backup_tracks(&backup.tracks, relocation_roots.as_deref());
    Ok(LibraryRestorePreview {
        source_path: path,
        total_tracks: backup.tracks.len(),
        found_original: resolved
            .iter()
            .filter(|item| item.method == RestoreResolveMethod::Original)
            .count(),
        found_relocated: resolved
            .iter()
            .filter(|item| item.method == RestoreResolveMethod::Relocated)
            .count(),
        missing: resolved
            .iter()
            .filter(|item| item.method == RestoreResolveMethod::Missing)
            .count(),
        playlists_to_restore: backup.playlists.len(),
        projects_to_restore: backup.projects.len(),
        tags_to_restore: backup.tags.len(),
        fields_to_restore: vec![
            "rating".to_owned(),
            "status".to_owned(),
            "project".to_owned(),
            "version".to_owned(),
            "tags".to_owned(),
            "mood".to_owned(),
            "language".to_owned(),
            "model".to_owned(),
            "notes".to_owned(),
        ],
        missing_items: resolved
            .iter()
            .filter(|item| item.method == RestoreResolveMethod::Missing)
            .take(200)
            .map(|item| LibraryRestoreMissingItem {
                source_name: item
                    .track
                    .title
                    .clone()
                    .unwrap_or_else(|| item.track.file_name.clone()),
                path: item.track.path.clone(),
                relative_path: item.track.relative_path.clone(),
            })
            .collect(),
        sqlite_backup_required: true,
    })
}

#[tauri::command]
pub async fn apply_library_restore(
    path: String,
    mode: String,
    relocation_roots: Option<Vec<String>>,
    state: State<'_, AppState>,
) -> Result<LibraryRestoreApplySummary, String> {
    if !["keep", "fill", "overwrite"].contains(&mode.as_str()) {
        return Err("Modo de restauración no válido".to_owned());
    }
    let backup = read_library_backup(&path)?;
    let resolved = resolve_backup_tracks(&backup.tracks, relocation_roots.as_deref());
    let backup_path = state.backup_dir.join(format!(
        "tagdeck_before_restore_{}.sqlite3",
        chrono::Local::now().format("%Y-%m-%d_%H%M%S")
    ));
    state
        .database
        .backup_to(&backup_path)
        .await
        .map_err(|error| format!("No se pudo crear el backup obligatorio: {error}"))?;

    let found = resolved
        .iter()
        .filter_map(|item| {
            item.path
                .as_ref()
                .map(|path| (item.track.clone(), path.clone(), item.method))
        })
        .collect::<Vec<_>>();
    let scanned = found
        .iter()
        .map(|(_, path, method)| {
            let root = if *method == RestoreResolveMethod::Relocated {
                relocation_roots
                    .as_ref()
                    .and_then(|roots| roots.first())
                    .map(PathBuf::from)
                    .unwrap_or_default()
            } else {
                PathBuf::new()
            };
            scanner::scan_track_with_root(Path::new(path), &root)
        })
        .collect::<Vec<_>>();
    state
        .database
        .upsert_scanned_tracks(&scanned)
        .await
        .map_err(|error| error.to_string())?;

    let mut restored = 0;
    let mut stable_to_id = HashMap::new();
    let mut path_to_id = HashMap::new();
    for (track, resolved_path, _) in &found {
        if let Some(track_id) = state
            .database
            .track_id_by_path(resolved_path)
            .await
            .map_err(|error| error.to_string())?
        {
            let force_internal = state
                .database
                .get_track(track_id)
                .await
                .map(|current| current.rating.is_none() && current.project_id.is_none())
                .unwrap_or(true);
            state
                .database
                .apply_backup_track_data(track_id, track, &mode, force_internal)
                .await
                .map_err(|error| error.to_string())?;
            if let Some(stable_id) = &track.stable_id {
                stable_to_id.insert(stable_id.clone(), track_id);
            }
            path_to_id.insert(normalize_path_for_restore(resolved_path), track_id);
            restored += 1;
        }
    }
    let (playlists_restored, playlist_songs_restored) = state
        .database
        .restore_backup_playlists(&backup.playlists, &stable_to_id, &path_to_id)
        .await
        .map_err(|error| error.to_string())?;
    Ok(LibraryRestoreApplySummary {
        total_tracks: backup.tracks.len(),
        restored,
        missing: backup.tracks.len().saturating_sub(restored),
        playlists_restored,
        playlist_songs_restored,
        backup_path: backup_path.to_string_lossy().into_owned(),
    })
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum RestoreResolveMethod {
    Original,
    Relocated,
    Missing,
}

struct ResolvedBackupTrack<'a> {
    track: &'a LibraryBackupTrack,
    path: Option<String>,
    method: RestoreResolveMethod,
}

fn read_library_backup(path: &str) -> Result<LibraryBackup, String> {
    let content = std::fs::read_to_string(path).map_err(|error| error.to_string())?;
    let backup: LibraryBackup =
        serde_json::from_str(&content).map_err(|error| error.to_string())?;
    if backup.r#type != "tagdeck_library_backup" {
        return Err("La restauración completa requiere un backup JSON de TagDeck.".to_owned());
    }
    Ok(backup)
}

fn resolve_backup_tracks<'a>(
    tracks: &'a [LibraryBackupTrack],
    relocation_roots: Option<&[String]>,
) -> Vec<ResolvedBackupTrack<'a>> {
    tracks
        .iter()
        .map(|track| {
            if Path::new(&track.path).is_file() {
                return ResolvedBackupTrack {
                    track,
                    path: Some(track.path.clone()),
                    method: RestoreResolveMethod::Original,
                };
            }
            if let Some(path) = resolve_relocated_track(track, relocation_roots.unwrap_or(&[])) {
                return ResolvedBackupTrack {
                    track,
                    path: Some(path),
                    method: RestoreResolveMethod::Relocated,
                };
            }
            ResolvedBackupTrack {
                track,
                path: None,
                method: RestoreResolveMethod::Missing,
            }
        })
        .collect()
}

fn resolve_relocated_track(track: &LibraryBackupTrack, roots: &[String]) -> Option<String> {
    for root in roots {
        let root = Path::new(root);
        if let Some(relative_path) = &track.relative_path {
            let candidate = root.join(relative_path.replace('/', std::path::MAIN_SEPARATOR_STR));
            if candidate.is_file() {
                return Some(candidate.to_string_lossy().into_owned());
            }
        }
        let candidate = root.join(&track.file_name);
        if candidate.is_file() {
            return Some(candidate.to_string_lossy().into_owned());
        }
    }
    None
}

fn normalize_path_for_restore(path: &str) -> String {
    let normalized = path.replace('/', "\\");
    if cfg!(windows) {
        normalized.to_lowercase()
    } else {
        normalized
    }
}

fn default_export_options() -> ExportOptions {
    ExportOptions {
        csv_delimiter: Some(",".to_owned()),
        include_path: true,
        include_internal: true,
        include_technical: true,
        include_curation: true,
    }
}

fn export_csv(tracks: &[TrackSummary], options: &ExportOptions) -> String {
    let delimiter = options
        .csv_delimiter
        .as_deref()
        .filter(|value| *value == ";" || *value == ",")
        .unwrap_or(",");
    let mut headers = vec![
        "id",
        "stable_id",
        "title",
        "artist",
        "album",
        "album_artist",
        "genre",
        "track_number",
        "rating",
    ];
    if options.include_path {
        headers.push("file_path");
        headers.push("relative_path");
    }
    if options.include_internal {
        headers.extend([
            "status",
            "project",
            "version",
            "tags",
            "workflow_notes",
            "next_action",
        ]);
    }
    if options.include_curation {
        headers.extend([
            "strong_part",
            "main_problem",
            "intended_use",
            "mood",
            "model",
            "reviewed_at",
            "last_reviewed_at",
            "skip_count",
        ]);
    }
    if options.include_technical {
        headers.extend(["duration_ms", "format", "bpm", "musical_key", "play_count"]);
    }
    let mut output = format!("{}\n", headers.join(delimiter));
    for track in tracks {
        let mut values = vec![
            track.id.to_string(),
            track.stable_id.clone().unwrap_or_default(),
            track.title.clone().unwrap_or_default(),
            track.artist.clone().unwrap_or_default(),
            track.album.clone().unwrap_or_default(),
            track.album_artist.clone().unwrap_or_default(),
            track.genre.clone().unwrap_or_default(),
            track
                .track_number
                .map(|value| value.to_string())
                .unwrap_or_default(),
            track
                .rating
                .map(|value| value.to_string())
                .unwrap_or_default(),
        ];
        if options.include_path {
            values.push(track.file_path.clone());
            values.push(track.relative_path.clone().unwrap_or_default());
        }
        if options.include_internal {
            values.extend([
                track.status.clone(),
                track.project_name.clone().unwrap_or_default(),
                track.version_label.clone().unwrap_or_default(),
                track.tag_names.clone(),
                track.workflow_notes.clone().unwrap_or_default(),
                track.next_action.clone().unwrap_or_default(),
            ]);
        }
        if options.include_curation {
            values.extend([
                track.strong_part.clone().unwrap_or_default(),
                track.main_problem.clone().unwrap_or_default(),
                track.intended_use.clone().unwrap_or_default(),
                track.mood.clone().unwrap_or_default(),
                track.generation_model.clone().unwrap_or_default(),
                track.reviewed_at.clone().unwrap_or_default(),
                track.last_reviewed_at.clone().unwrap_or_default(),
                track.skip_count.to_string(),
            ]);
        }
        if options.include_technical {
            values.extend([
                track
                    .duration_ms
                    .map(|value| value.to_string())
                    .unwrap_or_default(),
                track.audio_format.clone(),
                track.bpm.map(|value| value.to_string()).unwrap_or_default(),
                track.musical_key.clone().unwrap_or_default(),
                track.play_count.to_string(),
            ]);
        }
        output.push_str(
            &values
                .iter()
                .map(|value| format!("\"{}\"", value.replace('"', "\"\"")))
                .collect::<Vec<_>>()
                .join(delimiter),
        );
        output.push('\n');
    }
    output
}

fn export_json(tracks: &[TrackSummary], options: &ExportOptions) -> Result<String, String> {
    let rows = tracks
        .iter()
        .map(|track| {
            let mut row = serde_json::Map::new();
            row.insert("id".to_owned(), track.id.into());
            row.insert("stable_id".to_owned(), track.stable_id.clone().into());
            row.insert("title".to_owned(), track.title.clone().into());
            row.insert("artist".to_owned(), track.artist.clone().into());
            row.insert("album".to_owned(), track.album.clone().into());
            row.insert("album_artist".to_owned(), track.album_artist.clone().into());
            row.insert("genre".to_owned(), track.genre.clone().into());
            row.insert("track_number".to_owned(), track.track_number.into());
            row.insert("rating".to_owned(), track.rating.into());
            if options.include_path {
                row.insert("file_path".to_owned(), track.file_path.clone().into());
                row.insert(
                    "relative_path".to_owned(),
                    track.relative_path.clone().into(),
                );
            }
            if options.include_internal {
                row.insert("status".to_owned(), track.status.clone().into());
                row.insert("project".to_owned(), track.project_name.clone().into());
                row.insert("version".to_owned(), track.version_label.clone().into());
                row.insert("tags".to_owned(), track.tag_names.clone().into());
                row.insert(
                    "workflow_notes".to_owned(),
                    track.workflow_notes.clone().into(),
                );
                row.insert("next_action".to_owned(), track.next_action.clone().into());
            }
            if options.include_curation {
                row.insert("strong_part".to_owned(), track.strong_part.clone().into());
                row.insert("main_problem".to_owned(), track.main_problem.clone().into());
                row.insert("intended_use".to_owned(), track.intended_use.clone().into());
                row.insert("mood".to_owned(), track.mood.clone().into());
                row.insert("model".to_owned(), track.generation_model.clone().into());
                row.insert("reviewed_at".to_owned(), track.reviewed_at.clone().into());
                row.insert(
                    "last_reviewed_at".to_owned(),
                    track.last_reviewed_at.clone().into(),
                );
                row.insert("skip_count".to_owned(), track.skip_count.into());
            }
            if options.include_technical {
                row.insert("duration_ms".to_owned(), track.duration_ms.into());
                row.insert("format".to_owned(), track.audio_format.clone().into());
                row.insert("bpm".to_owned(), track.bpm.into());
                row.insert("musical_key".to_owned(), track.musical_key.clone().into());
                row.insert("play_count".to_owned(), track.play_count.into());
            }
            serde_json::Value::Object(row)
        })
        .collect::<Vec<_>>();
    serde_json::to_string_pretty(&rows).map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn get_track(id: i64, state: State<'_, AppState>) -> Result<TrackDetails, String> {
    state
        .database
        .get_track(id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn get_explorer_tracks(
    query: ExplorerQuery,
    state: State<'_, AppState>,
) -> Result<TrackPage, String> {
    state
        .database
        .get_explorer_tracks(query)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn save_curation(
    request: CurationSaveRequest,
    state: State<'_, AppState>,
) -> Result<TrackDetails, String> {
    state
        .database
        .save_curation(&request)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn skip_curation_track(
    id: i64,
    state: State<'_, AppState>,
) -> Result<TrackDetails, String> {
    state
        .database
        .skip_curation_track(id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn get_playlists(state: State<'_, AppState>) -> Result<Vec<PlaylistSummary>, String> {
    state
        .database
        .get_playlists()
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn get_playlist_groups(state: State<'_, AppState>) -> Result<Vec<PlaylistGroup>, String> {
    state
        .database
        .get_playlist_groups()
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn create_playlist_group(
    name: String,
    state: State<'_, AppState>,
) -> Result<PlaylistGroup, String> {
    state
        .database
        .create_playlist_group(&name)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn update_playlist_group(
    id: i64,
    name: String,
    state: State<'_, AppState>,
) -> Result<PlaylistGroup, String> {
    state
        .database
        .update_playlist_group(id, &name)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn delete_playlist_group(id: i64, state: State<'_, AppState>) -> Result<(), String> {
    state
        .database
        .delete_playlist_group(id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn create_playlist(
    request: PlaylistSaveRequest,
    state: State<'_, AppState>,
) -> Result<PlaylistSummary, String> {
    state
        .database
        .create_playlist(&request)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn update_playlist(
    id: i64,
    request: PlaylistSaveRequest,
    state: State<'_, AppState>,
) -> Result<PlaylistSummary, String> {
    state
        .database
        .update_playlist(id, &request)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn delete_playlist(id: i64, state: State<'_, AppState>) -> Result<(), String> {
    state
        .database
        .delete_playlist(id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn get_playlist(id: i64, state: State<'_, AppState>) -> Result<PlaylistDetails, String> {
    state
        .database
        .get_playlist(id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn add_tracks_to_playlist(
    playlist_id: i64,
    track_ids: Vec<i64>,
    state: State<'_, AppState>,
) -> Result<PlaylistMutationSummary, String> {
    let track_ids = unique_track_ids(track_ids)?;
    state
        .database
        .add_tracks_to_playlist(playlist_id, &track_ids)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn remove_tracks_from_playlist(
    playlist_id: i64,
    track_ids: Vec<i64>,
    state: State<'_, AppState>,
) -> Result<PlaylistMutationSummary, String> {
    let track_ids = unique_track_ids(track_ids)?;
    state
        .database
        .remove_tracks_from_playlist(playlist_id, &track_ids)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn move_playlist_track(
    playlist_id: i64,
    track_id: i64,
    direction: String,
    state: State<'_, AppState>,
) -> Result<PlaylistDetails, String> {
    state
        .database
        .move_playlist_track(playlist_id, track_id, &direction)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn reorder_playlist_tracks(
    playlist_id: i64,
    track_ids: Vec<i64>,
    state: State<'_, AppState>,
) -> Result<PlaylistDetails, String> {
    let track_ids = unique_track_ids(track_ids)?;
    state
        .database
        .reorder_playlist_tracks(playlist_id, &track_ids)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn export_playlist(
    id: i64,
    format: String,
    path: String,
    options: Option<ExportOptions>,
    state: State<'_, AppState>,
) -> Result<ExportFileSummary, String> {
    let details = state
        .database
        .get_playlist(id)
        .await
        .map_err(|error| error.to_string())?;
    let options = options.unwrap_or_else(default_export_options);
    let content = match format.as_str() {
        "json" => playlist_json(&details)?,
        "csv" => playlist_csv(&details, options.csv_delimiter.as_deref().unwrap_or(",")),
        _ => return Err("Formato de exportación no válido".to_owned()),
    };
    let output_path = resolve_export_file_path(&path, "tagdeck_playlist", &format)?;
    let file = write_export_file_verified(&output_path, content.as_bytes())?;
    Ok(ExportFileSummary {
        count: details.songs.len(),
        path: file.path,
        file_name: file.file_name,
        bytes: file.bytes,
    })
}

#[tauri::command]
pub async fn copy_playlist_files(
    request: PlaylistCopyRequest,
    state: State<'_, AppState>,
) -> Result<PlaylistCopySummary, String> {
    let track_ids = unique_track_ids(request.track_ids)?;
    let mut sources = Vec::with_capacity(track_ids.len());
    for track_id in track_ids {
        let track = state
            .database
            .get_track(track_id)
            .await
            .map_err(|error| error.to_string())?;
        sources.push(CopySource {
            track_id,
            path: PathBuf::from(track.file_path),
            file_name: track.file_name,
        });
    }
    let destination = PathBuf::from(request.destination_path);
    tauri::async_runtime::spawn_blocking(move || {
        transfer::copy_sources(
            &sources,
            &destination,
            request.numeric_prefix.unwrap_or(true),
        )
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn export_pack(
    request: PackExportRequest,
    state: State<'_, AppState>,
) -> Result<PackExportSummary, String> {
    let pack_label = pack_label(&request.pack_type)?;
    let pack_dir = PathBuf::from(&request.destination_path).join(format!(
        "{}-{}",
        safe_file_stem(pack_label),
        chrono::Local::now().format("%Y%m%d-%H%M%S")
    ));
    std::fs::create_dir_all(&pack_dir).map_err(|error| error.to_string())?;

    let options = ExportOptions {
        csv_delimiter: request.csv_delimiter.clone(),
        include_path: true,
        include_internal: true,
        include_technical: true,
        include_curation: true,
    };
    let (copy_sources, csv_content, json_content, title) = match request.source_kind.as_str() {
        "playlist" => {
            let playlist_id = request
                .playlist_id
                .ok_or_else(|| "Falta la lista para exportar el pack".to_owned())?;
            let details = state
                .database
                .get_playlist(playlist_id)
                .await
                .map_err(|error| error.to_string())?;
            let mut sources = Vec::with_capacity(details.songs.len());
            for song in &details.songs {
                let track = state
                    .database
                    .get_track(song.id)
                    .await
                    .map_err(|error| error.to_string())?;
                sources.push(CopySource {
                    track_id: song.id,
                    path: PathBuf::from(track.file_path),
                    file_name: track.file_name,
                });
            }
            (
                sources,
                playlist_csv(&details, request.csv_delimiter.as_deref().unwrap_or(",")),
                playlist_json(&details)?,
                details.playlist.name,
            )
        }
        "status" => {
            let tracks = pack_tracks_by_status(&state, &request.pack_type).await?;
            let sources = tracks
                .iter()
                .map(|track| CopySource {
                    track_id: track.id,
                    path: PathBuf::from(&track.file_path),
                    file_name: track.file_name.clone(),
                })
                .collect::<Vec<_>>();
            (
                sources,
                export_csv(&tracks, &options),
                export_json(&tracks, &options)?,
                pack_label.to_owned(),
            )
        }
        _ => return Err("Fuente de pack no válida".to_owned()),
    };

    let copy_summary = tauri::async_runtime::spawn_blocking({
        let sources = copy_sources.clone();
        let destination = pack_dir.clone();
        move || transfer::copy_sources(&sources, &destination, true)
    })
    .await
    .map_err(|error| error.to_string())??;

    let base_name = safe_file_stem(&title);
    let csv_path = pack_dir.join(format!("{base_name}.csv"));
    let json_path = pack_dir.join(format!("{base_name}.json"));
    let m3u_path = pack_dir.join(format!("{base_name}.m3u"));
    let readme_path = pack_dir.join("README.txt");
    write_export_file_verified(&csv_path, csv_content.as_bytes())?;
    write_export_file_verified(&json_path, json_content.as_bytes())?;
    let m3u_content = build_m3u(&copy_summary.items);
    write_export_file_verified(&m3u_path, m3u_content.as_bytes())?;
    let readme_content = build_pack_readme(&request.language.unwrap_or_else(|| "en".to_owned()));
    write_export_file_verified(&readme_path, readme_content.as_bytes())?;

    Ok(PackExportSummary {
        pack_type: request.pack_type,
        requested: copy_summary.requested,
        copied: copy_summary.copied,
        missing: copy_summary.missing,
        failed: copy_summary.failed,
        destination_path: pack_dir.to_string_lossy().into_owned(),
        csv_path: csv_path.to_string_lossy().into_owned(),
        json_path: json_path.to_string_lossy().into_owned(),
        m3u_path: m3u_path.to_string_lossy().into_owned(),
        readme_path: readme_path.to_string_lossy().into_owned(),
        items: copy_summary.items,
    })
}

#[tauri::command]
pub async fn preview_library_import(
    path: String,
    state: State<'_, AppState>,
) -> Result<ImportPreview, String> {
    let source_path = PathBuf::from(&path);
    let records =
        tauri::async_runtime::spawn_blocking(move || importer::parse_import_file(&source_path))
            .await
            .map_err(|error| error.to_string())??;
    state
        .database
        .preview_import(&path, &records)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn apply_library_import(
    path: String,
    mode: String,
    state: State<'_, AppState>,
) -> Result<ImportApplySummary, String> {
    let overwrite = match mode.as_str() {
        "safe" => false,
        "overwrite" => true,
        _ => return Err("Modo de importación no válido".to_owned()),
    };
    let source_path = PathBuf::from(&path);
    let records =
        tauri::async_runtime::spawn_blocking(move || importer::parse_import_file(&source_path))
            .await
            .map_err(|error| error.to_string())??;

    apply_import_with_backup(&state.database, &state.backup_dir, &records, overwrite).await
}

async fn apply_import_with_backup(
    database: &crate::database::Database,
    backup_dir: &std::path::Path,
    records: &[importer::ImportRecord],
    overwrite: bool,
) -> Result<ImportApplySummary, String> {
    let backup_path = backup_dir.join(format!(
        "tagdeck-pre-import-{}.sqlite3",
        chrono::Local::now().format("%Y%m%d-%H%M%S-%3f")
    ));
    database
        .backup_to(&backup_path)
        .await
        .map_err(|error| format!("No se pudo crear el backup obligatorio: {error}"))?;
    let mut summary = database
        .apply_import(records, overwrite)
        .await
        .map_err(|error| error.to_string())?;
    summary.backup_path = backup_path.to_string_lossy().into_owned();
    Ok(summary)
}

fn unique_track_ids(track_ids: Vec<i64>) -> Result<Vec<i64>, String> {
    let mut seen = HashSet::new();
    let track_ids = track_ids
        .into_iter()
        .filter(|track_id| seen.insert(*track_id))
        .collect::<Vec<_>>();
    if track_ids.is_empty() {
        return Err(crate::error::AppError::EmptyTrackSelection.to_string());
    }
    if track_ids.len() > 2_000 {
        return Err("Las listas admiten hasta 2000 canciones por operación".to_owned());
    }
    Ok(track_ids)
}

async fn pack_tracks_by_status(
    state: &AppState,
    pack_type: &str,
) -> Result<Vec<TrackSummary>, String> {
    let smart_collection = match pack_type {
        "release" => "release_ready",
        "radio" => "radio_ready",
        "daw_rescue" => "daw_rescue",
        "model_seed" => "tag_custom_model_seed",
        _ => return Err("Tipo de pack no válido".to_owned()),
    };
    let mut query = LibraryQuery {
        search: None,
        folder_path: None,
        rating_min: None,
        rating_max: None,
        status: None,
        tag_id: None,
        project_id: None,
        version_label: None,
        smart_collection: Some(smart_collection.to_owned()),
        sort_by: "title".to_owned(),
        sort_direction: "asc".to_owned(),
        limit: 2_000,
        offset: 0,
    };
    let mut tracks = Vec::new();
    loop {
        let page = state
            .database
            .get_library_tracks(query.clone())
            .await
            .map_err(|error| error.to_string())?;
        let page_len = page.items.len();
        tracks.extend(page.items);
        if page_len < 2_000 {
            break;
        }
        query.offset += 2_000;
    }
    Ok(tracks)
}

fn pack_label(pack_type: &str) -> Result<&'static str, String> {
    match pack_type {
        "release" => Ok("Release Pack"),
        "radio" => Ok("Radio Pack"),
        "daw_rescue" => Ok("DAW Rescue Pack"),
        "model_seed" => Ok("Model Seed Pack"),
        _ => Err("Tipo de pack no válido".to_owned()),
    }
}

fn safe_file_stem(name: &str) -> String {
    let mut sanitized = name
        .chars()
        .map(|character| {
            if matches!(
                character,
                '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*'
            ) {
                '_'
            } else {
                character
            }
        })
        .collect::<String>();
    while sanitized.ends_with([' ', '.']) {
        sanitized.pop();
    }
    if sanitized.is_empty() {
        "tagdeck-pack".to_owned()
    } else {
        sanitized
    }
}

fn resolve_export_file_path(
    path: &str,
    default_stem: &str,
    extension: &str,
) -> Result<PathBuf, String> {
    let input = PathBuf::from(path);
    let extension = extension.trim_start_matches('.').to_ascii_lowercase();
    let output = if input.is_dir() {
        let timestamp = chrono::Local::now().format("%Y-%m-%d_%H%M");
        input.join(format!(
            "{}_{}.{}",
            safe_file_stem(default_stem),
            timestamp,
            extension
        ))
    } else if input.extension().is_none() {
        input.with_extension(&extension)
    } else {
        input
    };
    if let Some(parent) = output.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            return Err(format!(
                "La carpeta de destino no existe: {}",
                parent.to_string_lossy()
            ));
        }
    }
    Ok(output)
}

fn write_export_file_verified(path: &Path, content: &[u8]) -> Result<ExportedFileInfo, String> {
    let parent = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .ok_or_else(|| "La ruta de exportacion no tiene carpeta de destino".to_owned())?;
    if !parent.exists() {
        return Err(format!(
            "La carpeta de destino no existe: {}",
            parent.to_string_lossy()
        ));
    }
    if !parent.is_dir() {
        return Err(format!(
            "El destino no es una carpeta valida: {}",
            parent.to_string_lossy()
        ));
    }

    let temp_path = path.with_extension(format!(
        "{}.tmp",
        path.extension()
            .and_then(|extension| extension.to_str())
            .unwrap_or("export")
    ));

    #[cfg(debug_assertions)]
    eprintln!(
        "[EXPORT] generated file path: {} | bytes to write: {}",
        path.to_string_lossy(),
        content.len()
    );

    let write_result = (|| -> Result<(), String> {
        if temp_path.exists() {
            std::fs::remove_file(&temp_path).map_err(|error| error.to_string())?;
        }
        let mut file = std::fs::File::create(&temp_path).map_err(|error| error.to_string())?;
        file.write_all(content).map_err(|error| error.to_string())?;
        file.flush().map_err(|error| error.to_string())?;
        file.sync_all().map_err(|error| error.to_string())?;
        drop(file);

        let temp_metadata = std::fs::metadata(&temp_path).map_err(|error| error.to_string())?;
        if !temp_metadata.is_file() || temp_metadata.len() == 0 {
            return Err(
                "Error al exportar. El archivo temporal no se escribio correctamente.".to_owned(),
            );
        }

        if path.exists() {
            std::fs::remove_file(path).map_err(|error| error.to_string())?;
        }
        std::fs::rename(&temp_path, path).map_err(|error| error.to_string())?;
        Ok(())
    })();

    if let Err(error) = write_result {
        let _ = std::fs::remove_file(&temp_path);
        return Err(format!(
            "Error al exportar. La app genero una ruta, pero el archivo no se creo. Elige otra carpeta o revisa los permisos. {error}"
        ));
    }

    let info = verify_export_file(path)?;
    #[cfg(debug_assertions)]
    eprintln!(
        "[EXPORT] metadata after write: path={} bytes={}",
        info.path, info.bytes
    );
    Ok(info)
}

fn verify_export_file(path: &Path) -> Result<ExportedFileInfo, String> {
    let metadata = std::fs::metadata(path).map_err(|error| {
        format!(
            "Error al exportar. El archivo no existe despues de escribirlo: {}. {error}",
            path.to_string_lossy()
        )
    })?;
    if !metadata.is_file() {
        return Err(format!(
            "Error al exportar. La ruta final no es un archivo: {}",
            path.to_string_lossy()
        ));
    }
    if metadata.len() == 0 {
        return Err(format!(
            "Error al exportar. El archivo final esta vacio: {}",
            path.to_string_lossy()
        ));
    }
    std::fs::File::open(path).map_err(|error| {
        format!(
            "Error al exportar. El archivo final no se puede leer: {}. {error}",
            path.to_string_lossy()
        )
    })?;
    Ok(ExportedFileInfo {
        path: path.to_string_lossy().into_owned(),
        file_name: path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("export")
            .to_owned(),
        bytes: metadata.len(),
    })
}

fn build_m3u(items: &[crate::models::PlaylistCopyItem]) -> String {
    let mut lines = vec!["#EXTM3U".to_owned()];
    for item in items.iter().filter(|item| item.success) {
        if let Some(path) = &item.destination_path {
            let name = Path::new(path)
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or(path);
            lines.push(name.to_owned());
        }
    }
    format!("{}\n", lines.join("\n"))
}

fn build_pack_readme(language: &str) -> String {
    if language == "es" {
        "Pack de Soundbender TagDeck\nGenerado localmente por Soundbender TagDeck.\nLos archivos fueron copiados, no movidos.\n".to_owned()
    } else {
        "Soundbender TagDeck Pack\nGenerated locally by Soundbender TagDeck.\nFiles were copied, not moved.\n".to_owned()
    }
}

fn playlist_json(details: &PlaylistDetails) -> Result<String, String> {
    let rows = details
        .songs
        .iter()
        .map(|song| {
            serde_json::json!({
                "playlist_name": details.playlist.name,
                "playlist_type": details.playlist.playlist_type,
                "position": song.position,
                "track_stable_id": song.stable_id,
                "title": song.title,
                "artist": song.artist,
                "album": song.album,
                "genre": song.genre,
                "rating": song.rating,
                "status": song.status,
                "project": song.project_name,
                "version": song.version_label,
                "tags": song.tag_names,
                "mood": song.mood,
                "model": song.generation_model,
                "duration_ms": song.duration_ms,
                "format": song.audio_format,
                "path": song.file_path,
                "next_action": song.next_action,
                "notes": song.workflow_notes,
                "playlist_notes": song.playlist_notes,
                "strong_part": song.strong_part,
                "main_problem": song.main_problem,
                "intended_use": song.intended_use
            })
        })
        .collect::<Vec<_>>();
    serde_json::to_string_pretty(&rows).map_err(|error| error.to_string())
}

fn playlist_csv(details: &PlaylistDetails, requested_delimiter: &str) -> String {
    let delimiter = if requested_delimiter == ";" { ";" } else { "," };
    let mut output = format!(
        "{}\n",
        [
            "playlist_name",
            "playlist_type",
            "position",
            "track_stable_id",
            "title",
            "artist",
            "album",
            "genre",
            "rating",
            "status",
            "project",
            "version",
            "tags",
            "mood",
            "model",
            "duration_ms",
            "format",
            "path",
            "next_action",
            "notes",
            "playlist_notes",
            "strong_part",
            "main_problem",
            "intended_use"
        ]
        .join(delimiter)
    );
    for song in &details.songs {
        let values = [
            details.playlist.name.clone(),
            details.playlist.playlist_type.clone(),
            song.position.to_string(),
            song.stable_id.clone().unwrap_or_default(),
            song.title.clone().unwrap_or_default(),
            song.artist.clone().unwrap_or_default(),
            song.album.clone().unwrap_or_default(),
            song.genre.clone().unwrap_or_default(),
            song.rating
                .map(|value| value.to_string())
                .unwrap_or_default(),
            song.status.clone(),
            song.project_name.clone().unwrap_or_default(),
            song.version_label.clone().unwrap_or_default(),
            song.tag_names.clone(),
            song.mood.clone().unwrap_or_default(),
            song.generation_model.clone().unwrap_or_default(),
            song.duration_ms
                .map(|value| value.to_string())
                .unwrap_or_default(),
            song.audio_format.clone(),
            song.file_path.clone(),
            song.next_action.clone().unwrap_or_default(),
            song.workflow_notes.clone().unwrap_or_default(),
            song.playlist_notes.clone().unwrap_or_default(),
            song.strong_part.clone().unwrap_or_default(),
            song.main_problem.clone().unwrap_or_default(),
            song.intended_use.clone().unwrap_or_default(),
        ];
        output.push_str(
            &values
                .iter()
                .map(|value| format!("\"{}\"", value.replace('"', "\"\"")))
                .collect::<Vec<_>>()
                .join(delimiter),
        );
        output.push('\n');
    }
    output
}

#[tauri::command]
pub async fn update_track_rating(
    id: i64,
    rating: Option<i64>,
    state: State<'_, AppState>,
) -> Result<TrackDetails, String> {
    state
        .database
        .update_track_rating(id, rating)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn remove_tracks_from_library(
    track_ids: Vec<i64>,
    state: State<'_, AppState>,
) -> Result<LibraryRemovalSummary, String> {
    let mut seen = HashSet::new();
    let track_ids: Vec<i64> = track_ids
        .into_iter()
        .filter(|track_id| seen.insert(*track_id))
        .collect();
    if track_ids.is_empty() {
        return Err(crate::error::AppError::EmptyTrackSelection.to_string());
    }
    if track_ids.len() > 2_000 {
        return Err("Se pueden quitar como máximo 2000 canciones por operación".to_owned());
    }

    if state
        .player
        .current_track_id()
        .map_err(|error| error.to_string())?
        .is_some_and(|track_id| track_ids.contains(&track_id))
    {
        state.player.stop().map_err(|error| error.to_string())?;
    }

    let removed = state
        .database
        .remove_tracks(&track_ids)
        .await
        .map_err(|error| error.to_string())?;
    Ok(LibraryRemovalSummary {
        requested: track_ids.len(),
        removed,
    })
}

#[tauri::command]
pub async fn clear_library(state: State<'_, AppState>) -> Result<LibraryRemovalSummary, String> {
    state.player.stop().map_err(|error| error.to_string())?;
    let removed = state
        .database
        .clear_library()
        .await
        .map_err(|error| error.to_string())?;
    Ok(LibraryRemovalSummary {
        requested: removed as usize,
        removed,
    })
}

#[tauri::command]
pub async fn update_track_metadata(
    request: MetadataEditRequest,
    state: State<'_, AppState>,
) -> Result<MetadataEditSummary, String> {
    metadata_writer::validate_patch(&request.patch).map_err(|error| error.to_string())?;

    let mut seen = HashSet::new();
    let track_ids: Vec<i64> = request
        .track_ids
        .into_iter()
        .filter(|track_id| seen.insert(*track_id))
        .collect();
    if track_ids.is_empty() {
        return Err(crate::error::AppError::EmptyTrackSelection.to_string());
    }
    if track_ids.len() > 2_000 {
        return Err("La edición masiva admite como máximo 2000 canciones por operación".to_owned());
    }

    state.player.stop().map_err(|error| error.to_string())?;
    let operation_type = if track_ids.len() == 1 {
        "metadata_update"
    } else {
        "bulk_metadata_update"
    };
    let patch_json = serde_json::to_string(&request.patch).map_err(|error| error.to_string())?;
    let mut items = Vec::with_capacity(track_ids.len());

    for track_id in track_ids {
        let track = match state.database.get_track(track_id).await {
            Ok(track) => track,
            Err(error) => {
                items.push(MetadataEditItemResult {
                    track_id,
                    success: false,
                    backup_path: None,
                    error: Some(error.to_string()),
                });
                continue;
            }
        };
        let before_json = serde_json::to_string(&track).map_err(|error| error.to_string())?;
        let path = PathBuf::from(&track.file_path);
        let patch = request.patch.clone();
        let backup_dir = state.backup_dir.clone();

        let write_result = tauri::async_runtime::spawn_blocking(move || {
            metadata_writer::write_metadata_safely(&path, track_id, &patch, &backup_dir)
        })
        .await
        .map_err(|error| error.to_string())?;

        let outcome = match write_result {
            Ok(outcome) => outcome,
            Err(error) => {
                let message = error.to_string();
                let _ = state
                    .database
                    .record_edit_history(
                        Some(track_id),
                        &track.file_path,
                        operation_type,
                        Some(&before_json),
                        Some(&patch_json),
                        false,
                        false,
                        None,
                        Some(&message),
                    )
                    .await;
                items.push(MetadataEditItemResult {
                    track_id,
                    success: false,
                    backup_path: None,
                    error: Some(message),
                });
                continue;
            }
        };

        let backup_path = outcome.backup_path.to_string_lossy().into_owned();
        let scan_path = PathBuf::from(&track.file_path);
        let scanned = tauri::async_runtime::spawn_blocking(move || scanner::scan_track(&scan_path))
            .await
            .map_err(|error| error.to_string())?;

        if let Err(error) = state
            .database
            .upsert_scanned_tracks(std::slice::from_ref(&scanned))
            .await
        {
            let message =
                format!("El archivo se actualizó, pero SQLite no pudo refrescarse: {error}");
            let after_json = serde_json::to_string(&outcome.metadata).ok();
            let _ = state
                .database
                .record_edit_history(
                    Some(track_id),
                    &track.file_path,
                    operation_type,
                    Some(&before_json),
                    after_json.as_deref(),
                    true,
                    false,
                    Some(&backup_path),
                    Some(&message),
                )
                .await;
            items.push(MetadataEditItemResult {
                track_id,
                success: false,
                backup_path: Some(backup_path),
                error: Some(message),
            });
            continue;
        }

        let updated_track = state
            .database
            .get_track(track_id)
            .await
            .map_err(|error| error.to_string())?;
        let after_json =
            serde_json::to_string(&updated_track).map_err(|error| error.to_string())?;
        let history_error = state
            .database
            .record_edit_history(
                Some(track_id),
                &track.file_path,
                operation_type,
                Some(&before_json),
                Some(&after_json),
                true,
                true,
                Some(&backup_path),
                None,
            )
            .await
            .err()
            .map(|error| format!("Metadatos guardados, pero falló el historial: {error}"));

        items.push(MetadataEditItemResult {
            track_id,
            success: true,
            backup_path: Some(backup_path),
            error: history_error,
        });
    }

    let succeeded = items.iter().filter(|item| item.success).count();
    let failed = items.len() - succeeded;
    Ok(MetadataEditSummary {
        total: items.len(),
        succeeded,
        failed,
        items,
    })
}

#[tauri::command]
pub async fn read_audio_metadata(path: String) -> Result<AudioMetadata, String> {
    tauri::async_runtime::spawn_blocking(move || metadata::read_metadata(&PathBuf::from(path)))
        .await
        .map_err(|error| error.to_string())?
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn play_track(
    id: i64,
    context: Option<String>,
    reason: Option<String>,
    state: State<'_, AppState>,
) -> Result<PlayerState, String> {
    let track = state
        .database
        .get_track(id)
        .await
        .map_err(|error| error.to_string())?;
    let context = context.unwrap_or_else(|| "unknown".to_owned());
    let reason = reason.unwrap_or_else(|| "unknown".to_owned());
    state
        .player
        .play_track(&track, &context, &reason)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn pause_player(state: State<'_, AppState>) -> Result<PlayerState, String> {
    state.player.pause().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn resume_player(state: State<'_, AppState>) -> Result<PlayerState, String> {
    state.player.resume().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn stop_player(state: State<'_, AppState>) -> Result<PlayerState, String> {
    state.player.stop().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn seek_player(position_ms: i64, state: State<'_, AppState>) -> Result<PlayerState, String> {
    state
        .player
        .seek(position_ms)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn set_player_volume(volume: f32, state: State<'_, AppState>) -> Result<PlayerState, String> {
    state
        .player
        .set_volume(volume)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn get_player_state(
    play_count_threshold: Option<String>,
    state: State<'_, AppState>,
) -> Result<PlayerState, String> {
    let (player_state, play_count_candidate) = state
        .player
        .state_and_play_count_candidate(play_count_threshold.as_deref().unwrap_or("50"))
        .map_err(|error| error.to_string())?;

    if let Some(track_id) = play_count_candidate {
        state
            .database
            .increment_play_count(track_id)
            .await
            .map_err(|error| error.to_string())?;
    }

    Ok(player_state)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::Database;
    use crate::importer::ImportRecord;
    use crate::models::ScannedTrack;

    #[test]
    fn csv_export_includes_curation_fields() {
        let track = TrackSummary {
            id: 1,
            stable_id: Some("stable-track-1".to_owned()),
            relative_path: Some("Suno/tema.mp3".to_owned()),
            file_path: r"C:\Music\tema.mp3".to_owned(),
            file_name: "tema.mp3".to_owned(),
            audio_format: "mp3".to_owned(),
            status: "selected".to_owned(),
            tag_names: "Suno".to_owned(),
            strong_part: Some("Voz".to_owned()),
            main_problem: Some("Mezcla sucia".to_owned()),
            intended_use: Some("Radio".to_owned()),
            mood: Some("Cósmico".to_owned()),
            generation_model: Some("Suno v4.5".to_owned()),
            skip_count: 2,
            ..TrackSummary::default()
        };

        let csv = export_csv(&[track], &default_export_options());

        assert!(csv.contains("stable_id"));
        assert!(csv.contains("relative_path"));
        assert!(csv.contains("strong_part,main_problem,intended_use,mood,model"));
        assert!(csv.contains("\"stable-track-1\""));
        assert!(csv.contains("\"Suno/tema.mp3\""));
        assert!(csv.contains("\"Voz\",\"Mezcla sucia\",\"Radio\",\"Cósmico\",\"Suno v4.5\""));
        assert!(csv.contains("\"2\""));
    }

    #[test]
    fn playlist_exports_include_playlist_and_creative_fields() {
        let details = PlaylistDetails {
            playlist: PlaylistSummary {
                id: 1,
                name: "Sesión radio 01".to_owned(),
                description: None,
                playlist_type: "radio".to_owned(),
                group_id: None,
                group_name: None,
                purpose: None,
                song_count: 1,
                total_duration_ms: 120_000,
                created_at: "2026-06-12".to_owned(),
                updated_at: "2026-06-12".to_owned(),
            },
            songs: vec![crate::models::PlaylistSong {
                playlist_id: 1,
                position: 1,
                added_at: "2026-06-12".to_owned(),
                playlist_notes: Some("Abrir sesión".to_owned()),
                id: 4,
                stable_id: Some("track-stable-4".to_owned()),
                file_path: r"C:\Music\radio.mp3".to_owned(),
                file_name: "radio.mp3".to_owned(),
                title: Some("Radio Theme".to_owned()),
                artist: Some("Soundbender".to_owned()),
                album: Some("Draft".to_owned()),
                genre: Some("Electronic".to_owned()),
                duration_ms: Some(120_000),
                audio_format: "mp3".to_owned(),
                rating: Some(9),
                status: "selected".to_owned(),
                project_name: Some("Radio".to_owned()),
                version_label: Some("v2".to_owned()),
                tag_names: "Suno, Favorita".to_owned(),
                workflow_notes: Some("Master listo".to_owned()),
                next_action: Some("Emitir".to_owned()),
                strong_part: Some("Coro".to_owned()),
                main_problem: None,
                intended_use: Some("Radio".to_owned()),
                mood: Some("Energético".to_owned()),
                generation_model: Some("Suno v4".to_owned()),
            }],
        };

        let csv = playlist_csv(&details, ",");
        assert!(csv.contains("playlist_name,playlist_type,position,track_stable_id"));
        assert!(csv.contains("\"track-stable-4\""));
        assert!(csv.contains("\"Sesión radio 01\",\"radio\",\"1\""));
        assert!(csv.contains("\"Energético\""));
        assert!(csv.contains("\"Abrir sesión\""));

        assert!(csv.contains("\"Electronic\""));

        let json = playlist_json(&details).unwrap();
        assert!(json.contains("\"track_stable_id\": \"track-stable-4\""));
        assert!(json.contains("\"playlist_name\": \"Sesión radio 01\""));
        assert!(json.contains("\"mood\": \"Energético\""));
        assert!(json.contains("\"model\": \"Suno v4\""));
        assert!(json.contains("\"genre\": \"Electronic\""));
        assert!(json.contains("\"intended_use\": \"Radio\""));
    }

    #[test]
    fn export_options_apply_delimiter_and_optional_fields() {
        let track = TrackSummary {
            id: 1,
            file_path: r"C:\Music\private.mp3".to_owned(),
            file_name: "private.mp3".to_owned(),
            title: Some("Tema".to_owned()),
            audio_format: "mp3".to_owned(),
            status: "review".to_owned(),
            tag_names: "Interno".to_owned(),
            ..TrackSummary::default()
        };
        let options = ExportOptions {
            csv_delimiter: Some(";".to_owned()),
            include_path: false,
            include_internal: false,
            include_technical: false,
            include_curation: false,
        };

        let csv = export_csv(&[track], &options);
        assert!(csv.starts_with(
            "id;stable_id;title;artist;album;album_artist;genre;track_number;rating\n"
        ));
        assert!(!csv.contains("file_path"));
        assert!(!csv.contains("private.mp3"));
        assert!(!csv.contains("Interno"));
    }

    #[test]
    fn export_path_accepts_folder_and_generates_file_name() {
        let directory = tempfile::tempdir().unwrap();
        let path =
            resolve_export_file_path(directory.path().to_str().unwrap(), "tagdeck_library", "csv")
                .unwrap();
        assert_eq!(path.parent(), Some(directory.path()));
        assert_eq!(
            path.extension().and_then(|value| value.to_str()),
            Some("csv")
        );
        assert!(path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap()
            .starts_with("tagdeck_library_"));
    }

    #[test]
    fn export_path_adds_missing_extension() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("tagdeck_export");
        let resolved = resolve_export_file_path(path.to_str().unwrap(), "ignored", "json").unwrap();
        assert_eq!(
            resolved.file_name().and_then(|value| value.to_str()),
            Some("tagdeck_export.json")
        );
    }

    #[test]
    fn verified_export_writes_real_file_and_returns_size() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("tagdeck_library.csv");

        let info = write_export_file_verified(&path, b"id,title\n1,Free\n").unwrap();

        assert_eq!(info.path, path.to_string_lossy());
        assert_eq!(info.file_name, "tagdeck_library.csv");
        assert!(info.bytes > 0);
        assert!(path.is_file());
        assert_eq!(std::fs::read_to_string(path).unwrap(), "id,title\n1,Free\n");
    }

    #[test]
    fn verified_export_rejects_empty_file() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("empty.json");

        let error = write_export_file_verified(&path, b"").unwrap_err();

        assert!(error.contains("archivo"));
        assert!(!path.exists());
    }

    #[tokio::test]
    async fn import_creates_database_backup_before_applying_changes() {
        let directory = tempfile::tempdir().unwrap();
        let database_path = directory.path().join("tagdeck.sqlite3");
        let backup_dir = directory.path().join("backups");
        std::fs::create_dir_all(&backup_dir).unwrap();
        let database = Database::connect(&database_path).await.unwrap();
        let mut metadata = AudioMetadata::empty("wav".to_owned());
        metadata.title = Some("Backup test".to_owned());
        database
            .upsert_scanned_tracks(&[ScannedTrack {
                file_path: r"C:\Music\backup-test.wav".to_owned(),
                file_path_key: r"c:\music\backup-test.wav".to_owned(),
                file_name: "backup-test.wav".to_owned(),
                file_extension: "wav".to_owned(),
                file_size: 44,
                file_modified_at_ms: 1,
                metadata,
                metadata_read_error: None,
                library_root_path: None,
                relative_path: None,
            }])
            .await
            .unwrap();
        let record = ImportRecord {
            source_index: 1,
            path: Some(r"C:\Music\backup-test.wav".to_owned()),
            mood: Some("Profundo".to_owned()),
            ..ImportRecord::default()
        };

        let result = apply_import_with_backup(&database, &backup_dir, &[record], false)
            .await
            .unwrap();

        assert!(std::path::Path::new(&result.backup_path).is_file());
        assert_eq!(
            database.get_track(1).await.unwrap().mood.as_deref(),
            Some("Profundo")
        );
    }

    #[test]
    fn restore_backup_requires_tagdeck_backup_json_type() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("not-a-backup.json");
        let backup = LibraryBackup {
            r#type: "not_a_tagdeck_backup".to_owned(),
            backup_version: 1,
            app: "Soundbender TagDeck".to_owned(),
            app_version: "1.4.0".to_owned(),
            exported_at: "2026-06-26T00:00:00Z".to_owned(),
            device_id: "desktop_test".to_owned(),
            library_roots: vec![],
            projects: vec![],
            tags: vec![],
            tracks: vec![],
            playlists: vec![],
        };
        std::fs::write(&path, serde_json::to_string(&backup).unwrap()).unwrap();

        let error = read_library_backup(path.to_str().unwrap()).unwrap_err();

        assert!(error.contains("backup JSON"));
    }

    #[test]
    fn restore_preview_resolves_relocated_relative_path() {
        let directory = tempfile::tempdir().unwrap();
        let nested = directory.path().join("Suno");
        std::fs::create_dir_all(&nested).unwrap();
        let file = nested.join("Free.mp3");
        std::fs::write(&file, b"fake").unwrap();
        let track = LibraryBackupTrack {
            stable_id: Some("stable-1".to_owned()),
            path: r"Z:\Old\Suno\Free.mp3".to_owned(),
            relative_path: Some("Suno/Free.mp3".to_owned()),
            file_name: "Free.mp3".to_owned(),
            file_size: 4,
            duration_ms: Some(1000),
            format: "mp3".to_owned(),
            title: Some("Free".to_owned()),
            artist: None,
            album: None,
            album_artist: None,
            genre: None,
            rating: Some(8),
            status: "review".to_owned(),
            project: None,
            version: None,
            internal_tags: vec![],
            tag_names: String::new(),
            mood: None,
            language: None,
            model: None,
            strong_part: None,
            main_problem: None,
            intended_use: None,
            next_action: None,
            notes: None,
            reviewed_at: None,
            last_reviewed_at: None,
            skips: 0,
            play_count: 0,
        };

        let roots = vec![directory.path().to_string_lossy().into_owned()];
        let tracks = [track];
        let resolved = resolve_backup_tracks(&tracks, Some(&roots));

        assert_eq!(resolved[0].method, RestoreResolveMethod::Relocated);
        assert_eq!(
            resolved[0].path.as_deref(),
            Some(file.to_string_lossy().as_ref())
        );
    }
}
