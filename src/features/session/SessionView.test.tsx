// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  act,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrackDetails, TrackSummary } from "../../types/track";
import { SessionView } from "./SessionView";

const mocks = vi.hoisted(() => ({
  getLibraryTracks: vi.fn(),
  getTrack: vi.fn(),
  playTrack: vi.fn(),
  setLibraryTracks: vi.fn(),
  setSelectedTrack: vi.fn(),
  createProject: vi.fn(),
  createPlaylist: vi.fn(),
  addTracksToPlaylist: vi.fn(),
  updateTrackOrganization: vi.fn(),
  updateTrackRating: vi.fn(),
  saveCuration: vi.fn(),
  togglePlayback: vi.fn(),
  getPlaylists: vi.fn(),
  getPlaylist: vi.fn(),
  getLibraryFolders: vi.fn(),
  getOrganizationOptions: vi.fn(),
}));

vi.mock("../../lib/tauri", () => ({ api: mocks }));
vi.mock("../player/PlayerContext", () => ({
  usePlayer: () => ({
    state: {
      trackId: null,
      status: "stopped",
      positionMs: 0,
      durationMs: null,
      volume: 0.8,
    },
    currentTrack: null,
    selectedTrack: null,
    setLibraryTracks: mocks.setLibraryTracks,
    setSelectedTrack: mocks.setSelectedTrack,
    playTrack: mocks.playTrack,
    togglePlayback: mocks.togglePlayback,
    stop: vi.fn(),
    seek: vi.fn(),
    setVolume: vi.fn(),
  }),
}));

function summary(id: number, patch: Partial<TrackSummary> = {}): TrackSummary {
  return {
    id,
    filePath: `C:\\Music\\Main\\${id}.mp3`,
    fileName: `${id}.mp3`,
    title: `Tema ${id}`,
    artist: "Soundbender",
    album: "Suno",
    albumArtist: null,
    genre: "Electronic",
    year: null,
    trackNumber: null,
    durationMs: 180_000,
    audioFormat: "mp3",
    bpm: null,
    musicalKey: null,
    playCount: 0,
    rating: 8,
    status: "review",
    projectId: 1,
    projectName: "Proyecto",
    versionLabel: "v1",
    tagNames: "Favorita",
    workflowNotes: null,
    nextAction: null,
    strongPart: null,
    mainProblem: null,
    intendedUse: "Radio",
    mood: "Cósmico",
    generationModel: "Suno v4.5",
    reviewedAt: null,
    lastReviewedAt: null,
    skipCount: 0,
    metadataReadError: null,
    ...patch,
  };
}

function details(item: TrackSummary): TrackDetails {
  return {
    ...item,
    fileExtension: "mp3",
    fileSize: 1_024,
    albumArtist: null,
    trackTotal: null,
    discNumber: null,
    discTotal: null,
    comment: null,
    lyrics: null,
    bpm: null,
    musicalKey: null,
    bitrateKbps: 320,
    sampleRateHz: 44_100,
    channels: 2,
    hasCoverArt: false,
    playCount: 0,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  const items = [
    summary(1),
    summary(2),
    summary(3),
    summary(4, { projectId: 2, projectName: "Otro" }),
    summary(5, {
      filePath: "C:\\Music\\Divine\\5.mp3",
      title: "Manual Target",
      artist: "Luna Divine",
      album: "Celestial Waters",
      genre: "Psytrance",
      mood: "Cósmico",
      tagNames: "Radio",
      projectName: "Divine Sessions",
    }),
  ];
  mocks.getLibraryTracks.mockResolvedValue({ items, total: items.length });
  mocks.getLibraryFolders.mockResolvedValue([
    {
      path: "C:\\Music\\Main",
      name: "Main",
      trackCount: 4,
      isRoot: true,
    },
    {
      path: "C:\\Music\\Divine",
      name: "Divine",
      trackCount: 1,
      isRoot: false,
    },
  ]);
  mocks.getOrganizationOptions.mockResolvedValue({
    tags: [],
    projects: [
      { id: 1, name: "Proyecto", description: null, trackCount: 3 },
      { id: 2, name: "Otro", description: null, trackCount: 1 },
    ],
    versions: ["v1"],
    models: ["Suno v4.5", "Udio"],
    smartCollections: [],
  });
  mocks.getTrack.mockImplementation(async (id: number) =>
    details(items.find((item) => item.id === id) ?? summary(id)),
  );
  mocks.updateTrackRating.mockImplementation(async (id: number, rating: number | null) =>
    details({ ...(items.find((item) => item.id === id) ?? summary(id)), rating }),
  );
  mocks.updateTrackOrganization.mockResolvedValue({ updated: 1 });
  mocks.saveCuration.mockImplementation(async (request) =>
    details({
      ...(items.find((item) => item.id === request.trackId) ?? summary(request.trackId)),
      generationModel: request.generationModel,
    }),
  );
  mocks.createPlaylist.mockResolvedValue({
    id: 90,
    name: "Sesión guardada",
    description: null,
    playlistType: "session",
    songCount: 0,
    totalDurationMs: 0,
    createdAt: "2026-06-12",
    updatedAt: "2026-06-12",
  });
  mocks.createProject.mockResolvedValue({
    id: 3,
    name: "Nuevo Proyecto",
    description: null,
    trackCount: 0,
  });
  mocks.addTracksToPlaylist.mockResolvedValue({ requested: 4, changed: 4 });
  mocks.getPlaylists.mockResolvedValue([]);
  mocks.getPlaylist.mockResolvedValue({
    playlist: {
      id: 7,
      name: "Orden manual",
      description: null,
      playlistType: "manual",
      songCount: 3,
      totalDurationMs: 540_000,
      createdAt: "2026-06-14",
      updatedAt: "2026-06-14",
    },
    songs: [items[2], items[0], items[1]].map((item, index) => ({
      ...item,
      playlistId: 7,
      position: index + 1,
      addedAt: "2026-06-14",
      playlistNotes: null,
    })),
  });
});

afterEach(cleanup);

describe("SessionView", () => {
  it("muestra carpeta y criterio en el header sin workflow activo ni filtro duplicado", async () => {
    const view = render(<SessionView initialTrackId={1} onOpenTrack={vi.fn()} />);

    await view.findByRole("heading", { name: "Sugerencias afines" });

    expect(view.getByLabelText("Carpeta")).toBeInTheDocument();
    expect(view.getByLabelText("Criterio")).toBeInTheDocument();
    expect(view.queryByText("Workflow activo")).not.toBeInTheDocument();
    expect(
      view.queryByLabelText("Filtro de carpeta para sugerencias y búsqueda"),
    ).not.toBeInTheDocument();
  });

  it("filtra sugerencias por criterio", async () => {
    const items = [
      summary(1, { title: "Actual", status: "review" }),
      summary(2, { title: "Radio lista", status: "selected" }),
      summary(3, { title: "Pendiente normal", status: "review" }),
    ];
    mocks.getLibraryTracks.mockResolvedValue({ items, total: items.length });
    mocks.getTrack.mockImplementation(async (id: number) =>
      details(items.find((item) => item.id === id) ?? summary(id)),
    );

    const view = render(<SessionView initialTrackId={1} onOpenTrack={vi.fn()} />);
    await view.findByRole("heading", { name: "Sugerencias afines" });

    fireEvent.change(view.getByLabelText("Criterio"), {
      target: { value: "radio_ready" },
    });

    expect(
      await view.findByRole("article", { name: "Radio lista" }),
    ).toBeInTheDocument();
    expect(
      view.queryByRole("article", { name: "Pendiente normal" }),
    ).not.toBeInTheDocument();
  });

  it("filtra busqueda por criterio", async () => {
    const items = [
      summary(1, { title: "Actual", rating: 7 }),
      summary(2, { title: "Buscar sin rating", rating: null }),
      summary(3, { title: "Buscar con rating", rating: 8 }),
    ];
    mocks.getLibraryTracks.mockResolvedValue({ items, total: items.length });
    mocks.getTrack.mockImplementation(async (id: number) =>
      details(items.find((item) => item.id === id) ?? summary(id)),
    );

    const view = render(<SessionView initialTrackId={1} onOpenTrack={vi.fn()} />);
    await view.findByRole("heading", { name: "Sugerencias afines" });

    fireEvent.change(view.getByLabelText("Criterio"), {
      target: { value: "unrated" },
    });
    fireEvent.change(view.getByLabelText("Buscar canciones"), {
      target: { value: "buscar" },
    });

    expect(
      await view.findByRole("article", { name: "Buscar sin rating" }),
    ).toBeInTheDocument();
    expect(
      view.queryByRole("article", { name: "Buscar con rating" }),
    ).not.toBeInTheDocument();
  });

  it("coloca y guarda rating, estado, modelo y proyecto junto a la portada", async () => {
    const view = render(<SessionView initialTrackId={1} onOpenTrack={vi.fn()} />);
    const heading = await view.findByRole("heading", { name: "Tema 1 · v1" });
    const leftColumn = heading.closest("section") as HTMLElement;

    const cover = within(leftColumn).getByLabelText("Placeholder de portada de sesión");
    const rating = within(leftColumn).getByLabelText("Rating");
    const status = within(leftColumn).getByLabelText("Estado");
    const model = within(leftColumn).getByLabelText("Modelo");
    const project = within(leftColumn).getByLabelText("Proyecto");
    const playButton = within(leftColumn).getByRole("button", { name: "Reproducir" });

    expect(cover).toBeInTheDocument();
    expect(rating).toBeInTheDocument();
    expect(status).toBeInTheDocument();
    expect(model).toBeInTheDocument();
    expect(project).toBeInTheDocument();
    expect(within(leftColumn).getByText("▼")).toBeInTheDocument();
    expect(within(leftColumn).getByPlaceholderText("Crear proyecto")).toBeInTheDocument();
    expect(within(leftColumn).getAllByLabelText("Rating")).toHaveLength(1);
    expect(within(leftColumn).getAllByLabelText("Estado")).toHaveLength(1);
    expect(within(leftColumn).getAllByLabelText("Modelo")).toHaveLength(1);
    expect(within(leftColumn).getAllByLabelText("Proyecto")).toHaveLength(1);
    expect(
      Boolean(
        cover.compareDocumentPosition(rating) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
    expect(
      Boolean(
        project.compareDocumentPosition(heading) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
    expect(
      Boolean(
        heading.compareDocumentPosition(playButton) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);

    fireEvent.change(rating, { target: { value: "6" } });
    await waitFor(() => expect(mocks.updateTrackRating).toHaveBeenCalledWith(1, 6));

    fireEvent.change(status, { target: { value: "selected" } });
    await waitFor(() =>
      expect(mocks.updateTrackOrganization).toHaveBeenCalledWith([1], {
        status: { value: "selected" },
      }),
    );

    fireEvent.change(model, { target: { value: "Udio" } });
    fireEvent.blur(model);
    await waitFor(() =>
      expect(mocks.saveCuration).toHaveBeenCalledWith(
        expect.objectContaining({
          trackId: 1,
          generationModel: "Udio",
        }),
      ),
    );

    fireEvent.change(project, { target: { value: "2" } });
    await waitFor(() =>
      expect(mocks.updateTrackOrganization).toHaveBeenCalledWith([1], {
        projectId: { value: 2 },
      }),
    );

    fireEvent.change(within(leftColumn).getByPlaceholderText("Crear proyecto"), {
      target: { value: "Nuevo Proyecto" },
    });
    fireEvent.click(within(leftColumn).getByRole("button", { name: "Crear proyecto" }));
    await waitFor(() =>
      expect(mocks.createProject).toHaveBeenCalledWith("Nuevo Proyecto"),
    );
    await waitFor(() =>
      expect(mocks.updateTrackOrganization).toHaveBeenCalledWith([1], {
        projectId: { value: 3 },
      }),
    );
  });

  it("respeta el orden de entrada de una playlist y reproduce su primera canción", async () => {
    render(
      <SessionView
        initialTrackId={3}
        initialQueueIds={[3, 1, 2]}
        onOpenTrack={vi.fn()}
      />,
    );

    await waitFor(() => expect(mocks.playTrack).toHaveBeenCalled());
    expect(mocks.playTrack.mock.calls[0][0].id).toBe(3);
    await waitFor(() =>
      expect(
        mocks.setLibraryTracks.mock.calls.some(
          ([items, context]) =>
            context === "session" &&
            items.length === 3 &&
            items[0]?.id === 3 &&
            items[1]?.id === 1 &&
            items[2]?.id === 2,
        ),
      ).toBe(true),
    );
    const orderedCall = mocks.setLibraryTracks.mock.calls.find(
      ([items, context]) => context === "session" && items.length === 3,
    );
    expect(orderedCall?.[0].map((item: TrackSummary) => item.id)).toEqual([
      3, 1, 2,
    ]);
  });

  it("añade y retira sugerencias de la cola", async () => {
    const view = render(
      <SessionView initialTrackId={1} onOpenTrack={vi.fn()} />,
    );

    const addButtons = await view.findAllByRole("button", {
      name: "Añadir a cola",
    });
    const suggestion = await view.findByRole("article", { name: "Tema 2" });
    expect(within(suggestion).getByText("8 / 10")).toBeInTheDocument();
    expect(within(suggestion).getByText("Sin revisar")).toBeInTheDocument();
    expect(within(suggestion).getByText("Electronic")).toBeInTheDocument();
    expect(within(suggestion).getByText(/smico/)).toBeInTheDocument();
    expect(within(suggestion).getByText("3:00")).toBeInTheDocument();
    fireEvent.click(addButtons[0]);
    expect(
      await view.findByRole("button", { name: /Quitar de la cola Tema \d/ }),
    ).toBeInTheDocument();
    fireEvent.click(
      view.getByRole("button", { name: /Quitar de la cola Tema \d/ }),
    );
    await waitFor(() =>
      expect(
        view.queryByRole("button", { name: /Quitar de la cola Tema \d/ }),
      ).not.toBeInTheDocument(),
    );
  });

  it("guarda pista actual y cola como playlist de tipo session", async () => {
    const view = render(
      <SessionView
        initialTrackId={3}
        initialQueueIds={[3, 1, 2]}
        onOpenTrack={vi.fn()}
      />,
    );

    fireEvent.click(
      await view.findByRole("button", { name: "Guardar cola como lista" }),
    );
    fireEvent.change(view.getByLabelText("Nombre de lista"), {
      target: { value: "Sesión nocturna" },
    });
    fireEvent.click(view.getByRole("button", { name: "Guardar sesión" }));

    await waitFor(() =>
      expect(mocks.createPlaylist).toHaveBeenCalledWith({
        name: "Sesión nocturna",
        description: "Cola guardada desde Modo Sesión.",
        playlistType: "session",
      }),
    );
    expect(mocks.addTracksToPlaylist).toHaveBeenCalledWith(90, [3, 1, 2]);
  });

  it("carga una lista existente como cola activa respetando su orden", async () => {
    mocks.getPlaylists.mockResolvedValue([
      {
        id: 7,
        name: "Orden manual",
        description: null,
        playlistType: "manual",
        songCount: 3,
        totalDurationMs: 540_000,
        createdAt: "2026-06-14",
        updatedAt: "2026-06-14",
      },
    ]);
    const view = render(<SessionView initialTrackId={1} onOpenTrack={vi.fn()} />);
    await view.findByText("Tema 1 · v1");

    fireEvent.click(await view.findByRole("button", { name: "Cargar lista" }));

    await waitFor(() => expect(mocks.getPlaylist).toHaveBeenCalledWith(7));
    await waitFor(() =>
      expect(mocks.playTrack).toHaveBeenLastCalledWith(
        expect.objectContaining({ id: 3 }),
        "session_playlist_loaded",
      ),
    );
    expect(await view.findByText("Lista activa: Orden manual")).toBeInTheDocument();
    expect(await view.findByText("canción 1 de 3")).toBeInTheDocument();
    const orderedCall = mocks.setLibraryTracks.mock.calls
      .map(([tracks]) => tracks)
      .find(
        (tracks: TrackSummary[]) =>
          tracks.length === 3 && tracks[0]?.id === 3,
      );
    expect(orderedCall.map((item: TrackSummary) => item.id)).toEqual([3, 1, 2]);
    const sessionCall = mocks.setLibraryTracks.mock.calls.find(
      ([tracks, context]) =>
        context === "session" &&
        tracks.length === 3 &&
        tracks[0]?.id === 3,
    );
    expect(sessionCall?.[1]).toBe("session");
    expect(sessionCall?.[2]).toMatchObject({
      next: expect.any(Function),
      previous: expect.any(Function),
      ended: expect.any(Function),
    });

    mocks.playTrack.mockClear();
    await act(async () => {
      fireEvent.click(view.getByRole("button", { name: "Siguiente" }));
    });
    await waitFor(() =>
      expect(mocks.playTrack).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1 }),
        "session_queue_next",
      ),
    );

    mocks.playTrack.mockClear();
    await act(async () => {
      fireEvent.click(view.getByRole("button", { name: "Anterior" }));
    });
    await waitFor(() =>
      expect(mocks.playTrack).toHaveBeenCalledWith(
        expect.objectContaining({ id: 3 }),
        "session_queue_previous",
      ),
    );
  });

  it("muestra estado vacio cuando la playlist no tiene canciones", async () => {
    mocks.getPlaylists.mockResolvedValue([
      {
        id: 8,
        name: "Lista vacia",
        description: null,
        playlistType: "manual",
        songCount: 0,
        totalDurationMs: 0,
        createdAt: "2026-06-14",
        updatedAt: "2026-06-14",
      },
    ]);
    mocks.getPlaylist.mockResolvedValue({
      playlist: {
        id: 8,
        name: "Lista vacia",
        description: null,
        playlistType: "manual",
        songCount: 0,
        totalDurationMs: 0,
        createdAt: "2026-06-14",
        updatedAt: "2026-06-14",
      },
      songs: [],
    });
    const view = render(<SessionView initialTrackId={1} onOpenTrack={vi.fn()} />);
    await view.findByText("Tema 1 · v1");

    fireEvent.click(await view.findByRole("button", { name: "Cargar lista" }));

    await waitFor(() => expect(mocks.getPlaylist).toHaveBeenCalledWith(8));
    expect(await view.findByText("Esta lista no tiene canciones.")).toBeInTheDocument();
  });

  it("busca, añade a cola, reproduce, abre lista y vuelve a sugerencias al limpiar", async () => {
    const onOpenTrack = vi.fn();
    const view = render(
      <SessionView initialTrackId={1} onOpenTrack={onOpenTrack} />,
    );
    await view.findByRole("heading", { name: "Sugerencias afines" });

    fireEvent.change(view.getByLabelText("Campo de búsqueda"), {
      target: { value: "title" },
    });
    fireEvent.change(view.getByLabelText("Buscar canciones"), {
      target: { value: "manual tar" },
    });

    expect(
      await view.findByRole("heading", { name: "Resultados de búsqueda" }),
    ).toBeInTheDocument();
    const result = view.getByRole("article", { name: "Manual Target" });
    expect(within(result).getByText("8 / 10")).toBeInTheDocument();
    expect(within(result).getByText("Sin revisar")).toBeInTheDocument();
    expect(within(result).getByText("Psytrance")).toBeInTheDocument();
    expect(within(result).getByText(/smico/)).toBeInTheDocument();
    expect(within(result).getByText("3:00")).toBeInTheDocument();
    expect(within(result).getByText("Luna Divine · Celestial Waters · Divine Sessions")).toBeInTheDocument();

    fireEvent.click(within(result).getByRole("button", { name: "Añadir a cola" }));
    expect(
      await view.findByRole("button", {
        name: "Quitar de la cola Manual Target",
      }),
    ).toBeInTheDocument();

    mocks.playTrack.mockClear();
    fireEvent.click(
      within(result).getByRole("button", { name: "Reproducir ahora" }),
    );
    await waitFor(() =>
      expect(mocks.playTrack).toHaveBeenCalledWith(
        expect.objectContaining({ id: 5 }),
        "user_click",
      ),
    );

    fireEvent.click(
      within(result).getByRole("button", { name: "Añadir a lista" }),
    );
    expect(
      await view.findByRole("dialog", { name: "Añadir a lista" }),
    ).toBeInTheDocument();
    fireEvent.click(view.getByRole("button", { name: "Cerrar" }));

    fireEvent.click(
      within(result).getByRole("button", { name: "Organización" }),
    );
    expect(onOpenTrack).toHaveBeenCalledWith("organization", 5);

    fireEvent.click(view.getByRole("button", { name: "Limpiar búsqueda" }));
    expect(
      await view.findByRole("heading", { name: "Sugerencias afines" }),
    ).toBeInTheDocument();
  });

  it("usa atajos para avanzar en cola y anadir sugerencia enfocada", async () => {
    const view = render(
      <SessionView initialTrackId={1} initialQueueIds={[1, 2]} onOpenTrack={vi.fn()} />,
    );
    await view.findByRole("heading", { name: "Sugerencias afines" });

    mocks.playTrack.mockClear();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    await waitFor(() =>
      expect(mocks.playTrack).toHaveBeenCalledWith(
        expect.objectContaining({ id: 2 }),
        "session_queue_next",
      ),
    );

    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "q" });
    expect(
      (await view.findAllByRole("button", { name: /Quitar de la cola/ })).length,
    ).toBeGreaterThan(0);
  });

  it("no dispara atajos de sesion al escribir en busqueda", async () => {
    const view = render(
      <SessionView initialTrackId={1} onOpenTrack={vi.fn()} />,
    );
    await view.findByRole("heading", { name: "Sugerencias afines" });
    const search = view.getByLabelText("Buscar canciones");

    fireEvent.keyDown(search, { key: "r" });

    expect(mocks.updateTrackOrganization).not.toHaveBeenCalledWith([1], {
      status: { value: "selected" },
    });
  });

  it("limita sugerencias y busqueda por la carpeta seleccionada", async () => {
    const view = render(
      <SessionView initialTrackId={1} onOpenTrack={vi.fn()} />,
    );
    await view.findByRole("heading", { name: "Sugerencias afines" });

    fireEvent.change(await view.findByLabelText("Carpeta"), {
      target: { value: "C:\\Music\\Divine" },
    });

    await waitFor(() =>
      expect(
        view.getByRole("article", { name: "Manual Target" }),
      ).toBeInTheDocument(),
    );
    expect(view.queryByRole("article", { name: "Tema 2" })).not.toBeInTheDocument();

    fireEvent.change(view.getByLabelText("Campo de búsqueda"), {
      target: { value: "title" },
    });
    fireEvent.change(view.getByLabelText("Buscar canciones"), {
      target: { value: "manual" },
    });
    expect(
      await view.findByRole("article", { name: "Manual Target" }),
    ).toBeInTheDocument();

    fireEvent.change(view.getByLabelText("Carpeta"), {
      target: { value: "C:\\Music\\Main" },
    });
    await waitFor(() =>
      expect(
        view.queryByRole("article", { name: "Manual Target" }),
      ).not.toBeInTheDocument(),
    );
    expect(
      await view.findByText("No hay canciones que coincidan con esta búsqueda."),
    ).toBeInTheDocument();
  });
});
