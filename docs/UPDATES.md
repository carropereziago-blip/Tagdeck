# Soundbender TagDeck manual updates

TagDeck uses a manual update checker. It does not auto-install updates, download
installers in the background, or execute installers from inside the app.

The user flow is:

1. Open Settings.
2. Go to Updates.
3. Click Check for updates.
4. If a newer version exists, open Download update or Release notes in the
   external browser.

## Manifest URL

Production builds check:

```text
https://soundbender.live/tagdeck/latest.txt
```

The app performs a public GET only. It does not send library data, file paths,
song names, device identifiers, or telemetry.

## Manifest format

Required fields:

- `app`
- `manifest_version`
- `channel`
- `latest_version`
- `released_at`
- `download_url`
- `release_notes_url`
- `mandatory`
- `notes`

Optional fields:

- `minimum_supported_version`
- `sha256`
- `size`

Example:

```json
{
  "app": "Soundbender TagDeck",
  "manifest_version": 1,
  "channel": "beta",
  "latest_version": "1.4.0-beta.1",
  "released_at": "2026-06-26T12:00:00Z",
  "minimum_supported_version": "1.4.0-beta.1",
  "download_url": "https://soundbender.live/tagdeck/download",
  "release_notes_url": "https://soundbender.live/tagdeck/releases/1.4.0-beta.1",
  "mandatory": false,
  "sha256": null,
  "size": null,
  "notes": {
    "en": [
      "Manual update checks from Settings.",
      "Improved library backup and restore."
    ],
    "es": [
      "Comprobacion manual de actualizaciones desde Ajustes.",
      "Mejoras en backup y restauracion de biblioteca."
    ]
  }
}
```

## Validation rules

The app accepts a manifest only when:

- `app` is exactly `Soundbender TagDeck`;
- `manifest_version` is supported;
- `latest_version` is valid semver;
- `download_url` and `release_notes_url` use HTTPS;
- both URLs belong to `soundbender.live`;
- release notes exist.

Version comparison follows semver, including prereleases:

- `0.1.0-beta.2` is newer than `0.1.0-beta.1`;
- `0.1.0` is newer than `0.1.0-beta.9`;
- `0.1.1` is newer than `0.1.0`.

## Publishing a new version

1. Update the app version in both files:
   - `package.json`
   - `src-tauri/tauri.conf.json`
2. Build and test the release installer manually.
3. Publish the installer or download page under:
   - `https://soundbender.live/tagdeck/download`
4. Add release notes under:
   - `https://soundbender.live/tagdeck/releases/<version>`
5. Update:
   - `https://soundbender.live/tagdeck/latest.txt`

Recommended web headers for `latest.txt`:

```text
Content-Type: text/plain; charset=utf-8
Cache-Control: no-cache
```

## Current limitation

This is not an autoupdater. The app only tells the user that an update exists and
opens trusted Soundbender URLs in the system browser.
