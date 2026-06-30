// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TrackDetails } from "../../types/track";
import { TrackInspector } from "./TrackInspector";

afterEach(() => cleanup());

function track(): TrackDetails {
  return {
    id: 1,
    filePath: "C:\\Music\\tema.mp3",
    fileName: "tema.mp3",
    title: "Título original",
    artist: "Artista",
    album: "Álbum",
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
    tagNames: "Suno",
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
  };
}

function renderInspector(overrides = {}) {
  return render(
    <TrackInspector
      track={track()}
      metadata={{
        title: "Título original",
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
      }}
      metadataLoading={false}
      metadataError={null}
      onRatingChange={vi.fn()}
      onEdit={vi.fn()}
      editSelectionCount={0}
      {...overrides}
    />,
  );
}

describe("TrackInspector inline editing", () => {
  it("distingue title tag vacio del nombre visible de archivo", () => {
    const onMetadataInlineSave = vi.fn().mockResolvedValue(undefined);
    renderInspector({
      track: {
        ...track(),
        filePath: "C:\\Music\\1312.mp3",
        fileName: "1312.mp3",
        title: null,
      },
      metadata: {
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
      },
      onMetadataInlineSave,
    });

    expect(screen.getByRole("heading", { name: "1312.mp3" })).toBeInTheDocument();
    expect(screen.getByText("Tag de título")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sin título embebido" })).toBeInTheDocument();
    expect(screen.getByText("Nombre de archivo")).toBeInTheDocument();
    expect(screen.getAllByText("1312.mp3").length).toBeGreaterThanOrEqual(2);
    expect(onMetadataInlineSave).not.toHaveBeenCalled();
  });

  it("usa el nombre de archivo sin extension como titulo solo con accion explicita", async () => {
    const onMetadataInlineSave = vi.fn().mockResolvedValue(undefined);
    renderInspector({
      track: {
        ...track(),
        filePath: "C:\\Music\\1312.mp3",
        fileName: "1312.mp3",
        title: null,
      },
      metadata: {
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
      },
      onMetadataInlineSave,
    });

    expect(onMetadataInlineSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Usar nombre de archivo como título" }));

    await waitFor(() =>
      expect(onMetadataInlineSave).toHaveBeenCalledWith({
        title: { value: "1312" },
      }),
    );
  });

  it("muestra el title tag real por encima del titulo cacheado", () => {
    renderInspector({
      track: {
        ...track(),
        title: "Titulo cacheado",
      },
      metadata: {
        title: "Titulo tag real",
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
      },
    });

    expect(screen.getByRole("heading", { name: "Titulo tag real" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Titulo tag real" })).toBeInTheDocument();
  });

  it("muestra la version interna junto al titulo del inspector", () => {
    renderInspector({
      track: {
        ...track(),
        title: "Titulo cacheado",
        versionLabel: "v3",
      },
      metadata: {
        title: "Titulo tag real",
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
      },
    });

    expect(screen.getByRole("heading", { name: "Titulo tag real · v3" })).toBeInTheDocument();
  });

  it("guarda metadatos de archivo mediante el callback seguro", async () => {
    const onMetadataInlineSave = vi.fn().mockResolvedValue(undefined);
    renderInspector({ onMetadataInlineSave });

    fireEvent.click(screen.getByRole("button", { name: "Título original" }));
    fireEvent.change(screen.getByDisplayValue("Título original"), {
      target: { value: "Título nuevo" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(onMetadataInlineSave).toHaveBeenCalledWith({
        title: { value: "Título nuevo" },
      }),
    );
  });

  it("permite editar y guardar letras no sincronizadas desde File Metadata", async () => {
    const onMetadataInlineSave = vi.fn().mockResolvedValue(undefined);
    renderInspector({ onMetadataInlineSave });

    const lyrics = screen.getByPlaceholderText("Añadir letra...");
    fireEvent.change(lyrics, {
      target: { value: "Primera linea\nSegunda linea" },
    });
    expect(screen.getByText("Cambios de letra sin guardar")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Guardar letra" }));

    await waitFor(() =>
      expect(onMetadataInlineSave).toHaveBeenCalledWith({
        unsyncedLyrics: { value: "Primera linea\nSegunda linea" },
      }),
    );
  });

  it("limpia letras solo en el borrador hasta guardar", async () => {
    const onMetadataInlineSave = vi.fn().mockResolvedValue(undefined);
    renderInspector({
      metadata: {
        title: "Título original",
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
        unsyncedLyrics: "Letra existente",
        bpm: null,
        musicalKey: null,
        durationMs: 180_000,
        bitrateKbps: 320,
        sampleRateHz: 44_100,
        channels: 2,
        audioFormat: "mp3",
        hasCoverArt: false,
        extendedTags: [],
      },
      onMetadataInlineSave,
    });

    const lyrics = screen.getByDisplayValue("Letra existente");
    fireEvent.click(screen.getByRole("button", { name: "Limpiar" }));
    expect(onMetadataInlineSave).not.toHaveBeenCalled();
    expect(lyrics).toHaveValue("");

    fireEvent.click(screen.getByRole("button", { name: "Guardar letra" }));

    await waitFor(() =>
      expect(onMetadataInlineSave).toHaveBeenCalledWith({
        unsyncedLyrics: { value: null },
      }),
    );
  });

  it("guarda tags internos solo por el callback de organización", async () => {
    const onOrganizationInlineSave = vi.fn().mockResolvedValue(undefined);
    renderInspector({ onOrganizationInlineSave });

    fireEvent.click(screen.getByRole("button", { name: "Suno" }));
    fireEvent.change(screen.getByDisplayValue("Suno"), {
      target: { value: "Suno, Radio" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(onOrganizationInlineSave).toHaveBeenCalledWith({
        tagNames: ["Suno", "Radio"],
      }),
    );
  });
});
