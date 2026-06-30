use crate::database::Database;
use crate::error::{AppError, AppResult};
use crate::metadata::{is_supported_audio, read_metadata};
use crate::models::{AudioMetadata, ScanSummary, ScannedTrack};
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use walkdir::WalkDir;

pub async fn scan_folder_into_database(
    database: &Database,
    root_path: PathBuf,
) -> AppResult<ScanSummary> {
    let root_path = dunce::canonicalize(root_path)?;
    if !root_path.is_dir() {
        return Err(AppError::InvalidDirectory(root_path));
    }

    let scan_root = root_path.clone();
    let scan_result = tauri::async_runtime::spawn_blocking(move || collect_tracks(&scan_root))
        .await
        .map_err(|error| AppError::BackgroundTask(error.to_string()))?;
    let (tracks, traversal_errors) = scan_result;
    let discovered = tracks.len();
    let metadata_failures = tracks
        .iter()
        .filter(|track| track.metadata_read_error.is_some())
        .count();
    let (inserted, updated) = database.upsert_scanned_tracks(&tracks).await?;
    database
        .record_scan_root(&root_path.to_string_lossy())
        .await?;

    Ok(ScanSummary {
        root_path: root_path.to_string_lossy().into_owned(),
        discovered,
        inserted,
        updated,
        failed: metadata_failures + traversal_errors,
    })
}

fn collect_tracks(root_path: &Path) -> (Vec<ScannedTrack>, usize) {
    let mut tracks = Vec::new();
    let mut traversal_errors = 0;

    for entry in WalkDir::new(root_path).follow_links(false) {
        let entry = match entry {
            Ok(entry) => entry,
            Err(_) => {
                traversal_errors += 1;
                continue;
            }
        };
        if !entry.file_type().is_file() || !is_supported_audio(entry.path()) {
            continue;
        }
        tracks.push(scan_track_with_root(entry.path(), root_path));
    }

    (tracks, traversal_errors)
}

pub(crate) fn scan_track(path: &Path) -> ScannedTrack {
    scan_track_with_root(path, Path::new(""))
}

pub(crate) fn scan_track_with_root(path: &Path, root_path: &Path) -> ScannedTrack {
    let canonical_path = dunce::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    let canonical_root = if root_path.as_os_str().is_empty() {
        None
    } else {
        Some(dunce::canonicalize(root_path).unwrap_or_else(|_| root_path.to_path_buf()))
    };
    let file_path = canonical_path.to_string_lossy().into_owned();
    let file_path_key = normalize_path_key(&canonical_path);
    let file_name = canonical_path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_default()
        .to_owned();
    let file_extension = canonical_path
        .extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();

    let (file_size, file_modified_at_ms, file_error) = match std::fs::metadata(&canonical_path) {
        Ok(metadata) => {
            let modified = metadata
                .modified()
                .ok()
                .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
                .and_then(|value| i64::try_from(value.as_millis()).ok())
                .unwrap_or_default();
            (
                i64::try_from(metadata.len()).unwrap_or(i64::MAX),
                modified,
                None,
            )
        }
        Err(error) => (0, 0, Some(error.to_string())),
    };

    let (metadata, metadata_error) = match read_metadata(&canonical_path) {
        Ok(metadata) => (metadata, None),
        Err(error) => (
            AudioMetadata::empty(file_extension.clone()),
            Some(error.to_string()),
        ),
    };

    ScannedTrack {
        file_path,
        file_path_key,
        file_name,
        file_extension,
        file_size,
        file_modified_at_ms,
        library_root_path: canonical_root
            .as_ref()
            .map(|root| root.to_string_lossy().into_owned()),
        relative_path: canonical_root
            .as_ref()
            .and_then(|root| canonical_path.strip_prefix(root).ok())
            .map(|relative| relative.to_string_lossy().replace('\\', "/")),
        metadata,
        metadata_read_error: merge_errors(file_error, metadata_error),
    }
}

fn normalize_path_key(path: &Path) -> String {
    let normalized = path.to_string_lossy().replace('/', "\\");
    if cfg!(windows) {
        normalized.to_lowercase()
    } else {
        normalized
    }
}

fn merge_errors(first: Option<String>, second: Option<String>) -> Option<String> {
    match (first, second) {
        (Some(first), Some(second)) => Some(format!("{first}; {second}")),
        (Some(error), None) | (None, Some(error)) => Some(error),
        (None, None) => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn write_minimal_wav(path: &Path) {
        let sample_rate = 8_000_u32;
        let sample_count = 800_u32;
        let data_size = sample_count * 2;
        let mut file = std::fs::File::create(path).unwrap();
        file.write_all(b"RIFF").unwrap();
        file.write_all(&(36 + data_size).to_le_bytes()).unwrap();
        file.write_all(b"WAVEfmt ").unwrap();
        file.write_all(&16_u32.to_le_bytes()).unwrap();
        file.write_all(&1_u16.to_le_bytes()).unwrap();
        file.write_all(&1_u16.to_le_bytes()).unwrap();
        file.write_all(&sample_rate.to_le_bytes()).unwrap();
        file.write_all(&(sample_rate * 2).to_le_bytes()).unwrap();
        file.write_all(&2_u16.to_le_bytes()).unwrap();
        file.write_all(&16_u16.to_le_bytes()).unwrap();
        file.write_all(b"data").unwrap();
        file.write_all(&data_size.to_le_bytes()).unwrap();
        file.write_all(&vec![0_u8; data_size as usize]).unwrap();
    }

    #[tokio::test]
    async fn repeated_scan_is_idempotent() {
        let directory = tempfile::tempdir().unwrap();
        write_minimal_wav(&directory.path().join("track.wav"));
        std::fs::write(directory.path().join("ignore.txt"), "not audio").unwrap();
        let database = Database::connect_in_memory().await.unwrap();

        let first = scan_folder_into_database(&database, directory.path().to_path_buf())
            .await
            .unwrap();
        let second = scan_folder_into_database(&database, directory.path().to_path_buf())
            .await
            .unwrap();

        assert_eq!(first.discovered, 1);
        assert_eq!(first.inserted, 1);
        assert_eq!(second.inserted, 0);
        assert_eq!(second.updated, 1);
        assert_eq!(database.track_count().await.unwrap(), 1);
    }

    #[tokio::test]
    async fn metadata_errors_do_not_stop_the_scan() {
        let directory = tempfile::tempdir().unwrap();
        write_minimal_wav(&directory.path().join("valid.wav"));
        std::fs::write(directory.path().join("broken.mp3"), "not an mp3").unwrap();
        let database = Database::connect_in_memory().await.unwrap();

        let summary = scan_folder_into_database(&database, directory.path().to_path_buf())
            .await
            .unwrap();

        assert_eq!(summary.discovered, 2);
        assert_eq!(summary.inserted, 2);
        assert_eq!(summary.failed, 1);
        assert_eq!(database.track_count().await.unwrap(), 2);
    }
}
