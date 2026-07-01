# Changelog

All notable public changes to Soundbender TagDeck will be documented here.

This project is preparing its first public source release.

## 1.4.0 - Public launch build

- Added customizable keyboard shortcuts with editable contexts for Library,
  Explorer and Session.
- Added guided shortcut value controls: closed dropdowns for Rating, Status,
  Action and Language; autocomplete/custom values for Genre, Mood, internal
  tags, Project and Model.
- Improved Library workflow with configurable/reorderable columns.
- Added Library selection handoff into Explorer and Session as ordered temporary
  queues.
- Kept safe local-first behavior: creative fields remain in SQLite/TagDeck
  unless an existing safe metadata-write flow is explicitly used.
- Refreshed Windows installer, update manifest and manual GitHub/source package.

## 1.4.0-beta.2 - Beta 2 hotfix

- Fixed Session Mode getting stuck on Preparing session.
- Fixed Session playlist loading so the queue remains intact after the first song starts.
- Fixed Explorer Criterion showing duplicate All entries.
- Refreshed installer, update manifest and manual GitHub/source package.

## 1.4.0-beta.1 - Beta 1

- First public/tester beta of Soundbender TagDeck.
- Prepare Windows installer and source package for inspection, audit and forks.
- Add GPL-3.0 license.
- Include local-first library, player, safe metadata editing and creative
  organization.
- Include Explorer / Curator mode, workflow presets, playlists and Session mode.
- Include CSV/JSON export and import, full library backup/restore foundation and
  manual update checker using soundbender.live.

## Unreleased

- Prepare repository for public GitHub release.
- Add public README, contribution guide, security policy and project docs.
- Add GitHub issue templates, pull request template and CI workflow.
- Strengthen `.gitignore` to exclude music files, databases, installers, logs,
  export packs, caches and generated builds.

## Internal Tester Builds

Recent internal work includes:

- Library scanning, search, filters, sorting and virtualized table.
- Local rating, status, project, version, model, mood and workflow fields.
- Explorer / Curator mode.
- Session mode with queue, suggestions and search.
- Internal playlists.
- Safe metadata editing for supported file tags.
- CSV/JSON export and import foundations.
- Mobile/sync readiness foundation.
- Shift-click range selection in Library.

Public release notes will start from the first GitHub tag.
