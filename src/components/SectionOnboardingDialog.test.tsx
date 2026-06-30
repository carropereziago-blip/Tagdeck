// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SectionOnboardingDialog } from "./SectionOnboardingDialog";

afterEach(cleanup);

describe("SectionOnboardingDialog", () => {
  it("muestra contenido contextual y marca como visto al pulsar Entendido", () => {
    const onClose = vi.fn();
    const view = render(
      <SectionOnboardingDialog section="library" onClose={onClose} />,
    );

    expect(view.getByRole("dialog", { name: "Biblioteca" })).toBeInTheDocument();
    expect(view.getByText("Escanea y navega tu biblioteca musical local.")).toBeInTheDocument();
    expect(view.getByLabelText("No volver a mostrar")).toBeInTheDocument();

    fireEvent.click(view.getByRole("button", { name: "Entendido" }));

    expect(onClose).toHaveBeenCalledWith(true);
  });

  it("descarta temporalmente con la X si no se marca No volver a mostrar", () => {
    const onClose = vi.fn();
    const view = render(
      <SectionOnboardingDialog section="session" onClose={onClose} />,
    );

    fireEvent.click(view.getByRole("button", { name: "Cerrar" }));

    expect(onClose).toHaveBeenCalledWith(false);
  });
});
