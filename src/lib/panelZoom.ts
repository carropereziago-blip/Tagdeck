import type { AppSettings } from "../features/settings/settings";

export const PANEL_ZOOM_MIN = 0.6;
export const PANEL_ZOOM_MAX = 1.4;
export const PANEL_ZOOM_STEP = 0.1;
export const PANEL_ZOOM_DEFAULT = 1;

export type PanelZoomAction = "in" | "out" | "reset";
export type PanelZoomTarget = "explorerRightPanelZoom" | "libraryInspectorZoom";

export function clampPanelZoom(value: unknown) {
  const numeric = typeof value === "number" && Number.isFinite(value)
    ? value
    : PANEL_ZOOM_DEFAULT;
  const rounded = Math.round(numeric * 10) / 10;
  return Math.min(PANEL_ZOOM_MAX, Math.max(PANEL_ZOOM_MIN, rounded));
}

export function nextPanelZoom(current: number, action: PanelZoomAction) {
  if (action === "reset") return PANEL_ZOOM_DEFAULT;
  return clampPanelZoom(
    current + (action === "in" ? PANEL_ZOOM_STEP : -PANEL_ZOOM_STEP),
  );
}

export function formatPanelZoom(value: number) {
  return `${Math.round(clampPanelZoom(value) * 100)}%`;
}

export function panelZoomActionFromKey(
  key: string,
  resetModifier = false,
): PanelZoomAction | null {
  if (key === "+" || key === "=") return "in";
  if (key === "-" || key === "_") return "out";
  if (resetModifier && key === "0") return "reset";
  return null;
}

export function updatePanelZoomSetting(
  current: AppSettings,
  target: PanelZoomTarget,
  action: PanelZoomAction,
): AppSettings {
  return {
    ...current,
    layout: {
      ...current.layout,
      [target]: nextPanelZoom(current.layout[target], action),
    },
  };
}
