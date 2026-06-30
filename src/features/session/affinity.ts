import type { TrackSummary } from "../../types/track";

export interface SessionSuggestion {
  track: TrackSummary;
  score: number;
  reasons: string[];
}

export const SESSION_REASON = {
  sameProject: "same_project",
  genreAffinity: "genre_affinity",
  compatibleGenres: "compatible_genres",
  sharedMood: "shared_mood",
  relatedTags: "related_tags",
  radioReady: "radio_ready",
  releaseReady: "release_ready",
  compatibleUse: "compatible_use",
} as const;

export interface RankSuggestionOptions {
  playedIds?: ReadonlySet<number>;
  queuedIds?: ReadonlySet<number>;
  excludePlayed?: boolean;
  excludeLowRated?: boolean;
  excludeArchived?: boolean;
  minimumRating?: number;
  priorities?: {
    genre?: boolean;
    mood?: boolean;
    project?: boolean;
    tags?: boolean;
    rating?: boolean;
    radioReady?: boolean;
  };
}

const COMPATIBLE_GENRE_GROUPS = [
  ["electronic", "house", "deep house", "afro house", "techno", "trance", "psytrance"],
  ["ambient", "cinematic", "orchestral", "experimental"],
  ["pop", "r&b", "soul", "funk"],
  ["rock", "reggae rock", "blues", "folk"],
  ["hip hop", "r&b", "funk"],
  ["reggae", "reggae rock", "world"],
  ["latin", "flamenco", "world"],
];

export function splitCreativeValues(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(/[,;|]/)
    .map((item) => item.trim().toLocaleLowerCase("es"))
    .filter(Boolean);
}

export function scoreAffinity(
  seed: TrackSummary,
  candidate: TrackSummary,
  playedIds: ReadonlySet<number> = new Set(),
  priorities: RankSuggestionOptions["priorities"] = {},
): SessionSuggestion {
  let score = 0;
  const reasons: string[] = [];

  if (priorities.project !== false && seed.projectId !== null && seed.projectId === candidate.projectId) {
    score += 5;
    reasons.push(SESSION_REASON.sameProject);
  }

  if (priorities.genre !== false && hasSharedValue(seed.genre, candidate.genre)) {
    score += 4;
    reasons.push(SESSION_REASON.genreAffinity);
  } else if (priorities.genre !== false && hasCompatibleGenre(seed.genre, candidate.genre)) {
    score += 2;
    reasons.push(SESSION_REASON.compatibleGenres);
  }

  if (priorities.mood !== false && hasSharedValue(seed.mood, candidate.mood)) {
    score += 3;
    reasons.push(SESSION_REASON.sharedMood);
  }

  if (priorities.tags !== false && hasSharedValue(seed.tagNames, candidate.tagNames)) {
    score += 2;
    reasons.push(SESSION_REASON.relatedTags);
  }

  if (priorities.rating !== false && candidate.rating !== null && candidate.rating >= 8) {
    score += 2;
    reasons.push(`Rating ${candidate.rating}/10`);
  }

  if (priorities.radioReady !== false && candidate.status === "selected") {
    score += 2;
    reasons.push(SESSION_REASON.radioReady);
  } else if (candidate.status === "final" || candidate.status === "published") {
    score += 1;
    reasons.push(SESSION_REASON.releaseReady);
  } else if (candidate.status === "archived") {
    score -= 5;
  }

  if (hasSharedValue(seed.intendedUse, candidate.intendedUse)) {
    score += 2;
    reasons.push(SESSION_REASON.compatibleUse);
  }

  if (playedIds.has(candidate.id)) {
    score -= 3;
  }

  if (candidate.rating !== null && candidate.rating <= 3) {
    score -= 2;
  }

  return { track: candidate, score, reasons };
}

export function rankSuggestions(
  seed: TrackSummary,
  candidates: TrackSummary[],
  options: RankSuggestionOptions = {},
): SessionSuggestion[] {
  const playedIds = options.playedIds ?? new Set<number>();
  const queuedIds = options.queuedIds ?? new Set<number>();
  const excludePlayed = options.excludePlayed ?? true;
  const excludeLowRated = options.excludeLowRated ?? true;
  const excludeArchived = options.excludeArchived ?? true;
  const minimumRating = options.minimumRating ?? 0;

  return candidates
    .filter((candidate) => candidate.id !== seed.id)
    .filter((candidate) => !excludeArchived || candidate.status !== "archived")
    .filter((candidate) => !queuedIds.has(candidate.id))
    .filter((candidate) => !excludePlayed || !playedIds.has(candidate.id))
    .filter(
      (candidate) =>
        !excludeLowRated || candidate.rating === null || candidate.rating > 3,
    )
    .filter(
      (candidate) =>
        minimumRating <= 0 ||
        candidate.rating === null ||
        candidate.rating >= minimumRating,
    )
    .map((candidate) =>
      scoreAffinity(seed, candidate, playedIds, options.priorities),
    )
    .sort(
      (left, right) =>
        right.score - left.score ||
        (right.track.rating ?? -1) - (left.track.rating ?? -1) ||
        (left.track.title ?? left.track.fileName).localeCompare(
          right.track.title ?? right.track.fileName,
          "es",
        ),
    );
}

function hasSharedValue(left: string | null, right: string | null): boolean {
  const leftValues = new Set(splitCreativeValues(left));
  return splitCreativeValues(right).some((value) => leftValues.has(value));
}

function hasCompatibleGenre(left: string | null, right: string | null): boolean {
  const leftValues = splitCreativeValues(left);
  const rightValues = splitCreativeValues(right);
  return COMPATIBLE_GENRE_GROUPS.some(
    (group) =>
      leftValues.some((value) => group.includes(value)) &&
      rightValues.some((value) => group.includes(value)),
  );
}
