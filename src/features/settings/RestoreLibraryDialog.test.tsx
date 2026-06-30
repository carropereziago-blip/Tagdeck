// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RestoreLibraryDialog } from "./RestoreLibraryDialog";

const mocks = vi.hoisted(() => ({
  open: vi.fn(),
  previewLibraryRestore: vi.fn(),
  applyLibraryRestore: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: mocks.open }));
vi.mock("../../lib/tauri", () => ({
  api: {
    previewLibraryRestore: mocks.previewLibraryRestore,
    applyLibraryRestore: mocks.applyLibraryRestore,
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.open.mockResolvedValue("C:\\Exports\\tagdeck_library_backup.json");
  mocks.previewLibraryRestore.mockResolvedValue({
    sourcePath: "C:\\Exports\\tagdeck_library_backup.json",
    totalTracks: 10,
    foundOriginal: 8,
    foundRelocated: 1,
    missing: 1,
    playlistsToRestore: 2,
    projectsToRestore: 3,
    tagsToRestore: 4,
    fieldsToRestore: ["rating", "status", "project"],
    missingItems: [{ sourceName: "Lost", path: "Z:\\Lost.mp3", relativePath: null }],
    sqliteBackupRequired: true,
  });
  mocks.applyLibraryRestore.mockResolvedValue({
    totalTracks: 10,
    restored: 9,
    missing: 1,
    playlistsRestored: 2,
    playlistSongsRestored: 8,
    backupPath: "C:\\AppData\\backups\\before_restore.sqlite3",
  });
});

afterEach(cleanup);

describe("RestoreLibraryDialog", () => {
  it("obliga a previsualizar y restaura con el modo recomendado", async () => {
    const onComplete = vi.fn();
    const onClose = vi.fn();
    const view = render(
      <RestoreLibraryDialog onClose={onClose} onComplete={onComplete} />,
    );

    expect(view.getByRole("button", { name: "Restaurar biblioteca" })).toBeDisabled();

    fireEvent.click(view.getByRole("button", { name: "Seleccionar backup JSON" }));
    await waitFor(() =>
      expect(mocks.previewLibraryRestore).toHaveBeenCalledWith(
        "C:\\Exports\\tagdeck_library_backup.json",
        [],
      ),
    );

    expect(await view.findByText("Vista previa de restauración")).toBeInTheDocument();
    expect(view.getByText("Archivos encontrados en rutas originales")).toBeInTheDocument();
    expect(
      view.getByText("Se creará una copia de seguridad de SQLite antes de restaurar."),
    ).toBeInTheDocument();

    fireEvent.click(view.getByRole("button", { name: "Restaurar biblioteca" }));

    await waitFor(() =>
      expect(mocks.applyLibraryRestore).toHaveBeenCalledWith(
        "C:\\Exports\\tagdeck_library_backup.json",
        "fill",
        [],
      ),
    );
    expect(onComplete).toHaveBeenCalledWith(
      expect.stringContaining("9 canciones restauradas"),
    );
    expect(onClose).toHaveBeenCalled();
  });
});
