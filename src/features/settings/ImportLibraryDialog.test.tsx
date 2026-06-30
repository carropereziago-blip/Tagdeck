// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ImportLibraryDialog } from "./ImportLibraryDialog";

const mocks = vi.hoisted(() => ({
  open: vi.fn(),
  previewLibraryImport: vi.fn(),
  applyLibraryImport: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: mocks.open }));
vi.mock("../../lib/tauri", () => ({
  api: {
    previewLibraryImport: mocks.previewLibraryImport,
    applyLibraryImport: mocks.applyLibraryImport,
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.open.mockResolvedValue("C:\\Exports\\tagdeck.json");
  mocks.previewLibraryImport.mockResolvedValue({
    sourcePath: "C:\\Exports\\tagdeck.json",
    total: 2,
    matched: 1,
    notFound: 1,
    ambiguous: 0,
    wouldUpdate: 1,
    playlistsFound: 0,
    items: [
      {
        sourceIndex: 1,
        sourceName: "Tema",
        matchedTrackId: 8,
        matchedTrackName: "Tema",
        matchMethod: "Ruta exacta",
        changes: ["Mood"],
        conflicts: [],
        ambiguous: false,
      },
    ],
  });
  mocks.applyLibraryImport.mockResolvedValue({
    total: 2,
    matched: 1,
    updated: 1,
    notFound: 1,
    ambiguous: 0,
    playlistsImported: 0,
    playlistSongsAdded: 0,
    backupPath: "C:\\AppData\\backups\\pre-import.sqlite3",
  });
});

afterEach(cleanup);

describe("ImportLibraryDialog", () => {
  it("previsualiza y aplica el modo seguro mostrando el backup", async () => {
    const onComplete = vi.fn();
    const onClose = vi.fn();
    const view = render(
      <ImportLibraryDialog onClose={onClose} onComplete={onComplete} />,
    );

    fireEvent.click(view.getByRole("button", { name: "Seleccionar archivo" }));
    await waitFor(() =>
      expect(mocks.previewLibraryImport).toHaveBeenCalledWith(
        "C:\\Exports\\tagdeck.json",
      ),
    );
    expect(await view.findByText("Ruta exacta", { exact: false })).toBeInTheDocument();

    fireEvent.click(
      view.getByRole("button", { name: "Importar en modo seguro" }),
    );

    await waitFor(() =>
      expect(mocks.applyLibraryImport).toHaveBeenCalledWith(
        "C:\\Exports\\tagdeck.json",
        "safe",
      ),
    );
    expect(onComplete).toHaveBeenCalledWith(
      expect.stringContaining("pre-import.sqlite3"),
    );
    expect(onClose).toHaveBeenCalled();
  });
});
