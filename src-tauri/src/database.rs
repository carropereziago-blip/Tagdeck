use crate::error::{AppError, AppResult};
use crate::importer::ImportRecord;
use crate::models::{
    CurationSaveRequest, ExplorerQuery, ImportApplySummary, ImportPreview, ImportPreviewItem,
    InternalTag, LibraryBackup, LibraryBackupPlaylist, LibraryBackupPlaylistItem,
    LibraryBackupProject, LibraryBackupRoot, LibraryBackupTag, LibraryBackupTrack,
    LibraryFolderOption, LibraryQuery, ManifestLibraryRoot, ManifestPlaylist, ManifestPlaylistItem,
    ManifestTrack, OrganizationEditSummary, OrganizationOptions, OrganizationPatch,
    PlaylistDetails, PlaylistGroup, PlaylistMutationSummary, PlaylistSaveRequest, PlaylistSong,
    PlaylistSummary, Project, ScannedTrack, SmartCollection, TagDeckManifest, TrackDetails,
    TrackPage, TrackSummary,
};
use chrono::Utc;
use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous};
use sqlx::{FromRow, QueryBuilder, Sqlite, SqlitePool, Transaction};
use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::time::Duration;
use uuid::Uuid;

#[derive(Clone)]
pub struct Database {
    pool: SqlitePool,
}

#[derive(Debug, Clone, FromRow)]
struct ImportCandidate {
    id: i64,
    stable_id: Option<String>,
    relative_path: Option<String>,
    file_path_key: String,
    file_name: String,
    file_hash: Option<String>,
    title: Option<String>,
    artist: Option<String>,
    duration_ms: Option<i64>,
    rating: Option<i64>,
    status: String,
    project_name: Option<String>,
    version_label: Option<String>,
    tag_names: String,
    workflow_notes: Option<String>,
    next_action: Option<String>,
    strong_part: Option<String>,
    main_problem: Option<String>,
    intended_use: Option<String>,
    mood: Option<String>,
    language: Option<String>,
    generation_model: Option<String>,
    genre: Option<String>,
}

#[derive(Debug, Clone, FromRow)]
struct LibraryBackupTrackRow {
    stable_id: Option<String>,
    path: String,
    relative_path: Option<String>,
    file_name: String,
    file_size: i64,
    duration_ms: Option<i64>,
    format: String,
    title: Option<String>,
    artist: Option<String>,
    album: Option<String>,
    album_artist: Option<String>,
    genre: Option<String>,
    rating: Option<i64>,
    status: String,
    project: Option<String>,
    version: Option<String>,
    tag_names: String,
    mood: Option<String>,
    language: Option<String>,
    model: Option<String>,
    strong_part: Option<String>,
    main_problem: Option<String>,
    intended_use: Option<String>,
    next_action: Option<String>,
    notes: Option<String>,
    reviewed_at: Option<String>,
    last_reviewed_at: Option<String>,
    skips: i64,
    play_count: i64,
}

#[derive(Debug, Clone, FromRow)]
struct ManifestTrackRow {
    stable_id: String,
    relative_path: Option<String>,
    file_name: String,
    file_hash: Option<String>,
    file_size: i64,
    duration_ms: Option<i64>,
    title: Option<String>,
    artist: Option<String>,
    rating: Option<i64>,
    status: String,
    project: Option<String>,
    version: Option<String>,
    tags: String,
    mood: Option<String>,
    model: Option<String>,
    notes: Option<String>,
    next_action: Option<String>,
    updated_at: String,
    updated_by_device: Option<String>,
}

enum ImportMatch<'a> {
    Found(&'a ImportCandidate, &'static str),
    NotFound,
    Ambiguous,
}

impl Database {
    pub async fn connect(path: &Path) -> AppResult<Self> {
        let options = SqliteConnectOptions::new()
            .filename(path)
            .create_if_missing(true)
            .foreign_keys(true)
            .journal_mode(SqliteJournalMode::Wal)
            .synchronous(SqliteSynchronous::Normal)
            .busy_timeout(Duration::from_secs(5));

        Self::connect_with_options(options).await
    }

    pub async fn get_app_settings(&self) -> AppResult<Option<String>> {
        Ok(
            sqlx::query_scalar("SELECT value FROM app_settings WHERE key = 'preferences'")
                .fetch_optional(&self.pool)
                .await?,
        )
    }

    pub async fn save_app_settings(&self, value: &str) -> AppResult<()> {
        sqlx::query(
            r#"
            INSERT INTO app_settings (key, value, updated_at)
            VALUES ('preferences', ?, ?)
            ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                updated_at = excluded.updated_at
            "#,
        )
        .bind(value)
        .bind(Utc::now().to_rfc3339())
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn diagnostic_counts(&self) -> AppResult<(i64, i64, i64, i64)> {
        let tracks = sqlx::query_scalar("SELECT COUNT(*) FROM tracks WHERE missing_file = 0")
            .fetch_one(&self.pool)
            .await?;
        let playlists = sqlx::query_scalar("SELECT COUNT(*) FROM playlists")
            .fetch_one(&self.pool)
            .await?;
        let tags = sqlx::query_scalar("SELECT COUNT(*) FROM internal_tags")
            .fetch_one(&self.pool)
            .await?;
        let projects = sqlx::query_scalar("SELECT COUNT(*) FROM projects")
            .fetch_one(&self.pool)
            .await?;
        Ok((tracks, playlists, tags, projects))
    }

    pub async fn backup_to(&self, path: &Path) -> AppResult<()> {
        sqlx::query("VACUUM INTO ?")
            .bind(path.to_string_lossy().into_owned())
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn build_sync_manifest(&self) -> AppResult<TagDeckManifest> {
        self.ensure_sync_foundation().await?;
        let device_id = self.get_or_create_device().await?;
        let library_roots = sqlx::query_as::<_, ManifestLibraryRoot>(
            "SELECT id, name AS path_label FROM library_roots ORDER BY name COLLATE NOCASE",
        )
        .fetch_all(&self.pool)
        .await?;
        let track_rows = sqlx::query_as::<_, ManifestTrackRow>(
            r#"
            SELECT
                stable_id,
                relative_path,
                file_name,
                file_hash,
                file_size,
                duration_ms,
                title,
                artist,
                rating,
                status,
                (SELECT name FROM projects WHERE id = tracks.project_id) AS project,
                version_label AS version,
                COALESCE((
                    SELECT GROUP_CONCAT(internal_tags.name, ', ')
                    FROM song_tags
                    JOIN internal_tags ON internal_tags.id = song_tags.tag_id
                    WHERE song_tags.track_id = tracks.id
                ), '') AS tags,
                mood,
                generation_model AS model,
                workflow_notes AS notes,
                next_action,
                updated_at,
                updated_by_device
            FROM tracks
            WHERE missing_file = 0 AND stable_id IS NOT NULL
            ORDER BY relative_path COLLATE NOCASE, file_name COLLATE NOCASE
            "#,
        )
        .fetch_all(&self.pool)
        .await?;
        let tracks = track_rows
            .into_iter()
            .map(|row| ManifestTrack {
                stable_id: row.stable_id,
                relative_path: row.relative_path,
                file_name: row.file_name,
                file_hash: row.file_hash,
                file_size: row.file_size,
                duration_ms: row.duration_ms,
                title: row.title,
                artist: row.artist,
                rating: row.rating,
                status: row.status,
                project: row.project,
                version: row.version,
                tags: split_manifest_values(&row.tags),
                mood: row.mood,
                model: row.model,
                notes: row.notes,
                next_action: row.next_action,
                updated_at: row.updated_at,
                updated_by_device: row.updated_by_device,
            })
            .collect();
        let playlist_summaries = self.get_playlists().await?;
        let mut playlists = Vec::with_capacity(playlist_summaries.len());
        for playlist in playlist_summaries {
            let items = sqlx::query_as::<_, ManifestPlaylistItem>(
                r#"
                SELECT tracks.stable_id AS track_stable_id, playlist_songs.position
                FROM playlist_songs
                JOIN tracks ON tracks.id = playlist_songs.song_id
                WHERE playlist_songs.playlist_id = ?
                  AND tracks.missing_file = 0
                  AND tracks.stable_id IS NOT NULL
                ORDER BY playlist_songs.position, playlist_songs.added_at, tracks.id
                "#,
            )
            .bind(playlist.id)
            .fetch_all(&self.pool)
            .await?;
            playlists.push(ManifestPlaylist {
                name: playlist.name,
                playlist_type: playlist.playlist_type,
                items,
            });
        }

        Ok(TagDeckManifest {
            app: "Soundbender TagDeck".to_owned(),
            manifest_version: 1,
            exported_at: Utc::now().to_rfc3339(),
            device_id,
            library_roots,
            tracks,
            playlists,
        })
    }

    pub async fn build_library_backup(&self, app_version: &str) -> AppResult<LibraryBackup> {
        self.ensure_sync_foundation().await?;
        let device_id = self.get_or_create_device().await?;
        let library_roots = sqlx::query_as::<_, LibraryBackupRoot>(
            "SELECT path, name FROM library_roots ORDER BY name COLLATE NOCASE",
        )
        .fetch_all(&self.pool)
        .await?;
        let projects = sqlx::query_as::<_, LibraryBackupProject>(
            "SELECT name, description FROM projects ORDER BY name COLLATE NOCASE",
        )
        .fetch_all(&self.pool)
        .await?;
        let tags = sqlx::query_as::<_, LibraryBackupTag>(
            "SELECT name FROM internal_tags ORDER BY name COLLATE NOCASE",
        )
        .fetch_all(&self.pool)
        .await?;
        let track_rows = sqlx::query_as::<_, LibraryBackupTrackRow>(
            r#"
            SELECT tracks.stable_id,
                   tracks.file_path AS path,
                   tracks.relative_path,
                   tracks.file_name,
                   tracks.file_size,
                   tracks.duration_ms,
                   tracks.audio_format AS format,
                   tracks.title,
                   tracks.artist,
                   tracks.album,
                   tracks.album_artist,
                   tracks.genre,
                   tracks.rating,
                   tracks.status,
                   projects.name AS project,
                   tracks.version_label AS version,
                   COALESCE((
                       SELECT GROUP_CONCAT(internal_tags.name, ', ')
                       FROM song_tags
                       JOIN internal_tags ON internal_tags.id = song_tags.tag_id
                       WHERE song_tags.track_id = tracks.id
                   ), '') AS tag_names,
                   tracks.mood,
                   tracks.language,
                   tracks.generation_model AS model,
                   tracks.strong_part,
                   tracks.main_problem,
                   tracks.intended_use,
                   tracks.next_action,
                   tracks.workflow_notes AS notes,
                   tracks.reviewed_at,
                   tracks.last_reviewed_at,
                   tracks.skip_count AS skips,
                   tracks.play_count
            FROM tracks
            LEFT JOIN projects ON projects.id = tracks.project_id
            WHERE tracks.missing_file = 0
            ORDER BY tracks.file_path COLLATE NOCASE
            "#,
        )
        .fetch_all(&self.pool)
        .await?;
        let tracks = track_rows
            .into_iter()
            .map(|row| LibraryBackupTrack {
                stable_id: row.stable_id,
                path: row.path,
                relative_path: row.relative_path,
                file_name: row.file_name,
                file_size: row.file_size,
                duration_ms: row.duration_ms,
                format: row.format,
                title: row.title,
                artist: row.artist,
                album: row.album,
                album_artist: row.album_artist,
                genre: row.genre,
                rating: row.rating,
                status: row.status,
                project: row.project,
                version: row.version,
                internal_tags: split_stored_list(&row.tag_names),
                tag_names: row.tag_names,
                mood: row.mood,
                language: row.language,
                model: row.model,
                strong_part: row.strong_part,
                main_problem: row.main_problem,
                intended_use: row.intended_use,
                next_action: row.next_action,
                notes: row.notes,
                reviewed_at: row.reviewed_at,
                last_reviewed_at: row.last_reviewed_at,
                skips: row.skips,
                play_count: row.play_count,
            })
            .collect::<Vec<_>>();

        let playlist_summaries = self.get_playlists().await?;
        let mut playlists = Vec::with_capacity(playlist_summaries.len());
        for playlist in playlist_summaries {
            let items = sqlx::query_as::<_, LibraryBackupPlaylistItem>(
                r#"
                SELECT tracks.stable_id AS track_stable_id,
                       tracks.file_path AS track_path,
                       playlist_songs.position,
                       playlist_songs.notes
                FROM playlist_songs
                JOIN tracks ON tracks.id = playlist_songs.song_id
                WHERE playlist_songs.playlist_id = ? AND tracks.missing_file = 0
                ORDER BY playlist_songs.position, playlist_songs.added_at, tracks.id
                "#,
            )
            .bind(playlist.id)
            .fetch_all(&self.pool)
            .await?;
            playlists.push(LibraryBackupPlaylist {
                name: playlist.name,
                description: playlist.description,
                playlist_type: playlist.playlist_type,
                group: playlist.group_name,
                purpose: playlist.purpose,
                items,
            });
        }

        Ok(LibraryBackup {
            r#type: "tagdeck_library_backup".to_owned(),
            backup_version: 1,
            app: "Soundbender TagDeck".to_owned(),
            app_version: app_version.to_owned(),
            exported_at: Utc::now().to_rfc3339(),
            device_id,
            library_roots,
            projects,
            tags,
            tracks,
            playlists,
        })
    }

    #[cfg(test)]
    pub async fn connect_in_memory() -> AppResult<Self> {
        let options = "sqlite::memory:"
            .parse::<SqliteConnectOptions>()?
            .foreign_keys(true)
            .create_if_missing(true);
        Self::connect_with_options(options).await
    }

    async fn connect_with_options(options: SqliteConnectOptions) -> AppResult<Self> {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(options)
            .await?;
        sqlx::migrate!("./migrations").run(&pool).await?;
        let database = Self { pool };
        database.ensure_sync_foundation().await?;
        Ok(database)
    }

    async fn ensure_sync_foundation(&self) -> AppResult<()> {
        let now = Utc::now().to_rfc3339();

        let missing_stable_ids = sqlx::query_scalar::<_, i64>(
            "SELECT id FROM tracks WHERE stable_id IS NULL OR stable_id = ''",
        )
        .fetch_all(&self.pool)
        .await?;
        for id in missing_stable_ids {
            sqlx::query("UPDATE tracks SET stable_id = ?, updated_at = ? WHERE id = ?")
                .bind(Uuid::new_v4().to_string())
                .bind(&now)
                .bind(id)
                .execute(&self.pool)
                .await?;
        }

        let roots = sqlx::query_as::<_, (String, String)>(
            "SELECT path, path_key FROM scan_roots ORDER BY path_key",
        )
        .fetch_all(&self.pool)
        .await?;
        for (path, path_key) in &roots {
            let name = Path::new(path)
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or(path)
                .to_owned();
            sqlx::query(
                "INSERT INTO library_roots (path, path_key, name, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?)
                 ON CONFLICT(path_key) DO UPDATE SET
                    path = excluded.path,
                    name = excluded.name,
                    updated_at = excluded.updated_at",
            )
            .bind(path)
            .bind(path_key)
            .bind(name)
            .bind(&now)
            .bind(&now)
            .execute(&self.pool)
            .await?;
        }

        self.backfill_relative_paths().await?;
        self.get_or_create_device().await?;
        Ok(())
    }

    pub async fn upsert_scanned_tracks(
        &self,
        tracks: &[ScannedTrack],
    ) -> AppResult<(usize, usize)> {
        let now = Utc::now().to_rfc3339();
        let device_id = self.get_or_create_device().await?;
        let mut transaction = self.pool.begin().await?;
        let mut inserted = 0;
        let mut updated = 0;

        for track in tracks {
            let stable_id = Uuid::new_v4().to_string();
            let library_root_id = if let Some(root_path) = &track.library_root_path {
                Some(ensure_library_root_in_transaction(&mut transaction, root_path, &now).await?)
            } else {
                None
            };
            let existed: bool =
                sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM tracks WHERE file_path_key = ?)")
                    .bind(&track.file_path_key)
                    .fetch_one(&mut *transaction)
                    .await?;

            sqlx::query(
                r#"
                INSERT INTO tracks (
                    file_path, file_path_key, file_name, file_extension,
                    file_size, file_modified_at_ms,
                    stable_id, library_root_id, relative_path,
                    title, artist, album, album_artist, genre, year,
                    track_number, track_total, disc_number, disc_total,
                    comment, lyrics, bpm, musical_key,
                    duration_ms, bitrate_kbps, sample_rate_hz, channels,
                    audio_format, has_cover_art, metadata_read_error,
                    status, created_at, updated_at, updated_by_device, last_scanned_at
                )
                VALUES (
                    ?, ?, ?, ?, ?, ?,
                    ?, ?, ?,
                    ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?,
                    'review', ?, ?, ?, ?
                )
                ON CONFLICT(file_path_key) DO UPDATE SET
                    file_path = excluded.file_path,
                    file_name = excluded.file_name,
                    file_extension = excluded.file_extension,
                    file_size = excluded.file_size,
                    file_modified_at_ms = excluded.file_modified_at_ms,
                    library_root_id = COALESCE(excluded.library_root_id, library_root_id),
                    relative_path = COALESCE(excluded.relative_path, relative_path),
                    title = excluded.title,
                    artist = excluded.artist,
                    album = excluded.album,
                    album_artist = excluded.album_artist,
                    genre = excluded.genre,
                    year = excluded.year,
                    track_number = excluded.track_number,
                    track_total = excluded.track_total,
                    disc_number = excluded.disc_number,
                    disc_total = excluded.disc_total,
                    comment = excluded.comment,
                    lyrics = excluded.lyrics,
                    bpm = excluded.bpm,
                    musical_key = excluded.musical_key,
                    duration_ms = excluded.duration_ms,
                    bitrate_kbps = excluded.bitrate_kbps,
                    sample_rate_hz = excluded.sample_rate_hz,
                    channels = excluded.channels,
                    audio_format = excluded.audio_format,
                    has_cover_art = excluded.has_cover_art,
                    metadata_read_error = excluded.metadata_read_error,
                    missing_file = 0,
                    updated_at = excluded.updated_at,
                    updated_by_device = excluded.updated_by_device,
                    last_scanned_at = excluded.last_scanned_at
                "#,
            )
            .bind(&track.file_path)
            .bind(&track.file_path_key)
            .bind(&track.file_name)
            .bind(&track.file_extension)
            .bind(track.file_size)
            .bind(track.file_modified_at_ms)
            .bind(&stable_id)
            .bind(library_root_id)
            .bind(&track.relative_path)
            .bind(&track.metadata.title)
            .bind(&track.metadata.artist)
            .bind(&track.metadata.album)
            .bind(&track.metadata.album_artist)
            .bind(&track.metadata.genre)
            .bind(track.metadata.year)
            .bind(track.metadata.track_number)
            .bind(track.metadata.track_total)
            .bind(track.metadata.disc_number)
            .bind(track.metadata.disc_total)
            .bind(&track.metadata.comment)
            .bind(&track.metadata.lyrics)
            .bind(track.metadata.bpm)
            .bind(&track.metadata.musical_key)
            .bind(track.metadata.duration_ms)
            .bind(track.metadata.bitrate_kbps)
            .bind(track.metadata.sample_rate_hz)
            .bind(track.metadata.channels)
            .bind(&track.metadata.audio_format)
            .bind(track.metadata.has_cover_art)
            .bind(&track.metadata_read_error)
            .bind(&now)
            .bind(&now)
            .bind(&device_id)
            .bind(&now)
            .execute(&mut *transaction)
            .await?;

            if existed {
                updated += 1;
            } else {
                inserted += 1;
            }
        }

        transaction.commit().await?;
        Ok((inserted, updated))
    }

    pub async fn record_scan_root(&self, path: &str) -> AppResult<()> {
        let path_key = normalize_path_value(path);
        let now = Utc::now().to_rfc3339();
        sqlx::query(
            "INSERT INTO scan_roots (path, path_key, scanned_at)
             VALUES (?, ?, ?)
             ON CONFLICT(path_key) DO UPDATE SET
                path = excluded.path,
                scanned_at = excluded.scanned_at",
        )
        .bind(path)
        .bind(&path_key)
        .bind(&now)
        .execute(&self.pool)
        .await?;
        sqlx::query(
            "INSERT INTO library_roots (path, path_key, name, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(path_key) DO UPDATE SET
                path = excluded.path,
                name = excluded.name,
                updated_at = excluded.updated_at",
        )
        .bind(path)
        .bind(path_key)
        .bind(root_name(path))
        .bind(&now)
        .bind(&now)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn get_or_create_device(&self) -> AppResult<String> {
        if let Some(device_id) =
            sqlx::query_scalar::<_, String>("SELECT device_id FROM devices LIMIT 1")
                .fetch_optional(&self.pool)
                .await?
        {
            return Ok(device_id);
        }
        let now = Utc::now().to_rfc3339();
        let device_id = format!("desktop_{}", Uuid::new_v4());
        sqlx::query(
            "INSERT INTO devices (device_id, device_name, device_type, created_at)
             VALUES (?, ?, 'desktop', ?)",
        )
        .bind(&device_id)
        .bind(default_device_name())
        .bind(now)
        .execute(&self.pool)
        .await?;
        Ok(device_id)
    }

    async fn backfill_relative_paths(&self) -> AppResult<()> {
        let roots = sqlx::query_as::<_, (i64, String, String)>(
            "SELECT id, path, path_key FROM library_roots ORDER BY LENGTH(path_key) DESC",
        )
        .fetch_all(&self.pool)
        .await?;
        if roots.is_empty() {
            return Ok(());
        }
        let tracks = sqlx::query_as::<_, (i64, String, String)>(
            "SELECT id, file_path, file_path_key FROM tracks
             WHERE missing_file = 0 AND (relative_path IS NULL OR library_root_id IS NULL)",
        )
        .fetch_all(&self.pool)
        .await?;
        for (track_id, file_path, file_path_key) in tracks {
            let Some((root_id, root_path, root_key)) = roots
                .iter()
                .find(|(_, _, root_key)| is_path_inside_root(&file_path_key, root_key))
            else {
                continue;
            };
            let relative_path =
                relative_path_from_root_strings(&file_path, root_path, &file_path_key, root_key);
            sqlx::query(
                "UPDATE tracks
                 SET library_root_id = COALESCE(library_root_id, ?),
                     relative_path = COALESCE(relative_path, ?)
                 WHERE id = ?",
            )
            .bind(root_id)
            .bind(relative_path)
            .bind(track_id)
            .execute(&self.pool)
            .await?;
        }
        Ok(())
    }

    pub async fn get_library_folders(&self) -> AppResult<Vec<LibraryFolderOption>> {
        let roots = sqlx::query_as::<_, (String, String)>(
            "SELECT path, path_key FROM scan_roots ORDER BY path COLLATE NOCASE",
        )
        .fetch_all(&self.pool)
        .await?;
        let track_paths = sqlx::query_scalar::<_, String>(
            "SELECT file_path FROM tracks WHERE missing_file = 0 ORDER BY file_path",
        )
        .fetch_all(&self.pool)
        .await?;
        let mut folders: HashMap<String, (String, i64, bool)> = HashMap::new();

        for (root_path, root_key) in &roots {
            folders.insert(root_key.clone(), (root_path.clone(), 0, true));
        }

        for track_path in track_paths {
            let Some(parent) = Path::new(&track_path).parent() else {
                continue;
            };
            let parent_path = parent.to_string_lossy().into_owned();
            let parent_key = normalize_path_value(&parent_path);
            let matching_root = roots
                .iter()
                .filter(|(_, root_key)| {
                    parent_key == *root_key || parent_key.starts_with(&format!("{root_key}\\"))
                })
                .max_by_key(|(_, root_key)| root_key.len());

            if let Some((_, root_key)) = matching_root {
                let mut current = Some(parent.to_path_buf());
                while let Some(folder) = current {
                    let folder_path = folder.to_string_lossy().into_owned();
                    let folder_key = normalize_path_value(&folder_path);
                    let entry = folders.entry(folder_key.clone()).or_insert((
                        folder_path,
                        0,
                        folder_key == *root_key,
                    ));
                    entry.1 += 1;
                    if folder_key == *root_key {
                        break;
                    }
                    current = folder.parent().map(Path::to_path_buf);
                }
            } else {
                let entry = folders.entry(parent_key).or_insert((parent_path, 0, false));
                entry.1 += 1;
            }
        }

        let mut result = folders
            .into_values()
            .filter(|(_, track_count, _)| *track_count > 0)
            .map(|(path, track_count, is_root)| LibraryFolderOption {
                name: Path::new(&path)
                    .file_name()
                    .and_then(|value| value.to_str())
                    .unwrap_or(&path)
                    .to_owned(),
                path,
                track_count,
                is_root,
            })
            .collect::<Vec<_>>();
        result.sort_by(|left, right| {
            right
                .is_root
                .cmp(&left.is_root)
                .then_with(|| left.path.to_lowercase().cmp(&right.path.to_lowercase()))
        });
        Ok(result)
    }

    pub async fn get_library_tracks(&self, query: LibraryQuery) -> AppResult<TrackPage> {
        validate_rating_filter(query.rating_min)?;
        validate_rating_filter(query.rating_max)?;
        validate_status(query.status.as_deref())?;

        let limit = query.limit.clamp(1, 20_000);
        let offset = query.offset.max(0);
        let search = query
            .search
            .map(|value| value.trim().to_owned())
            .filter(|value| !value.is_empty());

        let mut count_builder =
            QueryBuilder::<Sqlite>::new("SELECT COUNT(*) FROM tracks WHERE missing_file = 0");
        push_filters(
            &mut count_builder,
            search.as_deref(),
            query.rating_min,
            query.rating_max,
            query.status.as_deref(),
            query.tag_id,
            query.project_id,
            query.version_label.as_deref(),
            query.smart_collection.as_deref(),
        );
        push_folder_filter(&mut count_builder, query.folder_path.as_deref());
        let total: i64 = count_builder
            .build_query_scalar()
            .fetch_one(&self.pool)
            .await?;

        let mut rows_builder = QueryBuilder::<Sqlite>::new(
            r#"
            SELECT
                id, stable_id, relative_path, file_path, file_name, title, artist, album, album_artist, genre, year,
                track_number, duration_ms, audio_format, bpm, musical_key, play_count, rating,
                status, project_id,
                (SELECT name FROM projects WHERE id = tracks.project_id) AS project_name,
                version_label,
                COALESCE((
                    SELECT GROUP_CONCAT(internal_tags.name, ', ')
                    FROM song_tags
                    JOIN internal_tags ON internal_tags.id = song_tags.tag_id
                    WHERE song_tags.track_id = tracks.id
                ), '') AS tag_names,
                workflow_notes, next_action,
                strong_part, main_problem, intended_use, mood, language, generation_model,
                reviewed_at, last_reviewed_at, skip_count,
                metadata_read_error
            FROM tracks
            WHERE missing_file = 0
            "#,
        );
        push_filters(
            &mut rows_builder,
            search.as_deref(),
            query.rating_min,
            query.rating_max,
            query.status.as_deref(),
            query.tag_id,
            query.project_id,
            query.version_label.as_deref(),
            query.smart_collection.as_deref(),
        );
        push_folder_filter(&mut rows_builder, query.folder_path.as_deref());

        let sort_column = match query.sort_by.as_str() {
            "artist" => "artist",
            "album" => "album",
            "albumArtist" => "album_artist",
            "genre" => "genre",
            "year" => "year",
            "trackNumber" => "track_number",
            "rating" => "rating",
            "status" => "status",
            "project" => "project_name",
            "version" => "version_label",
            "tags" => "tag_names",
            "mood" => "mood",
            "bpm" => "bpm",
            "musicalKey" => "musical_key",
            "playCount" => "play_count",
            "nextAction" => "next_action",
            "reviewedAt" => "COALESCE(last_reviewed_at, reviewed_at)",
            "intendedUse" => "intended_use",
            "audioFormat" => "audio_format",
            "durationMs" => "duration_ms",
            "path" => "file_path",
            _ => "title",
        };
        let sort_direction = if query.sort_direction.eq_ignore_ascii_case("desc") {
            "DESC"
        } else {
            "ASC"
        };

        rows_builder
            .push(" ORDER BY ")
            .push(sort_column)
            .push(" ")
            .push(sort_direction)
            .push(", file_name ASC LIMIT ")
            .push_bind(limit)
            .push(" OFFSET ")
            .push_bind(offset);

        let items = rows_builder
            .build_query_as::<TrackSummary>()
            .fetch_all(&self.pool)
            .await?;

        Ok(TrackPage { items, total })
    }

    pub async fn get_track(&self, id: i64) -> AppResult<TrackDetails> {
        sqlx::query_as::<_, TrackDetails>(
            r#"
            SELECT
                id, file_path, file_name, file_extension, file_size,
                title, artist, album, album_artist, genre, year,
                track_number, track_total, disc_number, disc_total,
                comment, lyrics, bpm, musical_key,
                duration_ms, bitrate_kbps, sample_rate_hz, channels,
                audio_format, has_cover_art, rating, play_count,
                status, workflow_notes, next_action, version_label, project_id,
                (SELECT name FROM projects WHERE id = tracks.project_id) AS project_name,
                COALESCE((
                    SELECT GROUP_CONCAT(internal_tags.name, ', ')
                    FROM song_tags
                    JOIN internal_tags ON internal_tags.id = song_tags.tag_id
                    WHERE song_tags.track_id = tracks.id
                ), '') AS tag_names,
                strong_part, main_problem, intended_use, mood, language, generation_model,
                reviewed_at, last_reviewed_at, skip_count,
                metadata_read_error
            FROM tracks
            WHERE id = ?
            "#,
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(AppError::TrackNotFound(id))
    }

    pub async fn update_track_rating(
        &self,
        id: i64,
        rating: Option<i64>,
    ) -> AppResult<TrackDetails> {
        validate_rating_filter(rating)?;
        let device_id = self.get_or_create_device().await?;
        let result = sqlx::query(
            "UPDATE tracks SET rating = ?, updated_at = ?, updated_by_device = ? WHERE id = ?",
        )
        .bind(rating)
        .bind(Utc::now().to_rfc3339())
        .bind(device_id)
        .bind(id)
        .execute(&self.pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(AppError::TrackNotFound(id));
        }

        self.get_track(id).await
    }

    pub async fn get_explorer_tracks(&self, query: ExplorerQuery) -> AppResult<TrackPage> {
        let limit = query.limit.clamp(1, 2_000);
        let condition = explorer_condition(&query.criterion)?;
        let mut count_builder =
            QueryBuilder::<Sqlite>::new("SELECT COUNT(*) FROM tracks WHERE missing_file = 0 AND ");
        count_builder.push(condition);
        push_filters(
            &mut count_builder,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            query.smart_collection.as_deref(),
        );
        push_folder_filter(&mut count_builder, query.folder_path.as_deref());
        let total = count_builder
            .build_query_scalar::<i64>()
            .fetch_one(&self.pool)
            .await?;
        let order = if query.criterion == "random" {
            "RANDOM()"
        } else {
            "COALESCE(last_reviewed_at, reviewed_at, created_at) ASC, id ASC"
        };
        let mut rows_builder = QueryBuilder::<Sqlite>::new(format!(
            r#"
            SELECT
                id, stable_id, relative_path, file_path, file_name, title, artist, album, album_artist, genre, year,
                track_number, duration_ms, audio_format, bpm, musical_key, play_count, rating,
                status, project_id,
                (SELECT name FROM projects WHERE id = tracks.project_id) AS project_name,
                version_label,
                COALESCE((
                    SELECT GROUP_CONCAT(internal_tags.name, ', ')
                    FROM song_tags
                    JOIN internal_tags ON internal_tags.id = song_tags.tag_id
                    WHERE song_tags.track_id = tracks.id
                ), '') AS tag_names,
                workflow_notes, next_action,
                strong_part, main_problem, intended_use, mood, language, generation_model,
                reviewed_at, last_reviewed_at, skip_count,
                metadata_read_error
            FROM tracks
            WHERE missing_file = 0 AND {condition}
            "#,
        ));
        push_filters(
            &mut rows_builder,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            query.smart_collection.as_deref(),
        );
        push_folder_filter(&mut rows_builder, query.folder_path.as_deref());
        rows_builder
            .push(" ORDER BY ")
            .push(order)
            .push(" LIMIT ")
            .push_bind(limit);
        let items = rows_builder
            .build_query_as::<TrackSummary>()
            .fetch_all(&self.pool)
            .await?;
        Ok(TrackPage { items, total })
    }

    pub async fn preview_import(
        &self,
        source_path: &str,
        records: &[ImportRecord],
    ) -> AppResult<ImportPreview> {
        let candidates = self.import_candidates().await?;
        let mut items = Vec::with_capacity(records.len());
        let mut matched = 0;
        let mut not_found = 0;
        let mut ambiguous = 0;
        let mut would_update = 0;
        let playlists_found = records
            .iter()
            .filter_map(|record| record.playlist_name.as_deref())
            .map(str::to_lowercase)
            .collect::<HashSet<_>>()
            .len();

        for record in records {
            match match_import_record(record, &candidates) {
                ImportMatch::Found(candidate, method) => {
                    matched += 1;
                    let (changes, conflicts) = import_differences(record, candidate);
                    if !changes.is_empty() {
                        would_update += 1;
                    }
                    items.push(ImportPreviewItem {
                        source_index: record.source_index,
                        source_name: record.source_name(),
                        matched_track_id: Some(candidate.id),
                        matched_track_name: Some(
                            candidate
                                .title
                                .clone()
                                .unwrap_or_else(|| candidate.file_name.clone()),
                        ),
                        match_method: Some(method.to_owned()),
                        changes,
                        conflicts,
                        ambiguous: false,
                    });
                }
                ImportMatch::NotFound => {
                    not_found += 1;
                    items.push(ImportPreviewItem {
                        source_index: record.source_index,
                        source_name: record.source_name(),
                        matched_track_id: None,
                        matched_track_name: None,
                        match_method: None,
                        changes: Vec::new(),
                        conflicts: Vec::new(),
                        ambiguous: false,
                    });
                }
                ImportMatch::Ambiguous => {
                    ambiguous += 1;
                    items.push(ImportPreviewItem {
                        source_index: record.source_index,
                        source_name: record.source_name(),
                        matched_track_id: None,
                        matched_track_name: None,
                        match_method: None,
                        changes: Vec::new(),
                        conflicts: Vec::new(),
                        ambiguous: true,
                    });
                }
            }
        }

        Ok(ImportPreview {
            source_path: source_path.to_owned(),
            total: records.len(),
            matched,
            not_found,
            ambiguous,
            would_update,
            playlists_found,
            items,
        })
    }

    pub async fn apply_import(
        &self,
        records: &[ImportRecord],
        overwrite: bool,
    ) -> AppResult<ImportApplySummary> {
        let candidates = self.import_candidates().await?;
        let mut matched_records = Vec::new();
        let mut not_found = 0;
        let mut ambiguous = 0;
        for record in records {
            match match_import_record(record, &candidates) {
                ImportMatch::Found(candidate, _) => {
                    matched_records.push((record, candidate.clone()))
                }
                ImportMatch::NotFound => not_found += 1,
                ImportMatch::Ambiguous => ambiguous += 1,
            }
        }

        let mut transaction = self.pool.begin().await?;
        let now = Utc::now().to_rfc3339();
        let mut updated = 0;
        let mut playlist_rows: HashMap<String, Vec<(&ImportRecord, i64)>> = HashMap::new();

        for (record, candidate) in &matched_records {
            let mut builder = QueryBuilder::<Sqlite>::new("UPDATE tracks SET updated_at = ");
            builder.push_bind(&now);
            let mut changed = false;

            macro_rules! push_text {
                ($column:literal, $incoming:expr, $current:expr) => {
                    if let Some(value) = $incoming {
                        if overwrite || is_empty($current) {
                            builder
                                .push(concat!(", ", $column, " = "))
                                .push_bind(value.clone());
                            changed = true;
                        }
                    }
                };
            }

            if let Some(value) = record.rating {
                if overwrite || candidate.rating.is_none() {
                    builder.push(", rating = ").push_bind(value);
                    changed = true;
                }
            }
            if let Some(value) = record.status.as_ref().filter(|value| valid_status(value)) {
                if overwrite || candidate.status == "review" {
                    builder.push(", status = ").push_bind(value.clone());
                    changed = true;
                }
            }
            push_text!("version_label", &record.version, &candidate.version_label);
            push_text!("workflow_notes", &record.notes, &candidate.workflow_notes);
            push_text!("next_action", &record.next_action, &candidate.next_action);
            push_text!("strong_part", &record.strong_part, &candidate.strong_part);
            push_text!(
                "main_problem",
                &record.main_problem,
                &candidate.main_problem
            );
            push_text!(
                "intended_use",
                &record.intended_use,
                &candidate.intended_use
            );
            push_text!("mood", &record.mood, &candidate.mood);
            push_text!("language", &record.language, &candidate.language);
            push_text!(
                "generation_model",
                &record.model,
                &candidate.generation_model
            );
            push_text!("genre", &record.genre, &candidate.genre);

            if let Some(project_name) = &record.project {
                if overwrite || candidate.project_name.is_none() {
                    let project_id = ensure_project(&mut transaction, project_name, &now).await?;
                    builder.push(", project_id = ").push_bind(project_id);
                    changed = true;
                }
            }
            builder.push(" WHERE id = ").push_bind(candidate.id);
            if changed {
                builder.build().execute(&mut *transaction).await?;
            }

            if !record.tags.is_empty() {
                if overwrite {
                    sqlx::query("DELETE FROM song_tags WHERE track_id = ?")
                        .bind(candidate.id)
                        .execute(&mut *transaction)
                        .await?;
                }
                for tag_name in normalized_tag_names(&record.tags) {
                    let normalized = tag_name.to_lowercase();
                    sqlx::query(
                        "INSERT INTO internal_tags (name, normalized_name, created_at)
                         VALUES (?, ?, ?) ON CONFLICT(normalized_name) DO NOTHING",
                    )
                    .bind(&tag_name)
                    .bind(&normalized)
                    .bind(&now)
                    .execute(&mut *transaction)
                    .await?;
                    sqlx::query(
                        "INSERT OR IGNORE INTO song_tags (track_id, tag_id)
                         SELECT ?, id FROM internal_tags WHERE normalized_name = ?",
                    )
                    .bind(candidate.id)
                    .bind(&normalized)
                    .execute(&mut *transaction)
                    .await?;
                }
                changed = true;
            }

            if changed {
                updated += 1;
            }
            if let Some(playlist_name) = &record.playlist_name {
                playlist_rows
                    .entry(playlist_name.clone())
                    .or_default()
                    .push((record, candidate.id));
            }
        }

        let mut playlists_imported = 0;
        let mut playlist_songs_added = 0;
        for (name, mut rows) in playlist_rows {
            rows.sort_by_key(|(record, _)| record.position.unwrap_or(i64::MAX));
            let existing_id = sqlx::query_scalar::<_, i64>(
                "SELECT id FROM playlists WHERE name = ? COLLATE NOCASE",
            )
            .bind(&name)
            .fetch_optional(&mut *transaction)
            .await?;
            let playlist_id = if let Some(id) = existing_id {
                id
            } else {
                let playlist_type = rows
                    .iter()
                    .find_map(|(record, _)| record.playlist_type.as_deref())
                    .filter(|value| valid_playlist_type(value))
                    .unwrap_or("manual");
                sqlx::query(
                    "INSERT INTO playlists
                     (name, description, playlist_type, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?)",
                )
                .bind(&name)
                .bind("Importada desde CSV/JSON de TagDeck")
                .bind(playlist_type)
                .bind(&now)
                .bind(&now)
                .execute(&mut *transaction)
                .await?
                .last_insert_rowid()
            };
            let mut position: i64 = sqlx::query_scalar(
                "SELECT COALESCE(MAX(position), 0) FROM playlist_songs WHERE playlist_id = ?",
            )
            .bind(playlist_id)
            .fetch_one(&mut *transaction)
            .await?;
            let mut added_here = 0;
            for (_, track_id) in rows {
                position += 1;
                let result = sqlx::query(
                    "INSERT OR IGNORE INTO playlist_songs
                     (playlist_id, song_id, position, added_at)
                     VALUES (?, ?, ?, ?)",
                )
                .bind(playlist_id)
                .bind(track_id)
                .bind(position)
                .bind(&now)
                .execute(&mut *transaction)
                .await?;
                if result.rows_affected() == 0 {
                    position -= 1;
                } else {
                    added_here += 1;
                }
            }
            if added_here > 0 {
                playlists_imported += 1;
                playlist_songs_added += added_here;
                sqlx::query("UPDATE playlists SET updated_at = ? WHERE id = ?")
                    .bind(&now)
                    .bind(playlist_id)
                    .execute(&mut *transaction)
                    .await?;
            }
        }
        transaction.commit().await?;

        Ok(ImportApplySummary {
            total: records.len(),
            matched: matched_records.len(),
            updated,
            not_found,
            ambiguous,
            playlists_imported,
            playlist_songs_added,
            backup_path: String::new(),
        })
    }

    async fn import_candidates(&self) -> AppResult<Vec<ImportCandidate>> {
        Ok(sqlx::query_as::<_, ImportCandidate>(
            r#"
            SELECT tracks.id, tracks.stable_id, tracks.relative_path, tracks.file_path_key, tracks.file_name, tracks.file_hash,
                   tracks.title, tracks.artist, tracks.duration_ms, tracks.rating,
                   tracks.status, projects.name AS project_name, tracks.version_label,
                   COALESCE((
                       SELECT GROUP_CONCAT(internal_tags.name, ', ')
                       FROM song_tags
                       JOIN internal_tags ON internal_tags.id = song_tags.tag_id
                       WHERE song_tags.track_id = tracks.id
                   ), '') AS tag_names,
                   tracks.workflow_notes, tracks.next_action, tracks.strong_part,
                   tracks.main_problem, tracks.intended_use, tracks.mood,
                   tracks.language, tracks.generation_model, tracks.genre
            FROM tracks
            LEFT JOIN projects ON projects.id = tracks.project_id
            WHERE tracks.missing_file = 0
            "#,
        )
        .fetch_all(&self.pool)
        .await?)
    }

    pub async fn save_curation(&self, request: &CurationSaveRequest) -> AppResult<TrackDetails> {
        validate_rating_filter(request.rating)?;
        self.update_track_organization(&[request.track_id], &request.organization)
            .await?;
        let now = Utc::now().to_rfc3339();
        let device_id = self.get_or_create_device().await?;
        sqlx::query(
            r#"
            UPDATE tracks
            SET rating = ?,
                strong_part = ?,
                main_problem = ?,
                intended_use = ?,
                mood = ?,
                generation_model = ?,
                reviewed_at = CASE WHEN ? THEN COALESCE(reviewed_at, ?) ELSE reviewed_at END,
                last_reviewed_at = CASE WHEN ? THEN ? ELSE last_reviewed_at END,
                updated_at = ?,
                updated_by_device = ?
            WHERE id = ?
            "#,
        )
        .bind(request.rating)
        .bind(clean_optional_text(request.strong_part.as_deref()))
        .bind(clean_optional_text(request.main_problem.as_deref()))
        .bind(clean_optional_text(request.intended_use.as_deref()))
        .bind(clean_optional_text(request.mood.as_deref()))
        .bind(clean_optional_text(request.generation_model.as_deref()))
        .bind(request.mark_reviewed.unwrap_or(true))
        .bind(&now)
        .bind(request.mark_reviewed.unwrap_or(true))
        .bind(&now)
        .bind(&now)
        .bind(device_id)
        .bind(request.track_id)
        .execute(&self.pool)
        .await?;
        self.get_track(request.track_id).await
    }

    pub async fn skip_curation_track(&self, id: i64) -> AppResult<TrackDetails> {
        let result = sqlx::query(
            "UPDATE tracks SET skip_count = skip_count + 1, updated_at = ?, updated_by_device = ? WHERE id = ?",
        )
        .bind(Utc::now().to_rfc3339())
        .bind(self.get_or_create_device().await?)
        .bind(id)
        .execute(&self.pool)
        .await?;
        if result.rows_affected() == 0 {
            return Err(AppError::TrackNotFound(id));
        }
        self.get_track(id).await
    }

    pub async fn get_playlist_groups(&self) -> AppResult<Vec<PlaylistGroup>> {
        Ok(sqlx::query_as::<_, PlaylistGroup>(
            r#"
            SELECT playlist_groups.id, playlist_groups.name, playlist_groups.position,
                   COUNT(playlists.id) AS playlist_count,
                   playlist_groups.created_at, playlist_groups.updated_at
            FROM playlist_groups
            LEFT JOIN playlists ON playlists.group_id = playlist_groups.id
            GROUP BY playlist_groups.id
            ORDER BY playlist_groups.position, playlist_groups.name COLLATE NOCASE
            "#,
        )
        .fetch_all(&self.pool)
        .await?)
    }

    pub async fn create_playlist_group(&self, name: &str) -> AppResult<PlaylistGroup> {
        let name = name.trim();
        if name.is_empty() {
            return Err(AppError::InvalidMetadata(
                "El nombre del grupo no puede estar vacio".to_owned(),
            ));
        }
        let now = Utc::now().to_rfc3339();
        let position: i64 =
            sqlx::query_scalar("SELECT COALESCE(MAX(position), 0) + 1 FROM playlist_groups")
                .fetch_one(&self.pool)
                .await?;
        sqlx::query(
            "INSERT INTO playlist_groups (name, position, created_at, updated_at)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(name) DO UPDATE SET updated_at = excluded.updated_at",
        )
        .bind(name)
        .bind(position)
        .bind(&now)
        .bind(&now)
        .execute(&self.pool)
        .await?;
        self.get_playlist_group_by_name(name).await
    }

    pub async fn update_playlist_group(&self, id: i64, name: &str) -> AppResult<PlaylistGroup> {
        let name = name.trim();
        if name.is_empty() {
            return Err(AppError::InvalidMetadata(
                "El nombre del grupo no puede estar vacio".to_owned(),
            ));
        }
        let result =
            sqlx::query("UPDATE playlist_groups SET name = ?, updated_at = ? WHERE id = ?")
                .bind(name)
                .bind(Utc::now().to_rfc3339())
                .bind(id)
                .execute(&self.pool)
                .await?;
        if result.rows_affected() == 0 {
            return Err(AppError::InvalidMetadata(
                "El grupo de listas no existe".to_owned(),
            ));
        }
        self.get_playlist_group(id).await
    }

    pub async fn delete_playlist_group(&self, id: i64) -> AppResult<()> {
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM playlists WHERE group_id = ?")
            .bind(id)
            .fetch_one(&self.pool)
            .await?;
        if count > 0 {
            return Err(AppError::InvalidMetadata(
                "El grupo debe estar vacio antes de borrarlo".to_owned(),
            ));
        }
        let result = sqlx::query("DELETE FROM playlist_groups WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;
        if result.rows_affected() == 0 {
            return Err(AppError::InvalidMetadata(
                "El grupo de listas no existe".to_owned(),
            ));
        }
        Ok(())
    }

    async fn get_playlist_group(&self, id: i64) -> AppResult<PlaylistGroup> {
        sqlx::query_as::<_, PlaylistGroup>(
            r#"
            SELECT playlist_groups.id, playlist_groups.name, playlist_groups.position,
                   COUNT(playlists.id) AS playlist_count,
                   playlist_groups.created_at, playlist_groups.updated_at
            FROM playlist_groups
            LEFT JOIN playlists ON playlists.group_id = playlist_groups.id
            WHERE playlist_groups.id = ?
            GROUP BY playlist_groups.id
            "#,
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| AppError::InvalidMetadata("El grupo de listas no existe".to_owned()))
    }

    async fn get_playlist_group_by_name(&self, name: &str) -> AppResult<PlaylistGroup> {
        sqlx::query_as::<_, PlaylistGroup>(
            r#"
            SELECT playlist_groups.id, playlist_groups.name, playlist_groups.position,
                   COUNT(playlists.id) AS playlist_count,
                   playlist_groups.created_at, playlist_groups.updated_at
            FROM playlist_groups
            LEFT JOIN playlists ON playlists.group_id = playlist_groups.id
            WHERE playlist_groups.name = ? COLLATE NOCASE
            GROUP BY playlist_groups.id
            "#,
        )
        .bind(name)
        .fetch_one(&self.pool)
        .await
        .map_err(AppError::from)
    }

    pub async fn get_playlists(&self) -> AppResult<Vec<PlaylistSummary>> {
        Ok(sqlx::query_as::<_, PlaylistSummary>(
            r#"
            SELECT playlists.id, playlists.name, playlists.description,
                   playlists.playlist_type, playlists.group_id,
                   playlist_groups.name AS group_name, playlists.purpose,
                   COUNT(playlist_songs.song_id) AS song_count,
                   COALESCE(SUM(tracks.duration_ms), 0) AS total_duration_ms,
                   playlists.created_at, playlists.updated_at
            FROM playlists
            LEFT JOIN playlist_groups ON playlist_groups.id = playlists.group_id
            LEFT JOIN playlist_songs ON playlist_songs.playlist_id = playlists.id
            LEFT JOIN tracks ON tracks.id = playlist_songs.song_id
            GROUP BY playlists.id
            ORDER BY COALESCE(playlist_groups.position, 999999),
                     playlist_groups.name COLLATE NOCASE,
                     playlists.updated_at DESC,
                     playlists.name COLLATE NOCASE
            "#,
        )
        .fetch_all(&self.pool)
        .await?)
    }

    pub async fn create_playlist(
        &self,
        request: &PlaylistSaveRequest,
    ) -> AppResult<PlaylistSummary> {
        validate_playlist(request)?;
        let now = Utc::now().to_rfc3339();
        let result = sqlx::query(
            "INSERT INTO playlists (name, description, playlist_type, group_id, purpose, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(request.name.trim())
        .bind(clean_optional_text(request.description.as_deref()))
        .bind(&request.playlist_type)
        .bind(request.group_id)
        .bind(clean_optional_text(request.purpose.as_deref()))
        .bind(&now)
        .bind(&now)
        .execute(&self.pool)
        .await?;
        self.get_playlist_summary(result.last_insert_rowid()).await
    }

    pub async fn update_playlist(
        &self,
        id: i64,
        request: &PlaylistSaveRequest,
    ) -> AppResult<PlaylistSummary> {
        validate_playlist(request)?;
        let result = sqlx::query(
            "UPDATE playlists
             SET name = ?, description = ?, playlist_type = ?, group_id = ?, purpose = ?, updated_at = ?
             WHERE id = ?",
        )
        .bind(request.name.trim())
        .bind(clean_optional_text(request.description.as_deref()))
        .bind(&request.playlist_type)
        .bind(request.group_id)
        .bind(clean_optional_text(request.purpose.as_deref()))
        .bind(Utc::now().to_rfc3339())
        .bind(id)
        .execute(&self.pool)
        .await?;
        if result.rows_affected() == 0 {
            return Err(AppError::InvalidMetadata("La lista no existe".to_owned()));
        }
        self.get_playlist_summary(id).await
    }

    pub async fn delete_playlist(&self, id: i64) -> AppResult<()> {
        let result = sqlx::query("DELETE FROM playlists WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;
        if result.rows_affected() == 0 {
            return Err(AppError::InvalidMetadata("La lista no existe".to_owned()));
        }
        Ok(())
    }

    pub async fn get_playlist(&self, id: i64) -> AppResult<PlaylistDetails> {
        let playlist = self.get_playlist_summary(id).await?;
        let songs = sqlx::query_as::<_, PlaylistSong>(
            r#"
            SELECT playlist_songs.playlist_id, playlist_songs.position,
                   playlist_songs.added_at,
                   playlist_songs.notes AS playlist_notes,
                   tracks.id, tracks.stable_id, tracks.file_path, tracks.file_name,
                   tracks.title, tracks.artist, tracks.album, tracks.genre,
                   tracks.duration_ms, tracks.audio_format, tracks.rating,
                   tracks.status,
                   projects.name AS project_name,
                   tracks.version_label,
                   COALESCE((
                       SELECT GROUP_CONCAT(internal_tags.name, ', ')
                       FROM song_tags
                       JOIN internal_tags ON internal_tags.id = song_tags.tag_id
                       WHERE song_tags.track_id = tracks.id
                   ), '') AS tag_names,
                   tracks.workflow_notes, tracks.next_action,
                   tracks.strong_part, tracks.main_problem,
                   tracks.intended_use, tracks.mood, tracks.generation_model
            FROM playlist_songs
            JOIN tracks ON tracks.id = playlist_songs.song_id
            LEFT JOIN projects ON projects.id = tracks.project_id
            WHERE playlist_songs.playlist_id = ? AND tracks.missing_file = 0
            ORDER BY playlist_songs.position, playlist_songs.added_at, tracks.id
            "#,
        )
        .bind(id)
        .fetch_all(&self.pool)
        .await?;
        Ok(PlaylistDetails { playlist, songs })
    }

    pub async fn add_tracks_to_playlist(
        &self,
        playlist_id: i64,
        track_ids: &[i64],
    ) -> AppResult<PlaylistMutationSummary> {
        self.get_playlist_summary(playlist_id).await?;
        let mut transaction = self.pool.begin().await?;
        let mut position: i64 = sqlx::query_scalar(
            "SELECT COALESCE(MAX(position), 0) FROM playlist_songs WHERE playlist_id = ?",
        )
        .bind(playlist_id)
        .fetch_one(&mut *transaction)
        .await?;
        let now = Utc::now().to_rfc3339();
        let mut changed = 0;
        for track_id in track_ids {
            let exists: bool =
                sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM tracks WHERE id = ?)")
                    .bind(track_id)
                    .fetch_one(&mut *transaction)
                    .await?;
            if !exists {
                continue;
            }
            position += 1;
            let result = sqlx::query(
                "INSERT OR IGNORE INTO playlist_songs
                 (playlist_id, song_id, position, added_at)
                 VALUES (?, ?, ?, ?)",
            )
            .bind(playlist_id)
            .bind(track_id)
            .bind(position)
            .bind(&now)
            .execute(&mut *transaction)
            .await?;
            if result.rows_affected() == 0 {
                position -= 1;
            } else {
                changed += 1;
            }
        }
        sqlx::query("UPDATE playlists SET updated_at = ? WHERE id = ?")
            .bind(&now)
            .bind(playlist_id)
            .execute(&mut *transaction)
            .await?;
        transaction.commit().await?;
        Ok(PlaylistMutationSummary {
            requested: track_ids.len(),
            changed,
        })
    }

    pub async fn remove_tracks_from_playlist(
        &self,
        playlist_id: i64,
        track_ids: &[i64],
    ) -> AppResult<PlaylistMutationSummary> {
        self.get_playlist_summary(playlist_id).await?;
        let mut transaction = self.pool.begin().await?;
        let mut changed = 0;
        for track_id in track_ids {
            changed +=
                sqlx::query("DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?")
                    .bind(playlist_id)
                    .bind(track_id)
                    .execute(&mut *transaction)
                    .await?
                    .rows_affected();
        }
        normalize_playlist_positions(&mut transaction, playlist_id).await?;
        sqlx::query("UPDATE playlists SET updated_at = ? WHERE id = ?")
            .bind(Utc::now().to_rfc3339())
            .bind(playlist_id)
            .execute(&mut *transaction)
            .await?;
        transaction.commit().await?;
        Ok(PlaylistMutationSummary {
            requested: track_ids.len(),
            changed,
        })
    }

    pub async fn move_playlist_track(
        &self,
        playlist_id: i64,
        track_id: i64,
        direction: &str,
    ) -> AppResult<PlaylistDetails> {
        if !matches!(direction, "up" | "down") {
            return Err(AppError::InvalidMetadata(
                "Dirección de movimiento no válida".to_owned(),
            ));
        }
        let mut transaction = self.pool.begin().await?;
        normalize_playlist_positions(&mut transaction, playlist_id).await?;
        let position = sqlx::query_scalar::<_, i64>(
            "SELECT position FROM playlist_songs WHERE playlist_id = ? AND song_id = ?",
        )
        .bind(playlist_id)
        .bind(track_id)
        .fetch_optional(&mut *transaction)
        .await?
        .ok_or_else(|| AppError::InvalidMetadata("La canción no está en la lista".to_owned()))?;
        let target_position = if direction == "up" {
            position - 1
        } else {
            position + 1
        };
        let target_id = sqlx::query_scalar::<_, i64>(
            "SELECT song_id FROM playlist_songs WHERE playlist_id = ? AND position = ?",
        )
        .bind(playlist_id)
        .bind(target_position)
        .fetch_optional(&mut *transaction)
        .await?;
        if let Some(target_id) = target_id {
            sqlx::query(
                "UPDATE playlist_songs
                 SET position = CASE song_id WHEN ? THEN ? WHEN ? THEN ? END
                 WHERE playlist_id = ? AND song_id IN (?, ?)",
            )
            .bind(track_id)
            .bind(target_position)
            .bind(target_id)
            .bind(position)
            .bind(playlist_id)
            .bind(track_id)
            .bind(target_id)
            .execute(&mut *transaction)
            .await?;
            sqlx::query("UPDATE playlists SET updated_at = ? WHERE id = ?")
                .bind(Utc::now().to_rfc3339())
                .bind(playlist_id)
                .execute(&mut *transaction)
                .await?;
        }
        transaction.commit().await?;
        self.get_playlist(playlist_id).await
    }

    pub async fn reorder_playlist_tracks(
        &self,
        playlist_id: i64,
        track_ids: &[i64],
    ) -> AppResult<PlaylistDetails> {
        self.get_playlist_summary(playlist_id).await?;
        let existing = sqlx::query_scalar::<_, i64>(
            "SELECT song_id FROM playlist_songs
             WHERE playlist_id = ? ORDER BY position, added_at, song_id",
        )
        .bind(playlist_id)
        .fetch_all(&self.pool)
        .await?;
        let mut expected = existing.clone();
        let mut requested = track_ids.to_vec();
        expected.sort_unstable();
        requested.sort_unstable();
        requested.dedup();
        if requested != expected {
            return Err(AppError::InvalidMetadata(
                "El nuevo orden no coincide con las canciones de la lista".to_owned(),
            ));
        }

        let mut transaction = self.pool.begin().await?;
        for (index, track_id) in track_ids.iter().enumerate() {
            sqlx::query(
                "UPDATE playlist_songs SET position = ?
                 WHERE playlist_id = ? AND song_id = ?",
            )
            .bind(index as i64 + 1)
            .bind(playlist_id)
            .bind(track_id)
            .execute(&mut *transaction)
            .await?;
        }
        sqlx::query("UPDATE playlists SET updated_at = ? WHERE id = ?")
            .bind(Utc::now().to_rfc3339())
            .bind(playlist_id)
            .execute(&mut *transaction)
            .await?;
        transaction.commit().await?;
        self.get_playlist(playlist_id).await
    }

    async fn get_playlist_summary(&self, id: i64) -> AppResult<PlaylistSummary> {
        sqlx::query_as::<_, PlaylistSummary>(
            r#"
            SELECT playlists.id, playlists.name, playlists.description,
                   playlists.playlist_type, playlists.group_id,
                   playlist_groups.name AS group_name, playlists.purpose,
                   COUNT(playlist_songs.song_id) AS song_count,
                   COALESCE(SUM(tracks.duration_ms), 0) AS total_duration_ms,
                   playlists.created_at, playlists.updated_at
            FROM playlists
            LEFT JOIN playlist_groups ON playlist_groups.id = playlists.group_id
            LEFT JOIN playlist_songs ON playlist_songs.playlist_id = playlists.id
            LEFT JOIN tracks ON tracks.id = playlist_songs.song_id
            WHERE playlists.id = ?
            GROUP BY playlists.id
            "#,
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| AppError::InvalidMetadata("La lista no existe".to_owned()))
    }

    pub async fn get_organization_options(&self) -> AppResult<OrganizationOptions> {
        let tags = sqlx::query_as::<_, InternalTag>(
            r#"
            SELECT internal_tags.id, internal_tags.name, COUNT(song_tags.track_id) AS usage_count
            FROM internal_tags
            LEFT JOIN song_tags ON song_tags.tag_id = internal_tags.id
            GROUP BY internal_tags.id
            ORDER BY internal_tags.name COLLATE NOCASE
            "#,
        )
        .fetch_all(&self.pool)
        .await?;
        let projects = sqlx::query_as::<_, Project>(
            r#"
            SELECT projects.id, projects.name, projects.description,
                   COUNT(tracks.id) AS track_count
            FROM projects
            LEFT JOIN tracks ON tracks.project_id = projects.id
            GROUP BY projects.id
            ORDER BY projects.name COLLATE NOCASE
            "#,
        )
        .fetch_all(&self.pool)
        .await?;
        let versions = sqlx::query_scalar::<_, String>(
            r#"
            SELECT DISTINCT version_label
            FROM tracks
            WHERE TRIM(COALESCE(version_label, '')) <> ''
            ORDER BY version_label COLLATE NOCASE
            "#,
        )
        .fetch_all(&self.pool)
        .await?;
        let models = sqlx::query_scalar::<_, String>(
            r#"
            SELECT DISTINCT generation_model
            FROM tracks
            WHERE TRIM(COALESCE(generation_model, '')) <> ''
            ORDER BY generation_model COLLATE NOCASE
            "#,
        )
        .fetch_all(&self.pool)
        .await?;

        let definitions = [
            ("all", "Toda la biblioteca", "1 = 1"),
            (
                "active",
                "Trabajo activo",
                "status IN ('idea', 'editing', 'generating')",
            ),
            (
                "needs_action",
                "Con siguiente acción",
                "TRIM(COALESCE(next_action, '')) <> ''",
            ),
            ("unreviewed", "Sin revisar", "status = 'review'"),
            (
                "untagged",
                "Sin tags",
                "NOT EXISTS (SELECT 1 FROM song_tags WHERE song_tags.track_id = tracks.id)",
            ),
            ("no_project", "Sin proyecto", "project_id IS NULL"),
            ("unrated", "Sin rating", "rating IS NULL"),
            ("daw_rescue", "DAW Rescue", "status = 'generating'"),
            ("radio_ready", "Radio Ready", "status = 'selected'"),
            (
                "release_ready",
                "Release Ready",
                "status IN ('final', 'published')",
            ),
            (
                "tag_potential",
                "Potential",
                "EXISTS (SELECT 1 FROM song_tags JOIN internal_tags ON internal_tags.id = song_tags.tag_id WHERE song_tags.track_id = tracks.id AND internal_tags.name = 'Potential' COLLATE NOCASE)",
            ),
            (
                "tag_strong_idea",
                "Strong Ideas",
                "EXISTS (SELECT 1 FROM song_tags JOIN internal_tags ON internal_tags.id = song_tags.tag_id WHERE song_tags.track_id = tracks.id AND internal_tags.name = 'Strong Idea' COLLATE NOCASE)",
            ),
            (
                "tag_maybe_later",
                "Maybe Later",
                "EXISTS (SELECT 1 FROM song_tags JOIN internal_tags ON internal_tags.id = song_tags.tag_id WHERE song_tags.track_id = tracks.id AND internal_tags.name = 'Maybe Later' COLLATE NOCASE)",
            ),
            (
                "tag_rejects_i_like",
                "Rejects I Like",
                "EXISTS (SELECT 1 FROM song_tags JOIN internal_tags ON internal_tags.id = song_tags.tag_id WHERE song_tags.track_id = tracks.id AND internal_tags.name = 'Rejects I Like' COLLATE NOCASE)",
            ),
            (
                "tag_custom_model_seed",
                "Custom Model Seeds",
                "EXISTS (SELECT 1 FROM song_tags JOIN internal_tags ON internal_tags.id = song_tags.tag_id WHERE song_tags.track_id = tracks.id AND internal_tags.name = 'Custom Model Seed' COLLATE NOCASE)",
            ),
            (
                "tag_release_candidate",
                "Release Candidates",
                "EXISTS (SELECT 1 FROM song_tags JOIN internal_tags ON internal_tags.id = song_tags.tag_id WHERE song_tags.track_id = tracks.id AND internal_tags.name = 'Release Candidate' COLLATE NOCASE)",
            ),
            (
                "tag_final_version",
                "Final Versions",
                "EXISTS (SELECT 1 FROM song_tags JOIN internal_tags ON internal_tags.id = song_tags.tag_id WHERE song_tags.track_id = tracks.id AND internal_tags.name = 'Final Version' COLLATE NOCASE)",
            ),
            (
                "needs_daw_work",
                "Needs DAW Work",
                "(status IN ('generating', 'editing') OR EXISTS (SELECT 1 FROM song_tags JOIN internal_tags ON internal_tags.id = song_tags.tag_id WHERE song_tags.track_id = tracks.id AND LOWER(internal_tags.name) IN ('needs stems', 'needs vocal replacement', 'weak intro', 'needs arrangement', 'needs mix', 'needs master')))",
            ),
            (
                "tag_needs_stems",
                "Needs Stems",
                "EXISTS (SELECT 1 FROM song_tags JOIN internal_tags ON internal_tags.id = song_tags.tag_id WHERE song_tags.track_id = tracks.id AND internal_tags.name = 'Needs Stems' COLLATE NOCASE)",
            ),
            (
                "tag_needs_mix",
                "Needs Mix",
                "EXISTS (SELECT 1 FROM song_tags JOIN internal_tags ON internal_tags.id = song_tags.tag_id WHERE song_tags.track_id = tracks.id AND internal_tags.name = 'Needs Mix' COLLATE NOCASE)",
            ),
            (
                "tag_needs_master",
                "Needs Master",
                "EXISTS (SELECT 1 FROM song_tags JOIN internal_tags ON internal_tags.id = song_tags.tag_id WHERE song_tags.track_id = tracks.id AND internal_tags.name = 'Needs Master' COLLATE NOCASE)",
            ),
            (
                "needs_metadata",
                "Needs Metadata",
                "(TRIM(COALESCE(title, '')) = '' OR TRIM(COALESCE(artist, '')) = '' OR TRIM(COALESCE(album, '')) = '' OR TRIM(COALESCE(genre, '')) = '')",
            ),
            (
                "tag_useful_fragment",
                "Useful Fragments",
                "EXISTS (SELECT 1 FROM song_tags JOIN internal_tags ON internal_tags.id = song_tags.tag_id WHERE song_tags.track_id = tracks.id AND internal_tags.name = 'Useful Fragment' COLLATE NOCASE)",
            ),
            (
                "tag_core_seed",
                "Core Seeds",
                "EXISTS (SELECT 1 FROM song_tags JOIN internal_tags ON internal_tags.id = song_tags.tag_id WHERE song_tags.track_id = tracks.id AND internal_tags.name = 'Core Seed' COLLATE NOCASE)",
            ),
            (
                "tag_reference_only",
                "Reference Only",
                "EXISTS (SELECT 1 FROM song_tags JOIN internal_tags ON internal_tags.id = song_tags.tag_id WHERE song_tags.track_id = tracks.id AND internal_tags.name = 'Reference Only' COLLATE NOCASE)",
            ),
            ("archived", "Archivadas", "status = 'archived'"),
        ];
        let mut smart_collections = Vec::with_capacity(definitions.len());
        for (id, name, condition) in definitions {
            let sql = format!("SELECT COUNT(*) FROM tracks WHERE missing_file = 0 AND {condition}");
            let count = sqlx::query_scalar(&sql).fetch_one(&self.pool).await?;
            smart_collections.push(SmartCollection {
                id: id.to_owned(),
                name: name.to_owned(),
                count,
            });
        }

        Ok(OrganizationOptions {
            tags,
            projects,
            versions,
            models,
            smart_collections,
        })
    }

    pub async fn create_project(&self, name: &str) -> AppResult<Project> {
        let name = name.trim();
        if name.is_empty() {
            return Err(AppError::InvalidMetadata(
                "El nombre del proyecto no puede estar vacio".to_owned(),
            ));
        }
        let now = Utc::now().to_rfc3339();
        sqlx::query(
            "INSERT INTO projects (name, created_at, updated_at) VALUES (?, ?, ?)
             ON CONFLICT(name) DO UPDATE SET updated_at = excluded.updated_at",
        )
        .bind(name)
        .bind(&now)
        .bind(&now)
        .execute(&self.pool)
        .await?;
        Ok(sqlx::query_as::<_, Project>(
            r#"
            SELECT projects.id, projects.name, projects.description,
                   COUNT(tracks.id) AS track_count
            FROM projects
            LEFT JOIN tracks ON tracks.project_id = projects.id
            WHERE projects.name = ? COLLATE NOCASE
            GROUP BY projects.id
            "#,
        )
        .bind(name)
        .fetch_one(&self.pool)
        .await?)
    }

    pub async fn update_track_organization(
        &self,
        track_ids: &[i64],
        patch: &OrganizationPatch,
    ) -> AppResult<OrganizationEditSummary> {
        if let Some(rating) = &patch.rating {
            validate_rating_filter(rating.value)?;
        }
        if let Some(status) = &patch.status {
            validate_status(status.value.as_deref())?;
        }
        let tag_mode = patch.tag_mode.as_deref().unwrap_or("replace");
        if !matches!(tag_mode, "add" | "remove" | "replace") {
            return Err(AppError::InvalidMetadata("Unsupported tag mode".into()));
        }
        let notes_mode = patch.workflow_notes_mode.as_deref().unwrap_or("replace");
        if !matches!(notes_mode, "replace" | "append") {
            return Err(AppError::InvalidMetadata("Unsupported notes mode".into()));
        }
        let next_action_mode = patch.next_action_mode.as_deref().unwrap_or("replace");
        if !matches!(next_action_mode, "replace" | "append") {
            return Err(AppError::InvalidMetadata(
                "Unsupported next action mode".into(),
            ));
        }
        let now = Utc::now().to_rfc3339();
        let device_id = self.get_or_create_device().await?;
        let mut transaction = self.pool.begin().await?;
        let mut updated = 0;

        for track_id in track_ids {
            let current_texts = if notes_mode == "append" || next_action_mode == "append" {
                Some(
                    sqlx::query_as::<_, (Option<String>, Option<String>)>(
                        "SELECT workflow_notes, next_action FROM tracks WHERE id = ?",
                    )
                    .bind(*track_id)
                    .fetch_optional(&mut *transaction)
                    .await?
                    .ok_or(AppError::TrackNotFound(*track_id))?,
                )
            } else {
                None
            };
            let mut builder = QueryBuilder::<Sqlite>::new("UPDATE tracks SET updated_at = ");
            builder.push_bind(&now);
            builder.push(", updated_by_device = ").push_bind(&device_id);
            if let Some(field) = &patch.rating {
                builder.push(", rating = ").push_bind(field.value);
            }
            if let Some(field) = &patch.status {
                builder
                    .push(", status = ")
                    .push_bind(field.value.as_deref().unwrap_or("review"));
            }
            if let Some(field) = &patch.workflow_notes {
                let value = if notes_mode == "append" {
                    append_optional_text(
                        current_texts
                            .as_ref()
                            .and_then(|(notes, _)| notes.as_deref()),
                        field.value.as_deref(),
                    )
                } else {
                    clean_optional_text(field.value.as_deref())
                };
                builder.push(", workflow_notes = ").push_bind(value);
            }
            if let Some(field) = &patch.next_action {
                let value = if next_action_mode == "append" {
                    append_optional_text(
                        current_texts
                            .as_ref()
                            .and_then(|(_, next_action)| next_action.as_deref()),
                        field.value.as_deref(),
                    )
                } else {
                    clean_optional_text(field.value.as_deref())
                };
                builder.push(", next_action = ").push_bind(value);
            }
            if let Some(field) = &patch.version_label {
                builder
                    .push(", version_label = ")
                    .push_bind(clean_optional_text(field.value.as_deref()));
            }
            if let Some(field) = &patch.project_id {
                builder.push(", project_id = ").push_bind(field.value);
            }
            if let Some(field) = &patch.mood {
                builder
                    .push(", mood = ")
                    .push_bind(clean_optional_text(field.value.as_deref()));
            }
            if let Some(field) = &patch.strong_part {
                builder
                    .push(", strong_part = ")
                    .push_bind(clean_optional_text(field.value.as_deref()));
            }
            if let Some(field) = &patch.main_problem {
                builder
                    .push(", main_problem = ")
                    .push_bind(clean_optional_text(field.value.as_deref()));
            }
            if let Some(field) = &patch.intended_use {
                builder
                    .push(", intended_use = ")
                    .push_bind(clean_optional_text(field.value.as_deref()));
            }
            if let Some(field) = &patch.language {
                builder
                    .push(", language = ")
                    .push_bind(clean_optional_text(field.value.as_deref()));
            }
            if let Some(field) = &patch.generation_model {
                builder
                    .push(", generation_model = ")
                    .push_bind(clean_optional_text(field.value.as_deref()));
            }
            builder.push(" WHERE id = ").push_bind(*track_id);
            updated += builder
                .build()
                .execute(&mut *transaction)
                .await?
                .rows_affected();

            if let Some(tag_names) = &patch.tag_names {
                let normalized_tags = normalized_tag_names(tag_names);
                if tag_mode == "replace" {
                    sqlx::query("DELETE FROM song_tags WHERE track_id = ?")
                        .bind(*track_id)
                        .execute(&mut *transaction)
                        .await?;
                } else if tag_mode == "remove" {
                    for tag_name in normalized_tags {
                        let normalized = tag_name.to_lowercase();
                        sqlx::query(
                            "DELETE FROM song_tags
                             WHERE track_id = ?
                             AND tag_id IN (
                                 SELECT id FROM internal_tags WHERE normalized_name = ?
                             )",
                        )
                        .bind(*track_id)
                        .bind(&normalized)
                        .execute(&mut *transaction)
                        .await?;
                    }
                    continue;
                }
                for tag_name in normalized_tags {
                    let normalized = tag_name.to_lowercase();
                    sqlx::query(
                        "INSERT INTO internal_tags (name, normalized_name, created_at)
                         VALUES (?, ?, ?) ON CONFLICT(normalized_name) DO NOTHING",
                    )
                    .bind(&tag_name)
                    .bind(&normalized)
                    .bind(&now)
                    .execute(&mut *transaction)
                    .await?;
                    sqlx::query(
                        "INSERT OR IGNORE INTO song_tags (track_id, tag_id)
                         SELECT ?, id FROM internal_tags WHERE normalized_name = ?",
                    )
                    .bind(*track_id)
                    .bind(&normalized)
                    .execute(&mut *transaction)
                    .await?;
                }
            }
        }
        transaction.commit().await?;
        Ok(OrganizationEditSummary { updated })
    }

    pub async fn remove_tracks(&self, track_ids: &[i64]) -> AppResult<u64> {
        if track_ids.is_empty() {
            return Ok(0);
        }

        let mut builder = QueryBuilder::<Sqlite>::new("DELETE FROM tracks WHERE id IN (");
        let mut separated = builder.separated(", ");
        for track_id in track_ids {
            separated.push_bind(*track_id);
        }
        separated.push_unseparated(")");

        Ok(builder.build().execute(&self.pool).await?.rows_affected())
    }

    pub async fn clear_library(&self) -> AppResult<u64> {
        Ok(sqlx::query("DELETE FROM tracks")
            .execute(&self.pool)
            .await?
            .rows_affected())
    }

    pub async fn track_id_by_path(&self, path: &str) -> AppResult<Option<i64>> {
        let path_key = normalize_path_value(path);
        Ok(
            sqlx::query_scalar("SELECT id FROM tracks WHERE file_path_key = ?")
                .bind(path_key)
                .fetch_optional(&self.pool)
                .await?,
        )
    }

    pub async fn apply_backup_track_data(
        &self,
        track_id: i64,
        track: &LibraryBackupTrack,
        mode: &str,
        force_internal: bool,
    ) -> AppResult<()> {
        let overwrite = mode == "overwrite" || force_internal;
        let fill_empty = mode != "keep" || force_internal;
        let current = self.get_track(track_id).await?;
        let now = Utc::now().to_rfc3339();
        let device_id = self.get_or_create_device().await?;
        let project_id = if let Some(project_name) = clean_optional_text(track.project.as_deref()) {
            Some(self.create_project(&project_name).await?.id)
        } else {
            None
        };

        let mut builder = QueryBuilder::<Sqlite>::new("UPDATE tracks SET updated_at = ");
        builder.push_bind(&now);
        builder.push(", updated_by_device = ").push_bind(&device_id);
        let mut changed = false;

        macro_rules! push_text {
            ($column:literal, $incoming:expr, $current:expr) => {
                if let Some(value) = clean_optional_text($incoming.as_deref()) {
                    if overwrite || (fill_empty && is_empty(&$current)) {
                        builder.push(concat!(", ", $column, " = ")).push_bind(value);
                        changed = true;
                    }
                }
            };
        }

        if let Some(stable_id) = clean_optional_text(track.stable_id.as_deref()) {
            let existing: Option<i64> =
                sqlx::query_scalar("SELECT id FROM tracks WHERE stable_id = ? AND id <> ?")
                    .bind(&stable_id)
                    .bind(track_id)
                    .fetch_optional(&self.pool)
                    .await?;
            if existing.is_none() {
                builder.push(", stable_id = ").push_bind(stable_id);
                changed = true;
            }
        }
        if let Some(value) = track.rating {
            if overwrite || (fill_empty && current.rating.is_none()) {
                builder.push(", rating = ").push_bind(value);
                changed = true;
            }
        }
        if overwrite || (fill_empty && current.status == "review") {
            builder.push(", status = ").push_bind(track.status.clone());
            changed = true;
        }
        if let Some(value) = project_id {
            if overwrite || (fill_empty && current.project_id.is_none()) {
                builder.push(", project_id = ").push_bind(value);
                changed = true;
            }
        }
        push_text!("version_label", track.version, current.version_label);
        push_text!("workflow_notes", track.notes, current.workflow_notes);
        push_text!("next_action", track.next_action, current.next_action);
        push_text!("strong_part", track.strong_part, current.strong_part);
        push_text!("main_problem", track.main_problem, current.main_problem);
        push_text!("intended_use", track.intended_use, current.intended_use);
        push_text!("mood", track.mood, current.mood);
        push_text!("language", track.language, current.language);
        push_text!("generation_model", track.model, current.generation_model);
        push_text!("reviewed_at", track.reviewed_at, current.reviewed_at);
        push_text!(
            "last_reviewed_at",
            track.last_reviewed_at,
            current.last_reviewed_at
        );
        if overwrite || force_internal {
            builder.push(", skip_count = ").push_bind(track.skips);
            builder.push(", play_count = ").push_bind(track.play_count);
            changed = true;
        }
        builder.push(" WHERE id = ").push_bind(track_id);
        if changed {
            builder.build().execute(&self.pool).await?;
        }

        if overwrite || force_internal || (fill_empty && current.tag_names.trim().is_empty()) {
            let tags = if track.internal_tags.is_empty() {
                split_stored_list(&track.tag_names)
            } else {
                track.internal_tags.clone()
            };
            self.update_track_organization(
                &[track_id],
                &OrganizationPatch {
                    tag_names: Some(tags),
                    ..OrganizationPatch::default()
                },
            )
            .await?;
        }
        Ok(())
    }

    pub async fn restore_backup_playlists(
        &self,
        playlists: &[LibraryBackupPlaylist],
        stable_to_id: &HashMap<String, i64>,
        path_to_id: &HashMap<String, i64>,
    ) -> AppResult<(usize, usize)> {
        let mut playlists_restored = 0;
        let mut songs_restored = 0;
        for playlist in playlists {
            let group_id = if let Some(group_name) = clean_optional_text(playlist.group.as_deref())
            {
                Some(ensure_playlist_group(&self.pool, &group_name).await?)
            } else {
                None
            };
            let playlist_id: Option<i64> =
                sqlx::query_scalar("SELECT id FROM playlists WHERE name = ? COLLATE NOCASE")
                    .bind(&playlist.name)
                    .fetch_optional(&self.pool)
                    .await?;
            let playlist_id = if let Some(playlist_id) = playlist_id {
                sqlx::query(
                    "UPDATE playlists
                     SET description = ?, playlist_type = ?, group_id = ?, purpose = ?, updated_at = ?
                     WHERE id = ?",
                )
                .bind(&playlist.description)
                .bind(&playlist.playlist_type)
                .bind(group_id)
                .bind(&playlist.purpose)
                .bind(Utc::now().to_rfc3339())
                .bind(playlist_id)
                .execute(&self.pool)
                .await?;
                sqlx::query("DELETE FROM playlist_songs WHERE playlist_id = ?")
                    .bind(playlist_id)
                    .execute(&self.pool)
                    .await?;
                playlist_id
            } else {
                self.create_playlist(&PlaylistSaveRequest {
                    name: playlist.name.clone(),
                    description: playlist.description.clone(),
                    playlist_type: playlist.playlist_type.clone(),
                    group_id,
                    purpose: playlist.purpose.clone(),
                })
                .await?
                .id
            };
            let mut pairs = playlist
                .items
                .iter()
                .filter_map(|item| {
                    item.track_stable_id
                        .as_deref()
                        .and_then(|stable_id| stable_to_id.get(stable_id).copied())
                        .or_else(|| {
                            item.track_path
                                .as_deref()
                                .map(normalize_path_value)
                                .and_then(|path_key| path_to_id.get(&path_key).copied())
                        })
                        .map(|track_id| (item.position, track_id))
                })
                .collect::<Vec<_>>();
            pairs.sort_by_key(|(position, _)| *position);
            let ids = pairs.into_iter().map(|(_, id)| id).collect::<Vec<_>>();
            if !ids.is_empty() {
                let mutation = self.add_tracks_to_playlist(playlist_id, &ids).await?;
                songs_restored += usize::try_from(mutation.changed).unwrap_or(usize::MAX);
                self.reorder_playlist_tracks(playlist_id, &ids).await?;
            }
            playlists_restored += 1;
        }
        Ok((playlists_restored, songs_restored))
    }

    pub async fn increment_play_count(&self, id: i64) -> AppResult<()> {
        let result = sqlx::query(
            "UPDATE tracks SET play_count = play_count + 1, updated_at = ?, updated_by_device = ? WHERE id = ?",
        )
        .bind(Utc::now().to_rfc3339())
        .bind(self.get_or_create_device().await?)
        .bind(id)
        .execute(&self.pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(AppError::TrackNotFound(id));
        }
        Ok(())
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn record_edit_history(
        &self,
        track_id: Option<i64>,
        file_path_snapshot: &str,
        operation_type: &str,
        before_json: Option<&str>,
        after_json: Option<&str>,
        written_to_file: bool,
        success: bool,
        backup_path: Option<&str>,
        error_message: Option<&str>,
    ) -> AppResult<()> {
        sqlx::query(
            r#"
            INSERT INTO edit_history (
                track_id, file_path_snapshot, operation_type,
                before_json, after_json, written_to_file,
                success, backup_path, error_message, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(track_id)
        .bind(file_path_snapshot)
        .bind(operation_type)
        .bind(before_json)
        .bind(after_json)
        .bind(written_to_file)
        .bind(success)
        .bind(backup_path)
        .bind(error_message)
        .bind(Utc::now().to_rfc3339())
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    #[cfg(test)]
    pub async fn track_count(&self) -> AppResult<i64> {
        Ok(sqlx::query_scalar("SELECT COUNT(*) FROM tracks")
            .fetch_one(&self.pool)
            .await?)
    }

    #[cfg(test)]
    pub async fn edit_history_count(&self) -> AppResult<i64> {
        Ok(sqlx::query_scalar("SELECT COUNT(*) FROM edit_history")
            .fetch_one(&self.pool)
            .await?)
    }
}

fn validate_rating_filter(rating: Option<i64>) -> AppResult<()> {
    if rating.is_some_and(|value| !(1..=10).contains(&value)) {
        return Err(AppError::InvalidRating);
    }
    Ok(())
}

fn normalize_path_value(path: &str) -> String {
    let normalized = path.replace('/', "\\");
    if cfg!(windows) {
        normalized.to_lowercase()
    } else {
        normalized
    }
}

fn root_name(path: &str) -> String {
    Path::new(path)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(path)
        .to_owned()
}

fn default_device_name() -> String {
    if cfg!(windows) {
        "Windows Desktop".to_owned()
    } else {
        "Desktop".to_owned()
    }
}

fn is_path_inside_root(path_key: &str, root_key: &str) -> bool {
    let root = root_key.trim_end_matches('\\');
    path_key == root || path_key.starts_with(&format!("{root}\\"))
}

fn relative_path_from_root_strings(
    file_path: &str,
    root_path: &str,
    file_path_key: &str,
    root_key: &str,
) -> Option<String> {
    if !is_path_inside_root(file_path_key, root_key) {
        return None;
    }
    let root_len = root_path.trim_end_matches(['\\', '/']).len();
    let relative = file_path
        .get(root_len..)
        .unwrap_or_default()
        .trim_start_matches(['\\', '/']);
    if relative.is_empty() {
        None
    } else {
        Some(relative.replace('\\', "/"))
    }
}

fn split_manifest_values(value: &str) -> Vec<String> {
    value
        .split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
        .collect()
}

async fn ensure_library_root_in_transaction(
    transaction: &mut Transaction<'_, Sqlite>,
    path: &str,
    now: &str,
) -> AppResult<i64> {
    let path_key = normalize_path_value(path);
    sqlx::query(
        "INSERT INTO library_roots (path, path_key, name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(path_key) DO UPDATE SET
            path = excluded.path,
            name = excluded.name,
            updated_at = excluded.updated_at",
    )
    .bind(path)
    .bind(&path_key)
    .bind(root_name(path))
    .bind(now)
    .bind(now)
    .execute(&mut **transaction)
    .await?;

    sqlx::query_scalar("SELECT id FROM library_roots WHERE path_key = ?")
        .bind(path_key)
        .fetch_one(&mut **transaction)
        .await
        .map_err(AppError::from)
}

async fn ensure_playlist_group(pool: &SqlitePool, name: &str) -> AppResult<i64> {
    let name = name.trim();
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT INTO playlist_groups (name, position, created_at, updated_at)
         VALUES (?, (SELECT COALESCE(MAX(position), 0) + 1 FROM playlist_groups), ?, ?)
         ON CONFLICT(name) DO UPDATE SET updated_at = excluded.updated_at",
    )
    .bind(name)
    .bind(&now)
    .bind(&now)
    .execute(pool)
    .await?;
    sqlx::query_scalar("SELECT id FROM playlist_groups WHERE name = ? COLLATE NOCASE")
        .bind(name)
        .fetch_one(pool)
        .await
        .map_err(AppError::from)
}

fn escape_like(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_")
}

fn push_folder_filter(builder: &mut QueryBuilder<'_, Sqlite>, folder_path: Option<&str>) {
    if let Some(folder_path) = folder_path
        .map(str::trim)
        .filter(|folder_path| !folder_path.is_empty())
    {
        let folder_key = normalize_path_value(folder_path)
            .trim_end_matches('\\')
            .to_owned();
        builder
            .push(" AND file_path_key LIKE ")
            .push_bind(format!("{}\\\\%", escape_like(&folder_key)))
            .push(" ESCAPE '\\'");
    }
}

fn match_import_record<'a>(
    record: &ImportRecord,
    candidates: &'a [ImportCandidate],
) -> ImportMatch<'a> {
    if let Some(stable_id) = &record.stable_id {
        if let Some(candidate) = candidates.iter().find(|candidate| {
            candidate
                .stable_id
                .as_deref()
                .is_some_and(|value| value.eq_ignore_ascii_case(stable_id))
        }) {
            return ImportMatch::Found(candidate, "Stable ID");
        }
    }

    if let Some(path) = &record.path {
        let path_key = normalize_path_value(path);
        if let Some(candidate) = candidates
            .iter()
            .find(|candidate| candidate.file_path_key == path_key)
        {
            return ImportMatch::Found(candidate, "Ruta exacta");
        }
    }

    if let Some(relative_path) = &record.relative_path {
        let relative_key = normalize_path_value(relative_path);
        let matches = candidates
            .iter()
            .filter(|candidate| {
                candidate
                    .relative_path
                    .as_deref()
                    .is_some_and(|value| normalize_path_value(value) == relative_key)
            })
            .collect::<Vec<_>>();
        match matches.as_slice() {
            [candidate] => return ImportMatch::Found(candidate, "Ruta relativa"),
            [_, _, ..] => return ImportMatch::Ambiguous,
            _ => {}
        }
    }

    if let Some(file_name) = &record.file_name {
        let matches = candidates
            .iter()
            .filter(|candidate| candidate.file_name.eq_ignore_ascii_case(file_name))
            .collect::<Vec<_>>();
        match matches.as_slice() {
            [candidate] => return ImportMatch::Found(candidate, "Nombre de archivo"),
            [_, _, ..] => return ImportMatch::Ambiguous,
            _ => {}
        }
    }

    if let (Some(title), Some(artist)) = (&record.title, &record.artist) {
        let title = normalize_match_text(title);
        let artist = normalize_match_text(artist);
        let matches = candidates
            .iter()
            .filter(|candidate| {
                candidate
                    .title
                    .as_deref()
                    .is_some_and(|value| normalize_match_text(value) == title)
                    && candidate
                        .artist
                        .as_deref()
                        .is_some_and(|value| normalize_match_text(value) == artist)
                    && match (record.duration_ms, candidate.duration_ms) {
                        (Some(source), Some(target)) => (source - target).abs() <= 5_000,
                        _ => true,
                    }
            })
            .collect::<Vec<_>>();
        match matches.as_slice() {
            [candidate] => return ImportMatch::Found(candidate, "Título + artista + duración"),
            [_, _, ..] => return ImportMatch::Ambiguous,
            _ => {}
        }
    }

    if let Some(file_hash) = &record.file_hash {
        let matches = candidates
            .iter()
            .filter(|candidate| {
                candidate
                    .file_hash
                    .as_deref()
                    .is_some_and(|value| value.eq_ignore_ascii_case(file_hash))
            })
            .collect::<Vec<_>>();
        return match matches.as_slice() {
            [candidate] => ImportMatch::Found(candidate, "Hash de archivo"),
            [] => ImportMatch::NotFound,
            _ => ImportMatch::Ambiguous,
        };
    }

    ImportMatch::NotFound
}

fn normalize_match_text(value: &str) -> String {
    value.trim().to_lowercase()
}

fn import_differences(
    record: &ImportRecord,
    candidate: &ImportCandidate,
) -> (Vec<String>, Vec<String>) {
    let mut changes = Vec::new();
    let mut conflicts = Vec::new();

    if let Some(rating) = record.rating {
        match candidate.rating {
            None => changes.push("Rating".to_owned()),
            Some(current) if current != rating => conflicts.push("Rating".to_owned()),
            _ => {}
        }
    }
    if let Some(status) = record.status.as_deref().filter(|value| valid_status(value)) {
        if candidate.status == "review" {
            changes.push("Estado".to_owned());
        } else if !candidate.status.eq_ignore_ascii_case(status) {
            conflicts.push("Estado".to_owned());
        }
    }
    push_import_difference(
        &mut changes,
        &mut conflicts,
        "Proyecto",
        record.project.as_deref(),
        candidate.project_name.as_deref(),
    );
    push_import_difference(
        &mut changes,
        &mut conflicts,
        "Versión",
        record.version.as_deref(),
        candidate.version_label.as_deref(),
    );
    push_import_difference(
        &mut changes,
        &mut conflicts,
        "Mood",
        record.mood.as_deref(),
        candidate.mood.as_deref(),
    );
    push_import_difference(
        &mut changes,
        &mut conflicts,
        "Parte fuerte",
        record.strong_part.as_deref(),
        candidate.strong_part.as_deref(),
    );
    push_import_difference(
        &mut changes,
        &mut conflicts,
        "Problema principal",
        record.main_problem.as_deref(),
        candidate.main_problem.as_deref(),
    );
    push_import_difference(
        &mut changes,
        &mut conflicts,
        "Uso previsto",
        record.intended_use.as_deref(),
        candidate.intended_use.as_deref(),
    );
    push_import_difference(
        &mut changes,
        &mut conflicts,
        "Modelo",
        record.model.as_deref(),
        candidate.generation_model.as_deref(),
    );
    push_import_difference(
        &mut changes,
        &mut conflicts,
        "Siguiente acción",
        record.next_action.as_deref(),
        candidate.next_action.as_deref(),
    );
    push_import_difference(
        &mut changes,
        &mut conflicts,
        "Notas",
        record.notes.as_deref(),
        candidate.workflow_notes.as_deref(),
    );
    push_import_difference(
        &mut changes,
        &mut conflicts,
        "Género",
        record.genre.as_deref(),
        candidate.genre.as_deref(),
    );
    if !record.tags.is_empty() {
        if candidate.tag_names.trim().is_empty() {
            changes.push("Tags".to_owned());
        } else {
            let current = candidate
                .tag_names
                .split(',')
                .map(|value| value.trim().to_lowercase())
                .collect::<HashSet<_>>();
            if record
                .tags
                .iter()
                .any(|tag| !current.contains(&tag.to_lowercase()))
            {
                changes.push("Tags".to_owned());
            }
        }
    }
    (changes, conflicts)
}

fn push_import_difference(
    changes: &mut Vec<String>,
    conflicts: &mut Vec<String>,
    label: &str,
    incoming: Option<&str>,
    current: Option<&str>,
) {
    let Some(incoming) = incoming else {
        return;
    };
    match current.map(str::trim).filter(|value| !value.is_empty()) {
        None => changes.push(label.to_owned()),
        Some(current) if !current.eq_ignore_ascii_case(incoming) => {
            conflicts.push(label.to_owned())
        }
        _ => {}
    }
}

fn is_empty(value: &Option<String>) -> bool {
    value.as_deref().map(str::trim).is_none_or(str::is_empty)
}

fn valid_status(value: &str) -> bool {
    matches!(
        value,
        "idea"
            | "generating"
            | "review"
            | "selected"
            | "editing"
            | "final"
            | "published"
            | "archived"
    )
}

fn valid_playlist_type(value: &str) -> bool {
    matches!(
        value,
        "manual"
            | "radio"
            | "album_draft"
            | "review"
            | "daw_rescue"
            | "release_candidates"
            | "session"
            | "other"
    )
}

fn valid_playlist_purpose(value: &str) -> bool {
    matches!(
        value,
        "idea_capture"
            | "deep_review"
            | "daw_rescue"
            | "release_candidates"
            | "radio"
            | "custom_model_seed"
            | "rejects_i_like"
            | "archive"
            | "archive_cleanup"
            | "metadata_cleanup"
            | "general"
    )
}

async fn ensure_project(
    transaction: &mut Transaction<'_, Sqlite>,
    name: &str,
    now: &str,
) -> AppResult<i64> {
    if let Some(id) =
        sqlx::query_scalar::<_, i64>("SELECT id FROM projects WHERE name = ? COLLATE NOCASE")
            .bind(name.trim())
            .fetch_optional(&mut **transaction)
            .await?
    {
        return Ok(id);
    }
    Ok(sqlx::query(
        "INSERT INTO projects (name, created_at, updated_at)
             VALUES (?, ?, ?)",
    )
    .bind(name.trim())
    .bind(now)
    .bind(now)
    .execute(&mut **transaction)
    .await?
    .last_insert_rowid())
}

fn validate_status(status: Option<&str>) -> AppResult<()> {
    const STATUSES: [&str; 8] = [
        "idea",
        "generating",
        "review",
        "selected",
        "editing",
        "final",
        "published",
        "archived",
    ];
    if status.is_some_and(|value| !STATUSES.contains(&value)) {
        return Err(AppError::InvalidMetadata(
            "Estado interno no válido".to_owned(),
        ));
    }
    Ok(())
}

fn validate_playlist(request: &PlaylistSaveRequest) -> AppResult<()> {
    if request.name.trim().is_empty() {
        return Err(AppError::InvalidMetadata(
            "El nombre de la lista no puede estar vacío".to_owned(),
        ));
    }
    const TYPES: [&str; 8] = [
        "manual",
        "radio",
        "album_draft",
        "review",
        "daw_rescue",
        "release_candidates",
        "session",
        "other",
    ];
    if !TYPES.contains(&request.playlist_type.as_str()) {
        return Err(AppError::InvalidMetadata(
            "El tipo de lista no es válido".to_owned(),
        ));
    }
    if request
        .purpose
        .as_deref()
        .is_some_and(|purpose| !valid_playlist_purpose(purpose))
    {
        return Err(AppError::InvalidMetadata(
            "El proposito de lista no es valido".to_owned(),
        ));
    }
    Ok(())
}

async fn normalize_playlist_positions(
    transaction: &mut Transaction<'_, Sqlite>,
    playlist_id: i64,
) -> AppResult<()> {
    let song_ids = sqlx::query_scalar::<_, i64>(
        "SELECT song_id FROM playlist_songs
         WHERE playlist_id = ?
         ORDER BY position, added_at, song_id",
    )
    .bind(playlist_id)
    .fetch_all(&mut **transaction)
    .await?;
    for (index, song_id) in song_ids.into_iter().enumerate() {
        sqlx::query(
            "UPDATE playlist_songs SET position = ?
             WHERE playlist_id = ? AND song_id = ?",
        )
        .bind(index as i64 + 1)
        .bind(playlist_id)
        .bind(song_id)
        .execute(&mut **transaction)
        .await?;
    }
    Ok(())
}

fn explorer_condition(criterion: &str) -> AppResult<&'static str> {
    match criterion {
        "unreviewed" => Ok(
            "(reviewed_at IS NULL AND (status = 'review' OR (rating IS NULL AND project_id IS NULL AND NOT EXISTS (SELECT 1 FROM song_tags WHERE song_tags.track_id = tracks.id))))",
        ),
        "unrated" => Ok("rating IS NULL"),
        "no_project" => Ok("project_id IS NULL"),
        "untagged" => Ok(
            "NOT EXISTS (SELECT 1 FROM song_tags WHERE song_tags.track_id = tracks.id)",
        ),
        "needs_action" => Ok("TRIM(COALESCE(next_action, '')) <> ''"),
        "daw_rescue" => Ok("status = 'generating'"),
        "radio_ready" => Ok("status = 'selected'"),
        "release_ready" => Ok("status IN ('final', 'published')"),
        "archived" => Ok("status = 'archived'"),
        "random" | "all" => Ok("1 = 1"),
        _ => Err(AppError::InvalidMetadata(
            "Criterio de Explorador no valido".to_owned(),
        )),
    }
}

fn clean_optional_text(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
}

fn append_optional_text(current: Option<&str>, addition: Option<&str>) -> Option<String> {
    let addition = clean_optional_text(addition)?;
    match clean_optional_text(current) {
        Some(current) => Some(format!("{current}\n{addition}")),
        None => Some(addition),
    }
}

fn normalized_tag_names(tag_names: &[String]) -> Vec<String> {
    let mut names = tag_names
        .iter()
        .map(|name| name.trim())
        .filter(|name| !name.is_empty() && !name.contains(','))
        .map(str::to_owned)
        .collect::<Vec<_>>();
    names.sort_by_key(|name| name.to_lowercase());
    names.dedup_by(|left, right| left.eq_ignore_ascii_case(right));
    names
}

fn split_stored_list(value: &str) -> Vec<String> {
    value
        .split([',', ';', '|'])
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
        .collect()
}

#[allow(clippy::too_many_arguments)]
fn push_filters<'a>(
    builder: &mut QueryBuilder<'a, Sqlite>,
    search: Option<&'a str>,
    rating_min: Option<i64>,
    rating_max: Option<i64>,
    status: Option<&'a str>,
    tag_id: Option<i64>,
    project_id: Option<i64>,
    version_label: Option<&'a str>,
    smart_collection: Option<&str>,
) {
    if let Some(search) = search {
        push_library_search_filter(builder, search);
    }
    if let Some(rating_min) = rating_min {
        builder.push(" AND rating >= ").push_bind(rating_min);
    }
    if let Some(rating_max) = rating_max {
        builder.push(" AND rating <= ").push_bind(rating_max);
    }
    if let Some(status) = status {
        builder.push(" AND status = ").push_bind(status);
    }
    if let Some(tag_id) = tag_id {
        builder
            .push(" AND EXISTS (SELECT 1 FROM song_tags WHERE song_tags.track_id = tracks.id AND song_tags.tag_id = ")
            .push_bind(tag_id)
            .push(")");
    }
    if let Some(project_id) = project_id {
        builder.push(" AND project_id = ").push_bind(project_id);
    }
    if let Some(version_label) = version_label {
        builder
            .push(" AND version_label = ")
            .push_bind(version_label);
    }
    match smart_collection {
        Some("active") => builder.push(" AND status IN ('idea', 'editing', 'generating')"),
        Some("needs_action") => builder.push(" AND TRIM(COALESCE(next_action, '')) <> ''"),
        Some("unreviewed") => builder.push(" AND status = 'review'"),
        Some("untagged") => builder
            .push(" AND NOT EXISTS (SELECT 1 FROM song_tags WHERE song_tags.track_id = tracks.id)"),
        Some("no_project") => builder.push(" AND project_id IS NULL"),
        Some("unrated") => builder.push(" AND rating IS NULL"),
        Some("daw_rescue") => builder.push(" AND status = 'generating'"),
        Some("radio_ready") => builder.push(" AND status = 'selected'"),
        Some("release_ready") => builder.push(" AND status IN ('final', 'published')"),
        Some("tag_potential") => {
            push_internal_tag_filter(builder, "Potential");
            builder
        }
        Some("tag_strong_idea") => {
            push_internal_tag_filter(builder, "Strong Idea");
            builder
        }
        Some("tag_maybe_later") => {
            push_internal_tag_filter(builder, "Maybe Later");
            builder
        }
        Some("tag_rejects_i_like") => {
            push_internal_tag_filter(builder, "Rejects I Like");
            builder
        }
        Some("tag_custom_model_seed") => {
            push_internal_tag_filter(builder, "Custom Model Seed");
            builder
        }
        Some("tag_release_candidate") => {
            push_internal_tag_filter(builder, "Release Candidate");
            builder
        }
        Some("tag_final_version") => {
            push_internal_tag_filter(builder, "Final Version");
            builder
        }
        Some("needs_daw_work") => builder.push(
            " AND (status IN ('generating', 'editing') OR EXISTS (SELECT 1 FROM song_tags JOIN internal_tags ON internal_tags.id = song_tags.tag_id WHERE song_tags.track_id = tracks.id AND LOWER(internal_tags.name) IN ('needs stems', 'needs vocal replacement', 'weak intro', 'needs arrangement', 'needs mix', 'needs master')))",
        ),
        Some("tag_needs_stems") => {
            push_internal_tag_filter(builder, "Needs Stems");
            builder
        }
        Some("tag_needs_mix") => {
            push_internal_tag_filter(builder, "Needs Mix");
            builder
        }
        Some("tag_needs_master") => {
            push_internal_tag_filter(builder, "Needs Master");
            builder
        }
        Some("needs_metadata") => builder.push(
            " AND (TRIM(COALESCE(title, '')) = '' OR TRIM(COALESCE(artist, '')) = '' OR TRIM(COALESCE(album, '')) = '' OR TRIM(COALESCE(genre, '')) = '')",
        ),
        Some("tag_useful_fragment") => {
            push_internal_tag_filter(builder, "Useful Fragment");
            builder
        }
        Some("tag_core_seed") => {
            push_internal_tag_filter(builder, "Core Seed");
            builder
        }
        Some("tag_reference_only") => {
            push_internal_tag_filter(builder, "Reference Only");
            builder
        }
        Some("archived") => builder.push(" AND status = 'archived'"),
        _ => builder,
    };
}

fn push_library_search_filter(builder: &mut QueryBuilder<'_, Sqlite>, search: &str) {
    let terms = search
        .split_whitespace()
        .map(str::trim)
        .filter(|term| !term.is_empty())
        .collect::<Vec<_>>();
    for term in terms {
        let pattern = format!("%{term}%");
        builder
            .push(" AND (title LIKE ")
            .push_bind(pattern.clone())
            .push(" OR artist LIKE ")
            .push_bind(pattern.clone())
            .push(" OR album LIKE ")
            .push_bind(pattern.clone())
            .push(" OR album_artist LIKE ")
            .push_bind(pattern.clone())
            .push(" OR file_name LIKE ")
            .push_bind(pattern.clone())
            .push(" OR file_path LIKE ")
            .push_bind(pattern.clone())
            .push(" OR genre LIKE ")
            .push_bind(pattern.clone())
            .push(" OR mood LIKE ")
            .push_bind(pattern.clone())
            .push(" OR language LIKE ")
            .push_bind(pattern.clone())
            .push(" OR status LIKE ")
            .push_bind(pattern.clone())
            .push(" OR CASE status ")
            .push("WHEN 'review' THEN 'Unreviewed Sin revisar' ")
            .push("WHEN 'idea' THEN 'Idea' ")
            .push("WHEN 'editing' THEN 'In progress En proceso' ")
            .push("WHEN 'generating' THEN 'DAW Rescue' ")
            .push("WHEN 'selected' THEN 'Radio Ready' ")
            .push("WHEN 'final' THEN 'Release Ready' ")
            .push("WHEN 'published' THEN 'Release Ready' ")
            .push("WHEN 'archived' THEN 'Archived Archivada' ")
            .push("ELSE status END LIKE ")
            .push_bind(pattern.clone())
            .push(" OR (SELECT name FROM projects WHERE id = tracks.project_id) LIKE ")
            .push_bind(pattern.clone())
            .push(" OR version_label LIKE ")
            .push_bind(pattern.clone())
            .push(" OR generation_model LIKE ")
            .push_bind(pattern.clone())
            .push(" OR COALESCE(CAST(rating AS TEXT), '') LIKE ")
            .push_bind(pattern.clone())
            .push(" OR workflow_notes LIKE ")
            .push_bind(pattern.clone())
            .push(" OR next_action LIKE ")
            .push_bind(pattern.clone())
            .push(" OR strong_part LIKE ")
            .push_bind(pattern.clone())
            .push(" OR main_problem LIKE ")
            .push_bind(pattern.clone())
            .push(" OR intended_use LIKE ")
            .push_bind(pattern.clone())
            .push(" OR musical_key LIKE ")
            .push_bind(pattern.clone())
            .push(" OR COALESCE(CAST(year AS TEXT), '') LIKE ")
            .push_bind(pattern.clone())
            .push(" OR COALESCE(CAST(track_number AS TEXT), '') LIKE ")
            .push_bind(pattern.clone())
            .push(" OR COALESCE(CAST(bpm AS TEXT), '') LIKE ")
            .push_bind(pattern.clone())
            .push(" OR audio_format LIKE ")
            .push_bind(pattern.clone())
            .push(" OR EXISTS (")
            .push("SELECT 1 FROM song_tags ")
            .push("JOIN internal_tags ON internal_tags.id = song_tags.tag_id ")
            .push("WHERE song_tags.track_id = tracks.id AND internal_tags.name LIKE ")
            .push_bind(pattern)
            .push("))");
    }
}

fn push_internal_tag_filter<'a>(builder: &mut QueryBuilder<'a, Sqlite>, tag_name: &'a str) {
    builder
        .push(" AND EXISTS (SELECT 1 FROM song_tags JOIN internal_tags ON internal_tags.id = song_tags.tag_id WHERE song_tags.track_id = tracks.id AND internal_tags.name = ")
        .push_bind(tag_name)
        .push(" COLLATE NOCASE)");
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::importer::ImportRecord;
    use crate::models::{AudioMetadata, MetadataFieldUpdate, PlaylistSaveRequest, ScannedTrack};

    fn sample_track(path_key: &str) -> ScannedTrack {
        ScannedTrack {
            file_path: format!(r"C:\Music\{path_key}.wav"),
            file_path_key: path_key.to_owned(),
            file_name: format!("{path_key}.wav"),
            file_extension: "wav".to_owned(),
            file_size: 44,
            file_modified_at_ms: 1,
            metadata: AudioMetadata::empty("wav".to_owned()),
            metadata_read_error: None,
            library_root_path: None,
            relative_path: None,
        }
    }

    #[tokio::test]
    async fn migration_and_rating_constraints_work() {
        let database = Database::connect_in_memory().await.unwrap();
        database
            .upsert_scanned_tracks(&[sample_track("track")])
            .await
            .unwrap();

        let track = database.update_track_rating(1, Some(10)).await.unwrap();
        assert_eq!(track.rating, Some(10));

        let cleared = database.update_track_rating(1, None).await.unwrap();
        assert_eq!(cleared.rating, None);
        assert!(matches!(
            database.update_track_rating(1, Some(0)).await,
            Err(AppError::InvalidRating)
        ));
        assert!(matches!(
            database.update_track_rating(1, Some(11)).await,
            Err(AppError::InvalidRating)
        ));
    }

    #[tokio::test]
    async fn sync_foundation_assigns_stable_id_and_relative_path() {
        let database = Database::connect_in_memory().await.unwrap();
        let mut track = sample_track("sync-one");
        track.file_path = r"C:\Music\Suno\sync-one.wav".to_owned();
        track.file_path_key = normalize_path_value(&track.file_path);
        track.library_root_path = Some(r"C:\Music".to_owned());
        track.relative_path = Some("Suno/sync-one.wav".to_owned());

        database
            .upsert_scanned_tracks(std::slice::from_ref(&track))
            .await
            .unwrap();
        let first = sqlx::query_as::<_, (String, Option<String>, Option<i64>)>(
            "SELECT stable_id, relative_path, library_root_id FROM tracks WHERE id = 1",
        )
        .fetch_one(&database.pool)
        .await
        .unwrap();
        assert!(!first.0.is_empty());
        assert_eq!(first.1.as_deref(), Some("Suno/sync-one.wav"));
        assert!(first.2.is_some());

        database.upsert_scanned_tracks(&[track]).await.unwrap();
        let second = sqlx::query_as::<_, (String, Option<String>, Option<i64>)>(
            "SELECT stable_id, relative_path, library_root_id FROM tracks WHERE id = 1",
        )
        .fetch_one(&database.pool)
        .await
        .unwrap();
        assert_eq!(second.0, first.0);
        assert_eq!(second.1, first.1);
        assert_eq!(second.2, first.2);
    }

    #[tokio::test]
    async fn device_id_is_local_and_persistent() {
        let database = Database::connect_in_memory().await.unwrap();
        let first = database.get_or_create_device().await.unwrap();
        let second = database.get_or_create_device().await.unwrap();

        assert!(first.starts_with("desktop_"));
        assert_eq!(first, second);
    }

    #[tokio::test]
    async fn sync_manifest_exports_tracks_and_playlist_stable_ids() {
        let database = Database::connect_in_memory().await.unwrap();
        let mut first = sample_track("manifest-first");
        first.file_path = r"C:\Music\manifest-first.wav".to_owned();
        first.file_path_key = normalize_path_value(&first.file_path);
        first.library_root_path = Some(r"C:\Music".to_owned());
        first.relative_path = Some("manifest-first.wav".to_owned());
        first.metadata.title = Some("Manifest First".to_owned());
        first.metadata.artist = Some("Soundbender".to_owned());

        let mut second = sample_track("manifest-second");
        second.file_path = r"C:\Music\manifest-second.wav".to_owned();
        second.file_path_key = normalize_path_value(&second.file_path);
        second.library_root_path = Some(r"C:\Music".to_owned());
        second.relative_path = Some("manifest-second.wav".to_owned());

        database
            .upsert_scanned_tracks(&[first, second])
            .await
            .unwrap();
        database.update_track_rating(1, Some(8)).await.unwrap();
        database
            .create_playlist(&PlaylistSaveRequest {
                name: "Manifest list".to_owned(),
                description: None,
                playlist_type: "manual".to_owned(),
                group_id: None,
                purpose: None,
            })
            .await
            .unwrap();
        database.add_tracks_to_playlist(1, &[1, 2]).await.unwrap();

        let manifest = database.build_sync_manifest().await.unwrap();
        assert_eq!(manifest.manifest_version, 1);
        assert!(manifest.device_id.starts_with("desktop_"));
        assert_eq!(manifest.library_roots.len(), 1);
        assert_eq!(manifest.tracks.len(), 2);
        assert!(manifest
            .tracks
            .iter()
            .all(|track| !track.stable_id.is_empty()));
        assert!(manifest
            .tracks
            .iter()
            .any(|track| track.title.as_deref() == Some("Manifest First")
                && track.rating == Some(8)
                && track.relative_path.as_deref() == Some("manifest-first.wav")));
        assert_eq!(manifest.playlists.len(), 1);
        assert_eq!(manifest.playlists[0].items.len(), 2);
        assert!(manifest.playlists[0]
            .items
            .iter()
            .all(|item| !item.track_stable_id.is_empty()));
    }

    #[tokio::test]
    async fn import_matches_exact_path_and_safe_mode_preserves_existing_values() {
        let database = Database::connect_in_memory().await.unwrap();
        let mut scanned = sample_track("restore");
        scanned.file_path = r"C:\Music\restore.wav".to_owned();
        scanned.file_path_key = normalize_path_value(&scanned.file_path);
        scanned.metadata.title = Some("Restore".to_owned());
        scanned.metadata.artist = Some("Soundbender".to_owned());
        scanned.metadata.duration_ms = Some(180_000);
        database.upsert_scanned_tracks(&[scanned]).await.unwrap();
        database.update_track_rating(1, Some(9)).await.unwrap();

        let record = ImportRecord {
            source_index: 1,
            path: Some(r"C:\Music\restore.wav".to_owned()),
            file_name: Some("restore.wav".to_owned()),
            title: Some("Restore".to_owned()),
            artist: Some("Soundbender".to_owned()),
            duration_ms: Some(181_000),
            rating: Some(5),
            status: Some("selected".to_owned()),
            model: Some("Suno v4.5".to_owned()),
            mood: Some("Cósmico".to_owned()),
            notes: Some("Recuperada".to_owned()),
            playlist_name: Some("Restaurada".to_owned()),
            playlist_type: Some("manual".to_owned()),
            position: Some(1),
            ..ImportRecord::default()
        };

        let preview = database
            .preview_import("restore.json", std::slice::from_ref(&record))
            .await
            .unwrap();
        assert_eq!(preview.matched, 1);
        assert_eq!(preview.not_found, 0);
        assert_eq!(
            preview.items[0].match_method.as_deref(),
            Some("Ruta exacta")
        );

        sqlx::query("UPDATE tracks SET file_hash = 'abc123' WHERE id = 1")
            .execute(&database.pool)
            .await
            .unwrap();
        let hash_preview = database
            .preview_import(
                "restore-hash.json",
                &[ImportRecord {
                    source_index: 1,
                    file_hash: Some("ABC123".to_owned()),
                    mood: Some("Profundo".to_owned()),
                    ..ImportRecord::default()
                }],
            )
            .await
            .unwrap();
        assert_eq!(
            hash_preview.items[0].match_method.as_deref(),
            Some("Hash de archivo")
        );

        let stable_id: String = sqlx::query_scalar("SELECT stable_id FROM tracks WHERE id = 1")
            .fetch_one(&database.pool)
            .await
            .unwrap();
        let stable_preview = database
            .preview_import(
                "restore-stable.json",
                &[ImportRecord {
                    source_index: 1,
                    stable_id: Some(stable_id),
                    mood: Some("Energético".to_owned()),
                    ..ImportRecord::default()
                }],
            )
            .await
            .unwrap();
        assert_eq!(
            stable_preview.items[0].match_method.as_deref(),
            Some("Stable ID")
        );

        let summary = database
            .apply_import(std::slice::from_ref(&record), false)
            .await
            .unwrap();
        assert_eq!(summary.updated, 1);
        assert_eq!(summary.playlists_imported, 1);
        let restored = database.get_track(1).await.unwrap();
        assert_eq!(restored.rating, Some(9));
        assert_eq!(restored.status, "selected");
        assert_eq!(restored.generation_model.as_deref(), Some("Suno v4.5"));
        assert_eq!(restored.mood.as_deref(), Some("Cósmico"));
        assert_eq!(restored.workflow_notes.as_deref(), Some("Recuperada"));
        assert_eq!(database.track_count().await.unwrap(), 1);

        let overwrite = database.apply_import(&[record], true).await.unwrap();
        assert_eq!(overwrite.matched, 1);
        assert_eq!(database.get_track(1).await.unwrap().rating, Some(5));
        assert_eq!(database.track_count().await.unwrap(), 1);
    }

    #[tokio::test]
    async fn library_backup_exports_tracks_projects_tags_and_playlists() {
        let database = Database::connect_in_memory().await.unwrap();
        database
            .upsert_scanned_tracks(&[sample_track("backup-one")])
            .await
            .unwrap();
        let project = database.create_project("Divine Logic").await.unwrap();
        database.update_track_rating(1, Some(9)).await.unwrap();
        database
            .update_track_organization(
                &[1],
                &OrganizationPatch {
                    status: Some(MetadataFieldUpdate {
                        value: Some("selected".to_owned()),
                    }),
                    project_id: Some(MetadataFieldUpdate {
                        value: Some(project.id),
                    }),
                    version_label: Some(MetadataFieldUpdate {
                        value: Some("v3".to_owned()),
                    }),
                    workflow_notes: Some(MetadataFieldUpdate {
                        value: Some("Good chorus".to_owned()),
                    }),
                    tag_names: Some(vec!["Core Seed".to_owned(), "Release Candidate".to_owned()]),
                    ..OrganizationPatch::default()
                },
            )
            .await
            .unwrap();
        database
            .save_curation(&CurationSaveRequest {
                track_id: 1,
                rating: Some(9),
                organization: OrganizationPatch::default(),
                strong_part: Some("Chorus".to_owned()),
                main_problem: Some("Needs Mix".to_owned()),
                intended_use: Some("Release".to_owned()),
                mood: Some("Energetic".to_owned()),
                generation_model: Some("Suno v4.5".to_owned()),
                mark_reviewed: Some(true),
            })
            .await
            .unwrap();
        let playlist = database
            .create_playlist(&PlaylistSaveRequest {
                name: "hoy".to_owned(),
                description: Some("Restore me".to_owned()),
                playlist_type: "manual".to_owned(),
                group_id: None,
                purpose: Some("general".to_owned()),
            })
            .await
            .unwrap();
        database
            .add_tracks_to_playlist(playlist.id, &[1])
            .await
            .unwrap();

        let backup = database.build_library_backup("1.4.0").await.unwrap();

        assert_eq!(backup.r#type, "tagdeck_library_backup");
        assert_eq!(backup.tracks.len(), 1);
        assert!(backup.tracks[0].stable_id.is_some());
        assert_eq!(backup.tracks[0].file_size, 44);
        assert_eq!(backup.tracks[0].rating, Some(9));
        assert_eq!(backup.tracks[0].project.as_deref(), Some("Divine Logic"));
        assert_eq!(backup.tracks[0].version.as_deref(), Some("v3"));
        assert!(backup.tracks[0]
            .internal_tags
            .contains(&"Core Seed".to_owned()));
        assert_eq!(backup.tracks[0].model.as_deref(), Some("Suno v4.5"));
        assert_eq!(backup.projects.len(), 1);
        assert!(backup
            .tags
            .iter()
            .any(|tag| tag.name == "Release Candidate"));
        assert_eq!(backup.playlists.len(), 1);
        assert_eq!(backup.playlists[0].items.len(), 1);
    }

    #[tokio::test]
    async fn library_backup_restore_rebuilds_empty_library_without_file_writes() {
        let database = Database::connect_in_memory().await.unwrap();
        let mut source_track = sample_track("restore-backup");
        source_track.file_path_key = normalize_path_value(&source_track.file_path);
        database
            .upsert_scanned_tracks(&[source_track])
            .await
            .unwrap();
        let project = database.create_project("Restore Project").await.unwrap();
        database.update_track_rating(1, Some(8)).await.unwrap();
        database
            .update_track_organization(
                &[1],
                &OrganizationPatch {
                    status: Some(MetadataFieldUpdate {
                        value: Some("final".to_owned()),
                    }),
                    project_id: Some(MetadataFieldUpdate {
                        value: Some(project.id),
                    }),
                    version_label: Some(MetadataFieldUpdate {
                        value: Some("take 2".to_owned()),
                    }),
                    workflow_notes: Some(MetadataFieldUpdate {
                        value: Some("Restore notes".to_owned()),
                    }),
                    tag_names: Some(vec!["Backup Tag".to_owned()]),
                    ..OrganizationPatch::default()
                },
            )
            .await
            .unwrap();
        let playlist = database
            .create_playlist(&PlaylistSaveRequest {
                name: "restore-list".to_owned(),
                description: None,
                playlist_type: "manual".to_owned(),
                group_id: None,
                purpose: Some("general".to_owned()),
            })
            .await
            .unwrap();
        database
            .add_tracks_to_playlist(playlist.id, &[1])
            .await
            .unwrap();
        let backup = database.build_library_backup("1.4.0").await.unwrap();
        let original_stable_id = backup.tracks[0].stable_id.clone().unwrap();

        database.clear_library().await.unwrap();
        assert_eq!(database.track_count().await.unwrap(), 0);
        let mut restored_track = sample_track("restore-backup");
        restored_track.file_path_key = normalize_path_value(&restored_track.file_path);
        database
            .upsert_scanned_tracks(&[restored_track])
            .await
            .unwrap();
        let restored_id = database
            .track_id_by_path(&backup.tracks[0].path)
            .await
            .unwrap()
            .unwrap();
        database
            .apply_backup_track_data(restored_id, &backup.tracks[0], "fill", true)
            .await
            .unwrap();
        let mut stable_to_id = HashMap::new();
        stable_to_id.insert(original_stable_id.clone(), restored_id);
        let mut path_to_id = HashMap::new();
        path_to_id.insert(normalize_path_value(&backup.tracks[0].path), restored_id);
        let playlist_summary = database
            .restore_backup_playlists(&backup.playlists, &stable_to_id, &path_to_id)
            .await
            .unwrap();

        let restored = database.get_track(restored_id).await.unwrap();
        let restored_stable_id: String =
            sqlx::query_scalar("SELECT stable_id FROM tracks WHERE id = ?")
                .bind(restored_id)
                .fetch_one(&database.pool)
                .await
                .unwrap();
        assert_eq!(restored_stable_id, original_stable_id);
        assert_eq!(restored.rating, Some(8));
        assert_eq!(restored.status, "final");
        assert_eq!(restored.project_name.as_deref(), Some("Restore Project"));
        assert_eq!(restored.version_label.as_deref(), Some("take 2"));
        assert_eq!(restored.workflow_notes.as_deref(), Some("Restore notes"));
        assert_eq!(restored.tag_names, "Backup Tag");
        assert_eq!(playlist_summary, (1, 1));
        assert_eq!(
            database.get_playlists().await.unwrap()[0].name,
            "restore-list"
        );
        assert_eq!(database.edit_history_count().await.unwrap(), 0);
    }

    #[tokio::test]
    async fn explorer_filters_tracks_by_recorded_folder() {
        let database = Database::connect_in_memory().await.unwrap();
        let mut root_track = sample_track("root");
        root_track.file_path = r"C:\Music\root.wav".to_owned();
        root_track.file_path_key = normalize_path_value(&root_track.file_path);
        root_track.file_name = "root.wav".to_owned();
        let mut sub_track = sample_track("sub");
        sub_track.file_path = r"C:\Music\Suno\sub.wav".to_owned();
        sub_track.file_path_key = normalize_path_value(&sub_track.file_path);
        sub_track.file_name = "sub.wav".to_owned();
        database
            .upsert_scanned_tracks(&[root_track, sub_track])
            .await
            .unwrap();
        database.record_scan_root(r"C:\Music").await.unwrap();
        database.record_scan_root(r"C:\Empty").await.unwrap();

        let folders = database.get_library_folders().await.unwrap();
        assert!(folders
            .iter()
            .any(|folder| folder.path == r"C:\Music" && folder.track_count == 2));
        assert!(folders
            .iter()
            .any(|folder| folder.path == r"C:\Music\Suno" && folder.track_count == 1));
        assert!(!folders.iter().any(|folder| folder.path == r"C:\Empty"));

        let page = database
            .get_explorer_tracks(ExplorerQuery {
                criterion: "all".to_owned(),
                limit: 100,
                folder_path: Some(r"C:\Music\Suno".to_owned()),
                smart_collection: None,
            })
            .await
            .unwrap();
        assert_eq!(page.total, 1);
        assert_eq!(page.items[0].file_name, "sub.wav");
    }

    #[tokio::test]
    async fn library_filters_tracks_by_folder_without_prefix_collisions() {
        let database = Database::connect_in_memory().await.unwrap();
        let mut pop = sample_track("pop");
        pop.file_path = r"C:\Music\Pop\song.wav".to_owned();
        pop.file_path_key = normalize_path_value(&pop.file_path);
        pop.file_name = "song.wav".to_owned();
        let mut pop_rock = sample_track("pop-rock");
        pop_rock.file_path = r"C:\Music\Pop Rock\song.wav".to_owned();
        pop_rock.file_path_key = normalize_path_value(&pop_rock.file_path);
        pop_rock.file_name = "song.wav".to_owned();
        let mut nested = sample_track("nested");
        nested.file_path = r"C:\Music\Pop\Deep\nested.wav".to_owned();
        nested.file_path_key = normalize_path_value(&nested.file_path);
        nested.file_name = "nested.wav".to_owned();
        database
            .upsert_scanned_tracks(&[pop, pop_rock, nested])
            .await
            .unwrap();

        let page = database
            .get_library_tracks(LibraryQuery {
                search: None,
                folder_path: Some(r"C:\Music\Pop".to_owned()),
                rating_min: None,
                rating_max: None,
                status: None,
                tag_id: None,
                project_id: None,
                version_label: None,
                smart_collection: None,
                sort_by: "path".to_owned(),
                sort_direction: "asc".to_owned(),
                limit: 1000,
                offset: 0,
            })
            .await
            .unwrap();

        assert_eq!(page.total, 2);
        assert!(page
            .items
            .iter()
            .all(|item| item.file_path.contains(r"C:\Music\Pop\")));
        assert!(!page
            .items
            .iter()
            .any(|item| item.file_path.contains("Pop Rock")));
    }

    #[tokio::test]
    async fn library_allows_twenty_thousand_visible_tracks() {
        let database = Database::connect_in_memory().await.unwrap();
        let tracks = (0..5_050)
            .map(|index| sample_track(&format!("limit-{index:04}")))
            .collect::<Vec<_>>();
        database.upsert_scanned_tracks(&tracks).await.unwrap();

        let page = database
            .get_library_tracks(LibraryQuery {
                search: None,
                folder_path: None,
                rating_min: None,
                rating_max: None,
                status: None,
                tag_id: None,
                project_id: None,
                version_label: None,
                smart_collection: None,
                sort_by: "title".to_owned(),
                sort_direction: "asc".to_owned(),
                limit: 20_000,
                offset: 0,
            })
            .await
            .unwrap();

        assert_eq!(page.total, 5_050);
        assert_eq!(page.items.len(), 5_050);
    }

    #[tokio::test]
    async fn organization_patch_updates_internal_fields_without_file_writes() {
        let database = Database::connect_in_memory().await.unwrap();
        database
            .upsert_scanned_tracks(&[sample_track("creative-fields")])
            .await
            .unwrap();

        database
            .update_track_organization(
                &[1],
                &OrganizationPatch {
                    rating: Some(MetadataFieldUpdate { value: Some(9) }),
                    status: Some(MetadataFieldUpdate {
                        value: Some("idea".to_owned()),
                    }),
                    workflow_notes: Some(MetadataFieldUpdate {
                        value: Some("Primera nota".to_owned()),
                    }),
                    next_action: Some(MetadataFieldUpdate {
                        value: Some("Revisar hook".to_owned()),
                    }),
                    version_label: Some(MetadataFieldUpdate {
                        value: Some("v1".to_owned()),
                    }),
                    mood: Some(MetadataFieldUpdate {
                        value: Some("Cósmico".to_owned()),
                    }),
                    strong_part: Some(MetadataFieldUpdate {
                        value: Some("Drop final".to_owned()),
                    }),
                    main_problem: Some(MetadataFieldUpdate {
                        value: Some("Voz baja".to_owned()),
                    }),
                    intended_use: Some(MetadataFieldUpdate {
                        value: Some("Radio".to_owned()),
                    }),
                    language: Some(MetadataFieldUpdate {
                        value: Some("ES".to_owned()),
                    }),
                    generation_model: Some(MetadataFieldUpdate {
                        value: Some("Suno v4.5".to_owned()),
                    }),
                    tag_names: Some(vec!["IA".to_owned(), "Demo".to_owned()]),
                    tag_mode: Some("replace".to_owned()),
                    ..OrganizationPatch::default()
                },
            )
            .await
            .unwrap();
        database
            .update_track_organization(
                &[1],
                &OrganizationPatch {
                    workflow_notes: Some(MetadataFieldUpdate {
                        value: Some("Segunda nota".to_owned()),
                    }),
                    workflow_notes_mode: Some("append".to_owned()),
                    tag_names: Some(vec!["Demo".to_owned()]),
                    tag_mode: Some("remove".to_owned()),
                    ..OrganizationPatch::default()
                },
            )
            .await
            .unwrap();

        let details = database.get_track(1).await.unwrap();
        assert_eq!(details.rating, Some(9));
        assert_eq!(details.status, "idea");
        assert_eq!(
            details.workflow_notes.as_deref(),
            Some("Primera nota\nSegunda nota")
        );
        assert_eq!(details.next_action.as_deref(), Some("Revisar hook"));
        assert_eq!(details.version_label.as_deref(), Some("v1"));
        assert_eq!(details.mood.as_deref(), Some("Cósmico"));
        assert_eq!(details.strong_part.as_deref(), Some("Drop final"));
        assert_eq!(details.main_problem.as_deref(), Some("Voz baja"));
        assert_eq!(details.intended_use.as_deref(), Some("Radio"));
        assert_eq!(details.language.as_deref(), Some("ES"));
        assert_eq!(details.generation_model.as_deref(), Some("Suno v4.5"));
        assert_eq!(details.tag_names, "IA");
        assert_eq!(database.edit_history_count().await.unwrap(), 0);
    }

    #[tokio::test]
    async fn library_search_covers_creative_fields_and_internal_tags() {
        let database = Database::connect_in_memory().await.unwrap();
        let mut track = sample_track("hidden-field-search");
        track.file_name = "hidden-field-search.mp3".to_owned();
        track.file_extension = "mp3".to_owned();
        track.metadata.title = Some("Lunar River".to_owned());
        track.metadata.artist = Some("Signal Weaver".to_owned());
        track.metadata.album = Some("Invisible Album".to_owned());
        track.metadata.album_artist = Some("AI Collective".to_owned());
        track.metadata.genre = Some("Neon Trance".to_owned());
        track.metadata.year = Some(2026);
        track.metadata.track_number = Some(7);
        track.metadata.bpm = Some(128.0);
        track.metadata.musical_key = Some("Am".to_owned());
        database.upsert_scanned_tracks(&[track]).await.unwrap();
        let project = database.create_project("Divine Archive").await.unwrap();
        database.update_track_rating(1, Some(8)).await.unwrap();
        database
            .update_track_organization(
                &[1],
                &OrganizationPatch {
                    status: Some(MetadataFieldUpdate {
                        value: Some("generating".to_owned()),
                    }),
                    workflow_notes: Some(MetadataFieldUpdate {
                        value: Some("Rescatar voz principal".to_owned()),
                    }),
                    next_action: Some(MetadataFieldUpdate {
                        value: Some("Preparar radio edit".to_owned()),
                    }),
                    version_label: Some(MetadataFieldUpdate {
                        value: Some("Suno Remaster".to_owned()),
                    }),
                    project_id: Some(MetadataFieldUpdate {
                        value: Some(project.id),
                    }),
                    tag_names: Some(vec!["Core Seed".to_owned(), "Needs Mix".to_owned()]),
                    ..OrganizationPatch::default()
                },
            )
            .await
            .unwrap();
        database
            .save_curation(&CurationSaveRequest {
                track_id: 1,
                rating: Some(8),
                organization: OrganizationPatch::default(),
                strong_part: Some("Estribillo gigante".to_owned()),
                main_problem: Some("Intro larga".to_owned()),
                intended_use: Some("Radio".to_owned()),
                mood: Some("Energetic Cosmic".to_owned()),
                generation_model: Some("Suno v4.5".to_owned()),
                mark_reviewed: Some(false),
            })
            .await
            .unwrap();

        for search in [
            "lunar river",
            "signal",
            "neon trance",
            "energetic",
            "core seed",
            "daw rescue",
            "divine archive",
            "suno v4.5",
            "rescatar voz",
            "radio edit",
            "estribillo",
            "intro larga",
            "128",
            "2026",
            "Am",
            "8",
        ] {
            let page = database
                .get_library_tracks(LibraryQuery {
                    search: Some(search.to_owned()),
                    folder_path: None,
                    rating_min: None,
                    rating_max: None,
                    status: None,
                    tag_id: None,
                    project_id: None,
                    version_label: None,
                    smart_collection: None,
                    sort_by: "title".to_owned(),
                    sort_direction: "asc".to_owned(),
                    limit: 100,
                    offset: 0,
                })
                .await
                .unwrap();
            assert_eq!(page.total, 1, "search should match: {search}");
            assert_eq!(page.items[0].id, 1);
        }
    }

    #[tokio::test]
    async fn upsert_preserves_rating() {
        let database = Database::connect_in_memory().await.unwrap();
        let track = sample_track("same-path");
        database
            .upsert_scanned_tracks(std::slice::from_ref(&track))
            .await
            .unwrap();
        assert_eq!(database.get_track(1).await.unwrap().status, "review");
        database.update_track_rating(1, Some(7)).await.unwrap();

        database.upsert_scanned_tracks(&[track]).await.unwrap();

        assert_eq!(database.track_count().await.unwrap(), 1);
        assert_eq!(database.get_track(1).await.unwrap().rating, Some(7));
    }

    #[tokio::test]
    async fn reddit_quick_tags_feed_smart_collections() {
        let database = Database::connect_in_memory().await.unwrap();
        database
            .upsert_scanned_tracks(&[
                sample_track("potential"),
                sample_track("rejects"),
                sample_track("model-seed"),
            ])
            .await
            .unwrap();

        database
            .update_track_organization(
                &[1],
                &OrganizationPatch {
                    tag_names: Some(vec!["Potential".to_owned()]),
                    ..OrganizationPatch::default()
                },
            )
            .await
            .unwrap();
        database
            .update_track_organization(
                &[2],
                &OrganizationPatch {
                    tag_names: Some(vec!["Rejects I Like".to_owned()]),
                    ..OrganizationPatch::default()
                },
            )
            .await
            .unwrap();
        database
            .update_track_organization(
                &[3],
                &OrganizationPatch {
                    tag_names: Some(vec!["Custom Model Seed".to_owned()]),
                    ..OrganizationPatch::default()
                },
            )
            .await
            .unwrap();

        let options = database.get_organization_options().await.unwrap();
        let count_by_id = options
            .smart_collections
            .iter()
            .map(|collection| (collection.id.as_str(), collection.count))
            .collect::<HashMap<_, _>>();
        assert_eq!(count_by_id.get("tag_potential"), Some(&1));
        assert_eq!(count_by_id.get("tag_rejects_i_like"), Some(&1));
        assert_eq!(count_by_id.get("tag_custom_model_seed"), Some(&1));

        let page = database
            .get_library_tracks(LibraryQuery {
                search: None,
                folder_path: None,
                rating_min: None,
                rating_max: None,
                status: None,
                tag_id: None,
                project_id: None,
                version_label: None,
                smart_collection: Some("tag_custom_model_seed".to_owned()),
                sort_by: "title".to_owned(),
                sort_direction: "asc".to_owned(),
                limit: 100,
                offset: 0,
            })
            .await
            .unwrap();
        assert_eq!(page.total, 1);
        assert_eq!(page.items[0].file_name, "model-seed.wav");
    }

    #[tokio::test]
    async fn records_edit_history() {
        let database = Database::connect_in_memory().await.unwrap();
        database
            .upsert_scanned_tracks(&[sample_track("history")])
            .await
            .unwrap();

        database
            .record_edit_history(
                Some(1),
                r"C:\Music\history.wav",
                "metadata_update",
                Some(r#"{"title":null}"#),
                Some(r#"{"title":"Nuevo"}"#),
                true,
                true,
                Some(r"C:\Backups\history.wav.bak"),
                None,
            )
            .await
            .unwrap();

        assert_eq!(database.edit_history_count().await.unwrap(), 1);
    }

    #[tokio::test]
    async fn removes_selected_tracks_without_touching_the_rest() {
        let database = Database::connect_in_memory().await.unwrap();
        database
            .upsert_scanned_tracks(&[sample_track("one"), sample_track("two")])
            .await
            .unwrap();

        assert_eq!(database.remove_tracks(&[1]).await.unwrap(), 1);
        assert_eq!(database.track_count().await.unwrap(), 1);
        assert!(matches!(
            database.get_track(1).await,
            Err(AppError::TrackNotFound(1))
        ));
        assert_eq!(database.get_track(2).await.unwrap().file_name, "two.wav");
    }

    #[tokio::test]
    async fn clears_the_library() {
        let database = Database::connect_in_memory().await.unwrap();
        database
            .upsert_scanned_tracks(&[sample_track("one"), sample_track("two")])
            .await
            .unwrap();

        assert_eq!(database.clear_library().await.unwrap(), 2);
        assert_eq!(database.track_count().await.unwrap(), 0);
    }

    #[tokio::test]
    async fn sorts_library_by_track_number() {
        let database = Database::connect_in_memory().await.unwrap();
        let mut second = sample_track("second");
        second.metadata.track_number = Some(2);
        let mut first = sample_track("first");
        first.metadata.track_number = Some(1);
        database
            .upsert_scanned_tracks(&[second, first])
            .await
            .unwrap();

        let page = database
            .get_library_tracks(LibraryQuery {
                search: None,
                folder_path: None,
                rating_min: None,
                rating_max: None,
                status: None,
                tag_id: None,
                project_id: None,
                version_label: None,
                smart_collection: None,
                sort_by: "trackNumber".to_owned(),
                sort_direction: "asc".to_owned(),
                limit: 1000,
                offset: 0,
            })
            .await
            .unwrap();

        assert_eq!(page.items[0].track_number, Some(1));
        assert_eq!(page.items[1].track_number, Some(2));
    }

    #[tokio::test]
    async fn organization_survives_rescan_and_filters_by_tag_status_and_project() {
        let database = Database::connect_in_memory().await.unwrap();
        let track = sample_track("creative");
        database
            .upsert_scanned_tracks(std::slice::from_ref(&track))
            .await
            .unwrap();
        let project = database.create_project("Suno Album").await.unwrap();
        database
            .update_track_organization(
                &[1],
                &OrganizationPatch {
                    status: Some(MetadataFieldUpdate {
                        value: Some("review".to_owned()),
                    }),
                    workflow_notes: Some(MetadataFieldUpdate {
                        value: Some("Comparar versiones".to_owned()),
                    }),
                    next_action: Some(MetadataFieldUpdate {
                        value: Some("Regenerar puente".to_owned()),
                    }),
                    version_label: Some(MetadataFieldUpdate {
                        value: Some("v2".to_owned()),
                    }),
                    project_id: Some(MetadataFieldUpdate {
                        value: Some(project.id),
                    }),
                    tag_names: Some(vec!["Suno".to_owned(), "Cinematic".to_owned()]),
                    ..OrganizationPatch::default()
                },
            )
            .await
            .unwrap();

        database.upsert_scanned_tracks(&[track]).await.unwrap();
        let details = database.get_track(1).await.unwrap();
        assert_eq!(details.status, "review");
        assert_eq!(details.project_name.as_deref(), Some("Suno Album"));
        assert_eq!(details.version_label.as_deref(), Some("v2"));
        assert!(details.tag_names.contains("Suno"));

        let options = database.get_organization_options().await.unwrap();
        let collection_names = options
            .smart_collections
            .iter()
            .map(|collection| collection.name.as_str())
            .collect::<Vec<_>>();
        assert!(collection_names.contains(&"Sin revisar"));
        assert!(collection_names.contains(&"DAW Rescue"));
        assert!(collection_names.contains(&"Radio Ready"));
        assert!(collection_names.contains(&"Release Ready"));
        assert!(!collection_names.contains(&"Listas / publicadas"));
        let tag_id = options
            .tags
            .into_iter()
            .find(|tag| tag.name == "Suno")
            .unwrap()
            .id;
        let page = database
            .get_library_tracks(LibraryQuery {
                search: None,
                folder_path: None,
                rating_min: None,
                rating_max: None,
                status: Some("review".to_owned()),
                tag_id: Some(tag_id),
                project_id: Some(project.id),
                version_label: Some("v2".to_owned()),
                smart_collection: Some("needs_action".to_owned()),
                sort_by: "title".to_owned(),
                sort_direction: "asc".to_owned(),
                limit: 1000,
                offset: 0,
            })
            .await
            .unwrap();
        assert_eq!(page.total, 1);
        assert_eq!(page.items[0].status, "review");
    }

    #[tokio::test]
    async fn organization_survives_database_reopen() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("library.sqlite");
        let database = Database::connect(&path).await.unwrap();
        database
            .upsert_scanned_tracks(&[sample_track("persistent")])
            .await
            .unwrap();
        let project = database.create_project("Album persistente").await.unwrap();
        database
            .update_track_organization(
                &[1],
                &OrganizationPatch {
                    status: Some(MetadataFieldUpdate {
                        value: Some("final".to_owned()),
                    }),
                    workflow_notes: Some(MetadataFieldUpdate {
                        value: Some("Master aprobado".to_owned()),
                    }),
                    next_action: Some(MetadataFieldUpdate {
                        value: Some("Publicar".to_owned()),
                    }),
                    version_label: Some(MetadataFieldUpdate {
                        value: Some("master".to_owned()),
                    }),
                    project_id: Some(MetadataFieldUpdate {
                        value: Some(project.id),
                    }),
                    tag_names: Some(vec!["Suno".to_owned()]),
                    ..OrganizationPatch::default()
                },
            )
            .await
            .unwrap();
        database
            .save_curation(&CurationSaveRequest {
                track_id: 1,
                rating: Some(8),
                organization: OrganizationPatch::default(),
                strong_part: Some("Coro".to_owned()),
                main_problem: Some("Necesita stems".to_owned()),
                intended_use: Some("Album".to_owned()),
                mood: Some("Profundo".to_owned()),
                generation_model: Some("Suno v4.5".to_owned()),
                mark_reviewed: Some(true),
            })
            .await
            .unwrap();
        database.pool.close().await;

        let reopened = Database::connect(&path).await.unwrap();
        let details = reopened.get_track(1).await.unwrap();
        assert_eq!(details.status, "final");
        assert_eq!(details.project_name.as_deref(), Some("Album persistente"));
        assert_eq!(details.version_label.as_deref(), Some("master"));
        assert_eq!(details.workflow_notes.as_deref(), Some("Master aprobado"));
        assert_eq!(details.next_action.as_deref(), Some("Publicar"));
        assert_eq!(details.tag_names, "Suno");
        assert_eq!(details.strong_part.as_deref(), Some("Coro"));
        assert_eq!(details.main_problem.as_deref(), Some("Necesita stems"));
        assert_eq!(details.intended_use.as_deref(), Some("Album"));
        assert_eq!(details.mood.as_deref(), Some("Profundo"));
        assert_eq!(details.generation_model.as_deref(), Some("Suno v4.5"));
        assert!(details.reviewed_at.is_some());
    }

    #[tokio::test]
    async fn explorer_saves_curation_and_advances_unreviewed_queue() {
        let database = Database::connect_in_memory().await.unwrap();
        database
            .upsert_scanned_tracks(&[sample_track("first"), sample_track("second")])
            .await
            .unwrap();

        let initial = database
            .get_explorer_tracks(ExplorerQuery {
                criterion: "unreviewed".to_owned(),
                limit: 100,
                folder_path: None,
                smart_collection: None,
            })
            .await
            .unwrap();
        assert_eq!(initial.total, 2);
        assert_eq!(initial.items[0].status, "review");

        let saved = database
            .save_curation(&CurationSaveRequest {
                track_id: 1,
                rating: Some(9),
                organization: OrganizationPatch {
                    status: Some(MetadataFieldUpdate {
                        value: Some("selected".to_owned()),
                    }),
                    tag_names: Some(vec!["Suno".to_owned(), "Favorita".to_owned()]),
                    ..OrganizationPatch::default()
                },
                strong_part: Some("Voz, Coro".to_owned()),
                main_problem: Some("Mezcla sucia".to_owned()),
                intended_use: Some("Radio".to_owned()),
                mood: Some("Energético, Triunfal".to_owned()),
                generation_model: Some("Udio".to_owned()),
                mark_reviewed: Some(true),
            })
            .await
            .unwrap();
        assert_eq!(saved.rating, Some(9));
        assert_eq!(saved.status, "selected");
        assert_eq!(saved.strong_part.as_deref(), Some("Voz, Coro"));
        assert_eq!(saved.main_problem.as_deref(), Some("Mezcla sucia"));
        assert_eq!(saved.intended_use.as_deref(), Some("Radio"));
        assert_eq!(saved.mood.as_deref(), Some("Energético, Triunfal"));
        assert_eq!(saved.generation_model.as_deref(), Some("Udio"));
        assert!(saved.reviewed_at.is_some());
        assert!(saved.last_reviewed_at.is_some());

        let remaining = database
            .get_explorer_tracks(ExplorerQuery {
                criterion: "unreviewed".to_owned(),
                limit: 100,
                folder_path: None,
                smart_collection: None,
            })
            .await
            .unwrap();
        assert_eq!(remaining.total, 1);
        assert_eq!(remaining.items[0].id, 2);
    }

    #[tokio::test]
    async fn explorer_skip_increments_without_marking_reviewed() {
        let database = Database::connect_in_memory().await.unwrap();
        database
            .upsert_scanned_tracks(&[sample_track("skip")])
            .await
            .unwrap();

        database.skip_curation_track(1).await.unwrap();
        let skipped = database.skip_curation_track(1).await.unwrap();

        assert_eq!(skipped.skip_count, 2);
        assert_eq!(skipped.status, "review");
        assert!(skipped.reviewed_at.is_none());
        assert!(skipped.last_reviewed_at.is_none());
    }

    #[tokio::test]
    async fn explorer_curation_does_not_modify_audio_file() {
        let directory = tempfile::tempdir().unwrap();
        let audio_path = directory.path().join("untouched.mp3");
        let original = b"not-real-audio-but-byte-stable";
        std::fs::write(&audio_path, original).unwrap();
        let mut track = sample_track("untouched");
        track.file_path = audio_path.to_string_lossy().into_owned();
        track.file_path_key = track.file_path.to_lowercase();
        track.file_name = "untouched.mp3".to_owned();
        track.file_extension = "mp3".to_owned();
        track.metadata.audio_format = "mp3".to_owned();
        let database = Database::connect_in_memory().await.unwrap();
        database.upsert_scanned_tracks(&[track]).await.unwrap();

        database
            .save_curation(&CurationSaveRequest {
                track_id: 1,
                rating: Some(7),
                organization: OrganizationPatch {
                    status: Some(MetadataFieldUpdate {
                        value: Some("idea".to_owned()),
                    }),
                    ..OrganizationPatch::default()
                },
                strong_part: Some("Letra".to_owned()),
                main_problem: None,
                intended_use: Some("Demo".to_owned()),
                mood: Some("Melancólico".to_owned()),
                generation_model: Some("Modelo propio".to_owned()),
                mark_reviewed: Some(true),
            })
            .await
            .unwrap();

        assert_eq!(std::fs::read(audio_path).unwrap(), original);
    }

    #[tokio::test]
    async fn playlists_support_crud_duplicates_order_and_rescan() {
        let database = Database::connect_in_memory().await.unwrap();
        let first = sample_track("playlist-first");
        let second = sample_track("playlist-second");
        database
            .upsert_scanned_tracks(&[first.clone(), second.clone()])
            .await
            .unwrap();

        let playlist = database
            .create_playlist(&PlaylistSaveRequest {
                name: "Mejores Suno".to_owned(),
                description: Some("Selección manual".to_owned()),
                playlist_type: "manual".to_owned(),
                group_id: None,
                purpose: None,
            })
            .await
            .unwrap();
        let added = database
            .add_tracks_to_playlist(playlist.id, &[1, 2])
            .await
            .unwrap();
        assert_eq!(added.changed, 2);
        let duplicate = database
            .add_tracks_to_playlist(playlist.id, &[1, 2])
            .await
            .unwrap();
        assert_eq!(duplicate.changed, 0);

        let reordered = database
            .reorder_playlist_tracks(playlist.id, &[2, 1])
            .await
            .unwrap();
        assert_eq!(
            reordered
                .songs
                .iter()
                .map(|song| song.id)
                .collect::<Vec<_>>(),
            vec![2, 1]
        );

        let moved = database
            .move_playlist_track(playlist.id, 2, "up")
            .await
            .unwrap();
        assert_eq!(
            moved.songs.iter().map(|song| song.id).collect::<Vec<_>>(),
            vec![2, 1]
        );
        assert_eq!(
            moved
                .songs
                .iter()
                .map(|song| song.position)
                .collect::<Vec<_>>(),
            vec![1, 2]
        );

        let removed = database
            .remove_tracks_from_playlist(playlist.id, &[2])
            .await
            .unwrap();
        assert_eq!(removed.changed, 1);
        let renamed = database
            .update_playlist(
                playlist.id,
                &PlaylistSaveRequest {
                    name: "Mejores Suno 2026".to_owned(),
                    description: None,
                    playlist_type: "radio".to_owned(),
                    group_id: None,
                    purpose: None,
                },
            )
            .await
            .unwrap();
        assert_eq!(renamed.name, "Mejores Suno 2026");
        assert_eq!(renamed.playlist_type, "radio");
        assert_eq!(renamed.song_count, 1);

        database
            .upsert_scanned_tracks(&[first, second])
            .await
            .unwrap();
        let after_rescan = database.get_playlist(playlist.id).await.unwrap();
        assert_eq!(after_rescan.songs.len(), 1);
        assert_eq!(after_rescan.songs[0].id, 1);

        database.delete_playlist(playlist.id).await.unwrap();
        assert!(database.get_playlists().await.unwrap().is_empty());
        assert_eq!(database.track_count().await.unwrap(), 2);
    }

    #[tokio::test]
    async fn playlist_groups_create_assign_and_require_empty_delete() {
        let database = Database::connect_in_memory().await.unwrap();
        database
            .upsert_scanned_tracks(&[sample_track("grouped")])
            .await
            .unwrap();
        let group = database
            .create_playlist_group("Release prep")
            .await
            .unwrap();
        let playlist = database
            .create_playlist(&PlaylistSaveRequest {
                name: "Model Seeds".to_owned(),
                description: None,
                playlist_type: "manual".to_owned(),
                group_id: Some(group.id),
                purpose: Some("custom_model_seed".to_owned()),
            })
            .await
            .unwrap();
        database
            .add_tracks_to_playlist(playlist.id, &[1])
            .await
            .unwrap();

        let details = database.get_playlist(playlist.id).await.unwrap();
        assert_eq!(details.playlist.group_id, Some(group.id));
        assert_eq!(details.playlist.group_name.as_deref(), Some("Release prep"));
        assert_eq!(
            details.playlist.purpose.as_deref(),
            Some("custom_model_seed")
        );
        assert!(database.delete_playlist_group(group.id).await.is_err());

        database
            .update_playlist(
                playlist.id,
                &PlaylistSaveRequest {
                    name: "Model Seeds".to_owned(),
                    description: None,
                    playlist_type: "manual".to_owned(),
                    group_id: None,
                    purpose: Some("custom_model_seed".to_owned()),
                },
            )
            .await
            .unwrap();
        database.delete_playlist_group(group.id).await.unwrap();
        assert!(database.get_playlist_groups().await.unwrap().is_empty());
    }

    #[tokio::test]
    async fn playlists_survive_database_reopen() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("playlists.sqlite");
        let database = Database::connect(&path).await.unwrap();
        database
            .upsert_scanned_tracks(&[
                sample_track("persistent-playlist-one"),
                sample_track("persistent-playlist-two"),
            ])
            .await
            .unwrap();
        let playlist = database
            .create_playlist(&PlaylistSaveRequest {
                name: "Álbum provisional".to_owned(),
                description: Some("Tracklist inicial".to_owned()),
                playlist_type: "album_draft".to_owned(),
                group_id: None,
                purpose: None,
            })
            .await
            .unwrap();
        database
            .add_tracks_to_playlist(playlist.id, &[1, 2])
            .await
            .unwrap();
        database
            .reorder_playlist_tracks(playlist.id, &[2, 1])
            .await
            .unwrap();
        database.pool.close().await;

        let reopened = Database::connect(&path).await.unwrap();
        let details = reopened.get_playlist(playlist.id).await.unwrap();
        assert_eq!(details.playlist.name, "Álbum provisional");
        assert_eq!(details.playlist.playlist_type, "album_draft");
        assert_eq!(details.songs.len(), 2);
        assert_eq!(details.songs[0].file_name, "persistent-playlist-two.wav");
        assert_eq!(details.songs[0].position, 1);
        assert_eq!(details.songs[1].file_name, "persistent-playlist-one.wav");
        assert_eq!(details.songs[1].position, 2);
    }

    #[tokio::test]
    async fn app_settings_persist_and_corrupt_values_remain_recoverable() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("settings.sqlite");
        let database = Database::connect(&path).await.unwrap();
        database
            .save_app_settings(r#"{"appearance":{"theme":"studio"}}"#)
            .await
            .unwrap();
        assert_eq!(
            database.get_app_settings().await.unwrap().as_deref(),
            Some(r#"{"appearance":{"theme":"studio"}}"#)
        );
        database.pool.close().await;

        let reopened = Database::connect(&path).await.unwrap();
        assert!(reopened
            .get_app_settings()
            .await
            .unwrap()
            .unwrap()
            .contains("studio"));
        reopened.save_app_settings("not-json").await.unwrap();
        assert_eq!(
            reopened.get_app_settings().await.unwrap().as_deref(),
            Some("not-json")
        );
    }
}
