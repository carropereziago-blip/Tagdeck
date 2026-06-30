import { describe, expect, it } from "vitest";
import { resolveUnsyncedLyrics } from "./lyrics";
import type { AudioMetadata, TrackDetails } from "../types/track";

const track = {
  lyrics: "letra guardada por el escaneo",
} as TrackDetails;

describe("resolveUnsyncedLyrics", () => {
  it("prefers the explicit live unsynced lyrics field", () => {
    const metadata = {
      unsyncedLyrics: "USLT en vivo",
      lyrics: "letra genérica",
    } as AudioMetadata;

    expect(resolveUnsyncedLyrics(metadata, track)).toBe("USLT en vivo");
  });

  it("falls back to generic live lyrics and then scanned lyrics", () => {
    expect(
      resolveUnsyncedLyrics(
        { unsyncedLyrics: null, lyrics: "letra genérica" } as AudioMetadata,
        track,
      ),
    ).toBe("letra genérica");
    expect(resolveUnsyncedLyrics(null, track)).toBe(
      "letra guardada por el escaneo",
    );
  });
});
