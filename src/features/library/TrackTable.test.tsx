// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TrackSummary } from "../../types/track";
import { TrackTable } from "./TrackTable";

afterEach(() => cleanup());

function track(id: number, filePath: string, fileName: string): TrackSummary {
  return {
    id,
    filePath,
    fileName,
    title: "Misma canción",
    artist: null,
    album: null,
    albumArtist: null,
    genre: null,
    year: null,
    trackNumber: null,
    durationMs: null,
    audioFormat: fileName.split(".").pop() ?? "",
    bpm: null,
    musicalKey: null,
    playCount: 0,
    rating: null,
    status: "idea",
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

describe("TrackTable", () => {
  it("no muestra tooltips nativos de ruta sobre las filas", () => {
    const mp3 = track(1, "Y:\\Suno\\tema.mp3", "tema.mp3");
    const wav = track(2, "Y:\\Masters\\tema.wav", "tema.wav");
    const view = render(
      <TrackTable
        tracks={[mp3, wav]}
        selectedId={null}
        selectedIds={new Set()}
        sortBy="title"
        sortDirection="asc"
        loading={false}
        onSort={vi.fn()}
        onSelect={vi.fn()}
        onPlay={vi.fn()}
        onExternalDrag={vi.fn()}
        onRatingChange={vi.fn()}
        onSelectionChange={vi.fn()}
        onSelectAll={vi.fn()}
      />,
    );

    const rows = view.container.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(2);
    expect(rows[0]).not.toHaveAttribute("title");
    expect(rows[1]).not.toHaveAttribute("title");
  });

  it("respeta la lista de columnas visibles", () => {
    render(
      <TrackTable
        tracks={[track(1, "Y:\\Suno\\tema.mp3", "tema.mp3")]}
        selectedId={null}
        selectedIds={new Set()}
        sortBy="title"
        sortDirection="asc"
        loading={false}
        onSort={vi.fn()}
        onSelect={vi.fn()}
        onPlay={vi.fn()}
        onExternalDrag={vi.fn()}
        onRatingChange={vi.fn()}
        onSelectionChange={vi.fn()}
        onSelectAll={vi.fn()}
        visibleColumns={["title", "rating"]}
      />,
    );

    expect(screen.getByRole("columnheader", { name: /Título/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Rating/i })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: /Artista/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: /Ruta/i })).not.toBeInTheDocument();
  });

  it("propaga shiftKey al seleccionar desde checkbox", () => {
    const onSelectionChange = vi.fn();
    render(
      <TrackTable
        tracks={[track(1, "Y:\\Suno\\tema.mp3", "tema.mp3")]}
        selectedId={null}
        selectedIds={new Set()}
        sortBy="title"
        sortDirection="asc"
        loading={false}
        onSort={vi.fn()}
        onSelect={vi.fn()}
        onPlay={vi.fn()}
        onExternalDrag={vi.fn()}
        onRatingChange={vi.fn()}
        onSelectionChange={onSelectionChange}
        onSelectAll={vi.fn()}
      />,
    );

    fireEvent.click(screen.getAllByRole("checkbox")[1], {
      shiftKey: true,
    });

    expect(onSelectionChange).toHaveBeenCalledWith(1, true, { shiftKey: true });
  });

  it("usa Shift+click en fila para pedir seleccion por rango", () => {
    const onSelect = vi.fn();
    const onSelectionChange = vi.fn();
    render(
      <TrackTable
        tracks={[track(1, "Y:\\Suno\\tema.mp3", "tema.mp3")]}
        selectedId={null}
        selectedIds={new Set()}
        sortBy="title"
        sortDirection="asc"
        loading={false}
        onSort={vi.fn()}
        onSelect={onSelect}
        onPlay={vi.fn()}
        onExternalDrag={vi.fn()}
        onRatingChange={vi.fn()}
        onSelectionChange={onSelectionChange}
        onSelectAll={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText(/Misma/), { shiftKey: true });

    expect(onSelectionChange).toHaveBeenCalledWith(1, true, { shiftKey: true });
  });

  it("no selecciona la fila al enfocar un checkbox", () => {
    const onSelect = vi.fn();
    render(
      <TrackTable
        tracks={[track(1, "Y:\\Suno\\tema.mp3", "tema.mp3")]}
        selectedId={null}
        selectedIds={new Set()}
        sortBy="title"
        sortDirection="asc"
        loading={false}
        onSort={vi.fn()}
        onSelect={onSelect}
        onPlay={vi.fn()}
        onExternalDrag={vi.fn()}
        onRatingChange={vi.fn()}
        onSelectionChange={vi.fn()}
        onSelectAll={vi.fn()}
      />,
    );

    fireEvent.focus(screen.getAllByRole("checkbox")[1]);

    expect(onSelect).not.toHaveBeenCalled();
  });
});
