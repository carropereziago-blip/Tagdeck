# Metadata Model

TagDeck separates real file metadata from internal creative organization data.

This separation is central to the product.

## File Metadata

File metadata lives in the audio file when a safe metadata-writing workflow is
used.

Examples:

- Title
- Artist
- Album
- Album artist
- Genre
- Year
- Track number
- Disc number
- Comment
- Lyrics
- BPM
- Musical key
- Cover art

File metadata changes should be explicit, validated and backed up.

## Internal Organization

Internal organization is stored in TagDeck SQLite.

Examples:

- Rating
- Status
- Project
- Version
- Internal tags
- Mood
- Language
- Model
- Strong part
- Main problem
- Intended use
- Workflow notes
- Next action
- Playlists
- Session decisions

Internal organization should survive rescans and should not be written into
music files by default.

## Why This Matters

AI music workflows often need creative labels that are useful to the creator but
do not belong in the audio file itself.

For example:

- "needs bridge fix",
- "radio ready",
- "Suno v4.5",
- "take 3",
- "great chorus",
- "archive but keep".

Keeping these as internal fields prevents accidental pollution of real metadata
while still making the library searchable and exportable.
