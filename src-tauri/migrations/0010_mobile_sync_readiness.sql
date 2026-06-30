CREATE TABLE library_roots (
    id         INTEGER PRIMARY KEY,
    path       TEXT NOT NULL,
    path_key   TEXT NOT NULL UNIQUE,
    name       TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

ALTER TABLE tracks ADD COLUMN stable_id TEXT;
ALTER TABLE tracks ADD COLUMN relative_path TEXT;
ALTER TABLE tracks ADD COLUMN library_root_id INTEGER REFERENCES library_roots(id) ON DELETE SET NULL;
ALTER TABLE tracks ADD COLUMN updated_by_device TEXT;

CREATE UNIQUE INDEX idx_tracks_stable_id ON tracks(stable_id);
CREATE INDEX idx_tracks_library_root ON tracks(library_root_id);
CREATE INDEX idx_tracks_relative_path ON tracks(relative_path);

CREATE TABLE devices (
    id           INTEGER PRIMARY KEY,
    device_id    TEXT NOT NULL UNIQUE,
    device_name  TEXT NOT NULL,
    device_type  TEXT NOT NULL,
    created_at   TEXT NOT NULL,
    last_sync_at TEXT
);

CREATE TABLE sync_changes (
    id          INTEGER PRIMARY KEY,
    device_id   TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id   TEXT NOT NULL,
    field_name  TEXT,
    old_value   TEXT,
    new_value   TEXT,
    changed_at  TEXT NOT NULL,
    synced_at   TEXT
);

CREATE INDEX idx_sync_changes_entity ON sync_changes(entity_type, entity_id);
CREATE INDEX idx_sync_changes_changed ON sync_changes(changed_at);
