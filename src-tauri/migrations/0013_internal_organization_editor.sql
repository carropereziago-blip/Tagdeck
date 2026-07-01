ALTER TABLE tracks ADD COLUMN language TEXT;

CREATE INDEX IF NOT EXISTS idx_tracks_mood ON tracks(mood COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_tracks_language ON tracks(language COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_tracks_generation_model ON tracks(generation_model COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_tracks_updated_at ON tracks(updated_at);
CREATE INDEX IF NOT EXISTS idx_internal_tags_name ON internal_tags(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_song_tags_track_tag ON song_tags(track_id, tag_id);
