// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrackDetails, TrackSummary } from "../../types/track";
import type { ShortcutRule } from "../settings/settings";
import { LibraryView } from "./LibraryView";

const mocks = vi.hoisted(() => ({
  getLibraryTracks: vi.fn(),
  getLibraryFolders: vi.fn(),
  getDragIconPath: vi.fn(),
  getTrack: vi.fn(),
  readAudioMetadata: vi.fn(),
  updateTrackRating: vi.fn(),
  updateTrackOrganization: vi.fn(),
  updateTrackMetadata: vi.fn(),
  removeTracksFromLibrary: vi.fn(),
  clearLibrary: vi.fn(),
  setLibraryTracks: vi.fn(),
  setSelectedTrack: vi.fn(),
  forgetTracks: vi.fn(),
  playTrack: vi.fn(),
  togglePlayback: vi.fn(),
  playNext: vi.fn(),
  playPrevious: vi.fn(),
  stop: vi.fn(),
}));

const settingsMock = vi.hoisted(() => ({
  settings: {
    interfaceLanguage: "es",
    keyboardShortcutsEnabled: true,
    customKeyboardShortcuts: [] as ShortcutRule[],
    library: {
      visibleLimit: 1000,
      visibleColumns: [
        "title",
        "artist",
        "album",
        "rating",
        "status",
        "project",
        "version",
        "duration",
        "path",
      ],
      columnOrder: [
        "title",
        "artist",
        "album",
        "rating",
        "status",
        "project",
        "version",
        "duration",
        "path",
      ],
      rememberFilters: false,
      rememberScanFolder: false,
      lastScanFolder: "",
    },
    layout: {
      sidebarMode: "expanded",
      inspectorVisible: true,
      focusMode: false,
      explorerRightPanelZoom: 1,
      libraryInspectorZoom: 1,
    },
    metadata: {
      confirmBulkEdit: true,
      warnBeforeWrite: true,
    },
    playlists: {
      filterListOrder: "current",
    },
    player: {
      libraryEndAction: "stop",
      avoidLibraryRepeats: true,
      doubleClickPlay: true,
    },
    fieldVisibility: undefined,
  },
}));

const playerStateMock = vi.hoisted(() => ({
  currentTrack: null as TrackDetails | null,
  state: {
    trackId: null as number | null,
    status: "stopped" as "stopped" | "playing" | "paused" | "ended",
    positionMs: 0,
    durationMs: null as number | null,
    volume: 0.8,
  },
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("@crabnebula/tauri-plugin-drag", () => ({ startDrag: vi.fn() }));
vi.mock("../../lib/tauri", () => ({
  api: {
    getLibraryTracks: mocks.getLibraryTracks,
    getLibraryFolders: mocks.getLibraryFolders,
    getDragIconPath: mocks.getDragIconPath,
    getTrack: mocks.getTrack,
    readAudioMetadata: mocks.readAudioMetadata,
    updateTrackRating: mocks.updateTrackRating,
    updateTrackOrganization: mocks.updateTrackOrganization,
    updateTrackMetadata: mocks.updateTrackMetadata,
    removeTracksFromLibrary: mocks.removeTracksFromLibrary,
    clearLibrary: mocks.clearLibrary,
  },
}));
vi.mock("../player/PlayerContext", () => ({
  usePlayer: () => ({
    state: playerStateMock.state,
    currentTrack: playerStateMock.currentTrack,
    setLibraryTracks: mocks.setLibraryTracks,
    setSelectedTrack: mocks.setSelectedTrack,
    forgetTracks: mocks.forgetTracks,
    playTrack: mocks.playTrack,
    togglePlayback: mocks.togglePlayback,
    playNext: mocks.playNext,
    playPrevious: mocks.playPrevious,
    stop: mocks.stop,
  }),
}));
vi.mock("../settings/SettingsContext", () => ({
  useSettings: () => ({
    settings: settingsMock.settings,
    updateSettings: (update: typeof settingsMock.settings | ((current: typeof settingsMock.settings) => typeof settingsMock.settings)) => {
      settingsMock.settings =
        typeof update === "function" ? update(settingsMock.settings) : update;
    },
  }),
}));

function summary(id: number): TrackSummary {
  return {
    id,
    filePath: `C:\\Music\\${id}.mp3`,
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

function details(track: TrackSummary): TrackDetails {
  return {
    ...track,
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
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  settingsMock.settings.interfaceLanguage = "es";
  settingsMock.settings.keyboardShortcutsEnabled = true;
  settingsMock.settings.customKeyboardShortcuts = [];
  playerStateMock.currentTrack = null;
  playerStateMock.state.trackId = null;
  playerStateMock.state.status = "stopped";
  playerStateMock.state.positionMs = 0;
  playerStateMock.state.durationMs = null;
  playerStateMock.state.volume = 0.8;
  settingsMock.settings.library.visibleLimit = 1000;
  settingsMock.settings.layout.libraryInspectorZoom = 1;
  settingsMock.settings.layout.explorerRightPanelZoom = 1;
  const items = [summary(1), summary(2)];
  mocks.getLibraryTracks.mockResolvedValue({ items, total: items.length });
  mocks.getLibraryFolders.mockResolvedValue([]);
  mocks.getDragIconPath.mockResolvedValue("C:\\icon.png");
  mocks.getTrack.mockImplementation(async (id: number) =>
    details(items.find((item) => item.id === id) ?? summary(id)),
  );
  mocks.readAudioMetadata.mockResolvedValue({
    format: null,
    native: {},
    coverArt: null,
    extendedTags: [],
  });
  mocks.updateTrackRating.mockImplementation(async (id: number, rating: number | null) =>
    details({ ...(items.find((item) => item.id === id) ?? summary(id)), rating }),
  );
  mocks.updateTrackOrganization.mockResolvedValue({ updated: 1 });
  mocks.updateTrackMetadata.mockResolvedValue({
    total: 0,
    succeeded: 0,
    failed: 0,
    items: [],
  });
  mocks.removeTracksFromLibrary.mockResolvedValue({ removed: 1 });
  mocks.clearLibrary.mockResolvedValue({ removed: 2 });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("LibraryView keyboard shortcuts", () => {
  it("renderiza la cabecera en tres zonas compactas con acciones principales y busqueda global", async () => {
    const view = render(
      <LibraryView
        onOpenSession={vi.fn()}
        onStartReviewing={vi.fn()}
      />,
    );

    await view.findByText("Tema 1");

    expect(view.getByTestId("library-header-primary")).toBeInTheDocument();
    expect(view.getByTestId("library-header-secondary")).toBeInTheDocument();
    expect(view.getByTestId("library-header-search")).toBeInTheDocument();
    expect(
      view.getByPlaceholderText("Buscar en todos los campos y tags..."),
    ).toBeInTheDocument();
    expect(view.getByRole("button", { name: "Quitar canción" })).toBeDisabled();
    expect(
      view.getByRole("button", { name: "Abrir canción en Explorador" }),
    ).toBeDisabled();
    expect(view.getByRole("button", { name: "Quitar canción" })).toHaveAttribute(
      "title",
      "Selecciona una o varias canciones primero.",
    );
  });

  it("pide confirmacion antes de quitar una cancion y cancelar no elimina nada", async () => {
    const view = render(<LibraryView />);
    fireEvent.click(await view.findByText("Tema 1"));

    await waitFor(() =>
      expect(view.getByRole("button", { name: "Quitar canción" })).not.toBeDisabled(),
    );
    fireEvent.click(view.getByRole("button", { name: "Quitar canción" }));

    const dialog = view.getByRole("dialog", {
      name: "¿Quitar esta canción de TagDeck?",
    });
    expect(
      within(dialog).getByText(/El archivo de audio no se borrará del disco/),
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    expect(mocks.removeTracksFromLibrary).not.toHaveBeenCalled();
    expect(view.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("confirma quitar una cancion solo de la biblioteca SQLite", async () => {
    const view = render(<LibraryView />);
    fireEvent.click(await view.findByText("Tema 1"));

    await waitFor(() =>
      expect(view.getByRole("button", { name: "Quitar canción" })).not.toBeDisabled(),
    );
    fireEvent.click(view.getByRole("button", { name: "Quitar canción" }));
    fireEvent.click(view.getByRole("button", { name: "Quitar de la biblioteca" }));

    await waitFor(() => expect(mocks.removeTracksFromLibrary).toHaveBeenCalledWith([1]));
    expect(mocks.updateTrackMetadata).not.toHaveBeenCalled();
    expect(mocks.clearLibrary).not.toHaveBeenCalled();
  });

  it("muestra contador correcto al quitar varias canciones seleccionadas", async () => {
    const view = render(<LibraryView />);
    await view.findByText("Tema 1");

    fireEvent.click(view.getByLabelText("Seleccionar Tema 1"));
    fireEvent.click(view.getByLabelText("Seleccionar Tema 2"));
    fireEvent.click(view.getByRole("button", { name: "Quitar 2" }));

    const dialog = view.getByRole("dialog", {
      name: "¿Quitar 2 canciones de TagDeck?",
    });
    expect(
      within(dialog).getByText(/Los archivos de audio no se borrarán del disco/),
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    expect(mocks.removeTracksFromLibrary).not.toHaveBeenCalled();
  });

  it("exige escribir VACIAR antes de vaciar la biblioteca", async () => {
    const view = render(<LibraryView />);
    await view.findByText("Tema 1");

    fireEvent.click(view.getByRole("button", { name: "Vaciar biblioteca" }));

    const dialog = view.getByRole("dialog", {
      name: "¿Vaciar la biblioteca de TagDeck?",
    });
    const confirmButton = within(dialog).getByRole("button", {
      name: "Vaciar biblioteca",
    });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText("Escribe VACIAR para confirmar."), {
      target: { value: "EMPTY" },
    });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText("Escribe VACIAR para confirmar."), {
      target: { value: "VACIAR" },
    });
    expect(confirmButton).not.toBeDisabled();

    fireEvent.click(confirmButton);

    await waitFor(() => expect(mocks.clearLibrary).toHaveBeenCalledTimes(1));
    expect(mocks.removeTracksFromLibrary).not.toHaveBeenCalled();
    expect(await view.findByText("Biblioteca vaciada. Los archivos de audio no se borraron.")).toBeInTheDocument();
  });

  it("usa EMPTY como palabra fuerte cuando la interfaz esta en ingles", async () => {
    settingsMock.settings.interfaceLanguage = "en";
    const view = render(<LibraryView />);
    await view.findByText("Tema 1");

    fireEvent.click(view.getByRole("button", { name: "Empty library" }));

    const dialog = view.getByRole("dialog", {
      name: "Empty TagDeck library?",
    });
    const confirmButton = within(dialog).getByRole("button", {
      name: "Empty library",
    });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText("Type EMPTY to confirm."), {
      target: { value: "EMPTY" },
    });
    expect(confirmButton).not.toBeDisabled();
  });

  it("abre la cancion seleccionada en Modo Explorador", async () => {
    const onOpenExplorerTrack = vi.fn();
    const view = render(<LibraryView onOpenExplorerTrack={onOpenExplorerTrack} />);
    fireEvent.click(await view.findByText("Tema 1"));

    await waitFor(() =>
      expect(
        view.getByRole("button", { name: "Quitar canción" }),
      ).not.toBeDisabled(),
    );
    fireEvent.click(view.getByRole("button", { name: "Abrir canción en Explorador" }));

    expect(onOpenExplorerTrack).toHaveBeenCalledWith(1, [1]);
  });

  it("abre en Explorador la cancion seleccionada aunque haya otra reproduciendose", async () => {
    playerStateMock.state.trackId = 2;
    playerStateMock.state.status = "playing";
    const onOpenExplorerTrack = vi.fn();
    const view = render(<LibraryView onOpenExplorerTrack={onOpenExplorerTrack} />);
    fireEvent.click(await view.findByText("Tema 1"));

    await waitFor(() => expect(mocks.getTrack).toHaveBeenCalledWith(1));
    fireEvent.click(view.getByRole("button", { name: "Abrir canción en Explorador" }));

    expect(onOpenExplorerTrack).toHaveBeenCalledWith(1, [1]);
  });

  it("abre en Explorador la seleccion de la tabla en orden visible", async () => {
    playerStateMock.currentTrack = details(summary(2));
    const onOpenExplorerTrack = vi.fn();
    const view = render(<LibraryView onOpenExplorerTrack={onOpenExplorerTrack} />);
    await view.findByText("Tema 1");
    fireEvent.click(view.getAllByRole("checkbox")[0]);

    await waitFor(() =>
      expect(
        view.getByRole("button", { name: /Abrir.*Explorador/ }),
      ).not.toBeDisabled(),
    );
    fireEvent.click(view.getByRole("button", { name: /Abrir.*Explorador/ }));

    expect(onOpenExplorerTrack).toHaveBeenCalledWith(1, [1, 2]);
  });

  it("carga detalles completos por id y muestra filename cuando no hay title tag", async () => {
    const item = {
      ...summary(1312),
      filePath: "C:\\Music\\1312.mp3",
      fileName: "1312.mp3",
      title: null,
    };
    mocks.getLibraryTracks.mockResolvedValue({ items: [item], total: 1 });
    mocks.getTrack.mockResolvedValue(details(item));
    mocks.readAudioMetadata.mockResolvedValue({
      title: null,
      artist: null,
      album: null,
      albumArtist: null,
      genre: null,
      year: null,
      trackNumber: null,
      trackTotal: null,
      discNumber: null,
      discTotal: null,
      comment: null,
      lyrics: null,
      unsyncedLyrics: null,
      bpm: null,
      musicalKey: null,
      durationMs: 180_000,
      bitrateKbps: 320,
      sampleRateHz: 44_100,
      channels: 2,
      audioFormat: "mp3",
      hasCoverArt: false,
      extendedTags: [],
    });

    const view = render(<LibraryView />);
    fireEvent.click(await view.findByText("1312.mp3"));

    await waitFor(() => expect(mocks.getTrack).toHaveBeenCalledWith(1312));
    await waitFor(() =>
      expect(mocks.readAudioMetadata).toHaveBeenCalledWith("C:\\Music\\1312.mp3"),
    );
    expect(await view.findByRole("heading", { name: "1312.mp3" })).toBeInTheDocument();
    expect(view.getByText("Tag de título")).toBeInTheDocument();
    expect(view.getByRole("button", { name: "Sin título embebido" })).toBeInTheDocument();
    expect(view.getByText("Nombre de archivo")).toBeInTheDocument();
  });

  it("autonumera versiones seleccionadas sin escribir metadata real", async () => {
    const view = render(<LibraryView />);
    await view.findByText("Tema 1");

    expect(
      view.queryByRole("button", { name: "Autonumerar versiones" }),
    ).not.toBeInTheDocument();

    fireEvent.click(view.getByLabelText("Seleccionar Tema 1"));
    fireEvent.click(view.getByLabelText("Seleccionar Tema 2"));

    fireEvent.click(view.getByRole("button", { name: "Autonumerar versiones" }));

    expect(view.getByRole("heading", { name: "Autonumerar versiones" })).toBeInTheDocument();
    expect(view.getByText("1.mp3")).toBeInTheDocument();
    expect(view.getByText("v1")).toBeInTheDocument();
    expect(view.getByText("v2")).toBeInTheDocument();

    fireEvent.click(view.getByRole("button", { name: "Aplicar" }));

    await waitFor(() =>
      expect(mocks.updateTrackOrganization).toHaveBeenCalledWith([1], {
        versionLabel: { value: "v1" },
      }),
    );
    expect(mocks.updateTrackOrganization).toHaveBeenCalledWith([2], {
      versionLabel: { value: "v2" },
    });
    expect(mocks.updateTrackMetadata).not.toHaveBeenCalled();
  });

  it("selecciona un rango hacia abajo con Shift+click y conserva selecciones previas", async () => {
    const items = Array.from({ length: 5 }, (_, index) => summary(index + 1));
    mocks.getLibraryTracks.mockResolvedValue({ items, total: items.length });
    mocks.getTrack.mockImplementation(async (id: number) =>
      details(items.find((item) => item.id === id) ?? summary(id)),
    );
    const view = render(<LibraryView />);
    await view.findByText("Tema 1");

    fireEvent.click(view.getByLabelText("Seleccionar Tema 1"));
    fireEvent.click(view.getByLabelText("Seleccionar Tema 3"));
    fireEvent.focus(view.getByLabelText("Seleccionar Tema 5"));
    fireEvent.click(view.getByLabelText("Seleccionar Tema 5"), {
      shiftKey: true,
    });

    expect(view.getByLabelText("Seleccionar Tema 1")).toBeChecked();
    expect(view.getByLabelText("Seleccionar Tema 2")).not.toBeChecked();
    expect(view.getByLabelText("Seleccionar Tema 3")).toBeChecked();
    expect(view.getByLabelText("Seleccionar Tema 4")).toBeChecked();
    expect(view.getByLabelText("Seleccionar Tema 5")).toBeChecked();

    fireEvent.click(await view.findByRole("button", { name: "Autonumerar versiones" }));
    fireEvent.click(view.getByRole("button", { name: "Aplicar" }));

    await waitFor(() =>
      expect(mocks.updateTrackOrganization).toHaveBeenCalledWith([1], {
        versionLabel: { value: "v1" },
      }),
    );
    expect(mocks.updateTrackOrganization).toHaveBeenCalledWith([3], {
      versionLabel: { value: "v2" },
    });
    expect(mocks.updateTrackOrganization).toHaveBeenCalledWith([4], {
      versionLabel: { value: "v3" },
    });
    expect(mocks.updateTrackOrganization).toHaveBeenCalledWith([5], {
      versionLabel: { value: "v4" },
    });
  });

  it("selecciona un rango hacia arriba respetando el orden visible actual", async () => {
    const items = [summary(5), summary(3), summary(1)];
    mocks.getLibraryTracks.mockResolvedValue({ items, total: items.length });
    mocks.getTrack.mockImplementation(async (id: number) =>
      details(items.find((item) => item.id === id) ?? summary(id)),
    );
    const view = render(<LibraryView />);
    await view.findByText("Tema 5");

    fireEvent.click(view.getByLabelText("Seleccionar Tema 5"));
    fireEvent.focus(view.getByLabelText("Seleccionar Tema 1"));
    fireEvent.click(view.getByLabelText("Seleccionar Tema 1"), {
      shiftKey: true,
    });

    expect(view.getByLabelText("Seleccionar Tema 5")).toBeChecked();
    expect(view.getByLabelText("Seleccionar Tema 3")).toBeChecked();
    expect(view.getByLabelText("Seleccionar Tema 1")).toBeChecked();

    fireEvent.click(await view.findByRole("button", { name: "Autonumerar versiones" }));
    fireEvent.click(view.getByRole("button", { name: "Aplicar" }));

    await waitFor(() =>
      expect(mocks.updateTrackOrganization).toHaveBeenCalledWith([5], {
        versionLabel: { value: "v1" },
      }),
    );
    expect(mocks.updateTrackOrganization).toHaveBeenCalledWith([3], {
      versionLabel: { value: "v2" },
    });
    expect(mocks.updateTrackOrganization).toHaveBeenCalledWith([1], {
      versionLabel: { value: "v3" },
    });
  });

  it("solicita hasta 5000 canciones visibles cuando el ajuste lo permite", async () => {
    settingsMock.settings.library.visibleLimit = 5000;

    render(<LibraryView />);

    await waitFor(() =>
      expect(mocks.getLibraryTracks).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 5000 }),
      ),
    );
  });

  it("debouncea la busqueda antes de pedir datos al backend", async () => {
    const view = render(<LibraryView />);
    const search = await view.findByPlaceholderText(/Buscar/);
    mocks.getLibraryTracks.mockClear();

    vi.useFakeTimers();
    fireEvent.change(search, { target: { value: "trance cosmico" } });

    expect(mocks.getLibraryTracks).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(mocks.getLibraryTracks).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    vi.useRealTimers();
    await waitFor(() =>
      expect(mocks.getLibraryTracks).toHaveBeenCalledWith(
        expect.objectContaining({ search: "trance cosmico" }),
      ),
    );
  });

  it("virtualiza la tabla para no montar todas las filas visibles en DOM", async () => {
    const manyItems = Array.from({ length: 500 }, (_, index) => summary(index + 1));
    mocks.getLibraryTracks.mockResolvedValue({ items: manyItems, total: manyItems.length });

    const view = render(<LibraryView />);

    await view.findByText("Tema 1");

    expect(view.queryByText("Tema 400")).not.toBeInTheDocument();
    expect(view.getByTestId("library-virtualized-table")).toBeInTheDocument();
  });

  it("asigna rating con una tecla a la cancion seleccionada", async () => {
    const view = render(<LibraryView />);
    const title = await view.findByText("Tema 1");
    fireEvent.click(title);
    await waitFor(() =>
      expect(mocks.setSelectedTrack).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1 }),
      ),
    );

    fireEvent.keyDown(window, { key: "7" });

    await waitFor(() => expect(mocks.updateTrackRating).toHaveBeenCalledWith(1, 7));
  });

  it("asigna rating 10 con la tecla 0 a la fila activa", async () => {
    const view = render(<LibraryView />);
    fireEvent.click(await view.findByText("Tema 1"));
    await waitFor(() =>
      expect(mocks.setSelectedTrack).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1 }),
      ),
    );

    fireEvent.keyDown(window, { key: "0" });

    await waitFor(() => expect(mocks.updateTrackRating).toHaveBeenCalledWith(1, 10));
    expect(await view.findByText("Rating 10 aplicado a 1 canciones.")).toBeInTheDocument();
  });

  it("asigna rating rapido a todas las canciones marcadas", async () => {
    const view = render(<LibraryView />);
    await waitFor(() => expect(mocks.getLibraryTracks).toHaveBeenCalled());

    fireEvent.click(await view.findByLabelText("Seleccionar Tema 1"));
    fireEvent.click(await view.findByLabelText("Seleccionar Tema 2"));
    fireEvent.keyDown(window, { key: "6" });

    await waitFor(() => expect(mocks.updateTrackRating).toHaveBeenCalledWith(1, 6));
    expect(mocks.updateTrackRating).toHaveBeenCalledWith(2, 6);
  });

  it("mueve la fila activa con flechas y reproduce con Enter", async () => {
    const view = render(<LibraryView />);
    fireEvent.click(await view.findByText("Tema 1"));
    await waitFor(() =>
      expect(mocks.setSelectedTrack).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1 }),
      ),
    );
    await waitFor(() => expect(mocks.getTrack).toHaveBeenCalledWith(1));
    mocks.setSelectedTrack.mockClear();

    fireEvent.keyDown(window, { key: "ArrowDown" });
    await waitFor(() =>
      expect(mocks.setSelectedTrack).toHaveBeenCalledWith(
        expect.objectContaining({ id: 2 }),
      ),
    );

    fireEvent.keyDown(window, { key: "Enter" });
    await waitFor(() =>
      expect(mocks.playTrack).toHaveBeenCalledWith(
        expect.objectContaining({ id: 2 }),
        "user_click",
        "library",
      ),
    );

    fireEvent.keyDown(window, { key: "ArrowUp" });
    await waitFor(() =>
      expect(mocks.setSelectedTrack).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1 }),
      ),
    );
  });

  it("Ctrl+A selecciona las canciones visibles y Esc limpia la seleccion marcada", async () => {
    const view = render(<LibraryView />);
    await view.findByText("Tema 1");

    fireEvent.keyDown(window, { key: "a", ctrlKey: true });

    await waitFor(() => {
      expect(view.getByLabelText("Seleccionar Tema 1")).toBeChecked();
      expect(view.getByLabelText("Seleccionar Tema 2")).toBeChecked();
    });
    expect(await view.findByText("2 canciones visibles seleccionadas.")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(view.getByLabelText("Seleccionar Tema 1")).not.toBeChecked();
    expect(view.getByLabelText("Seleccionar Tema 2")).not.toBeChecked();
    expect(await view.findByText("Selección limpiada.")).toBeInTheDocument();
  });

  it("marca Radio Ready con R y controla play/pause con Espacio", async () => {
    const view = render(<LibraryView />);
    const title = await view.findByText("Tema 1");
    fireEvent.click(title);
    await waitFor(() =>
      expect(mocks.setSelectedTrack).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1 }),
      ),
    );

    fireEvent.keyDown(window, { key: "r" });
    await waitFor(() =>
      expect(mocks.updateTrackOrganization).toHaveBeenCalledWith([1], {
        status: { value: "selected" },
      }),
    );

    fireEvent.keyDown(window, { key: " " });
    expect(mocks.togglePlayback).toHaveBeenCalled();
  });

  it("aplica un atajo personalizado de mood a la seleccion", async () => {
    settingsMock.settings.customKeyboardShortcuts = [
      {
        id: "custom-mood-danceable",
        enabled: true,
        context: "library",
        field: "mood",
        value: "Danceable",
        key: "d",
        ctrl: false,
        alt: false,
        shift: false,
        meta: false,
      },
    ];
    const view = render(<LibraryView />);
    await view.findByText("Tema 1");
    fireEvent.click(view.getAllByRole("checkbox")[0]);

    fireEvent.keyDown(window, { key: "d" });

    await waitFor(() =>
      expect(mocks.updateTrackOrganization).toHaveBeenCalledWith([1, 2], {
        mood: { value: "Danceable" },
      }),
    );
  });

  it("no dispara atajos al escribir en busqueda", async () => {
    const view = render(<LibraryView />);
    const search = await view.findByPlaceholderText(/Buscar/);

    fireEvent.keyDown(search, { key: "r" });
    fireEvent.keyDown(search, { key: "0" });

    expect(mocks.updateTrackOrganization).not.toHaveBeenCalled();
    expect(mocks.updateTrackRating).not.toHaveBeenCalled();
  });

  it("ajusta el zoom del inspector con +, - y Ctrl+0", async () => {
    const view = render(<LibraryView />);
    await view.findByText("Tema 1");

    fireEvent.keyDown(window, { key: "+" });
    expect(settingsMock.settings.layout.libraryInspectorZoom).toBe(1.1);

    fireEvent.keyDown(window, { key: "-" });
    expect(settingsMock.settings.layout.libraryInspectorZoom).toBe(1);

    settingsMock.settings.layout.libraryInspectorZoom = 1.3;
    fireEvent.keyDown(window, { key: "0", ctrlKey: true });
    expect(settingsMock.settings.layout.libraryInspectorZoom).toBe(1);
  });

  it("no ajusta el zoom del inspector dentro de inputs", async () => {
    const view = render(<LibraryView />);
    const search = await view.findByPlaceholderText(/Buscar/);

    fireEvent.keyDown(search, { key: "+" });
    fireEvent.keyDown(search, { key: "0", ctrlKey: true });

    expect(settingsMock.settings.layout.libraryInspectorZoom).toBe(1);
  });
});
