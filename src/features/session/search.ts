import type { TrackSummary } from "../../types/track";
import { STATUS_LABELS } from "../organization/SmartCollections";

export type SessionSearchField =
  | "all"
  | "title"
  | "artist"
  | "album"
  | "genre"
  | "mood"
  | "tags"
  | "project"
  | "version"
  | "status"
  | "rating"
  | "intendedUse"
  | "strongPart"
  | "mainProblem"
  | "nextAction"
  | "notes"
  | "path";

export const SESSION_SEARCH_FIELDS: SessionSearchField[] = [
  "all",
  "title",
  "artist",
  "album",
  "genre",
  "mood",
  "tags",
  "project",
  "version",
  "status",
  "rating",
  "intendedUse",
  "strongPart",
  "mainProblem",
  "nextAction",
  "notes",
  "path",
];

export function sessionSearchFieldLabel(
  value: SessionSearchField,
  t: (key: string) => string,
) {
  const labels: Record<SessionSearchField, string> = {
    all: t("session.allFields"),
    title: t("field.title"),
    artist: t("field.artist"),
    album: t("field.album"),
    genre: t("field.genre"),
    mood: t("field.mood"),
    tags: t("field.tags"),
    project: t("field.project"),
    version: t("field.version"),
    status: t("field.status"),
    rating: t("field.rating"),
    intendedUse: t("field.intendedUse"),
    strongPart: t("field.strongPart"),
    mainProblem: t("field.mainProblem"),
    nextAction: t("field.nextAction"),
    notes: t("field.notes"),
    path: t("field.path"),
  };
  return labels[value];
}

export function normalizeSessionSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es")
    .replace(/\s+/g, " ")
    .trim();
}

export function searchSessionTracks(
  tracks: TrackSummary[],
  query: string,
  field: SessionSearchField,
  excludeArchived = true,
): TrackSummary[] {
  const terms = normalizeSessionSearch(query).split(" ").filter(Boolean);
  if (terms.length === 0) return [];

  return tracks.filter((track) => {
    if (excludeArchived && track.status === "archived") return false;
    const haystack = normalizeSessionSearch(searchableValue(track, field));
    return terms.every((term) => haystack.includes(term));
  });
}

function searchableValue(
  track: TrackSummary,
  field: SessionSearchField,
): string {
  const values: Record<Exclude<SessionSearchField, "all">, string> = {
    title: `${track.title ?? ""} ${track.fileName}`,
    artist: track.artist ?? "",
    album: track.album ?? "",
    genre: track.genre ?? "",
    mood: track.mood ?? "",
    tags: track.tagNames,
    project: track.projectName ?? "",
    version: track.versionLabel ?? "",
    status: `${track.status} ${STATUS_LABELS[track.status]}`,
    rating:
      track.rating === null
        ? "sin rating sin puntuacion"
        : `${track.rating} ${track.rating}/10`,
    intendedUse: track.intendedUse ?? "",
    strongPart: track.strongPart ?? "",
    mainProblem: track.mainProblem ?? "",
    nextAction: track.nextAction ?? "",
    notes: track.workflowNotes ?? "",
    path: `${track.filePath} ${track.fileName}`,
  };

  return field === "all" ? Object.values(values).join(" ") : values[field];
}
