# Track Workspace Roadmap

TagDeck is positioned as a local AI music curation workstation. A future Track Workspace can become the place where one generated song gathers its related assets, versions and release context.

This roadmap is documentation only. The Reddit Validation Build does not implement these tables or workflows yet.

## Concept

A Track Workspace would be a local workspace attached to one song or song family. It could collect:

- Original audio.
- Remasters.
- Lyrics drafts.
- Prompt notes.
- Stems.
- Cover art.
- Video renders.
- DAW project links.
- Release notes.
- Radio edit notes.
- Export/package history.

## Future Tables

Potential schema:

```text
track_workspaces
  id
  track_id
  title
  workspace_status
  created_at
  updated_at

track_assets
  id
  workspace_id
  asset_type
  asset_status
  path
  relative_path
  label
  notes
  created_at
  updated_at
```

## Asset Types

Suggested asset types:

- `audio_original`
- `audio_remaster`
- `stem_vocals`
- `stem_drums`
- `stem_bass`
- `stem_other`
- `lyrics`
- `prompt`
- `cover_art`
- `video`
- `daw_project`
- `release_document`
- `other`

## Asset Statuses

Suggested statuses:

- `draft`
- `candidate`
- `approved`
- `needs_fix`
- `archived`

## Future Song Package

A future Create Song Package flow could export:

- audio files,
- selected assets,
- CSV/JSON metadata,
- M3U,
- README,
- DAW notes,
- release notes,
- model seed notes.

The first implementation should copy files only. It should not move originals or rewrite creative internal tags into music files.

## Future Advanced Packs

The current export packs are lightweight. A future advanced export could add:

- DAW package,
- release package with cover art/video,
- radio package with clean ordering,
- model seed package with prompt and strong-part notes,
- archive package for frozen versions.

