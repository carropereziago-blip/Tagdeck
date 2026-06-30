// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import {
  shortcutRatingFromKey,
  shortcutStatusFromKey,
  shouldIgnoreKeyboardShortcut,
} from "./keyboardShortcuts";

function eventFor(target: EventTarget) {
  const event = new KeyboardEvent("keydown", { key: "r", bubbles: true });
  Object.defineProperty(event, "target", { value: target });
  return event;
}

describe("keyboardShortcuts", () => {
  it("ignora campos editables", () => {
    const input = document.createElement("input");
    const textarea = document.createElement("textarea");
    const select = document.createElement("select");
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");

    expect(shouldIgnoreKeyboardShortcut(eventFor(input))).toBe(true);
    expect(shouldIgnoreKeyboardShortcut(eventFor(textarea))).toBe(true);
    expect(shouldIgnoreKeyboardShortcut(eventFor(select))).toBe(true);
    expect(shouldIgnoreKeyboardShortcut(eventFor(editable))).toBe(true);
  });

  it("ignora atajos cuando hay un dialog modal abierto", () => {
    const button = document.createElement("button");
    const dialog = document.createElement("section");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    document.body.append(dialog, button);

    expect(shouldIgnoreKeyboardShortcut(eventFor(button))).toBe(true);

    dialog.remove();
    button.remove();
  });

  it("traduce teclas de rating y estado", () => {
    expect(shortcutRatingFromKey("7")).toBe(7);
    expect(shortcutRatingFromKey("0")).toBe(10);
    expect(shortcutRatingFromKey("x")).toBeNull();
    expect(shortcutStatusFromKey("r")).toBe("selected");
    expect(shortcutStatusFromKey("D")).toBe("generating");
    expect(shortcutStatusFromKey("u")).toBe("review");
  });
});
