import { describe, expect, it } from "vitest";
import { statusLabel, translate } from ".";

describe("i18n", () => {
  it("traduce claves principales en ingles y espanol", () => {
    expect(translate("en", "nav.library")).toBe("Library");
    expect(translate("es", "nav.library")).toBe("Biblioteca");
  });

  it("usa fallback a ingles si falta una clave localizada", () => {
    expect(translate("es", "missing.key")).toBe("missing.key");
    expect(translate("es", "settings.title")).toBe("Ajustes");
  });

  it("traduce estados sin cambiar el valor interno", () => {
    expect(statusLabel("en", "review")).toBe("Unreviewed");
    expect(statusLabel("es", "review")).toBe("Sin revisar");
  });

  it("traduce ayudas nuevas de atajos y rendimiento", () => {
    expect(translate("en", "library.keyboardShortcuts")).toBe("Library shortcuts");
    expect(translate("es", "session.keyboardShortcuts")).toBe("Atajos de Sesión");
    expect(translate("en", "library.searchPlaceholder")).toBe(
      "Search all fields and tags...",
    );
    expect(translate("es", "library.searchPlaceholder")).toBe(
      "Buscar en todos los campos y tags...",
    );
    expect(translate("en", "library.openSongInExplorer")).toBe(
      "Open Song in Explorer",
    );
    expect(translate("es", "library.selectSongsFirst")).toBe(
      "Selecciona una o varias canciones primero.",
    );
    expect(translate("en", "library.shortcutsHelp")).toContain("0: Set rating 10");
    expect(translate("en", "library.shortcutsHelp")).toContain("Ctrl+0");
    expect(translate("es", "library.shortcutsHelp")).toContain("0: Asignar rating 10");
    expect(translate("es", "library.shortcutsHelp")).toContain("Ctrl+0");
    expect(translate("en", "library.ratingApplied")).toBe(
      "Rating {rating} set for {count} songs.",
    );
    expect(translate("es", "library.visibleSongsSelected")).toBe(
      "{count} canciones visibles seleccionadas.",
    );
    expect(translate("en", "settings.highVisibleLimitWarning")).toContain(
      "performance",
    );
    expect(translate("es", "settings.highVisibleLimitWarning")).toContain(
      "rendimiento",
    );
  });

  it("traduce onboarding contextual por seccion", () => {
    expect(translate("en", "sectionOnboarding.library.title")).toBe("Library");
    expect(translate("es", "sectionOnboarding.library.title")).toBe("Biblioteca");
    expect(translate("en", "sectionOnboarding.resetAll")).toBe(
      "Reset all section tips",
    );
    expect(translate("es", "sectionOnboarding.resetAll")).toBe(
      "Restaurar todos los consejos",
    );
  });

  it("traduce la base experimental de sincronizacion movil", () => {
    expect(translate("en", "settings.mobileSyncReadiness")).toBe(
      "Mobile / Sync readiness",
    );
    expect(translate("es", "settings.mobileSyncReadiness")).toBe(
      "Preparación móvil / sincronización",
    );
    expect(translate("en", "settings.exportSyncManifest")).toBe("Export manifest");
    expect(translate("es", "settings.exportSyncManifest")).toBe("Exportar manifiesto");
  });

  it("traduce reddit validation build", () => {
    expect(translate("en", "explorer.creativeDecision")).toBe("Creative Decision");
    expect(translate("es", "explorer.creativeDecision")).toBe("Decisión creativa");
    expect(translate("en", "quickTag.custom_model_seed")).toBe("Custom Model Seed");
    expect(translate("es", "quickTag.custom_model_seed")).toBe("Semilla para modelo");
    expect(translate("en", "workflowPreset.release_prep")).toBe("Release Prep");
    expect(translate("es", "workflowPreset.release_prep")).toBe(
      "Preparación de publicación",
    );
    expect(translate("en", "packs.exportModelSeed")).toBe("Export Model Seed Pack");
    expect(translate("es", "packs.exportModelSeed")).toBe(
      "Exportar pack de semillas de modelo",
    );
  });

  it("traduce textos compactos de workflow presets", () => {
    expect(translate("en", "workflow.queueMismatchShort")).toBe("Queue mismatch");
    expect(translate("es", "workflow.queueMismatchShort")).toBe("Cola no coincidente");
    expect(translate("en", "workflow.metrics")).toBe("Metrics");
    expect(translate("es", "workflow.metrics")).toBe("Métricas");
    expect(translate("en", "workflow.recommended")).toBe("Recommended");
    expect(translate("es", "workflow.recommended")).toBe("Recomendado");
    expect(translate("en", "workflowWorkCard.release_prep")).toBe(
      "Release preparation fields",
    );
    expect(translate("es", "workflowWorkCard.release_prep")).toBe(
      "Campos de publicación",
    );
  });

  it("traduce textos del inspector de metadata embebida", () => {
    expect(translate("en", "field.titleTag")).toBe("Title tag");
    expect(translate("es", "field.titleTag")).toBe("Tag de título");
    expect(translate("en", "library.noEmbeddedTitle")).toBe("No embedded title");
    expect(translate("es", "library.noEmbeddedTitle")).toBe("Sin título embebido");
    expect(translate("en", "library.useFileNameAsTitle")).toBe(
      "Use file name as title",
    );
    expect(translate("es", "library.useFileNameAsTitle")).toBe(
      "Usar nombre de archivo como título",
    );
  });

  it("traduce textos de edicion de letras", () => {
    expect(translate("en", "library.saveLyrics")).toBe("Save lyrics");
    expect(translate("es", "library.saveLyrics")).toBe("Guardar letra");
    expect(translate("en", "library.lyricsSaveFailed")).toBe(
      "Could not save lyrics.",
    );
    expect(translate("es", "library.unsavedLyricsChanges")).toBe(
      "Cambios de letra sin guardar",
    );
  });

  it("traduce textos de autonumeracion de versiones", () => {
    expect(translate("en", "library.autoNumberVersions")).toBe("Auto-number versions");
    expect(translate("es", "library.autoNumberVersions")).toBe("Autonumerar versiones");
    expect(translate("en", "library.autoNumberOrderNatural")).toBe(
      "File name natural order",
    );
    expect(translate("es", "library.autoNumberOrderNatural")).toBe(
      "Orden natural de nombre",
    );
    expect(translate("en", "library.autoNumberFormatError")).toBe(
      "The format must include {n}.",
    );
    expect(translate("es", "library.autoNumberFormatError")).toBe(
      "El formato debe incluir {n}.",
    );
    expect(translate("en", "field.internalVersionLabel")).toBe(
      "Internal version label",
    );
    expect(translate("es", "field.internalVersionLabel")).toBe(
      "Etiqueta interna de versión",
    );
  });

  it("traduce criterios y mensajes de Session", () => {
    expect(translate("en", "session.criterion")).toBe("Criterion");
    expect(translate("es", "session.criterion")).toBe("Criterio");
    expect(translate("en", "sessionCriterion.unrated")).toBe("No rating");
    expect(translate("es", "sessionCriterion.unrated")).toBe("Sin rating");
    expect(translate("en", "sessionCriterion.needs_metadata")).toBe(
      "Needs Metadata",
    );
    expect(translate("es", "sessionCriterion.needs_metadata")).toBe(
      "Necesitan metadatos",
    );
    expect(translate("en", "session.playlistEmpty")).toBe(
      "This playlist has no songs.",
    );
    expect(translate("es", "session.playlistEmpty")).toBe(
      "Esta lista no tiene canciones.",
    );
  });
});
