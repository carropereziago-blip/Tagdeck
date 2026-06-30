// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlaylistDetails, PlaylistSummary } from "../../types/track";
import { PlaylistsView } from "./PlaylistsView";

const mocks = vi.hoisted(() => ({
  getPlaylists: vi.fn(),
  getPlaylistGroups: vi.fn(),
  createPlaylistGroup: vi.fn(),
  updatePlaylistGroup: vi.fn(),
  deletePlaylistGroup: vi.fn(),
  getPlaylist: vi.fn(),
  createPlaylist: vi.fn(),
  updatePlaylist: vi.fn(),
  deletePlaylist: vi.fn(),
  removeTracksFromPlaylist: vi.fn(),
  movePlaylistTrack: vi.fn(),
  reorderPlaylistTracks: vi.fn(),
  exportPlaylist: vi.fn(),
  getTrack: vi.fn(),
  setLibraryTracks: vi.fn(),
  setSelectedTrack: vi.fn(),
  playTrack: vi.fn(),
  getDragIconPath: vi.fn(),
  copyPlaylistFiles: vi.fn(),
  openDialog: vi.fn(),
}));

vi.mock("../../lib/tauri", () => ({ api: mocks }));
vi.mock("@tauri-apps/plugin-dialog", () => ({
  save: vi.fn(),
  open: mocks.openDialog,
}));
vi.mock("@crabnebula/tauri-plugin-drag", () => ({ startDrag: vi.fn() }));
vi.mock("../player/PlayerContext", () => ({
  usePlayer: () => ({
    state: {
      trackId: null,
      status: "stopped",
      positionMs: 0,
      durationMs: null,
      volume: 0.8,
    },
    setLibraryTracks: mocks.setLibraryTracks,
    setSelectedTrack: mocks.setSelectedTrack,
    playTrack: mocks.playTrack,
  }),
}));

const playlist: PlaylistSummary = {
  id: 1,
  name: "Sesión radio 01",
  description: "Selección para radio",
  playlistType: "radio",
  groupId: null,
  groupName: null,
  purpose: null,
  songCount: 2,
  totalDurationMs: 300_000,
  createdAt: "2026-06-12",
  updatedAt: "2026-06-12",
};

const details: PlaylistDetails = {
  playlist,
  songs: [
    {
      playlistId: 1,
      position: 1,
      addedAt: "2026-06-12",
      playlistNotes: null,
      id: 10,
      filePath: "C:\\Music\\uno.mp3",
      fileName: "uno.mp3",
      title: "Primera",
      artist: "Soundbender",
      album: "Suno",
      genre: "Electronic",
      durationMs: 120_000,
      audioFormat: "mp3",
      rating: 9,
      status: "selected",
      projectName: "Radio",
      versionLabel: "v1",
      tagNames: "Favorita",
      workflowNotes: null,
      nextAction: null,
      strongPart: "Coro",
      mainProblem: null,
      intendedUse: "Radio",
      mood: "Energético",
    },
    {
      playlistId: 1,
      position: 2,
      addedAt: "2026-06-12",
      playlistNotes: null,
      id: 11,
      filePath: "C:\\Music\\dos.mp3",
      fileName: "dos.mp3",
      title: "Segunda",
      artist: "Soundbender",
      album: "Suno",
      genre: "Cinematic",
      durationMs: 180_000,
      audioFormat: "mp3",
      rating: 8,
      status: "final",
      projectName: "Radio",
      versionLabel: "v2",
      tagNames: "Candidata",
      workflowNotes: null,
      nextAction: null,
      strongPart: "Voz",
      mainProblem: null,
      intendedUse: "Radio",
      mood: "Cósmico",
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPlaylists.mockResolvedValue([playlist]);
  mocks.getPlaylistGroups.mockResolvedValue([]);
  mocks.getDragIconPath.mockResolvedValue("C:\\App\\drag.png");
  mocks.copyPlaylistFiles.mockResolvedValue({
    requested: 2,
    copied: 2,
    missing: 0,
    failed: 0,
    destinationPath: "C:\\Export",
    items: [],
  });
  mocks.getPlaylist.mockResolvedValue(details);
  mocks.movePlaylistTrack.mockResolvedValue({
    ...details,
    songs: [details.songs[1], details.songs[0]],
  });
  mocks.reorderPlaylistTracks.mockResolvedValue({
    ...details,
    songs: [details.songs[1], details.songs[0]],
  });
  mocks.removeTracksFromPlaylist.mockResolvedValue({ requested: 1, changed: 1 });
  mocks.getTrack.mockResolvedValue({
    ...details.songs[0],
    fileExtension: "mp3",
    fileSize: 1,
    albumArtist: null,
    genre: null,
    year: null,
    trackNumber: null,
    trackTotal: null,
    discNumber: null,
    discTotal: null,
    comment: null,
    lyrics: null,
    bpm: null,
    musicalKey: null,
    bitrateKbps: null,
    sampleRateHz: null,
    channels: null,
    hasCoverArt: false,
    playCount: 0,
    projectId: null,
    reviewedAt: null,
    lastReviewedAt: null,
    skipCount: 0,
    generationModel: null,
    metadataReadError: null,
  });
});

afterEach(cleanup);

describe("PlaylistsView", () => {
  it("carga el tracklist, activa su orden y permite mover y reproducir", async () => {
    const view = render(<PlaylistsView onOpenTrack={vi.fn()} />);

    expect(await view.findByText("Primera")).toBeInTheDocument();
    expect(view.getByText("Segunda")).toBeInTheDocument();
    expect(mocks.setLibraryTracks).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 10 }),
        expect.objectContaining({ id: 11 }),
      ]),
      "playlist",
    );

    fireEvent.click(view.getAllByRole("button", { name: "Mover arriba" })[1]);
    await waitFor(() =>
      expect(mocks.movePlaylistTrack).toHaveBeenCalledWith(1, 11, "up"),
    );

    fireEvent.click(view.getByRole("button", { name: "Reproducir Primera" }));
    await waitFor(() =>
      expect(mocks.playTrack).toHaveBeenCalledWith(
        expect.objectContaining({ id: 10 }),
        "playlist_next",
        "playlist",
      ),
    );
  });

  it("crea una lista con nombre, tipo y descripción", async () => {
    const created = {
      ...playlist,
      id: 2,
      name: "Álbum provisional",
      playlistType: "album_draft" as const,
    };
    mocks.createPlaylist.mockResolvedValue(created);
    mocks.getPlaylists
      .mockResolvedValueOnce([playlist])
      .mockResolvedValueOnce([playlist, created]);
    mocks.getPlaylist.mockImplementation((id: number) =>
      Promise.resolve(id === 2 ? { playlist: created, songs: [] } : details),
    );
    const view = render(<PlaylistsView onOpenTrack={vi.fn()} />);
    await view.findByText("Primera");

    fireEvent.click(view.getByRole("button", { name: "Nueva lista" }));
    fireEvent.change(view.getByLabelText("Nombre de lista"), {
      target: { value: "Álbum provisional" },
    });
    fireEvent.change(view.getByLabelText("Tipo de lista"), {
      target: { value: "album_draft" },
    });
    fireEvent.change(view.getByLabelText("Comentario"), {
      target: { value: "Tracklist inicial" },
    });
    fireEvent.click(view.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(mocks.createPlaylist).toHaveBeenCalledWith({
        name: "Álbum provisional",
        description: "Tracklist inicial",
        playlistType: "album_draft",
        groupId: null,
        purpose: null,
      }),
    );
  });

  it("reordena filas mediante arrastrar y soltar", async () => {
    const view = render(<PlaylistsView onOpenTrack={vi.fn()} />);
    await view.findByText("Primera");
    const firstRow = view.getByText("Primera").closest("tr");
    const secondRow = view.getByText("Segunda").closest("tr");
    expect(firstRow).not.toBeNull();
    expect(secondRow).not.toBeNull();
    const dataTransfer = {
      effectAllowed: "",
      dropEffect: "",
      setData: vi.fn(),
    };

    fireEvent.dragStart(firstRow as HTMLElement, { dataTransfer });
    fireEvent.dragOver(secondRow as HTMLElement, { dataTransfer });
    fireEvent.drop(secondRow as HTMLElement, { dataTransfer });

    await waitFor(() =>
      expect(mocks.reorderPlaylistTracks).toHaveBeenCalledWith(1, [11, 10]),
    );
  });

  it("copia la selección respetando el orden visible de la lista", async () => {
    mocks.openDialog.mockResolvedValue("C:\\Export");
    const view = render(<PlaylistsView onOpenTrack={vi.fn()} />);
    await view.findByText("Primera");

    fireEvent.click(view.getByLabelText("Seleccionar Segunda"));
    fireEvent.click(view.getByLabelText("Seleccionar Primera"));
    fireEvent.click(
      view.getByRole("button", { name: "Copiar selección a carpeta" }),
    );

    await waitFor(() =>
      expect(mocks.copyPlaylistFiles).toHaveBeenCalledWith(
        [10, 11],
        "C:\\Export",
        true,
      ),
    );
  });
});
