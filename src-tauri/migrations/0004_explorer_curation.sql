ALTER TABLE tracks ADD COLUMN strong_part TEXT;
ALTER TABLE tracks ADD COLUMN main_problem TEXT;
ALTER TABLE tracks ADD COLUMN intended_use TEXT;
ALTER TABLE tracks ADD COLUMN reviewed_at TEXT;
ALTER TABLE tracks ADD COLUMN last_reviewed_at TEXT;
ALTER TABLE tracks ADD COLUMN skip_count INTEGER NOT NULL DEFAULT 0
    CHECK (skip_count >= 0);

CREATE INDEX idx_tracks_reviewed_at ON tracks(reviewed_at);
