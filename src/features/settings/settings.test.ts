import { describe, expect, it } from "vitest";
import {
  applyFieldVisibilityPreset,
  DEFAULT_SETTINGS,
  FIELD_VISIBILITY_CAPABILITIES,
  FIELD_VISIBILITY_FIELDS,
  SECTION_ONBOARDING_IDS,
  defaultKeyboardShortcuts,
  isFieldRequiredInZone,
  isFieldSupportedInZone,
  isFieldVisible,
  normalizeSettings,
  resetSectionOnboarding,
  setFieldVisibility,
  setZoneVisibility,
  visibleFieldsForZone,
  visibleLibraryColumns,
} from "./settings";

describe("normalizeSettings", () => {
  it("usa valores seguros cuando faltan ajustes", () => {
    expect(normalizeSettings({})).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({}).interfaceLanguage).toBe("en");
    expect(normalizeSettings({}).interfaceMode).toBe("simple");
    expect(normalizeSettings({}).hasSeenOnboarding).toBe(false);
    expect(normalizeSettings({}).hiddenSectionOnboarding.library).toBe(false);
  });

  it("conserva ajustes válidos y completa los nuevos", () => {
    const settings = normalizeSettings({
      appearance: { theme: "dark" },
      library: { visibleLimit: 5000 },
      export: { csvDelimiter: ";" },
    });

    expect(settings.appearance.theme).toBe("dark");
    expect(settings.library.visibleLimit).toBe(5000);
    expect(settings.export.csvDelimiter).toBe(";");
    expect(settings.layout.inspectorVisible).toBe(true);
    expect(settings.player.libraryEndAction).toBe("stop");
    expect(settings.player.avoidLibraryRepeats).toBe(true);
    expect(settings.metadata.backupBeforeWrite).toBe(true);
  });

  it("normaliza el zoom de paneles derechos entre 60 y 140 por ciento", () => {
    const settings = normalizeSettings({
      layout: {
        explorerRightPanelZoom: 2,
        libraryInspectorZoom: 0.1,
      },
    });

    expect(settings.layout.explorerRightPanelZoom).toBe(1.4);
    expect(settings.layout.libraryInspectorZoom).toBe(0.6);
  });

  it.each(["soundbender-light", "soft-light"] as const)(
    "conserva el tema claro %s",
    (theme) => {
      const settings = normalizeSettings({ appearance: { theme } });

      expect(settings.appearance.theme).toBe(theme);
    },
  );

  it("recupera valores corruptos sin desactivar backups", () => {
    const settings = normalizeSettings({
      appearance: { theme: "solarized" },
      library: { visibleLimit: -1, visibleColumns: ["unknown"] },
      layout: { sidebarMode: "giant" },
      player: { defaultVolume: 8, libraryEndAction: "shuffle-forever" },
      metadata: { backupBeforeWrite: false },
      interfaceLanguage: "de",
    });

    expect(settings.appearance.theme).toBe("studio");
    expect(settings.library.visibleLimit).toBe(1000);
    expect(settings.library.visibleColumns).toContain("title");
    expect(settings.layout.sidebarMode).toBe("expanded");
    expect(settings.player.defaultVolume).toBe(1);
    expect(settings.player.libraryEndAction).toBe("stop");
    expect(settings.metadata.backupBeforeWrite).toBe(true);
    expect(settings.interfaceLanguage).toBe("en");
    expect(settings.interfaceMode).toBe("simple");
  });

  it("conserva el idioma espanol configurado", () => {
    const settings = normalizeSettings({ interfaceLanguage: "es" });

    expect(settings.interfaceLanguage).toBe("es");
  });

  it("normaliza onboardings por seccion y recupera valores corruptos", () => {
    const settings = normalizeSettings({
      hiddenSectionOnboarding: {
        library: true,
        explorer: "yes",
        unknown: true,
      },
    });

    expect(settings.hiddenSectionOnboarding.library).toBe(true);
    expect(settings.hiddenSectionOnboarding.explorer).toBe(false);
    expect(Object.keys(settings.hiddenSectionOnboarding)).toEqual([
      ...SECTION_ONBOARDING_IDS,
    ]);
  });

  it("restaura todos los onboardings de seccion", () => {
    expect(resetSectionOnboarding()).toEqual(
      Object.fromEntries(SECTION_ONBOARDING_IDS.map((section) => [section, false])),
    );
  });

  it("normaliza la matriz de visibilidad y protege campos mínimos", () => {
    const settings = normalizeSettings({
      fieldVisibility: {
        libraryTable: ["artist", "unknown"],
        explorerEditor: ["mood", "notes"],
      },
    });

    expect(settings.fieldVisibility.libraryTable).toContain("title");
    expect(settings.fieldVisibility.libraryTable).toContain("artist");
    expect(settings.fieldVisibility.libraryTable).not.toContain("unknown");
    expect(settings.fieldVisibility.explorerEditor).toEqual(
      expect.arrayContaining(["rating", "status", "generationModel", "project", "version", "nextAction", "mood", "notes"]),
    );
  });

  it("sincroniza columnas de biblioteca desde la visibilidad por campos", () => {
    const config = setFieldVisibility(DEFAULT_SETTINGS.fieldVisibility, "libraryTable", "rating", false);
    const settings = normalizeSettings({ fieldVisibility: config });

    expect(isFieldVisible(settings.fieldVisibility, "libraryTable", "rating")).toBe(false);
    expect(visibleLibraryColumns(settings.fieldVisibility)).not.toContain("rating");
    expect(settings.library.visibleColumns).not.toContain("rating");
    expect(settings.library.visibleColumns).toContain("title");
  });

  it("normaliza y persiste el orden de columnas de Biblioteca", () => {
    const settings = normalizeSettings({
      library: {
        columnOrder: ["rating", "title", "rating", "unknown"],
      },
    });

    expect(settings.library.columnOrder[0]).toBe("rating");
    expect(settings.library.columnOrder[1]).toBe("title");
    expect(settings.library.columnOrder.filter((column) => column === "rating")).toHaveLength(1);
    expect(visibleLibraryColumns(settings.fieldVisibility, settings.library.columnOrder)[0]).toBe("rating");
  });

  it("define atajos por defecto con valores internos reales", () => {
    const shortcuts = defaultKeyboardShortcuts();

    expect(shortcuts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "rating", value: "10", key: "0" }),
        expect.objectContaining({ field: "status", value: "archived", key: "A" }),
        expect.objectContaining({ field: "status", value: "editing", key: "P" }),
        expect.objectContaining({ field: "status", value: "review", key: "U" }),
        expect.objectContaining({ field: "action", value: "play_pause", key: "Space" }),
        expect.objectContaining({ field: "action", value: "reset_zoom", key: "0", ctrl: true }),
      ]),
    );
    expect(shortcuts.some((shortcut) => shortcut.value === "in_progress")).toBe(false);
    expect(shortcuts.some((shortcut) => shortcut.value === "radio_ready")).toBe(false);
  });

  it("aplica presets manteniendo los minimos de navegacion", () => {
    const preset = applyFieldVisibilityPreset("minimal");

    expect(preset.libraryTable).toEqual(["title", "artist", "duration"]);
    expect(preset.organizationTable).toContain("title");
    expect(preset.explorerCard).toContain("title");
  });

  it("incluye Modelo como campo visible configurable", () => {
    expect(
      FIELD_VISIBILITY_FIELDS.some(
        (field) => field.id === "generationModel" && field.category === "curation",
      ),
    ).toBe(true);
    expect(DEFAULT_SETTINGS.fieldVisibility.explorerEditor).toContain(
      "generationModel",
    );
    expect(DEFAULT_SETTINGS.fieldVisibility.libraryInspector).toContain(
      "generationModel",
    );
    expect(DEFAULT_SETTINGS.fieldVisibility.sessionCurrent).toContain(
      "generationModel",
    );
  });

  it("ignora campos guardados que no estan soportados en una zona", () => {
    const settings = normalizeSettings({
      fieldVisibility: {
        libraryTable: ["title", "genre", "extendedTags", "lyrics", "backupPath"],
        sessionQueue: ["title", "rating", "mood", "playOrder"],
      },
    });

    expect(settings.fieldVisibility.libraryTable).toContain("genre");
    expect(settings.fieldVisibility.libraryTable).not.toContain("extendedTags");
    expect(settings.fieldVisibility.libraryTable).not.toContain("lyrics");
    expect(settings.fieldVisibility.libraryTable).not.toContain("backupPath");
    expect(settings.fieldVisibility.sessionQueue).toEqual(["title", "mood", "playOrder"]);
  });

  it("bloquea campos obligatorios aunque se intenten ocultar", () => {
    const config = setFieldVisibility(
      DEFAULT_SETTINGS.fieldVisibility,
      "libraryTable",
      "title",
      false,
    );

    expect(isFieldRequiredInZone("libraryTable", "title")).toBe(true);
    expect(config.libraryTable).toContain("title");
    expect(isFieldVisible(config, "libraryTable", "title")).toBe(true);
  });

  it("no permite activar campos no disponibles en una zona", () => {
    const config = setFieldVisibility(
      DEFAULT_SETTINGS.fieldVisibility,
      "libraryTable",
      "extendedTags",
      true,
    );

    expect(isFieldSupportedInZone("libraryTable", "extendedTags")).toBe(false);
    expect(config.libraryTable).not.toContain("extendedTags");
    expect(isFieldVisible(config, "libraryTable", "extendedTags")).toBe(false);
  });

  it("seleccionar toda una zona respeta las capacidades reales", () => {
    const config = setZoneVisibility(
      DEFAULT_SETTINGS.fieldVisibility,
      "libraryTable",
      true,
    );

    expect(config.libraryTable).toEqual(
      expect.arrayContaining([...FIELD_VISIBILITY_CAPABILITIES.libraryTable.required]),
    );
    expect(config.libraryTable).toEqual(
      expect.arrayContaining([...FIELD_VISIBILITY_CAPABILITIES.libraryTable.supported]),
    );
    expect(config.libraryTable).not.toContain("extendedTags");
  });

  it("los campos visibles de una zona filtran configuraciones antiguas", () => {
    const fields = visibleFieldsForZone(
      { ...DEFAULT_SETTINGS.fieldVisibility, libraryTable: ["title", "extendedTags"] },
      "libraryTable",
    );

    expect(fields.has("title")).toBe(true);
    expect(fields.has("extendedTags")).toBe(false);
  });

  it("mantiene Modelo visible en Session aunque una configuracion antigua lo oculte", () => {
    const fields = visibleFieldsForZone(
      { ...DEFAULT_SETTINGS.fieldVisibility, sessionCurrent: ["title", "version", "genre"] },
      "sessionCurrent",
    );

    expect(fields.has("generationModel")).toBe(true);
  });
});
