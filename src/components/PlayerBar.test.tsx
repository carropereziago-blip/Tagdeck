// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TrackDetails } from "../types/track";
import { PlayerBar } from "./PlayerBar";

const playerMock = vi.hoisted(() => ({
  currentTrack: null as TrackDetails | null,
  selectedTrack: null as TrackDetails | null,
  state: {
    trackId: null as number | null,
    status: "stopped" as "stopped" | "playing" | "paused" | "ended",
    positionMs: 0,
    durationMs: null as number | null,
    volume: 0.8,
  },
}));

vi.mock("../features/player/PlayerContext", () => ({
  usePlayer: () => ({
    state: playerMock.state,
    currentTrack: playerMock.currentTrack,
    selectedTrack: playerMock.selectedTrack,
    error: null,
    togglePlayback: vi.fn(),
    stop: vi.fn(),
    seek: vi.fn(),
    setVolume: vi.fn(),
    playNext: vi.fn(),
    playPrevious: vi.fn(),
  }),
}));

vi.mock("../features/settings/SettingsContext", () => ({
  useSettings: () => ({
    settings: { interfaceLanguage: "es" },
  }),
}));

function track(patch: Partial<TrackDetails> = {}): TrackDetails {
  return {
    id: 1,
    filePath: "C:\\Music\\Free.mp3",
    fileName: "Free.mp3",
    title: "Free",
    artist: "Divine Logic",
    album: null,
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
    fileExtension: "mp3",
    fileSize: 1_024,
    trackTotal: null,
    discNumber: null,
    discTotal: null,
    comment: null,
    lyrics: null,
    bitrateKbps: 320,
    sampleRateHz: 44_100,
    channels: 2,
    hasCoverArt: false,
    ...patch,
  };
}

afterEach(() => {
  cleanup();
  playerMock.currentTrack = null;
  playerMock.selectedTrack = null;
  playerMock.state.trackId = null;
  playerMock.state.status = "stopped";
});

describe("PlayerBar", () => {
  it("muestra titulo sin version si versionLabel esta vacio", () => {
    playerMock.selectedTrack = track();

    const view = render(<PlayerBar />);

    expect(view.getByText("Free")).toBeInTheDocument();
    expect(view.queryByText(/Free ·/)).not.toBeInTheDocument();
  });

  it("muestra titulo y version interna cuando existe", () => {
    playerMock.currentTrack = track({ versionLabel: "v3" });
    playerMock.state.trackId = 1;
    playerMock.state.status = "playing";

    const view = render(<PlayerBar />);

    expect(view.getByText("Free · v3")).toBeInTheDocument();
    expect(view.getByText("Free · v3")).toHaveAttribute(
      "title",
      "Etiqueta interna de versión",
    );
  });
});
