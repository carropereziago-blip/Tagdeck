import {
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Square,
  Volume2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { usePlayer } from "../features/player/PlayerContext";
import { useI18n } from "../i18n";
import { displayTitleWithVersion } from "../lib/displayTitle";
import { formatDuration } from "../lib/format";

export function PlayerBar() {
  const {
    state,
    currentTrack,
    selectedTrack,
    error,
    togglePlayback,
    stop,
    seek,
    setVolume,
    playNext,
    playPrevious,
  } = usePlayer();
  const { t } = useI18n();
  const [seeking, setSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);

  useEffect(() => {
    if (!seeking) {
      setSeekValue(state.positionMs);
    }
  }, [seeking, state.positionMs]);

  const displayTrack =
    state.status === "playing" || state.status === "paused" || state.status === "ended"
      ? currentTrack ?? selectedTrack
      : selectedTrack ?? currentTrack;
  const duration = state.durationMs ?? displayTrack?.durationMs ?? 0;
  const canPlay = Boolean(displayTrack);
  const isPlaying = state.status === "playing";
  const title = displayTrack
    ? displayTitleWithVersion(displayTrack)
    : t("playerBar.noSongSelected");

  async function commitSeek() {
    setSeeking(false);
    await seek(seekValue);
  }

  return (
    <footer className="card-surface grid grid-cols-[minmax(220px,1fr)_minmax(420px,2fr)_minmax(180px,1fr)] items-center gap-5 border-t border-white/8 px-5 shadow-[0_-10px_30px_rgba(0,0,0,0.12)]">
      <div className="min-w-0">
        <p
          className="truncate text-sm font-medium text-white/70"
          title={displayTrack?.versionLabel ? t("field.internalVersionLabel") : title}
        >
          {title}
        </p>
        <p className={`mt-0.5 truncate text-xs ${error ? "text-red-300" : "text-white/35"}`}>
          {error || displayTrack?.artist || t("playerBar.selectSong")}
        </p>
      </div>

      <div className="min-w-0">
        <div className="flex items-center justify-center gap-2 text-white/65">
          <button
            type="button"
            onClick={() => void playPrevious()}
            disabled={!canPlay}
            aria-label={t("common.previous")}
            className="rounded-full p-2 transition hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-25"
          >
            <SkipBack size={18} />
          </button>
          <button
            type="button"
            onClick={() => void stop()}
            disabled={state.trackId === null}
            aria-label={t("common.stop")}
            className="rounded-full p-2 transition hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-25"
          >
            <Square size={16} fill="currentColor" />
          </button>
          <button
            type="button"
            onClick={() => void togglePlayback()}
            disabled={!canPlay}
            aria-label={isPlaying ? t("common.pause") : t("common.play")}
            className="rounded-full bg-[#d9ff43] p-3 text-[#101113] transition hover:bg-[#e4ff72] disabled:cursor-not-allowed disabled:opacity-25"
          >
            {isPlaying ? (
              <Pause size={18} fill="currentColor" />
            ) : (
              <Play size={18} fill="currentColor" />
            )}
          </button>
          <button
            type="button"
            onClick={() => void playNext()}
            disabled={!canPlay}
            aria-label={t("common.next")}
            className="rounded-full p-2 transition hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-25"
          >
            <SkipForward size={18} />
          </button>
        </div>

        <div className="mt-2 flex items-center gap-2 text-[10px] tabular-nums text-white/35">
          <span className="w-10 text-right">{formatDuration(seekValue)}</span>
          <input
            type="range"
            min={0}
            max={Math.max(1, duration)}
            step={250}
            value={Math.min(seekValue, Math.max(1, duration))}
            disabled={state.trackId === null || duration <= 0}
            onPointerDown={() => setSeeking(true)}
            onChange={(event) => setSeekValue(Number(event.target.value))}
            onPointerUp={() => void commitSeek()}
            onKeyUp={() => void commitSeek()}
            className="h-1 min-w-0 flex-1 accent-[#d9ff43] disabled:opacity-25"
            aria-label={t("common.playbackPosition")}
          />
          <span className="w-10">{formatDuration(duration || null)}</span>
        </div>
      </div>

      <label className="ml-auto flex w-full max-w-48 items-center gap-3 text-white/45">
        <Volume2 size={17} />
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={state.volume}
          onChange={(event) => void setVolume(Number(event.target.value))}
          className="h-1 min-w-0 flex-1 accent-[#d9ff43]"
          aria-label={t("common.volume")}
        />
      </label>
    </footer>
  );
}
