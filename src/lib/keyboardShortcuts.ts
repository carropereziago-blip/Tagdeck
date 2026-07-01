import type { SongStatus } from "../types/track";
import type {
  ShortcutContext,
  ShortcutRule,
} from "../features/settings/settings";

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

export function keyComboFromEvent(event: KeyboardEvent) {
  return {
    key: normalizeShortcutKey(event.key),
    code: event.code || undefined,
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
    meta: event.metaKey,
  };
}

export function shortcutMatchesEvent(rule: ShortcutRule, event: KeyboardEvent) {
  const combo = keyComboFromEvent(event);
  return (
    normalizeShortcutKey(rule.key) === combo.key &&
    Boolean(rule.ctrl) === combo.ctrl &&
    Boolean(rule.alt) === combo.alt &&
    Boolean(rule.shift) === combo.shift &&
    Boolean(rule.meta) === combo.meta
  );
}

export function findShortcutForEvent(
  rules: readonly ShortcutRule[],
  context: ShortcutContext,
  event: KeyboardEvent,
) {
  return rules.find(
    (rule) =>
      rule.enabled &&
      (rule.context === context || rule.context === "global") &&
      shortcutMatchesEvent(rule, event),
  ) ?? null;
}

export function shortcutComboId(rule: Pick<ShortcutRule, "key" | "ctrl" | "alt" | "shift" | "meta">) {
  return [
    rule.ctrl ? "ctrl" : "",
    rule.alt ? "alt" : "",
    rule.shift ? "shift" : "",
    rule.meta ? "meta" : "",
    normalizeShortcutKey(rule.key),
  ].filter(Boolean).join("+");
}

export function shortcutConflictIds(rules: readonly ShortcutRule[]) {
  const buckets = new Map<string, string[]>();
  for (const rule of rules) {
    if (!rule.enabled || !rule.key.trim()) continue;
    const key = `${rule.context}:${shortcutComboId(rule)}`;
    buckets.set(key, [...(buckets.get(key) ?? []), rule.id]);
  }
  return new Set(
    [...buckets.values()]
      .filter((ids) => ids.length > 1)
      .flat(),
  );
}

export function normalizeShortcutKey(key: string) {
  if (key === " ") return "Space";
  if (key.length === 1) return key.toLowerCase();
  return key;
}

export function formatShortcut(rule: Pick<ShortcutRule, "key" | "ctrl" | "alt" | "shift" | "meta">) {
  return [
    rule.ctrl ? "Ctrl" : "",
    rule.alt ? "Alt" : "",
    rule.shift ? "Shift" : "",
    rule.meta ? "Meta" : "",
    rule.key === " " ? "Space" : rule.key,
  ].filter(Boolean).join("+");
}
