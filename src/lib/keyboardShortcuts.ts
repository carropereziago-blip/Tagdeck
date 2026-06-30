import type { SongStatus } from "../types/track";

const EDITABLE_SELECTOR = [
  "input",
  "textarea",
  "select",
  "[contenteditable='true']",
  "[role='textbox']",
  "[role='combobox']",
  "[data-ignore-shortcuts='true']",
].join(",");

export function shouldIgnoreKeyboardShortcut(event: KeyboardEvent) {
  if (event.defaultPrevented) return true;
  const target = event.target;
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest(EDITABLE_SELECTOR)) return true;
  if (target.isContentEditable) return true;
  const documentElement = target.ownerDocument;
  if (
    documentElement.querySelector(
      "[role='dialog'][aria-modal='true'], dialog[open]",
    )
  ) {
    return true;
  }
  return false;
}

export function shortcutRatingFromKey(key: string) {
  if (key === "0") return 10;
  if (/^[1-9]$/.test(key)) return Number(key);
  return null;
}

export function shortcutStatusFromKey(key: string): SongStatus | null {
  const shortcutStatus: Record<string, SongStatus> = {
    r: "selected",
    d: "generating",
    a: "archived",
    i: "idea",
    p: "editing",
    u: "review",
  };
  return shortcutStatus[key.toLowerCase()] ?? null;
}
