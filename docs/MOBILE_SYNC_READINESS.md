# Soundbender TagDeck - Mobile / Sync Readiness

This document describes the local-only foundation added for a future mobile companion or sync flow. It does not enable cloud sync, accounts, servers, automatic merge, or a mobile app yet.

## Current Scope

- Each song receives a stable internal `stable_id`.
- Library roots are stored separately from songs.
- Songs can store a `relative_path` inside their library root.
- The desktop installation has a local `device_id`.
- A `sync_changes` table exists as a future change-log anchor.
- Settings can export an experimental `tagdeck_manifest.json`.

All creative data remains in SQLite. Music files are not modified by this foundation.

## Database Additions

- `library_roots`: known scan roots with path, normalized path key and display name.
- `tracks.stable_id`: stable song identity independent from the SQLite row id.
- `tracks.relative_path`: portable path inside a library root.
- `tracks.library_root_id`: link to the root used to calculate `relative_path`.
- `tracks.updated_by_device`: last local device that touched a track row.
- `devices`: local desktop/device identity.
- `sync_changes`: placeholder table for future field-level sync events.

The migration is designed as a one-way schema upgrade. Backfill runs on startup after migrations to assign missing stable IDs, mirror existing scan roots into `library_roots`, calculate relative paths where possible, and create the desktop device ID.

## Manifest Export

Settings > Data and security exposes an experimental mobile/sync section with:

- Device ID.
- Export manifest.

The exported `tagdeck_manifest.json` includes:

- App and manifest version.
- Export timestamp.
- Device ID.
- Library root labels.
- Tracks with stable IDs, relative paths, curation fields, project, version, tags, mood, model, rating and technical identity fields.
- Playlists with items referenced by `track_stable_id`.

Full absolute paths are intentionally not the primary sync identity. Future mobile clients should match by `stable_id` first, then use `relative_path`, hash and metadata as recovery signals.

## Future Mobile Changes

A later phase can add an import path for a file such as `mobile_changes.json`:

- `device_id`
- `entity_type`
- `entity_id` / `stable_id`
- `field_name`
- `old_value`
- `new_value`
- `changed_at`

That phase should validate schema version, reject unknown destructive operations, and write accepted changes into `sync_changes`.

## Conflict Strategy Draft

Future conflict handling should be explicit, not silent:

- Same field changed on only one device: apply automatically.
- Same field changed on multiple devices: keep desktop value and mark conflict for review.
- Missing file on desktop: keep metadata in SQLite and mark track unresolved.
- Playlist order conflicts: prefer latest complete order for that playlist, but preserve orphan additions.
- File tags: never write mobile/internal sync data into music files unless a separate safe metadata-writing flow explicitly requests it.

## Limitations

- No automatic sync.
- No mobile app.
- No cloud backend.
- No login or account identity.
- No portable package ZIP yet.
- No conflict UI yet.
- `sync_changes` is a foundation table; full field-level event logging will be expanded with the actual import/sync feature.

