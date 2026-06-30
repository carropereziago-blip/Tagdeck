# GitHub Upload Notes

This folder contains the source files prepared for a public Soundbender TagDeck GitHub repository.

## Upload these contents to the repository root

Upload the files and folders inside this directory, not the parent directory itself.

## Included

- React / TypeScript frontend in src/
- Tauri / Rust backend in src-tauri/
- SQLite migrations
- Tests
- Documentation in docs/
- GitHub issue templates and CI workflow in .github/
- GPL-3.0 LICENSE
- README, CHANGELOG, CONTRIBUTING and SECURITY docs
- package.json / package-lock.json / Cargo.toml / Cargo.lock

## Intentionally excluded

- node_modules/
- dist/
- src-tauri/target/
- release/
- installers and generated bundles
- SQLite databases
- logs and backups
- audio/music files
- .git/ local history
- .agents/ and .codex/ local workspace data
- IMPLEMENTATION_LOG.md because it contains local implementation trace data

## After uploading

1. Create the GitHub repo.
2. Upload all files from this folder to the repo root.
3. Confirm GitHub Actions sees .github/workflows/ci.yml.
4. Add repository description and topics.
5. Optionally create a release entry later and attach the installer/source ZIP from the release folder.
