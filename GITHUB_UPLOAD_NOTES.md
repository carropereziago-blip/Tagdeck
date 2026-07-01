# Soundbender TagDeck 1.4.0 - GitHub upload notes

This folder contains the source package prepared for manual GitHub upload.

Do not upload generated folders such as node_modules, dist, release, github_upload, or src-tauri/target.

Suggested GitHub steps:
1. Create or open the TagDeck repository.
2. Upload the contents of this folder to the repository root.
3. In the repository release page, attach the installer from release/Soundbender_TagDeck_1.4.0_Release.
4. Publish docs/web/tagdeck/latest.json to the website updater endpoint if needed.

Build locally:
- npm.cmd install
- npm.cmd run test
- npm.cmd run build
- npm.cmd run tauri:build
