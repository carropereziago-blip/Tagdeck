import { describe, expect, it } from "vitest";
import {
  buildRandomTrackQueue,
  canUseGlobalEndedAction,
  isValidLibraryEndedState,
  pickRandomLibraryNext,
  shouldBlockRepeatedAutoAdvance,
  shouldIgnoreDuplicatePlayRequest,
} from "./PlayerContext";

describe("reproducción continua de Biblioteca", () => {
  it("construye una cola aleatoria sin repetir la canción actual inmediatamente", () => {
    const queue = buildRandomTrackQueue([1, 2, 3, 4], 2, () => 0.5);

    expect(queue).not.toContain(2);
    expect(queue.sort()).toEqual([1, 3, 4]);
  });

  it("consume la cola de sesión antes de regenerarla", () => {
    const first = pickRandomLibraryNext({
      trackIds: [1, 2, 3],
      queueIds: [2, 3],
      currentId: 1,
      avoidRepeats: true,
      random: () => 0,
    });
    const second = pickRandomLibraryNext({
      trackIds: [1, 2, 3],
      queueIds: first.queueIds,
      currentId: first.nextId,
      avoidRepeats: true,
      random: () => 0,
    });

    expect(first.nextId).toBe(2);
    expect(first.queueIds).toEqual([3]);
    expect(second.nextId).toBe(3);
  });

  it("no inventa una siguiente canción cuando el contexto solo tiene la actual", () => {
    const result = pickRandomLibraryNext({
      trackIds: [7],
      queueIds: [],
      currentId: 7,
      avoidRepeats: true,
      random: () => 0,
    });

    expect(result.nextId).toBeNull();
    expect(result.queueIds).toEqual([]);
  });

  it("no aplica el avance global al terminar fuera de Biblioteca", () => {
    expect(canUseGlobalEndedAction("explorer", "next")).toBe(false);
    expect(canUseGlobalEndedAction("session", "next")).toBe(false);
    expect(canUseGlobalEndedAction("playlist", "next")).toBe(false);
    expect(canUseGlobalEndedAction("organization", "next")).toBe(false);
  });

  it("mantiene la repeticion global solo para contextos personalizados", () => {
    expect(canUseGlobalEndedAction("custom", "repeat")).toBe(true);
    expect(canUseGlobalEndedAction("explorer", "repeat")).toBe(false);
    expect(canUseGlobalEndedAction("custom", "next")).toBe(false);
  });

  it("ignora una peticion duplicada para la misma cancion ya sonando", () => {
    expect(
      shouldIgnoreDuplicatePlayRequest(
        {
          trackId: 7,
          status: "playing",
          positionMs: 1_000,
          durationMs: 180_000,
          volume: 0.8,
        },
        7,
      ),
    ).toBe(true);
    expect(
      shouldIgnoreDuplicatePlayRequest(
        {
          trackId: 7,
          status: "paused",
          positionMs: 1_000,
          durationMs: 180_000,
          volume: 0.8,
        },
        7,
      ),
    ).toBe(false);
  });

  it("no autoavanza si la duracion terminada es cero o desconocida", () => {
    const baseState = {
      trackId: 7,
      status: "ended" as const,
      positionMs: 0,
      volume: 0.8,
    };

    expect(
      isValidLibraryEndedState({
        state: { ...baseState, durationMs: 0 },
        context: "library",
        startedTrackId: 7,
        startedAt: 1_000,
        now: 4_000,
      }),
    ).toBe(false);
    expect(
      isValidLibraryEndedState({
        state: { ...baseState, durationMs: null },
        context: "library",
        startedTrackId: 7,
        startedAt: 1_000,
        now: 4_000,
      }),
    ).toBe(false);
  });

  it("no autoavanza por cambios de progreso, estado o cancion actual", () => {
    const endedState = {
      trackId: 7,
      status: "ended" as const,
      positionMs: 179_000,
      durationMs: 180_000,
      volume: 0.8,
    };

    expect(
      isValidLibraryEndedState({
        state: endedState,
        context: "library",
        startedTrackId: 7,
        startedAt: 1_000,
        now: 4_000,
      }),
    ).toBe(false);
    expect(
      isValidLibraryEndedState({
        state: { ...endedState, status: "playing" },
        context: "library",
        startedTrackId: 7,
        startedAt: 1_000,
        now: 4_000,
      }),
    ).toBe(false);
    expect(
      isValidLibraryEndedState({
        state: { ...endedState, positionMs: 180_000 },
        context: "library",
        startedTrackId: 8,
        startedAt: 1_000,
        now: 4_000,
      }),
    ).toBe(false);
  });

  it("autoavanza solo con ended valido en Biblioteca", () => {
    const state = {
      trackId: 7,
      status: "ended" as const,
      positionMs: 180_000,
      durationMs: 180_000,
      volume: 0.8,
    };

    expect(
      isValidLibraryEndedState({
        state,
        context: "explorer",
        startedTrackId: 7,
        startedAt: 1_000,
        now: 4_000,
      }),
    ).toBe(false);
    expect(
      isValidLibraryEndedState({
        state,
        context: "library",
        startedTrackId: 7,
        startedAt: 3_000,
        now: 4_000,
      }),
    ).toBe(false);
    expect(
      isValidLibraryEndedState({
        state,
        context: "library",
        startedTrackId: 7,
        startedAt: 1_000,
        now: 4_000,
      }),
    ).toBe(true);
  });

  it("bloquea autoavances repetidos en menos de 1500 ms", () => {
    expect(
      shouldBlockRepeatedAutoAdvance({
        now: 2_000,
        lastAutoAdvanceAt: 1_000,
        inFlight: false,
      }),
    ).toBe(true);
    expect(
      shouldBlockRepeatedAutoAdvance({
        now: 3_000,
        lastAutoAdvanceAt: 1_000,
        inFlight: false,
      }),
    ).toBe(false);
    expect(
      shouldBlockRepeatedAutoAdvance({
        now: 3_000,
        lastAutoAdvanceAt: 1_000,
        inFlight: true,
      }),
    ).toBe(true);
  });
});
