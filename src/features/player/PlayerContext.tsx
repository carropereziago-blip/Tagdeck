import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api } from "../../lib/tauri";
import type { PlayerState, TrackDetails, TrackSummary } from "../../types/track";
import { useSettings } from "../settings/SettingsContext";

const INITIAL_PLAYER_STATE: PlayerState = {
  trackId: null,
  status: "stopped",
  positionMs: 0,
  durationMs: null,
  volume: 0.8,
};

const AUTO_ADVANCE_COOLDOWN_MS = 1_500;
const AUTO_ADVANCE_RELEASE_MS = 500;
const MIN_PLAY_TIME_BEFORE_AUTO_ADVANCE_MS = 1_500;
const ENDED_POSITION_TOLERANCE_MS = 500;

export type PlaybackContext =
  | "library"
  | "explorer"
  | "session"
  | "playlist"
  | "organization"
  | "custom";

export type PlayReason =
  | "user_click"
  | "user_double_click"
  | "global_next_button"
  | "global_previous_button"
  | "library_ended_auto_random"
  | "library_ended_auto_order"
  | "library_ended_auto_repeat"
  | "custom_ended_repeat"
  | "explorer_save_and_next"
  | "explorer_skip"
  | "explorer_next_button"
  | "explorer_previous_button"
  | "session_playlist_loaded"
  | "session_queue_next"
  | "session_queue_previous"
  | "playlist_next"
  | "organization_play"
  | "unknown";

type PlaybackControls = {
  next?: () => Promise<void> | void;
  previous?: () => Promise<void> | void;
  ended?: () => Promise<void> | void;
};

interface PlayerContextValue {
  state: PlayerState;
  currentTrack: TrackDetails | null;
  selectedTrack: TrackDetails | null;
  error: string | null;
  setLibraryTracks: (
    tracks: TrackSummary[],
    context?: PlaybackContext,
    controls?: PlaybackControls,
  ) => void;
  setSelectedTrack: (track: TrackDetails | null) => void;
  forgetTracks: (trackIds: number[] | null) => void;
  playTrack: (
    track: TrackDetails,
    reason: PlayReason,
    contextOverride?: PlaybackContext,
  ) => Promise<void>;
  togglePlayback: () => Promise<void>;
  stop: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  playNext: () => Promise<void>;
  playPrevious: () => Promise<void>;
}

export function buildRandomTrackQueue(
  trackIds: number[],
  currentId: number | null | undefined,
  random = Math.random,
) {
  const uniqueIds = [...new Set(trackIds)];
  const candidates =
    currentId === null || currentId === undefined
      ? uniqueIds
      : uniqueIds.filter((id) => id !== currentId);
  const shuffled = [...candidates];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

export function pickRandomLibraryNext({
  trackIds,
  queueIds,
  currentId,
  avoidRepeats,
  random = Math.random,
}: {
  trackIds: number[];
  queueIds: number[];
  currentId: number | null | undefined;
  avoidRepeats: boolean;
  random?: () => number;
}) {
  const validIds = new Set(trackIds);
  let queue = avoidRepeats
    ? queueIds.filter((id) => validIds.has(id) && id !== currentId)
    : buildRandomTrackQueue(trackIds, currentId, random);

  if (queue.length === 0) {
    queue = buildRandomTrackQueue(trackIds, currentId, random);
  }

  return {
    nextId: queue[0] ?? null,
    queueIds: queue.slice(1),
  };
}

export function canUseGlobalEndedAction(
  context: PlaybackContext,
  endAction: "stop" | "next" | "repeat",
) {
  return context === "custom" && endAction === "repeat";
}

export function shouldIgnoreDuplicatePlayRequest(
  state: PlayerState,
  requestedTrackId: number,
) {
  return state.trackId === requestedTrackId && state.status === "playing";
}

export function isValidLibraryEndedState({
  state,
  context,
  startedTrackId,
  startedAt,
  now,
  minPlayTimeMs = MIN_PLAY_TIME_BEFORE_AUTO_ADVANCE_MS,
}: {
  state: PlayerState;
  context: PlaybackContext;
  startedTrackId: number | null | undefined;
  startedAt: number | null | undefined;
  now: number;
  minPlayTimeMs?: number;
}) {
  if (context !== "library") return false;
  if (state.status !== "ended" || state.trackId === null) return false;
  if (!state.durationMs || state.durationMs <= 0) return false;
  if (state.positionMs < state.durationMs - ENDED_POSITION_TOLERANCE_MS) {
    return false;
  }
  if (startedTrackId !== state.trackId || !startedAt) return false;
  return now - startedAt >= minPlayTimeMs;
}

export function shouldBlockRepeatedAutoAdvance({
  now,
  lastAutoAdvanceAt,
  inFlight,
  cooldownMs = AUTO_ADVANCE_COOLDOWN_MS,
}: {
  now: number;
  lastAutoAdvanceAt: number;
  inFlight: boolean;
  cooldownMs?: number;
}) {
  return inFlight || now - lastAutoAdvanceAt < cooldownMs;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { settings, loaded: settingsLoaded, updateSettings } = useSettings();
  const [state, setState] = useState(INITIAL_PLAYER_STATE);
  const [currentTrack, setCurrentTrack] = useState<TrackDetails | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<TrackDetails | null>(null);
  const [libraryTracks, setLibraryTrackState] = useState<TrackSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const volumeInitialized = useRef(false);
  const handledEndedTrack = useRef<number | null>(null);
  const playbackContext = useRef<PlaybackContext>("custom");
  const contextControls = useRef<PlaybackControls>({});
  const contextSignature = useRef("");
  const randomQueueIds = useRef<number[]>([]);
  const historyIds = useRef<number[]>([]);
  const stateRef = useRef<PlayerState>(INITIAL_PLAYER_STATE);
  const playStartedRef = useRef<{ trackId: number; startedAt: number } | null>(null);
  const autoAdvanceInFlight = useRef(false);
  const lastAutoAdvanceAt = useRef(0);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const refreshState = useCallback(async () => {
    try {
      setState(await api.getPlayerState(settings.player.playCountThreshold));
      setError(null);
    } catch (playerError) {
      setError(String(playerError));
    }
  }, [settings.player.playCountThreshold]);

  useEffect(() => {
    void refreshState();
  }, [refreshState]);

  useEffect(() => {
    if (!settingsLoaded || volumeInitialized.current) return;
    volumeInitialized.current = true;
    const volume = settings.player.rememberVolume
      ? settings.player.lastVolume
      : settings.player.defaultVolume;
    void api.setPlayerVolume(volume).then(setState).catch((playerError) => {
      setError(String(playerError));
    });
  }, [settings.player, settingsLoaded]);

  useEffect(() => {
    if (state.trackId === null) {
      return;
    }
    const interval = window.setInterval(
      () => void refreshState(),
      state.status === "playing" ? 350 : 1_000,
    );
    return () => window.clearInterval(interval);
  }, [refreshState, state.status, state.trackId]);

  const setLibraryTracks = useCallback(
    (
      tracks: TrackSummary[],
      context: PlaybackContext = "custom",
      controls: PlaybackControls = {},
    ) => {
      setLibraryTrackState(tracks);
      const signature = `${context}:${tracks.map((track) => track.id).join(",")}`;
      if (signature !== contextSignature.current) {
        contextSignature.current = signature;
        randomQueueIds.current = [];
        historyIds.current = [];
      }
      playbackContext.current = context;
      contextControls.current = controls;
    },
    [],
  );

  const rememberCurrentForLibrary = useCallback(
    (targetId: number) => {
      if (playbackContext.current !== "library") return;
      const currentId = currentTrack?.id;
      if (!currentId || currentId === targetId) return;
      historyIds.current = [
        ...historyIds.current.filter((id) => id !== currentId),
        currentId,
      ].slice(-500);
    },
    [currentTrack?.id],
  );

  const playResolvedTrack = useCallback(
    async (
      track: TrackDetails,
      rememberHistory = true,
      reason: PlayReason,
      contextOverride?: PlaybackContext,
    ) => {
      try {
        const context = contextOverride ?? playbackContext.current;
        if (contextOverride) {
          playbackContext.current = contextOverride;
        }
        if (reason === "unknown") {
          console.error(
            `[PLAYER] ERROR play request without reason id=${track.id} context=${context}`,
          );
        }
        if (shouldIgnoreDuplicatePlayRequest(stateRef.current, track.id)) {
          console.info(
            `[PLAYER] blocked duplicate play id=${track.id} context=${context} reason=${reason}`,
          );
          setCurrentTrack(track);
          setSelectedTrack(track);
          setError(null);
          return;
        }
        if (rememberHistory) rememberCurrentForLibrary(track.id);
        console.info(
          `[PLAYER] play request id=${track.id} context=${context} reason=${reason} title=${track.title || track.fileName} at=${new Date().toISOString()}`,
        );
        const nextState = await api.playTrack(track.id, context, reason);
        setState(nextState);
        if (nextState.status === "playing" && nextState.trackId === track.id) {
          playStartedRef.current = { trackId: track.id, startedAt: Date.now() };
        }
        setCurrentTrack(track);
        setSelectedTrack(track);
        setError(null);
      } catch (playerError) {
        setError(String(playerError));
      }
    },
    [rememberCurrentForLibrary],
  );

  const playTrack = useCallback(
    async (
      track: TrackDetails,
      reason: PlayReason,
      contextOverride?: PlaybackContext,
    ) => {
      await playResolvedTrack(track, true, reason, contextOverride);
    },
    [playResolvedTrack],
  );

  const playSummary = useCallback(
    async (
      track: TrackSummary,
      rememberHistory = true,
      reason: PlayReason = "unknown",
      contextOverride?: PlaybackContext,
    ) => {
      try {
        await playResolvedTrack(
          await api.getTrack(track.id),
          rememberHistory,
          reason,
          contextOverride,
        );
      } catch (playerError) {
        setError(String(playerError));
      }
    },
    [playResolvedTrack],
  );

  const togglePlayback = useCallback(async () => {
    try {
      if (state.status === "playing") {
        setState(await api.pausePlayer());
      } else if (state.status === "paused") {
        setState(await api.resumePlayer());
      } else {
        const track =
          selectedTrack && selectedTrack.id !== currentTrack?.id
            ? selectedTrack
            : currentTrack ?? selectedTrack;
        if (track) {
          await playTrack(track, "user_click");
        }
      }
      setError(null);
    } catch (playerError) {
      setError(String(playerError));
    }
  }, [currentTrack, playTrack, selectedTrack, state.status]);

  const stop = useCallback(async () => {
    try {
      setState(await api.stopPlayer());
      setError(null);
    } catch (playerError) {
      setError(String(playerError));
    }
  }, []);

  const forgetTracks = useCallback((trackIds: number[] | null) => {
    if (trackIds === null) {
      setCurrentTrack(null);
      setSelectedTrack(null);
      setLibraryTrackState([]);
      randomQueueIds.current = [];
      historyIds.current = [];
      contextSignature.current = "";
      playbackContext.current = "custom";
      contextControls.current = {};
      return;
    }

    const forgotten = new Set(trackIds);
    setCurrentTrack((track) => (track && forgotten.has(track.id) ? null : track));
    setSelectedTrack((track) => (track && forgotten.has(track.id) ? null : track));
    setLibraryTrackState((tracks) =>
      tracks.filter((track) => !forgotten.has(track.id)),
    );
    randomQueueIds.current = randomQueueIds.current.filter((id) => !forgotten.has(id));
    historyIds.current = historyIds.current.filter((id) => !forgotten.has(id));
  }, []);

  const seek = useCallback(async (positionMs: number) => {
    try {
      setState(await api.seekPlayer(Math.max(0, Math.round(positionMs))));
      setError(null);
    } catch (playerError) {
      setError(String(playerError));
    }
  }, []);

  const setVolume = useCallback(async (volume: number) => {
    try {
      const normalized = Math.min(1, Math.max(0, volume));
      setState(await api.setPlayerVolume(normalized));
      if (settings.player.rememberVolume) {
        updateSettings((current) => ({
          ...current,
          player: { ...current.player, lastVolume: normalized },
        }));
      }
      setError(null);
    } catch (playerError) {
      setError(String(playerError));
    }
  }, [settings.player.rememberVolume, updateSettings]);

  const referenceTrackId = useCallback(() => {
    return state.status === "playing" ||
      state.status === "paused" ||
      state.status === "ended"
      ? currentTrack?.id ?? selectedTrack?.id
      : selectedTrack?.id ?? currentTrack?.id;
  }, [currentTrack?.id, selectedTrack?.id, state.status]);

  const playAdjacent = useCallback(
    async (offset: -1 | 1, reason: PlayReason) => {
      if (libraryTracks.length === 0) {
        return;
      }

      const referenceId = referenceTrackId();
      const currentIndex = libraryTracks.findIndex((track) => track.id === referenceId);
      const targetIndex =
        currentIndex < 0
          ? offset > 0
            ? 0
            : libraryTracks.length - 1
          : Math.min(libraryTracks.length - 1, Math.max(0, currentIndex + offset));
      const target = libraryTracks[targetIndex];
      if (!target || target.id === referenceId) {
        return;
      }

        await playSummary(target, offset > 0, reason, playbackContext.current);
    },
    [libraryTracks, playSummary, referenceTrackId],
  );

  const playRandomLibraryTrack = useCallback(async (reason: PlayReason) => {
    if (libraryTracks.length === 0) return;
    const trackIds = libraryTracks.map((track) => track.id);
    const picked = pickRandomLibraryNext({
      trackIds,
      queueIds: randomQueueIds.current,
      currentId: referenceTrackId(),
      avoidRepeats: settings.player.avoidLibraryRepeats,
    });
    randomQueueIds.current = picked.queueIds;
    if (picked.nextId === null) return;
    const target = libraryTracks.find((track) => track.id === picked.nextId);
    if (target) await playSummary(target, true, reason, "library");
  }, [
    libraryTracks,
    playSummary,
    referenceTrackId,
    settings.player.avoidLibraryRepeats,
  ]);

  const playPrevious = useCallback(async () => {
    if (playbackContext.current !== "library" && contextControls.current.previous) {
      await contextControls.current.previous();
      return;
    }
    if (playbackContext.current === "library" && historyIds.current.length > 0) {
      const previousId = historyIds.current.at(-1);
      historyIds.current = historyIds.current.slice(0, -1);
      const target = libraryTracks.find((track) => track.id === previousId);
      if (target) {
        await playSummary(target, false, "global_previous_button");
        return;
      }
    }
    await playAdjacent(-1, "global_previous_button");
  }, [libraryTracks, playAdjacent, playSummary]);

  const playNext = useCallback(async () => {
    if (playbackContext.current === "library") {
      if (settings.player.libraryEndAction === "ordered") {
        await playAdjacent(1, "global_next_button");
      } else {
        await playRandomLibraryTrack("global_next_button");
      }
      return;
    }
    if (contextControls.current.next) {
      await contextControls.current.next();
      return;
    }
    await playAdjacent(1, "global_next_button");
  }, [playAdjacent, playRandomLibraryTrack, settings.player.libraryEndAction]);

  const handleLibraryTrackEnded = useCallback(async () => {
    const action = settings.player.libraryEndAction;
    if (action === "stop") return;

    const now = Date.now();
    if (
      shouldBlockRepeatedAutoAdvance({
        now,
        lastAutoAdvanceAt: lastAutoAdvanceAt.current,
        inFlight: autoAdvanceInFlight.current,
      })
    ) {
      console.warn(`[PLAYER] BLOCKED auto advance reason=duplicate_auto_advance action=${action}`);
      return;
    }

    autoAdvanceInFlight.current = true;
    lastAutoAdvanceAt.current = now;
    try {
      if (action === "random") {
        await playRandomLibraryTrack("library_ended_auto_random");
      } else if (action === "ordered") {
        await playAdjacent(1, "library_ended_auto_order");
      } else if (action === "repeat" && currentTrack) {
        await playTrack(currentTrack, "library_ended_auto_repeat");
      }
    } finally {
      window.setTimeout(() => {
        autoAdvanceInFlight.current = false;
      }, AUTO_ADVANCE_RELEASE_MS);
    }
  }, [
    currentTrack,
    playAdjacent,
    playRandomLibraryTrack,
    playTrack,
    settings.player.libraryEndAction,
  ]);

  useEffect(() => {
    if (
      state.status !== "ended" ||
      state.trackId === null ||
      handledEndedTrack.current === state.trackId
    ) {
      if (state.status !== "ended") handledEndedTrack.current = null;
      return;
    }
    handledEndedTrack.current = state.trackId;

    if (playbackContext.current === "library") {
      const started = playStartedRef.current;
      if (
        !isValidLibraryEndedState({
          state,
          context: playbackContext.current,
          startedTrackId: started?.trackId,
          startedAt: started?.startedAt,
          now: Date.now(),
        })
      ) {
        console.warn(
          `[PLAYER] BLOCKED auto advance reason=invalid_ended_state id=${state.trackId} duration=${state.durationMs ?? "null"} position=${state.positionMs}`,
        );
        return;
      }
      void handleLibraryTrackEnded();
      return;
    }

    if (contextControls.current.ended) {
      void contextControls.current.ended();
    } else if (
      canUseGlobalEndedAction(playbackContext.current, settings.player.endAction) &&
      currentTrack
    ) {
      void playTrack(currentTrack, "custom_ended_repeat");
    }
  }, [
    currentTrack,
    handleLibraryTrackEnded,
    playTrack,
    settings.player.endAction,
    state.status,
    state.trackId,
    state.durationMs,
    state.positionMs,
  ]);

  const value = useMemo<PlayerContextValue>(
    () => ({
      state,
      currentTrack,
      selectedTrack,
      error,
      setLibraryTracks,
      setSelectedTrack,
      forgetTracks,
      playTrack,
      togglePlayback,
      stop,
      seek,
      setVolume,
      playNext,
      playPrevious,
    }),
    [
      currentTrack,
      error,
      forgetTracks,
      playNext,
      playPrevious,
      playTrack,
      seek,
      selectedTrack,
      setLibraryTracks,
      setVolume,
      state,
      stop,
      togglePlayback,
    ],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error("usePlayer debe usarse dentro de PlayerProvider");
  }
  return context;
}
