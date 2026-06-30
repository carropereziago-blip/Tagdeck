// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MetadataEditor } from "./MetadataEditor";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

describe("MetadataEditor", () => {
  it("mantiene montados los controles al activar y editar un campo masivo", () => {
    render(
      <MetadataEditor
        mode="bulk"
        selectedCount={2}
        track={null}
        metadata={null}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    const checkbox = screen.getAllByRole("checkbox")[0];
    const titleInput = screen.getAllByRole("textbox")[0];

    fireEvent.click(checkbox);
    expect(screen.getAllByRole("checkbox")[0]).toBe(checkbox);
    expect(checkbox).toBeChecked();

    titleInput.focus();
    fireEvent.change(titleInput, { target: { value: "Nuevo título" } });

    expect(screen.getAllByRole("textbox")[0]).toBe(titleInput);
    expect(document.activeElement).toBe(titleInput);
    expect(checkbox).toBeChecked();
  });
});
