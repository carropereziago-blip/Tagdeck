# Local-First Model

Soundbender TagDeck is designed as a local-first desktop app.

## Principles

- No account required.
- No mandatory cloud.
- No upload of your music library.
- Creative organization data stays in local SQLite.
- Original audio files are not moved or deleted by scanning.
- Internal creative fields are not written into music files unless an explicit
  safe metadata-writing flow is designed for that purpose.

## Local Data

TagDeck stores library and organization data in SQLite on the local machine.
This includes:

- track records,
- ratings,
- workflow status,
- projects,
- version labels,
- internal tags,
- playlists,
- notes,
- future sync identifiers.

## File Access

Scanning is read-only. Metadata read errors should be recorded without breaking
the whole scan.

File metadata editing is a separate safe workflow. It should be explicit,
validated and backed up.

## Future Sync

Mobile and sync are future roadmap items. The intended direction is:

```text
Desktop owns the library.
Mobile reviews the library.
Sync merges the decisions.
```

Sync should be explicit and conflict-aware. It should not silently rewrite music
files or discard desktop decisions.
