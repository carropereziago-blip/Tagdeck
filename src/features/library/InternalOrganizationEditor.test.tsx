// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OrganizationOptions, OrganizationPatch, Project } from "../../types/track";
import { InternalOrganizationEditor } from "./InternalOrganizationEditor";

const options: OrganizationOptions = {
  tags: [{ id: 1, name: "Suno", usageCount: 1 }],
  projects: [{ id: 7, name: "Album IA", description: null, trackCount: 2 }],
  versions: ["v1"],
  models: ["Suno v4.5"],
  smartCollections: [],
};

function applyCheckbox(field: string) {
  return document.getElementById(`internal-organization-apply-${field}`) as HTMLInputElement;
}

function renderBulk(onSave = vi.fn()) {
  const onCreateProject = vi.fn(async (name: string): Promise<Project> => ({
    id: 9,
    name,
    description: null,
    trackCount: 0,
  }));
  render(
    <InternalOrganizationEditor
      mode="bulk"
      selectedCount={2}
      track={null}
      options={options}
      onClose={vi.fn()}
      onCreateProject={onCreateProject}
      onSave={onSave}
    />,
  );
  return { onCreateProject };
}

describe("InternalOrganizationEditor", () => {
  beforeEach(() => {
    cleanup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("autoactiva Apply al escribir, seleccionar y añadir chips", () => {
    renderBulk();

    fireEvent.change(screen.getByLabelText(/Version|Versión/i), {
      target: { value: "v3" },
    });
    expect(applyCheckbox("version")).toBeChecked();

    fireEvent.change(screen.getByLabelText("Rating"), { target: { value: "8" } });
    expect(applyCheckbox("rating")).toBeChecked();

    fireEvent.change(screen.getByLabelText(/Status|Estado/i), {
      target: { value: "final" },
    });
    expect(applyCheckbox("status")).toBeChecked();

    fireEvent.change(screen.getByLabelText(/Notes|Notas/i), {
      target: { value: "Revisar" },
    });
    expect(applyCheckbox("notes")).toBeChecked();

    fireEvent.change(screen.getByLabelText(/Internal tags|Tags internos/i), {
      target: { value: "radio" },
    });
    fireEvent.keyDown(screen.getByLabelText(/Internal tags|Tags internos/i), {
      key: "Enter",
    });
    expect(applyCheckbox("tags")).toBeChecked();

    fireEvent.change(screen.getByLabelText("Mood"), { target: { value: "Cosmic" } });
    fireEvent.keyDown(screen.getByLabelText("Mood"), { key: "Enter" });
    expect(applyCheckbox("mood")).toBeChecked();
  });

  it("autoactiva Apply al escribir proyecto nuevo y lo asigna al crearlo", async () => {
    const onSave = vi.fn();
    const { onCreateProject } = renderBulk(onSave);

    fireEvent.change(screen.getByLabelText(/^(New project|Nuevo proyecto)$/i), {
      target: { value: "Nuevo proyecto" },
    });
    expect(applyCheckbox("project")).toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "+" }));

    await waitFor(() => expect(onCreateProject).toHaveBeenCalledWith("Nuevo proyecto"));
    expect(screen.getByLabelText(/^(Project|Proyecto)$/i)).toHaveValue("9");
  });

  it("desmarcar Apply evita aplicar ese campo aunque se haya editado", async () => {
    const onSave = vi.fn();
    renderBulk(onSave);

    fireEvent.change(screen.getByLabelText(/Version|Versión/i), {
      target: { value: "v3" },
    });
    fireEvent.click(applyCheckbox("version"));
    fireEvent.change(screen.getByLabelText("Rating"), { target: { value: "8" } });

    fireEvent.click(
      screen.getByRole("button", {
        name: /Save internal organization|Guardar organización interna/i,
      }),
    );

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const patch = onSave.mock.calls[0][0] as OrganizationPatch;
    expect(patch.rating).toEqual({ value: 8 });
    expect(patch.versionLabel).toBeUndefined();
  });

  it("Apply marcado con valor vacío limpia el campo", async () => {
    const onSave = vi.fn();
    renderBulk(onSave);

    fireEvent.change(screen.getByLabelText(/Version|Versión/i), {
      target: { value: "v3" },
    });
    fireEvent.change(screen.getByLabelText(/Version|Versión/i), { target: { value: "" } });

    fireEvent.click(
      screen.getByRole("button", {
        name: /Save internal organization|Guardar organización interna/i,
      }),
    );

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const patch = onSave.mock.calls[0][0] as OrganizationPatch;
    expect(patch.versionLabel).toEqual({ value: null });
  });

  it("no cambia inputs ni textareas a fondo negro al autoactivar Apply", () => {
    renderBulk();

    const versionInput = screen.getByLabelText(/Version|Versión/i);
    const notesTextarea = screen.getByLabelText(/Notes|Notas/i);

    fireEvent.change(versionInput, { target: { value: "v4" } });
    fireEvent.change(notesTextarea, { target: { value: "Notas internas" } });

    expect(versionInput.className).not.toContain("bg-[#181b20]");
    expect(versionInput.className).not.toContain("bg-black");
    expect(notesTextarea.className).not.toContain("bg-[#181b20]");
    expect(notesTextarea.className).not.toContain("bg-black");
    expect(versionInput.className).toContain("field");
    expect(notesTextarea.className).toContain("field");
  });
});
