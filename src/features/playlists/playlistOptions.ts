import type { PlaylistType } from "../../types/track";

export const PLAYLIST_TYPES: Array<{ value: PlaylistType }> = [
  { value: "manual" },
  { value: "radio" },
  { value: "album_draft" },
  { value: "review" },
  { value: "daw_rescue" },
  { value: "release_candidates" },
  { value: "session" },
  { value: "other" },
];

export function playlistTypeLabel(
  type: PlaylistType,
  t: (key: string) => string = (key) => key,
) {
  const keys: Record<PlaylistType, string> = {
    manual: "playlists.typeManual",
    radio: "playlists.typeRadio",
    album_draft: "playlists.typeAlbumDraft",
    review: "playlists.typeReview",
    daw_rescue: "playlists.typeDawRescue",
    release_candidates: "playlists.typeReleaseCandidates",
    session: "playlists.typeSession",
    other: "playlists.typeOther",
  };
  return keys[type] ? t(keys[type]) : type;
}
