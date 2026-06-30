# Security Policy

Soundbender TagDeck is a local-first desktop application for music library
curation. It does not require accounts and does not upload your library.

## Reporting a Vulnerability

If you find a security issue, please open a GitHub security advisory if
available, or contact the maintainer privately before posting public exploit
details.

Please include:

- affected version or commit,
- operating system,
- steps to reproduce,
- expected impact,
- whether user files, SQLite data or metadata writing are involved.

## Sensitive Data

Do not share:

- real music libraries,
- private SQLite databases,
- unreleased audio,
- personal filesystem paths,
- `.env` files,
- credentials or tokens,
- installer signing material.

## Metadata Writing Safety

TagDeck intentionally separates file metadata from internal organization data.
Internal fields such as rating, status, project, version, model, mood, notes and
workflow tags are stored in SQLite and should not be written into audio files
unless a future explicit safe-writing workflow is designed for that purpose.
