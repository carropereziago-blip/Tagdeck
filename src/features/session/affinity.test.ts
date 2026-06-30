import { describe, expect, it } from "vitest";
import type { TrackSummary } from "../../types/track";
import { SESSION_REASON, rankSuggestions, scoreAffinity } from "./affinity";

function track(id: number, patch: Partial<TrackSummary> = {}): TrackSummary {
  return {
    id,
    filePath: `C:\\Music\\${id}.mp3`,
    fileName: `${id}.mp3`,
    title: `Tema ${id}`,
    artist: "Soundbender",
    album: "Suno Lab",
    albumArtist: null,
    genre: null,
    year: null,
    trackNumber: null,
    durationMs: 180_000,
    audioFormat: "mp3",
    bpm: null,
    musicalKey: null,
    playCount: 0,
    rating: null,
    status: "review",
    projectId: null,
    projectName: null,
    versionLabel: null,
    tagNames: "",
    workflowNotes: null,
    nextAction: null,
    strongPart: null,
    mainProblem: null,
    intendedUse: null,
    mood: null,
    generationModel: null,
    reviewedAt: null,
    lastReviewedAt: null,
    skipCount: 0,
    metadataReadError: null,
    ...patch,
  };
}

describe("afinidad de Modo Sesión", () => {
  it("aplica los pesos de proyecto, género, mood, tags, rating y estado", () => {
    const seed = track(1, {
      projectId: 7,
      genre: "Electronic; Psytrance",
      mood: "Cósmico, Energético",
      tagNames: "Radio, Favorita",
      intendedUse: "Radio",
    });
    const candidate = track(2, {
      projectId: 7,
      genre: "Psytrance",
      mood: "Cósmico",
      tagNames: "Favorita",
      intendedUse: "Radio",
      rating: 9,
      status: "selected",
    });

    const result = scoreAffinity(seed, candidate);

    expect(result.score).toBe(20);
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        SESSION_REASON.sameProject,
        SESSION_REASON.genreAffinity,
        SESSION_REASON.sharedMood,
        SESSION_REASON.relatedTags,
        "Rating 9/10",
        SESSION_REASON.radioReady,
        SESSION_REASON.compatibleUse,
      ]),
    );
  });

  it("excluye archivadas, ratings muy bajos, reproducidas y canciones ya en cola", () => {
    const seed = track(1, { genre: "House" });
    const valid = track(2, { genre: "House", rating: 8 });
    const archived = track(3, { genre: "House", status: "archived" });
    const lowRated = track(4, { genre: "House", rating: 2 });
    const played = track(5, { genre: "House" });
    const queued = track(6, { genre: "House" });

    const results = rankSuggestions(
      seed,
      [valid, archived, lowRated, played, queued],
      {
        playedIds: new Set([played.id]),
        queuedIds: new Set([queued.id]),
      },
    );

    expect(results.map((item) => item.track.id)).toEqual([valid.id]);
  });

  it("prioriza la mayor afinidad antes que el rating aislado", () => {
    const seed = track(1, { projectId: 10, genre: "Ambient" });
    const sameProject = track(2, { projectId: 10, genre: "Ambient", rating: 7 });
    const highRating = track(3, { rating: 10 });

    const results = rankSuggestions(seed, [highRating, sameProject]);

    expect(results.map((item) => item.track.id)).toEqual([2, 3]);
  });

  it("reconoce géneros compatibles aunque no sean idénticos", () => {
    const seed = track(1, { genre: "Psytrance" });
    const compatible = track(2, { genre: "Trance" });

    const result = scoreAffinity(seed, compatible);

    expect(result.score).toBe(2);
    expect(result.reasons).toContain(SESSION_REASON.compatibleGenres);
  });
});
