import type { AudioMetadata, TrackDetails } from "../types/track";

export function resolveUnsyncedLyrics(
  metadata: AudioMetadata | null,
  track: TrackDetails,
): string | null {
  return (
    metadata?.unsyncedLyrics?.trim() ||
    metadata?.lyrics?.trim() ||
    track.lyrics?.trim() ||
    null
  );
}
