// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { translate } from "../../i18n";
import type { UpdateCheckResult } from "../../types/track";
import { UpdateSettingsPanel } from "./UpdateSettingsPanel";

afterEach(cleanup);

describe("UpdateSettingsPanel", () => {
  it("muestra una actualizacion disponible y abre descarga/notas", () => {
    const onCheck = vi.fn();
    const onOpenUrl = vi.fn();
    const view = renderPanel({
      result: updateResult("1.4.0", "1.4.1", true),
      onCheck,
      onOpenUrl,
    });

    expect(view.getByText("New TagDeck version available")).toBeInTheDocument();
    expect(view.getByText("Installed")).toBeInTheDocument();
    expect(view.getAllByText("1.4.0").length).toBeGreaterThan(0);
    expect(view.getByText("1.4.1")).toBeInTheDocument();

    fireEvent.click(view.getByRole("button", { name: "Download update" }));
    expect(onOpenUrl).toHaveBeenCalledWith("https://soundbender.live/tagdeck/download");

    fireEvent.click(view.getByRole("button", { name: "Release notes" }));
    expect(onOpenUrl).toHaveBeenCalledWith(
      "https://soundbender.live/tagdeck/releases/1.4.1",
    );
  });

  it("muestra estado actualizado sin boton de descarga", () => {
    const view = renderPanel({ result: updateResult("1.4.0", "1.4.0", false) });

    expect(view.getByText("TagDeck is up to date.")).toBeInTheDocument();
    expect(view.queryByRole("button", { name: "Download update" })).not.toBeInTheDocument();
    expect(view.getByRole("button", { name: "Release notes" })).toBeInTheDocument();
  });

  it("muestra fallo de red sin bloquear el boton manual", () => {
    const onCheck = vi.fn();
    const view = renderPanel({ error: "Network error", onCheck });

    expect(view.getByText("Could not check for updates.")).toBeInTheDocument();
    fireEvent.click(view.getByRole("button", { name: "Check for updates" }));
    expect(onCheck).toHaveBeenCalled();
  });

  it("usa textos espanoles cuando el idioma activo es es", () => {
    const view = renderPanel({
      language: "es",
      result: updateResult("1.4.0", "1.4.1", true),
    });

    expect(view.getByText("Nueva versión de TagDeck disponible")).toBeInTheDocument();
    expect(view.getByRole("button", { name: "Descargar actualización" })).toBeInTheDocument();
  });
});

function renderPanel({
  language = "en",
  result = null,
  error = null,
  onCheck = vi.fn(),
  onOpenUrl = vi.fn(),
}: Partial<Parameters<typeof UpdateSettingsPanel>[0]> = {}) {
  return render(
    <UpdateSettingsPanel
      currentVersion="1.4.0"
      lastCheckedAt=""
      checking={false}
      result={result}
      error={error}
      language={language}
      t={(key) => translate(language, key)}
      onCheck={onCheck}
      onOpenUrl={onOpenUrl}
    />,
  );
}

function updateResult(
  currentVersion: string,
  latestVersion: string,
  updateAvailable: boolean,
): UpdateCheckResult {
  return {
    manifestUrl: "https://soundbender.live/tagdeck/latest.txt",
    currentVersion,
    latestVersion,
    updateAvailable,
    checkedAt: "2026-06-26T12:00:00Z",
    manifest: {
      app: "Soundbender TagDeck",
      manifestVersion: 1,
      channel: "beta",
      latestVersion,
      releasedAt: "2026-06-26T12:00:00Z",
      minimumSupportedVersion: "1.4.0",
      downloadUrl: "https://soundbender.live/tagdeck/download",
      releaseNotesUrl: `https://soundbender.live/tagdeck/releases/${latestVersion}`,
      mandatory: false,
      sha256: null,
      size: null,
      notes: {
        en: ["Manual update checks."],
        es: ["Comprobacion manual de actualizaciones."],
      },
    },
  };
}
