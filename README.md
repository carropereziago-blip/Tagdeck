# Soundbender TagDeck

Soundbender TagDeck is a local-first desktop app for organizing, reviewing and
curating local music libraries, especially AI/Suno/Udio-generated music.

Built with Tauri, React, TypeScript, Rust and SQLite.

## What It Does

- Scan local music folders.
- Play and review songs.
- Read and safely edit supported audio metadata.
- Rate songs from 1 to 10.
- Organize songs by status, project, version, internal tags, mood, language,
  model, notes and next action.
- Review songs one by one with Explorer / Curator mode.
- Build playlists and session queues.
- Export/import CSV and JSON.
- Create and restore TagDeck library backups.
- Check manually for new versions using soundbender.live.

## Local-First

TagDeck does not upload your music.

TagDeck does not require accounts.

Creative organization data is stored locally in SQLite.

## Safety Model

TagDeck separates real file metadata from internal creative organization data.

Internal creative data is not written to music files.

Standard file metadata is only written when explicitly requested, using backup
and validation.

## Development

Install dependencies:

```powershell
npm.cmd install
```

Run the development app:

```powershell
npm.cmd run tauri:dev
```

Run tests and checks:

```powershell
npm.cmd run test
npm.cmd run build
cd src-tauri
cargo test
cargo check
cargo clippy --all-targets -- -D warnings
cargo fmt -- --check
```

## Documentation

- [Product vision](docs/PRODUCT_VISION.md)
- [Local-first model](docs/LOCAL_FIRST.md)
- [Metadata model](docs/METADATA_MODEL.md)
- [Roadmap](docs/ROADMAP.md)
- [Manual updates](docs/UPDATES.md)
- [Mobile/sync readiness](docs/MOBILE_SYNC_READINESS.md)
- [Track Workspace roadmap](docs/TRACK_WORKSPACE_ROADMAP.md)

## Contributing

Issues, feedback and pull requests are welcome once the repository is public.
Please avoid sharing copyrighted music, private databases, credentials or
personal library paths in issues.

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

License: GPL-3.0
