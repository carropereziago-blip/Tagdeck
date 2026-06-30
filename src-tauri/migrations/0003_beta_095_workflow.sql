-- Earlier versions assigned "idea" automatically to every imported track.
-- Treat those legacy automatic values as unreviewed; users can assign Idea again.
UPDATE tracks SET status = 'review' WHERE status = 'idea';
