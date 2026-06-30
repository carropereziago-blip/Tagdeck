import { describe, expect, it } from "vitest";
import type { TrackSummary } from "../../types/track";
import { buildVersionPlan, orderVersionTracks } from "./AutoNumberVersionsDialog";

function track(
  id: number,
  fileName: string,
  versionLabel: string | null = null,
): TrackSummary {
  return {
    id,
    filePath: `C:\\Music\\${fileName}`,
    fileName,
    title: fileName.replace(/\.[^.]+$/, ""),
    artist: "Soundbender",
    album: null,
    albumArtist: null,
    genre: null,
    year: null,
    trackNumber: null,
    durationMs: id * 1_000,
    audioFormat: fileName.split(".").pop() ?? "mp3",
    bpm: null,
    musicalKey: null,
    playCount: 0,
    rating: null,
    status: "review",
    projectId: null,
    projectName: null,
    versionLabel,
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
  };
}

describe("auto-number versions", () => {
  it("genera preview v1, v2, v3 respetando el orden actual", () => {
    const plan = buildVersionPlan({
      tracks: [track(1, "Free.mp3"), track(2, "Free.wav"), track(3, "Free remix.mp3")],
      format: "v{n}",
      startAt: 1,
      order: "current",
      applyMode: "empty",
      groupByTitleArtist: false,
    });

    expect(plan.map((item) => item.versionLabel)).toEqual(["v1", "v2", "v3"]);
  });

  it("respeta start number y formato custom", () => {
    const plan = buildVersionPlan({
      tracks: [track(1, "Free.mp3"), track(2, "Free.wav")],
      format: "take {n}",
      startAt: 4,
      order: "current",
      applyMode: "empty",
      groupByTitleArtist: false,
    });

    expect(plan.map((item) => item.versionLabel)).toEqual(["take 4", "take 5"]);
  });

  it("no sobrescribe versiones existentes en modo solo vacias", () => {
    const plan = buildVersionPlan({
      tracks: [track(1, "Free.mp3", "master"), track(2, "Free.wav")],
      format: "v{n}",
      startAt: 1,
      order: "current",
      applyMode: "empty",
      groupByTitleArtist: false,
    });

    expect(plan[0]).toMatchObject({ versionLabel: "master", skipped: true });
    expect(plan[1]).toMatchObject({ versionLabel: "v1", skipped: false });
  });

  it("sobrescribe todas las versiones si se solicita", () => {
    const plan = buildVersionPlan({
      tracks: [track(1, "Free.mp3", "master"), track(2, "Free.wav")],
      format: "version {n}",
      startAt: 1,
      order: "current",
      applyMode: "overwrite",
      groupByTitleArtist: false,
    });

    expect(plan.map((item) => item.versionLabel)).toEqual(["version 1", "version 2"]);
    expect(plan.some((item) => item.skipped)).toBe(false);
  });

  it("ordena por nombre natural", () => {
    const ordered = orderVersionTracks(
      [track(10, "Free 10.mp3"), track(2, "Free 2.mp3"), track(1, "Free 1.mp3")],
      "natural",
    );

    expect(ordered.map((item) => item.fileName)).toEqual([
      "Free 1.mp3",
      "Free 2.mp3",
      "Free 10.mp3",
    ]);
  });
});
