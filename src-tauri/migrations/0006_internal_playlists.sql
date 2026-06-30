PRAGMA foreign_keys = ON;

CREATE TABLE playlists (
    id            INTEGER PRIMARY KEY,
    name          TEXT NOT NULL COLLATE NOCASE UNIQUE,
    description   TEXT,
    playlist_type TEXT NOT NULL DEFAULT 'manual'
                  CHECK (playlist_type IN (
                      'manual', 'radio', 'album_draft', 'review',
                      'daw_rescue', 'release_candidates', 'session', 'other'
                  )),
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
);

CREATE TABLE playlist_songs (
    playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    song_id     INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    position    INTEGER NOT NULL CHECK (position >= 1),
    added_at    TEXT NOT NULL,
    notes       TEXT,
    PRIMARY KEY (playlist_id, song_id)
);

CREATE INDEX idx_playlist_songs_position
    ON playlist_songs(playlist_id, position);
