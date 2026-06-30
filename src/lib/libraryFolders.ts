import type { LibraryFolderOption, TrackSummary } from "../types/track";

export function normalizeLibraryPath(path: string): string {
  return path.replaceAll("/", "\\").replace(/\\+$/u, "").toLocaleLowerCase("es");
}

export function isTrackInFolder(filePath: string, folderPath: string): boolean {
  const fileKey = normalizeLibraryPath(filePath);
  const folderKey = normalizeLibraryPath(folderPath);
  if (!fileKey || !folderKey) return false;

  return fileKey.startsWith(`${folderKey}\\`);
}

export function filterTracksByFolder<T extends Pick<TrackSummary, "filePath">>(
  tracks: T[],
  folderPath: string,
): T[] {
  const selected = folderPath.trim();
  if (!selected) return tracks;
  return tracks.filter((track) => isTrackInFolder(track.filePath, selected));
}

export function hasLibraryFolder(
  folders: LibraryFolderOption[],
  folderPath: string,
): boolean {
  const selected = normalizeLibraryPath(folderPath);
  return folders.some((folder) => normalizeLibraryPath(folder.path) === selected);
}
