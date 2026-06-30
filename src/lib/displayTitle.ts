import type { TrackSummary } from "../types/track";

export function baseDisplayTitle(track: Pick<TrackSummary, "title" | "fileName" | "filePath">) {
  return clean(track.title) || clean(track.fileName) || pathBaseName(track.filePath);
}

export function displayTitleWithVersion(
  track: Pick<TrackSummary, "title" | "fileName" | "filePath"> & {
    versionLabel?: string | null;
  },
) {
  const title = baseDisplayTitle(track);
  const version = clean(track.versionLabel);
  return version ? `${title} · ${version}` : title;
}

function clean(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed !== "—" && trimmed !== "\u00e2\u20ac\u201d" ? trimmed : null;
}

function pathBaseName(path: string) {
  return path.split(/[\\/]/).pop() || path;
}
