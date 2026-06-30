PRAGMA foreign_keys = ON;

CREATE INDEX IF NOT EXISTS idx_tracks_missing_title
    ON tracks(missing_file, title COLLATE NOCASE);

CREATE INDEX IF NOT EXISTS idx_tracks_missing_artist
    ON tracks(missing_file, artist COLLATE NOCASE);

CREATE INDEX IF NOT EXISTS idx_tracks_missing_album
    ON tracks(missing_file, album COLLATE NOCASE);

CREATE INDEX IF NOT EXISTS idx_tracks_missing_rating
    ON tracks(missing_file, rating);

CREATE INDEX IF NOT EXISTS idx_tracks_missing_status
    ON tracks(missing_file, status);

CREATE INDEX IF NOT EXISTS idx_tracks_missing_project
    ON tracks(missing_file, project_id);

CREATE INDEX IF NOT EXISTS idx_tracks_missing_genre
    ON tracks(missing_file, genre COLLATE NOCASE);

CREATE INDEX IF NOT EXISTS idx_tracks_missing_file_path
    ON tracks(missing_file, file_path COLLATE NOCASE);

CREATE INDEX IF NOT EXISTS idx_tracks_missing_relative_path
    ON tracks(missing_file, relative_path COLLATE NOCASE);

CREATE INDEX IF NOT EXISTS idx_song_tags_track
    ON song_tags(track_id, tag_id);

CREATE INDEX IF NOT EXISTS idx_playlist_songs_song
    ON playlist_songs(song_id, playlist_id);
