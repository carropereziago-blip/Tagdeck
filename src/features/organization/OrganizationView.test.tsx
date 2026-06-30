// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TrackDetails, TrackSummary } from "../../types/track";
import { OrganizationView } from "./OrganizationView";

const mocks = vi.hoisted(() => ({
  getLibraryTracks: vi.fn(),
  getOrganizationOptions: vi.fn(),
  getTrack: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({ save: vi.fn() }));
vi.mock("../../lib/tauri", () => ({
  api: {
    getLibraryTracks: mocks.getLibraryTracks,
    getOrganizationOptions: mocks.getOrganizationOptions,
    getTrack: mocks.getTrack,
    updateTrackOrganization: vi.fn(),
    createProject: vi.fn(),
    exportLibrary: vi.fn(),
  },
}));
vi.mock("../player/PlayerContext", () => ({
  usePlayer: () => ({
    playTrack: vi.fn(),
    setSelectedTrack: vi.fn(),
    setLibraryTracks: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function track(id: number, title: string): TrackSummary {
  return {
    id,
    filePath: `C:\\Music\\${title}.mp3`,
    fileName: `${title}.mp3`,
    title,
    artist: "Artista",
    album: null,
    albumArtist: null,
    genre: null,
    year: null,
    trackNumber: null,
    durationMs: null,
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
  };
}

describe("OrganizationView", () => {
  it("aclara cuándo se edita una canción o una selección", async () => {
    const tracks = [track(1, "Uno"), track(2, "Dos")];
    mocks.getLibraryTracks.mockResolvedValue({ items: tracks, total: tracks.length });
    mocks.getOrganizationOptions.mockResolvedValue({
      tags: [],
      projects: [],
      versions: [],
      models: [],
      smartCollections: [
        { id: "unreviewed", name: "Sin revisar", count: 2 },
        { id: "daw_rescue", name: "DAW Rescue", count: 0 },
        { id: "radio_ready", name: "Radio Ready", count: 0 },
        { id: "release_ready", name: "Release Ready", count: 0 },
      ],
    });
    mocks.getTrack.mockImplementation(async (id: number) => ({
      ...tracks.find((item) => item.id === id),
    }) as TrackDetails);

    const view = render(<OrganizationView />);
    await waitFor(() =>
      expect(view.getByText("Estados, proyectos, versiones y tags internos. Estos datos no modifican los archivos musicales.")).toBeInTheDocument(),
    );
    expect(view.getByRole("columnheader", { name: "Tags" })).toBeInTheDocument();
    expect(view.container.querySelectorAll("tbody tr[title]")).toHaveLength(0);

    fireEvent.click(view.getByRole("checkbox", { name: "Seleccionar Uno" }));
    expect(view.getByRole("heading", { name: "Organizar canción" })).toBeInTheDocument();
    expect(view.getByText("1 canción seleccionada")).toBeInTheDocument();
    expect(view.getByRole("button", { name: "Guardar organización" })).toBeInTheDocument();

    fireEvent.click(view.getByRole("checkbox", { name: "Seleccionar Dos" }));
    expect(view.getByRole("heading", { name: "Organizar selección" })).toBeInTheDocument();
    expect(view.getByText("2 canciones seleccionadas")).toBeInTheDocument();
    expect(view.getByRole("button", { name: "Aplicar a selección" })).toBeInTheDocument();
  });
});
