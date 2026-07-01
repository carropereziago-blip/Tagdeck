# Soundbender TagDeck 1.4.0 - GitHub upload notes

This folder contains the source package prepared for manual GitHub upload.

Do not upload generated folders such as node_modules, dist, release, github_upload, or src-tauri/target.

Updater endpoint note:
- The app now checks https://soundbender.live/tagdeck/latest.txt
- The file content is JSON, but the extension is .txt for Porkbun/static hosting compatibility.

Suggested GitHub steps:
1. Create or open the TagDeck repository.
2. Upload the contents of this folder to the repository root.
3. In the repository release page, attach the installer from release/Soundbender_TagDeck_1.4.0_Release.
4. Publish docs/web/tagdeck/latest.txt to the website updater endpoint.

Build locally:
- npm.cmd install
- npm.cmd run test
- npm.cmd run build
- npm.cmd run tauri:build
