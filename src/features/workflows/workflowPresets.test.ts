import { describe, expect, it } from "vitest";
import type { TrackSummary } from "../../types/track";
import {
  WORKFLOW_PRESETS,
  trackMatchesWorkflowPreset,
  workflowPresetById,
} from "./workflowPresets";

const REQUIRED_PRESETS = [
  "idea_capture",
  "deep_review",
  "daw_finishing",
  "release_prep",
  "radio_selection",
  "custom_model_seeds",
  "rejects_i_like",
  "archive_cleanup",
  "metadata_cleanup",
] as const;

function track(overrides: Partial<TrackSummary> = {}): TrackSummary {
  return {
    id: 1,
    filePath: "C:/Music/song.mp3",
    fileName: "song.mp3",
    title: "Song",
    artist: "Artist",
    album: "Album",
    albumArtist: null,
    genre: "Pop",
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
    ...overrides,
  };
}

describe("workflow presets", () => {
  it("define guided presets with queues, fields, actions and metrics", () => {
    expect(WORKFLOW_PRESETS.map((preset) => preset.id)).toEqual(REQUIRED_PRESETS);
    for (const preset of WORKFLOW_PRESETS) {
      expect(preset.descriptionKey).toMatch(/^workflowPresetDescription\./);
      expect(preset.defaultQueue.criterion).toBeTruthy();
      expect(preset.primaryFields.length).toBeGreaterThan(0);
      expect(preset.quickActions.length).toBeGreaterThan(0);
      expect(preset.progressMetrics.length).toBeGreaterThan(0);
      expect(preset.playlistPurpose).toBeTruthy();
    }
  });

  it("keeps model as a core field in creative seed workflows", () => {
    expect(workflowPresetById("custom_model_seeds").primaryFields).toContain(
      "generationModel",
    );
  });

  it("matches tracks for workflow suggestion filtering", () => {
    expect(
      trackMatchesWorkflowPreset(
        track({ tagNames: "Potential", rating: 7, status: "idea" }),
        "deep_review",
      ),
    ).toBe(true);
    expect(
      trackMatchesWorkflowPreset(
        track({ tagNames: "Needs Stems", status: "editing" }),
        "daw_finishing",
      ),
    ).toBe(true);
    expect(
      trackMatchesWorkflowPreset(
        track({ title: null, artist: "", album: null, genre: "" }),
        "metadata_cleanup",
      ),
    ).toBe(true);
  });
});
