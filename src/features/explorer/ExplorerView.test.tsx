// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TrackDetails, TrackSummary } from "../../types/track";
import { ExplorerView, shuffleTracks } from "./ExplorerView";

const mocks = vi.hoisted(() => ({
  getExplorerTracks: vi.fn(),
  getOrganizationOptions: vi.fn(),
  getTrack: vi.fn(),
  saveCuration: vi.fn(),
  skipCurationTrack: vi.fn(),
  updateTrackMetadata: vi.fn(),
  setLibraryTracks: vi.fn(),
  setSelectedTrack: vi.fn(),
  playTrack: vi.fn(),
  stop: vi.fn(),
  getLibraryFolders: vi.fn(),
  playerState: {
    trackId: null as number | null,
    status: "stopped" as "stopped" | "playing" | "paused" | "ended",
    positionMs: 0,
    durationMs: null as number | null,
    volume: 0.8,
  },
}));

const settingsMock = vi.hoisted(() => ({
  settings: {
    interfaceLanguage: "es",
    interfaceMode: "advanced" as "simple" | "advanced",
    keyboardShortcutsEnabled: false,
    explorer: {
      defaultCriterion: "unreviewed",
      autoplayOnLoad: false,
      autoplayAfterSave: true,
      autoplayAfterSkip: false,
      confirmArchive: true,
      hideArchived: true,
      randomQueue: true,
      resetQueueOnCriterion: true,
      saveMarksReviewed: true,
    },
    metadata: {
      confirmExplorerGenreWrite: true,
    },
    layout: {
      explorerRightPanelZoom: 1,
      libraryInspectorZoom: 1,
      sidebarMode: "expanded",
      inspectorVisible: true,
      focusMode: false,
    },
    fieldVisibility: undefined as Record<string, string[]> | undefined,
  },
}));

vi.mock("../../lib/tauri", () => ({
  api: {
    getExplorerTracks: mocks.getExplorerTracks,
    getOrganizationOptions: mocks.getOrganizationOptions,
    getTrack: mocks.getTrack,
    saveCuration: mocks.saveCuration,
    skipCurationTrack: mocks.skipCurationTrack,
    updateTrackMetadata: mocks.updateTrackMetadata,
    getLibraryFolders: mocks.getLibraryFolders,
    createProject: vi.fn(),
  },
}));

vi.mock("../player/PlayerContext", () => ({
  usePlayer: () => ({
    state: mocks.playerState,
    setLibraryTracks: mocks.setLibraryTracks,
    setSelectedTrack: mocks.setSelectedTrack,
    playTrack: mocks.playTrack,
    togglePlayback: vi.fn(),
    stop: mocks.stop,
    seek: vi.fn(),
    setVolume: vi.fn(),
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

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  settingsMock.settings.explorer.autoplayOnLoad = false;
  settingsMock.settings.explorer.autoplayAfterSave = true;
  settingsMock.settings.explorer.autoplayAfterSkip = false;
  settingsMock.settings.explorer.hideArchived = true;
  settingsMock.settings.explorer.randomQueue = true;
  settingsMock.settings.interfaceMode = "advanced";
  settingsMock.settings.keyboardShortcutsEnabled = false;
  settingsMock.settings.layout.explorerRightPanelZoom = 1;
  settingsMock.settings.fieldVisibility = undefined;
  mocks.playerState.trackId = null;
  mocks.playerState.status = "stopped";
  mocks.playerState.positionMs = 0;
  mocks.playerState.durationMs = null;
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

function summary(id = 1, title = "Tema pendiente"): TrackSummary {
  return {
    id,
    filePath: `C:\\Music\\tema-${id}.mp3`,
    fileName: `tema-${id}.mp3`,
    title,
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
  };
}

function details(track = summary()): TrackDetails {
  return {
    ...track,
    fileExtension: "mp3",
    fileSize: 1024,
    albumArtist: track.albumArtist,
    genre: track.genre,
    trackTotal: null,
    discNumber: null,
    discTotal: null,
    comment: null,
    lyrics: null,
    bpm: track.bpm,
    musicalKey: track.musicalKey,
    bitrateKbps: 320,
    sampleRateHz: 44_100,
    channels: 2,
    hasCoverArt: false,
    playCount: track.playCount,
  };
}

function prepareQueue(items = [summary()]) {
  vi.spyOn(Math, "random").mockReturnValue(0.999);
  mocks.getExplorerTracks.mockResolvedValue({ items, total: items.length });
  mocks.getOrganizationOptions.mockResolvedValue({
    tags: [],
    projects: [],
    versions: [],
    models: ["Suno v4.5"],
    smartCollections: [],
  });
  mocks.getLibraryFolders.mockResolvedValue([
    {
      path: "C:\\Music\\Suno",
      name: "Suno",
      trackCount: items.length,
      isRoot: true,
    },
  ]);
  mocks.getTrack.mockImplementation(async (id: number) =>
    details(items.find((track) => track.id === id) ?? summary(id)),
  );
  mocks.saveCuration.mockResolvedValue(details(items[0] ?? summary()));
  mocks.updateTrackMetadata.mockResolvedValue({
    total: 1,
    succeeded: 1,
    failed: 0,
    items: [{ trackId: 1, success: true, backupPath: "backup", error: null }],
  });
}

function selectDropdownOptions(
  view: ReturnType<typeof render>,
  label: string,
  optionNames: string[],
) {
  fireEvent.click(view.getByLabelText(label));
  for (const optionName of optionNames) {
    fireEvent.click(view.getByLabelText(optionName));
  }
  fireEvent.click(view.getByRole("button", { name: "Aplicar" }));
}

function addDropdownCustomValue(
  view: ReturnType<typeof render>,
  label: string,
  value: string,
) {
  fireEvent.click(view.getByLabelText(label));
  fireEvent.change(view.getByPlaceholderText("Valor personalizado..."), {
    target: { value },
  });
  fireEvent.click(view.getByRole("button", { name: "Añadir personalizado" }));
  fireEvent.click(view.getByRole("button", { name: "Aplicar" }));
}

describe("ExplorerView", () => {
  it("muestra criterios unicos con All primero y permite cargar All", async () => {
    prepareQueue([summary(1, "Primera"), summary(2, "Segunda")]);
    const view = render(<ExplorerView onNavigate={vi.fn()} />);
    await view.findByRole("heading", { name: "Primera" });

    const criterion = view.getByLabelText("Criterio") as HTMLSelectElement;
    const options = Array.from(criterion.options);
    const values = options.map((option) => option.value);

    expect(values[0]).toBe("all");
    expect(values.filter((value) => value === "all")).toHaveLength(1);
    expect(new Set(values).size).toBe(values.length);
    expect(options.filter((option) => option.textContent === "Todos")).toHaveLength(1);
    expect(options.find((option) => option.value === "random")?.textContent).toBe(
      "Aleatorias",
    );

    fireEvent.change(criterion, { target: { value: "all" } });

    await waitFor(() =>
      expect(mocks.getExplorerTracks).toHaveBeenLastCalledWith({
        criterion: "all",
        limit: 1_000,
        folderPath: null,
        smartCollection: null,
      }),
    );
  });

  it("abre una cola temporal de canciones seleccionadas desde Biblioteca", async () => {
    const items = [summary(1, "Primera"), summary(2, "Segunda")];
    prepareQueue(items);
    const view = render(
      <ExplorerView
        onNavigate={vi.fn()}
        initialCriterion="all"
        initialQueueIds={[2, 1]}
        focusTrackId={2}
      />,
    );

    await view.findByRole("heading", { name: "Segunda" });
    expect(mocks.getExplorerTracks).not.toHaveBeenCalled();
    expect(mocks.getTrack).toHaveBeenCalledWith(2);
    expect(mocks.getTrack).toHaveBeenCalledWith(1);
    const criterion = view.getByLabelText("Criterio") as HTMLSelectElement;
    expect(criterion.value).toBe("library_selection");
    expect(
      Array.from(criterion.options).filter((option) => option.value === "library_selection"),
    ).toHaveLength(1);
    expect(mocks.setLibraryTracks).toHaveBeenCalledWith(
      [expect.objectContaining({ id: 2 }), expect.objectContaining({ id: 1 })],
      "explorer",
      expect.any(Object),
    );
  });

  it("abre una cancion enfocada desde Biblioteca como pista activa", async () => {
    const first = summary(1, "Primera");
    const focused = summary(2, "Cancion enfocada");
    const third = summary(3, "Tercera");
    prepareQueue([first, focused, third]);

    const view = render(
      <ExplorerView onNavigate={vi.fn()} initialCriterion="all" focusTrackId={2} />,
    );

    expect(
      await view.findByRole("heading", { name: "Cancion enfocada" }),
    ).toBeInTheDocument();
    expect(mocks.getTrack).toHaveBeenCalledWith(2);
    expect(mocks.setLibraryTracks).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 2 })]),
      "explorer",
      expect.any(Object),
    );
    expect(mocks.playTrack).not.toHaveBeenCalled();
  });

  it("muestra la version interna junto al titulo de la pista actual", async () => {
    const current = { ...summary(1, "Primera"), versionLabel: "v2" };
    prepareQueue([current]);

    const view = render(<ExplorerView onNavigate={vi.fn()} initialCriterion="all" />);

    expect(
      await view.findByRole("heading", { name: "Primera · v2" }),
    ).toBeInTheDocument();
  });

  it("abre la cancion enfocada aunque no este en la cola inicial del Explorador", async () => {
    const first = summary(1, "Primera de la cola");
    const focused = summary(42, "Primera lanzada en Biblioteca");
    prepareQueue([first]);
    mocks.getTrack.mockImplementation(async (id: number) =>
      details(id === focused.id ? focused : first),
    );

    const view = render(
      <ExplorerView onNavigate={vi.fn()} initialCriterion="all" focusTrackId={42} />,
    );

    expect(
      await view.findByRole("heading", { name: "Primera lanzada en Biblioteca" }),
    ).toBeInTheDocument();
    expect(mocks.getTrack).toHaveBeenCalledWith(42);
    expect(mocks.setLibraryTracks).toHaveBeenCalledWith(
      [
        expect.objectContaining({ id: 42 }),
        expect.objectContaining({ id: 1 }),
      ],
      "explorer",
      expect.any(Object),
    );
    expect(mocks.playTrack).not.toHaveBeenCalled();
  });

  it("guarda el estado rápido y los campos de curaduría antes de avanzar", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const nextTrack = summary(2, "Siguiente tema");
    prepareQueue([summary(), nextTrack]);
    mocks.saveCuration.mockResolvedValue({
      ...details(),
      status: "selected",
      strongPart: "Voz",
      reviewedAt: "2026-06-12T00:00:00Z",
      lastReviewedAt: "2026-06-12T00:00:00Z",
    });
    const view = render(<ExplorerView onNavigate={vi.fn()} />);
    const heading = await view.findByRole("heading", { name: "Tema pendiente" });
    const leftColumn = heading.closest("section");
    expect(leftColumn).not.toBeNull();
    expect(
      within(leftColumn as HTMLElement).getByRole("button", {
        name: "Guardar y siguiente",
      }),
    ).toBeInTheDocument();
    expect(
      within(leftColumn as HTMLElement).getByRole("button", {
        name: "Saltar por ahora",
      }),
    ).toBeInTheDocument();
    const ratingControl = within(leftColumn as HTMLElement).getByLabelText("Rating");
    const statusControl = within(leftColumn as HTMLElement).getByLabelText("Estado");
    const modelControl = within(leftColumn as HTMLElement).getByLabelText("Modelo");
    const projectControl = within(leftColumn as HTMLElement).getByLabelText("Proyecto");
    const coverPlaceholder = within(leftColumn as HTMLElement).getByLabelText(
      "Placeholder de portada",
    );
    const progressControl = within(leftColumn as HTMLElement).getByLabelText("Progreso en Explorador");
    const saveButton = within(leftColumn as HTMLElement).getByRole("button", {
      name: "Guardar",
    });
    expect(ratingControl).toBeInTheDocument();
    expect(statusControl).toBeInTheDocument();
    expect(modelControl).toBeInTheDocument();
    expect(projectControl).toBeInTheDocument();
    expect(coverPlaceholder).toBeInTheDocument();
    expect(
      Boolean(
        coverPlaceholder.compareDocumentPosition(ratingControl) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
    expect(
      Boolean(
        modelControl.compareDocumentPosition(heading) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
    expect(
      Boolean(
        modelControl.compareDocumentPosition(projectControl) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
    expect(
      Boolean(
        projectControl.compareDocumentPosition(heading) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
    expect(
      Boolean(
        ratingControl.compareDocumentPosition(progressControl) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
    expect(
      Boolean(
        modelControl.compareDocumentPosition(progressControl) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
    expect(
      Boolean(
        progressControl.compareDocumentPosition(saveButton) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
    const rightColumn = leftColumn?.nextElementSibling as HTMLElement;
    expect(within(rightColumn).queryByLabelText("Rating")).not.toBeInTheDocument();
    expect(within(rightColumn).queryByLabelText("Estado")).not.toBeInTheDocument();
    expect(within(rightColumn).queryByLabelText("Modelo")).not.toBeInTheDocument();
    expect(within(rightColumn).queryByLabelText("Proyecto")).not.toBeInTheDocument();

    fireEvent.click(view.getByRole("button", { name: "Radio Ready" }));
    selectDropdownOptions(view, "Parte fuerte", ["Voz"]);
    selectDropdownOptions(view, "Mood", ["Cósmico", "Atmosférico"]);
    selectDropdownOptions(view, "Género", ["Psytrance", "Electronic"]);
    fireEvent.click(view.getByRole("button", { name: "Guardar y siguiente" }));

    await waitFor(() =>
      expect(mocks.updateTrackMetadata).toHaveBeenCalledWith([1], {
        genre: { value: "Psytrance; Electronic" },
      }),
    );
    await waitFor(() => expect(mocks.saveCuration).toHaveBeenCalledTimes(1));
    expect(mocks.saveCuration.mock.calls[0][0]).toMatchObject({
      trackId: 1,
      strongPart: "Voz",
      mood: "Cósmico, Atmosférico",
      generationModel: null,
      organization: {
        status: { value: "selected" },
      },
    });
    await waitFor(() =>
      expect(mocks.playTrack).toHaveBeenCalledWith(
        expect.objectContaining({ id: 2, title: "Siguiente tema" }),
        "explorer_save_and_next",
        "explorer",
      ),
    );
  });

  it("guarda rating, estado y modelo sin avanzar ni escribir metadatos del archivo", async () => {
    prepareQueue([summary(1, "Primera"), summary(2, "Segunda")]);
    mocks.saveCuration.mockImplementation(async (request) => ({
      ...details(summary(request.trackId, "Primera")),
      generationModel: request.generationModel,
    }));
    const view = render(<ExplorerView onNavigate={vi.fn()} />);
    const heading = await view.findByRole("heading", { name: "Primera" });
    const leftColumn = heading.closest("section") as HTMLElement;

    fireEvent.change(within(leftColumn).getByLabelText("Rating"), {
      target: { value: "7" },
    });
    fireEvent.change(within(leftColumn).getByLabelText("Estado"), {
      target: { value: "idea" },
    });
    fireEvent.change(within(leftColumn).getByLabelText("Modelo"), {
      target: { value: "Suno v4.5" },
    });
    fireEvent.click(view.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(mocks.saveCuration).toHaveBeenCalledTimes(1));
    expect(mocks.saveCuration.mock.calls[0][0]).toMatchObject({
      trackId: 1,
      rating: 7,
      generationModel: "Suno v4.5",
      organization: {
        status: { value: "idea" },
      },
    });
    expect(mocks.updateTrackMetadata).not.toHaveBeenCalled();
    expect(mocks.playTrack).not.toHaveBeenCalled();
    expect(await view.findByRole("heading", { name: "Primera" })).toBeInTheDocument();
    expect(view.queryByRole("heading", { name: "Segunda" })).not.toBeInTheDocument();
  });

  it("muestra Modelo aunque la visibilidad persistida del Explorador no lo incluya", async () => {
    settingsMock.settings.fieldVisibility = {
      explorerCard: ["title", "coverArt"],
      explorerEditor: ["rating", "status"],
    };
    prepareQueue([summary(1, "Primera")]);
    const view = render(<ExplorerView onNavigate={vi.fn()} />);
    const heading = await view.findByRole("heading", { name: "Primera" });
    const leftColumn = heading.closest("section") as HTMLElement;

    expect(within(leftColumn).getByLabelText("Rating")).toBeInTheDocument();
    expect(within(leftColumn).getByLabelText("Estado")).toBeInTheDocument();
    expect(within(leftColumn).getByLabelText("Modelo")).toBeInTheDocument();
    expect(within(leftColumn).getByLabelText("Proyecto")).toBeInTheDocument();
    expect(
      within(leftColumn).getByPlaceholderText("Seleccionar o escribir modelo..."),
    ).toBeInTheDocument();
  });

  it("muestra Modelo en modo simple sin desplegar campos avanzados", async () => {
    settingsMock.settings.interfaceMode = "simple";
    settingsMock.settings.fieldVisibility = {
      explorerCard: ["title", "coverArt"],
      explorerEditor: ["rating", "status", "project"],
    };
    prepareQueue([summary(1, "Primera")]);
    const view = render(<ExplorerView onNavigate={vi.fn()} />);
    const heading = await view.findByRole("heading", { name: "Primera" });
    const leftColumn = heading.closest("section") as HTMLElement;

    expect(within(leftColumn).getByLabelText("Rating")).toBeInTheDocument();
    expect(within(leftColumn).getByLabelText("Estado")).toBeInTheDocument();
    expect(within(leftColumn).getByLabelText("Modelo")).toBeInTheDocument();
    expect(within(leftColumn).getByLabelText("Proyecto")).toBeInTheDocument();
    expect(
      within(leftColumn).getByPlaceholderText("Seleccionar o escribir modelo..."),
    ).toBeInTheDocument();
  });

  it("mantiene Modelo visible en modo avanzado", async () => {
    settingsMock.settings.interfaceMode = "advanced";
    prepareQueue([summary(1, "Primera")]);
    const view = render(<ExplorerView onNavigate={vi.fn()} />);
    const heading = await view.findByRole("heading", { name: "Primera" });
    const leftColumn = heading.closest("section") as HTMLElement;

    expect(within(leftColumn).getByLabelText("Modelo")).toBeInTheDocument();
    expect(
      within(leftColumn).getByPlaceholderText("Seleccionar o escribir modelo..."),
    ).toBeInTheDocument();
  });

  it("muestra Decision creativa y quick tags sin guardar hasta pulsar guardar", async () => {
    prepareQueue([summary(1, "Primera")]);
    const view = render(<ExplorerView onNavigate={vi.fn()} />);
    await view.findByRole("heading", { name: "Primera" });

    expect(view.getAllByText("Decisión creativa").length).toBeGreaterThan(0);
    fireEvent.click(view.getAllByRole("button", { name: "Potencial" })[0]);
    expect(mocks.saveCuration).not.toHaveBeenCalled();

    fireEvent.click(view.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(mocks.saveCuration).toHaveBeenCalledTimes(1));
    expect(mocks.saveCuration.mock.calls[0][0].organization.tagNames).toContain(
      "Potential",
    );
  });

  it("renderiza una cabecera compacta de workflow sin repetir Decision creativa", async () => {
    prepareQueue([summary(1, "Primera")]);
    const view = render(<ExplorerView onNavigate={vi.fn()} />);
    await view.findByRole("heading", { name: "Primera" });

    const header = view.getByTestId("workflow-compact-header");
    expect(within(header).getByText("Workflow:")).toBeInTheDocument();
    expect(within(header).getByDisplayValue("Captura de ideas")).toBeInTheDocument();
    expect(
      within(header).getByRole("button", { name: "Cargar cola sugerida" }),
    ).toBeInTheDocument();
    expect(within(header).queryByText("Decisión creativa")).not.toBeInTheDocument();
    expect(view.getByText("Campos de captura de ideas")).toBeInTheDocument();
  });

  it("muestra mismatch, metricas y checklist como elementos compactos o colapsados", async () => {
    prepareQueue([summary(1, "Primera")]);
    const view = render(<ExplorerView onNavigate={vi.fn()} />);
    await view.findByRole("heading", { name: "Primera" });

    const metrics = view.getByTestId("workflow-metrics");
    expect(metrics).not.toHaveAttribute("open");

    fireEvent.change(view.getByDisplayValue("Captura de ideas"), {
      target: { value: "release_prep" },
    });

    expect(view.getByTestId("workflow-queue-mismatch")).toHaveTextContent(
      "Cola no coincidente",
    );
    expect(view.getByTestId("workflow-queue-mismatch")).toHaveAttribute(
      "title",
      "Esta cola no coincide con el workflow seleccionado.",
    );
    expect(
      within(view.getByTestId("workflow-compact-header")).queryByText(
        "Checklist de publicación",
      ),
    ).not.toBeInTheDocument();
    expect(view.getByTestId("workflow-checklist")).not.toHaveAttribute("open");
    expect(view.getByText("Campos de publicación")).toBeInTheDocument();
  });

  it("diferencia quick action recomendada de aplicada visualmente", async () => {
    prepareQueue([summary(1, "Primera")]);
    const view = render(<ExplorerView onNavigate={vi.fn()} />);
    await view.findByRole("heading", { name: "Primera" });

    const recommended = view
      .getAllByRole("button", { name: "Idea fuerte" })
      .find((button) => button.textContent?.includes("Recomendado"));
    expect(recommended).toBeDefined();
    if (!recommended) throw new Error("Recommended quick action not found");
    expect(recommended).toHaveAttribute("aria-pressed", "false");
    expect(recommended).toHaveTextContent("Recomendado");
    expect(recommended.className).not.toContain("bg-[#d9ff43]");

    fireEvent.click(recommended);

    expect(recommended).toHaveAttribute("aria-pressed", "true");
    expect(recommended.className).toContain("bg-[#d9ff43]");
  });

  it("permite varias quick actions de tipo tag y las muestra como aplicadas", async () => {
    prepareQueue([summary(1, "Primera")]);
    const view = render(<ExplorerView onNavigate={vi.fn()} />);
    await view.findByRole("heading", { name: "Primera" });

    fireEvent.change(view.getByDisplayValue("Captura de ideas"), {
      target: { value: "custom_model_seeds" },
    });
    fireEvent.click(view.getByRole("button", { name: "Semilla principal" }));
    fireEvent.click(view.getByRole("button", { name: "Semilla para modelo" }));
    fireEvent.click(view.getByRole("button", { name: "Fragmento útil" }));

    expect(view.getByText("Acciones aplicadas")).toBeInTheDocument();
    expect(view.getByRole("button", { name: "Semilla principal" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      view.getByRole("button", {
        name: "Quitar acción aplicada: Semilla principal",
      }),
    ).toBeInTheDocument();
    expect(view.getByRole("button", { name: "Tags internos" })).toHaveTextContent(
      "Core Seed, Custom Model Seed +1",
    );

    fireEvent.click(view.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(mocks.saveCuration).toHaveBeenCalledTimes(1));
    expect(mocks.saveCuration.mock.calls[0][0].organization.tagNames).toEqual([
      "Core Seed",
      "Custom Model Seed",
      "Useful Fragment",
    ]);
  });

  it("las quick actions de tag hacen toggle sin borrar las demás", async () => {
    prepareQueue([
      {
        ...summary(1, "Primera"),
        tagNames: "Core Seed, Custom Model Seed, Useful Fragment",
      },
    ]);
    const view = render(<ExplorerView onNavigate={vi.fn()} />);
    await view.findByRole("heading", { name: "Primera" });

    fireEvent.change(view.getByDisplayValue("Captura de ideas"), {
      target: { value: "custom_model_seeds" },
    });
    fireEvent.click(
      view.getByRole("button", {
        name: "Quitar acción aplicada: Semilla principal",
      }),
    );
    fireEvent.click(view.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(mocks.saveCuration).toHaveBeenCalledTimes(1));
    expect(mocks.saveCuration.mock.calls[0][0].organization.tagNames).toEqual([
      "Custom Model Seed",
      "Useful Fragment",
    ]);
  });

  it("una quick action de estado no borra tags internos aplicados", async () => {
    prepareQueue([{ ...summary(1, "Primera"), tagNames: "Needs Stems" }]);
    const view = render(<ExplorerView onNavigate={vi.fn()} />);
    await view.findByRole("heading", { name: "Primera" });

    fireEvent.change(view.getByDisplayValue("Captura de ideas"), {
      target: { value: "daw_finishing" },
    });
    fireEvent.click(view.getByRole("button", { name: "Marcar en proceso" }));
    expect(view.getByText("Estado cambiado: En proceso")).toBeInTheDocument();
    fireEvent.click(view.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(mocks.saveCuration).toHaveBeenCalledTimes(1));
    expect(mocks.saveCuration.mock.calls[0][0].organization).toMatchObject({
      status: { value: "editing" },
      tagNames: ["Needs Stems"],
    });
  });

  it("renderiza campos creativos como dropdowns compactos con opciones seleccionables", async () => {
    prepareQueue([summary(1, "Primera")]);
    const view = render(<ExplorerView onNavigate={vi.fn()} />);
    await view.findByRole("heading", { name: "Primera" });

    expect(view.getByRole("button", { name: "Género" })).toHaveTextContent(
      "Seleccionar género...",
    );
    expect(view.getByRole("button", { name: "Mood" })).toHaveTextContent(
      "Seleccionar mood...",
    );
    expect(view.getByRole("button", { name: "Parte fuerte" })).toHaveTextContent(
      "Seleccionar partes fuertes...",
    );
    expect(view.queryByRole("button", { name: "Voz" })).not.toBeInTheDocument();

    selectDropdownOptions(view, "Mood", ["Energético", "Hipnótico"]);

    expect(view.getByRole("button", { name: "Mood" })).toHaveTextContent(
      "Energético, Hipnótico",
    );
  });

  it("mantiene valores existentes y custom en dropdowns sin borrarlos", async () => {
    const track = {
      ...summary(1, "Primera"),
      mood: "Afro-Brasil, Cósmico",
      strongPart: "Gancho raro",
      genre: "Afro-Brasil",
      tagNames: "Suno, Rare Hook",
    };
    prepareQueue([track]);
    const view = render(<ExplorerView onNavigate={vi.fn()} />);
    await view.findByRole("heading", { name: "Primera" });

    expect(view.getByRole("button", { name: "Mood" })).toHaveTextContent(
      "Afro-Brasil, Cósmico",
    );
    expect(view.getByRole("button", { name: "Parte fuerte" })).toHaveTextContent(
      "Gancho raro",
    );
    expect(view.getByRole("button", { name: "Género" })).toHaveTextContent(
      "Afro-Brasil",
    );

    addDropdownCustomValue(view, "Tags internos", "Nuevo tag");
    fireEvent.click(view.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(mocks.saveCuration).toHaveBeenCalledTimes(1));
    expect(mocks.saveCuration.mock.calls[0][0].organization.tagNames).toEqual([
      "Suno",
      "Rare Hook",
      "Nuevo tag",
    ]);
  });

  it("limpia selección de un dropdown y no dispara atajos globales ni zoom", async () => {
    settingsMock.settings.keyboardShortcutsEnabled = true;
    prepareQueue([{ ...summary(1, "Primera"), mood: "Cósmico" }]);
    const view = render(<ExplorerView onNavigate={vi.fn()} />);
    await view.findByRole("heading", { name: "Primera" });

    fireEvent.click(view.getByRole("button", { name: "Mood" }));
    fireEvent.keyDown(view.getByRole("button", { name: "Mood" }), { key: "+" });
    expect(settingsMock.settings.layout.explorerRightPanelZoom).toBe(1);
    fireEvent.click(view.getByRole("button", { name: "Limpiar" }));
    fireEvent.click(view.getByRole("button", { name: "Aplicar" }));
    fireEvent.click(view.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(mocks.saveCuration).toHaveBeenCalledTimes(1));
    expect(mocks.saveCuration.mock.calls[0][0].mood).toBeNull();
  });

  it("Genre conserva el flujo seguro de escritura y los campos creativos no escriben archivo", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    prepareQueue([summary(1, "Primera")]);
    const view = render(<ExplorerView onNavigate={vi.fn()} />);
    await view.findByRole("heading", { name: "Primera" });

    selectDropdownOptions(view, "Género", ["Psytrance"]);
    selectDropdownOptions(view, "Mood", ["Hipnótico"]);
    selectDropdownOptions(view, "Parte fuerte", ["Bajo"]);
    selectDropdownOptions(view, "Problema principal", ["Necesita stems"]);
    selectDropdownOptions(view, "Uso previsto", ["DAW Rescue"]);
    fireEvent.click(view.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(mocks.updateTrackMetadata).toHaveBeenCalledWith([1], {
        genre: { value: "Psytrance" },
      }),
    );
    await waitFor(() => expect(mocks.saveCuration).toHaveBeenCalledTimes(1));
    expect(mocks.saveCuration.mock.calls[0][0]).toMatchObject({
      mood: "Hipnótico",
      strongPart: "Bajo",
      mainProblem: "Necesita stems",
      intendedUse: "DAW Rescue",
    });
  });

  it("usa una ficha real de metadatos en Metadata Cleanup", async () => {
    prepareQueue([summary(1, "Primera")]);
    const view = render(<ExplorerView onNavigate={vi.fn()} />);
    await view.findByRole("heading", { name: "Primera" });

    fireEvent.change(view.getByDisplayValue("Captura de ideas"), {
      target: { value: "metadata_cleanup" },
    });

    const primaryFields = view.getByTestId("workflow-primary-fields");
    expect(within(primaryFields).getByText("Título")).toBeInTheDocument();
    expect(within(primaryFields).getByText("Artista")).toBeInTheDocument();
    expect(within(primaryFields).getByText("Álbum")).toBeInTheDocument();
    expect(within(primaryFields).getByText("Artista del álbum")).toBeInTheDocument();
    expect(within(primaryFields).getByText("Pista")).toBeInTheDocument();
    expect(within(primaryFields).getByText("Letras no sincronizadas")).toBeInTheDocument();
    expect(within(primaryFields).getByDisplayValue("Primera")).toBeInTheDocument();
    expect(within(primaryFields).getByDisplayValue("Soundbender")).toBeInTheDocument();
    expect(within(primaryFields).getByDisplayValue("Suno Lab")).toBeInTheDocument();
    expect(
      within(primaryFields).getByPlaceholderText("Pega o edita letras no sincronizadas..."),
    ).toBeInTheDocument();
    expect(within(primaryFields).getByText(/editor de metadatos/i)).toBeInTheDocument();
    expect(within(primaryFields).queryByText("Parte fuerte")).not.toBeInTheDocument();
    expect(view.queryByText("quickAction.needsStems")).not.toBeInTheDocument();
  });

  it("aplica acciones rápidas reales del preset DAW sin mostrar claves i18n crudas", async () => {
    prepareQueue([summary(1, "Primera")]);
    const view = render(<ExplorerView onNavigate={vi.fn()} />);
    await view.findByRole("heading", { name: "Primera" });

    fireEvent.change(view.getByDisplayValue("Captura de ideas"), {
      target: { value: "daw_finishing" },
    });
    expect(view.queryByText("quickAction.needsStems")).not.toBeInTheDocument();

    fireEvent.click(view.getAllByRole("button", { name: "Necesita stems" })[0]);
    fireEvent.click(view.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(mocks.saveCuration).toHaveBeenCalledTimes(1));
    expect(mocks.saveCuration.mock.calls[0][0].organization.tagNames).toContain(
      "Needs Stems",
    );
  });

  it("ajusta el zoom del panel derecho con +, - y Ctrl+0", async () => {
    settingsMock.settings.keyboardShortcutsEnabled = true;
    prepareQueue();
    const view = render(<ExplorerView onNavigate={vi.fn()} />);
    await view.findByRole("heading", { name: "Tema pendiente" });

    fireEvent.keyDown(window, { key: "+" });
    expect(settingsMock.settings.layout.explorerRightPanelZoom).toBe(1.1);

    fireEvent.keyDown(window, { key: "-" });
    expect(settingsMock.settings.layout.explorerRightPanelZoom).toBe(1);

    settingsMock.settings.layout.explorerRightPanelZoom = 1.3;
    fireEvent.keyDown(window, { key: "0", ctrlKey: true });
    expect(settingsMock.settings.layout.explorerRightPanelZoom).toBe(1);
  });

  it("usa 0 como rating 10 en Explorer y no resetea zoom", async () => {
    settingsMock.settings.keyboardShortcutsEnabled = true;
    settingsMock.settings.layout.explorerRightPanelZoom = 1.3;
    prepareQueue();
    const view = render(<ExplorerView onNavigate={vi.fn()} />);
    await view.findByRole("heading", { name: "Tema pendiente" });

    fireEvent.keyDown(window, { key: "0" });

    expect(view.getByLabelText("Rating")).toHaveValue("10");
    expect(settingsMock.settings.layout.explorerRightPanelZoom).toBe(1.3);
    expect(view.getByText("Rating 10 aplicado.")).toBeInTheDocument();
  });

  it("no ajusta el zoom del panel derecho mientras se escribe", async () => {
    settingsMock.settings.keyboardShortcutsEnabled = true;
    prepareQueue();
    const view = render(<ExplorerView onNavigate={vi.fn()} />);
    await view.findByRole("heading", { name: "Tema pendiente" });

    fireEvent.keyDown(view.getByLabelText("Notas"), { key: "+" });
    fireEvent.keyDown(view.getByLabelText("Notas"), { key: "0", ctrlKey: true });

    expect(settingsMock.settings.layout.explorerRightPanelZoom).toBe(1);
  });

  it("guardar y siguiente avanza exactamente una cancion", async () => {
    prepareQueue([
      summary(1, "Primera"),
      summary(2, "Segunda"),
      summary(3, "Tercera"),
    ]);
    mocks.saveCuration.mockResolvedValue(details(summary(1, "Primera")));
    const view = render(<ExplorerView onNavigate={vi.fn()} />);
    await view.findByRole("heading", { name: "Primera" });

    fireEvent.click(view.getByRole("button", { name: "Guardar y siguiente" }));

    await waitFor(() => expect(mocks.saveCuration).toHaveBeenCalledTimes(1));
    expect(await view.findByRole("heading", { name: "Segunda" })).toBeInTheDocument();
    expect(view.queryByRole("heading", { name: "Tercera" })).not.toBeInTheDocument();
  });

  it("salta una canción sin guardarla como revisada", async () => {
    prepareQueue([
      summary(1, "Primera"),
      summary(2, "Segunda"),
      summary(3, "Tercera"),
    ]);
    mocks.skipCurationTrack.mockImplementation(async (id: number) => ({
      ...details(summary(id)),
      skipCount: 1,
    }));
    const view = render(<ExplorerView onNavigate={vi.fn()} />);
    await view.findByRole("heading", { name: "Primera" });

    fireEvent.click(view.getByRole("button", { name: "Saltar por ahora" }));

    await waitFor(() => expect(mocks.skipCurationTrack).toHaveBeenCalledWith(1));
    expect(await view.findByRole("heading", { name: "Segunda" })).toBeInTheDocument();
    fireEvent.click(view.getByRole("button", { name: "Saltar por ahora" }));
    await waitFor(() => expect(mocks.skipCurationTrack).toHaveBeenCalledWith(2));
    expect(await view.findByRole("heading", { name: "Tercera" })).toBeInTheDocument();
    expect(view.queryByRole("heading", { name: "Primera" })).not.toBeInTheDocument();
    expect(mocks.saveCuration).not.toHaveBeenCalled();
    expect(mocks.playTrack).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2, title: "Segunda" }),
      "explorer_skip",
      "explorer",
    );
    expect(mocks.playTrack).toHaveBeenCalledWith(
      expect.objectContaining({ id: 3, title: "Tercera" }),
      "explorer_skip",
      "explorer",
    );
    expect(mocks.getExplorerTracks).toHaveBeenCalledTimes(1);
  });

  it("inicializa la cola una sola vez y no usa autoplay al cargar aunque el ajuste antiguo este activo", async () => {
    settingsMock.settings.explorer.autoplayOnLoad = true;
    prepareQueue([summary(1, "Primera"), summary(2, "Segunda")]);
    const view = render(<ExplorerView onNavigate={vi.fn()} />);

    expect(await view.findByRole("heading", { name: "Primera" })).toBeInTheDocument();
    expect(mocks.getExplorerTracks).toHaveBeenCalledTimes(1);
    expect(mocks.playTrack).not.toHaveBeenCalled();
    expect(
      mocks.playTrack.mock.calls.some((call) => call[1] === "explorer_autoplay_load"),
    ).toBe(false);
  });

  it("un re-render no cambia la cancion actual ni dispara reproduccion", async () => {
    prepareQueue([summary(1, "Primera"), summary(2, "Segunda")]);
    const onNavigate = vi.fn();
    const view = render(<ExplorerView onNavigate={onNavigate} />);
    await view.findByRole("heading", { name: "Primera" });

    view.rerender(<ExplorerView onNavigate={onNavigate} />);

    expect(await view.findByRole("heading", { name: "Primera" })).toBeInTheDocument();
    expect(view.queryByRole("heading", { name: "Segunda" })).not.toBeInTheDocument();
    expect(mocks.getExplorerTracks).toHaveBeenCalledTimes(1);
    expect(mocks.playTrack).not.toHaveBeenCalled();
  });

  it("cambios del estado del Player no avanzan ni reproducen en Explorador", async () => {
    prepareQueue([summary(1, "Primera"), summary(2, "Segunda")]);
    const onNavigate = vi.fn();
    const view = render(<ExplorerView onNavigate={onNavigate} />);
    await view.findByRole("heading", { name: "Primera" });

    mocks.playerState.trackId = 1;
    mocks.playerState.status = "playing";
    mocks.playerState.positionMs = 2_000;
    view.rerender(<ExplorerView onNavigate={onNavigate} />);

    expect(await view.findByRole("heading", { name: "Primera" })).toBeInTheDocument();
    expect(view.queryByRole("heading", { name: "Segunda" })).not.toBeInTheDocument();
    expect(mocks.playTrack).not.toHaveBeenCalled();

    mocks.playerState.status = "ended";
    mocks.playerState.positionMs = 180_000;
    mocks.playerState.durationMs = 180_000;
    view.rerender(<ExplorerView onNavigate={onNavigate} />);

    expect(await view.findByRole("heading", { name: "Primera" })).toBeInTheDocument();
    expect(view.queryByRole("heading", { name: "Segunda" })).not.toBeInTheDocument();
    expect(mocks.playTrack).not.toHaveBeenCalled();
  });

  it("cambiar ajustes del Explorador no dispara reproduccion", async () => {
    prepareQueue([summary(1, "Primera"), summary(2, "Segunda")]);
    const onNavigate = vi.fn();
    const view = render(<ExplorerView onNavigate={onNavigate} />);
    await view.findByRole("heading", { name: "Primera" });

    settingsMock.settings.explorer.randomQueue = false;
    settingsMock.settings.explorer.hideArchived = false;
    view.rerender(<ExplorerView onNavigate={onNavigate} />);

    expect(mocks.playTrack).not.toHaveBeenCalled();
  });

  it("registra el Explorador como contexto aislado sin autoavance al terminar", async () => {
    prepareQueue([summary(1, "Primera"), summary(2, "Segunda")]);
    const view = render(<ExplorerView onNavigate={vi.fn()} />);
    await view.findByRole("heading", { name: "Primera" });

    const contextCall = mocks.setLibraryTracks.mock.calls
      .filter((call) => call[1] === "explorer")
      .at(-1);

    expect(contextCall).toBeDefined();
    expect(contextCall?.[0]).toEqual([
      expect.objectContaining({ id: 1 }),
      expect.objectContaining({ id: 2 }),
    ]);
    expect(contextCall?.[2]).toMatchObject({
      next: expect.any(Function),
      previous: expect.any(Function),
    });
    expect(contextCall?.[2]?.ended).toBeUndefined();
  });

  it("permite que el botón global Siguiente avance una sola canción en Explorador", async () => {
    prepareQueue([
      summary(1, "Primera"),
      summary(2, "Segunda"),
      summary(3, "Tercera"),
    ]);
    const view = render(<ExplorerView onNavigate={vi.fn()} />);
    await view.findByRole("heading", { name: "Primera" });
    const contextCall = mocks.setLibraryTracks.mock.calls
      .filter((call) => call[1] === "explorer")
      .at(-1);

    await contextCall?.[2]?.next?.();

    expect(await view.findByRole("heading", { name: "Segunda" })).toBeInTheDocument();
    expect(view.queryByRole("heading", { name: "Tercera" })).not.toBeInTheDocument();
    expect(mocks.playTrack).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2, title: "Segunda" }),
      "explorer_next_button",
      "explorer",
    );
    expect(mocks.saveCuration).not.toHaveBeenCalled();
    expect(mocks.skipCurationTrack).not.toHaveBeenCalled();
  });

  it("el boton Anterior vuelve y reproduce en contexto Explorador", async () => {
    prepareQueue([
      summary(1, "Primera"),
      summary(2, "Segunda"),
      summary(3, "Tercera"),
    ]);
    const view = render(<ExplorerView onNavigate={vi.fn()} />);
    await view.findByRole("heading", { name: "Primera" });

    fireEvent.click(view.getByRole("button", { name: "Siguiente" }));
    await view.findByRole("heading", { name: "Segunda" });
    mocks.playTrack.mockClear();
    fireEvent.click(view.getByRole("button", { name: "Anterior" }));

    expect(await view.findByRole("heading", { name: "Primera" })).toBeInTheDocument();
    expect(mocks.playTrack).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, title: "Primera" }),
      "explorer_previous_button",
      "explorer",
    );
  });

  it("si falla reproducir tras Next no avanza en bucle", async () => {
    prepareQueue([
      summary(1, "Primera"),
      summary(2, "Segunda"),
      summary(3, "Tercera"),
    ]);
    mocks.playTrack.mockRejectedValueOnce(new Error("archivo no encontrado"));
    const view = render(<ExplorerView onNavigate={vi.fn()} />);
    await view.findByRole("heading", { name: "Primera" });

    fireEvent.click(view.getByRole("button", { name: "Siguiente" }));

    expect(await view.findByRole("heading", { name: "Segunda" })).toBeInTheDocument();
    expect(
      await view.findByText(/No se pudo reproducir esta cancion/i),
    ).toBeInTheDocument();
    expect(view.queryByRole("heading", { name: "Tercera" })).not.toBeInTheDocument();
    expect(mocks.playTrack).toHaveBeenCalledTimes(1);
    expect(mocks.getExplorerTracks).toHaveBeenCalledTimes(1);
  });

  it("termina de forma coherente si no queda otra canción tras guardar", async () => {
    prepareQueue();
    mocks.saveCuration.mockResolvedValue(details());
    const view = render(<ExplorerView onNavigate={vi.fn()} />);
    await view.findByRole("heading", { name: "Tema pendiente" });

    fireEvent.click(view.getByRole("button", { name: "Guardar y siguiente" }));

    await waitFor(() => expect(mocks.stop).toHaveBeenCalledTimes(1));
    expect(mocks.playTrack).not.toHaveBeenCalled();
    expect(
      await view.findByRole("heading", {
        name: "No quedan canciones pendientes para este criterio.",
      }),
    ).toBeInTheDocument();
  });

  it("regenera la cola al limitar el Explorador a una carpeta", async () => {
    prepareQueue([summary()]);
    const view = render(<ExplorerView onNavigate={vi.fn()} />);
    await view.findByRole("heading", { name: "Tema pendiente" });

    fireEvent.change(view.getByLabelText("Carpeta"), {
      target: { value: "C:\\Music\\Suno" },
    });

    await waitFor(() =>
      expect(mocks.getExplorerTracks).toHaveBeenLastCalledWith({
        criterion: "unreviewed",
        limit: 1_000,
        folderPath: "C:\\Music\\Suno",
        smartCollection: null,
      }),
    );
  });

  it("guarda metadatos reales de Metadata Cleanup usando el flujo seguro", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    prepareQueue([summary(1, "Primera")]);
    const view = render(<ExplorerView onNavigate={vi.fn()} />);
    await view.findByRole("heading", { name: "Primera" });

    fireEvent.change(view.getByDisplayValue("Captura de ideas"), {
      target: { value: "metadata_cleanup" },
    });
    const primaryFields = view.getByTestId("workflow-primary-fields");
    fireEvent.change(within(primaryFields).getByDisplayValue("Primera"), {
      target: { value: "Titulo limpio" },
    });
    fireEvent.change(within(primaryFields).getByDisplayValue("Soundbender"), {
      target: { value: "Artista limpio" },
    });
    fireEvent.change(within(primaryFields).getByDisplayValue("Suno Lab"), {
      target: { value: "Album limpio" },
    });
    fireEvent.change(within(primaryFields).getByLabelText("Letras no sincronizadas"), {
      target: { value: "Letra nueva" },
    });
    selectDropdownOptions(view, "Género", ["Psytrance"]);
    fireEvent.click(view.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(mocks.updateTrackMetadata).toHaveBeenCalledWith([1], {
        title: { value: "Titulo limpio" },
        artist: { value: "Artista limpio" },
        album: { value: "Album limpio" },
        genre: { value: "Psytrance" },
        unsyncedLyrics: { value: "Letra nueva" },
      }),
    );
    await waitFor(() => expect(mocks.saveCuration).toHaveBeenCalledTimes(1));
  });

  it("no avanza si falla la escritura segura de metadatos reales", async () => {
    prepareQueue([summary(1, "Primera"), summary(2, "Segunda")]);
    mocks.updateTrackMetadata.mockResolvedValueOnce({
      total: 1,
      succeeded: 0,
      failed: 1,
      items: [
        {
          trackId: 1,
          success: false,
          backupPath: null,
          error: "fallo de escritura",
        },
      ],
    });
    const view = render(<ExplorerView onNavigate={vi.fn()} />);
    await view.findByRole("heading", { name: "Primera" });

    fireEvent.change(view.getByDisplayValue("Captura de ideas"), {
      target: { value: "metadata_cleanup" },
    });
    fireEvent.change(view.getByDisplayValue("Primera"), {
      target: { value: "Titulo pendiente" },
    });
    fireEvent.click(view.getByRole("button", { name: "Guardar y siguiente" }));

    await waitFor(() => expect(view.getByText("Error: fallo de escritura")).toBeInTheDocument());
    expect(mocks.saveCuration).not.toHaveBeenCalled();
    expect(mocks.playTrack).not.toHaveBeenCalled();
    expect(view.getByRole("heading", { name: "Primera" })).toBeInTheDocument();
    expect(view.queryByRole("heading", { name: "Segunda" })).not.toBeInTheDocument();
  });

  it("guarda mood y tags internos sin escribir metadatos del archivo", async () => {
    prepareQueue([summary(1, "Primera")]);
    const view = render(<ExplorerView onNavigate={vi.fn()} />);
    await view.findByRole("heading", { name: "Primera" });

    selectDropdownOptions(view, "Mood", ["Hipnótico"]);
    addDropdownCustomValue(view, "Tags internos", "Internal only");
    fireEvent.click(view.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(mocks.saveCuration).toHaveBeenCalledTimes(1));
    expect(mocks.updateTrackMetadata).not.toHaveBeenCalled();
    expect(mocks.saveCuration.mock.calls[0][0]).toMatchObject({
      mood: "Hipnótico",
      organization: {
        tagNames: ["Internal only"],
      },
    });
  });

  it("baraja una copia sin modificar la cola original", () => {
    const original = [1, 2, 3, 4];
    const randomValues = [0, 0, 0];
    const shuffled = shuffleTracks(original, () => randomValues.shift() ?? 0);

    expect(shuffled).toEqual([2, 3, 4, 1]);
    expect(original).toEqual([1, 2, 3, 4]);
  });
});
