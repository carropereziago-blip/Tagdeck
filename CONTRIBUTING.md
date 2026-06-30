# Contributing to Soundbender TagDeck

Thanks for your interest in Soundbender TagDeck.

TagDeck is a local-first desktop app for organizing AI-generated music libraries.
The project welcomes bug reports, workflow ideas, documentation fixes and code
contributions.

## Ground Rules

- Do not attach or commit copyrighted music files.
- Do not attach or commit private SQLite databases.
- Do not include personal library paths, credentials, tokens or `.env` files.
- Use demo data when sharing screenshots.
- Keep internal creative organization separate from real file metadata unless a
  task explicitly concerns safe metadata writing.

## Development Setup

```powershell
npm.cmd install
npm.cmd run tauri:dev
```

Run checks before opening a pull request:

```powershell
npm.cmd run test
npm.cmd run build
cd src-tauri
cargo test
cargo check
cargo clippy --all-targets -- -D warnings
cargo fmt -- --check
```

## Pull Requests

Please include:

- a short summary,
- what changed,
- how it was tested,
- screenshots for UI changes,
- notes about metadata-writing safety if relevant.

## Useful Areas for Contribution

- Large-library performance.
- Accessibility and keyboard workflows.
- Metadata reader/writer safety.
- Playlist and session workflows.
- Export packs.
- Documentation.
- Cross-platform testing.
