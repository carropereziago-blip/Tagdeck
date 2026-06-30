CREATE TABLE playlist_groups (
    id         INTEGER PRIMARY KEY,
    name       TEXT NOT NULL UNIQUE,
    position   INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

ALTER TABLE playlists ADD COLUMN group_id INTEGER REFERENCES playlist_groups(id) ON DELETE SET NULL;
ALTER TABLE playlists ADD COLUMN purpose TEXT;

CREATE INDEX idx_playlists_group ON playlists(group_id);
CREATE INDEX idx_playlists_purpose ON playlists(purpose);

