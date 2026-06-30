PRAGMA foreign_keys = ON;

CREATE TABLE tracks (
    id                    INTEGER PRIMARY KEY,
    file_path             TEXT NOT NULL,
    file_path_key         TEXT NOT NULL UNIQUE,
    file_name             TEXT NOT NULL,
    file_extension        TEXT NOT NULL,
    file_size             INTEGER NOT NULL,
    file_modified_at_ms   INTEGER NOT NULL,
    file_hash             TEXT,

    title                 TEXT,
    artist                TEXT,
    album                 TEXT,
    album_artist          TEXT,
    genre                 TEXT,
    year                  INTEGER,
    track_number          INTEGER,
    track_total           INTEGER,
    disc_number           INTEGER,
    disc_total            INTEGER,
    comment               TEXT,
    lyrics                TEXT,
    bpm                   REAL,
    musical_key           TEXT,

    duration_ms           INTEGER,
    bitrate_kbps          INTEGER,
    sample_rate_hz        INTEGER,
    channels              INTEGER,
    audio_format          TEXT NOT NULL,
    has_cover_art         INTEGER NOT NULL DEFAULT 0
                          CHECK (has_cover_art IN (0, 1)),

    rating                INTEGER
                          CHECK (rating IS NULL OR rating BETWEEN 1 AND 10),
    play_count            INTEGER NOT NULL DEFAULT 0 CHECK (play_count >= 0),
    missing_file          INTEGER NOT NULL DEFAULT 0
                          CHECK (missing_file IN (0, 1)),
    metadata_read_error   TEXT,

    created_at            TEXT NOT NULL,
    updated_at            TEXT NOT NULL,
    last_scanned_at       TEXT NOT NULL
);

CREATE INDEX idx_tracks_title ON tracks(title);
CREATE INDEX idx_tracks_artist ON tracks(artist);
CREATE INDEX idx_tracks_album ON tracks(album);
CREATE INDEX idx_tracks_rating ON tracks(rating);
CREATE INDEX idx_tracks_hash ON tracks(file_hash);

CREATE TABLE edit_history (
    id                    INTEGER PRIMARY KEY,
    track_id              INTEGER REFERENCES tracks(id) ON DELETE SET NULL,
    file_path_snapshot    TEXT NOT NULL,
    operation_type        TEXT NOT NULL,
    before_json           TEXT,
    after_json            TEXT,
    written_to_file       INTEGER NOT NULL DEFAULT 0
                          CHECK (written_to_file IN (0, 1)),
    success               INTEGER NOT NULL
                          CHECK (success IN (0, 1)),
    backup_path           TEXT,
    error_message         TEXT,
    created_at            TEXT NOT NULL
);

CREATE INDEX idx_edit_history_track
    ON edit_history(track_id, created_at DESC);
