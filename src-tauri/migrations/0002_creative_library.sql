PRAGMA foreign_keys = ON;

CREATE TABLE projects (
    id          INTEGER PRIMARY KEY,
    name        TEXT NOT NULL COLLATE NOCASE UNIQUE,
    description TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE internal_tags (
    id              INTEGER PRIMARY KEY,
    name            TEXT NOT NULL,
    normalized_name TEXT NOT NULL UNIQUE,
    created_at      TEXT NOT NULL
);

ALTER TABLE tracks ADD COLUMN status TEXT NOT NULL DEFAULT 'idea'
    CHECK (status IN (
        'idea', 'generating', 'review', 'selected',
        'editing', 'final', 'published', 'archived'
    ));
ALTER TABLE tracks ADD COLUMN workflow_notes TEXT;
ALTER TABLE tracks ADD COLUMN next_action TEXT;
ALTER TABLE tracks ADD COLUMN version_label TEXT;
ALTER TABLE tracks ADD COLUMN project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL;

CREATE TABLE song_tags (
    track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    tag_id   INTEGER NOT NULL REFERENCES internal_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (track_id, tag_id)
);

CREATE INDEX idx_tracks_status ON tracks(status);
CREATE INDEX idx_tracks_project ON tracks(project_id);
CREATE INDEX idx_song_tags_tag ON song_tags(tag_id, track_id);
