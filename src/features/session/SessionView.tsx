import {
  Archive,
  ChevronLeft,
  ChevronRight,
  Disc3,
  FolderKanban,
  Library,
  ListMusic,
  ListPlus,
  Pause,
  Play,
  Radio,
  Save,
  Search,
  Square,
  Star,
  Trash2,
  Volume2,
  Workflow,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { displayTitleWithVersion } from "../../lib/displayTitle";
import { formatDuration } from "../../lib/format";
import { filterTracksByFolder, hasLibraryFolder } from "../../lib/libraryFolders";
import {
  shortcutRatingFromKey,
  shortcutStatusFromKey,
  findShortcutForEvent,
  shouldIgnoreKeyboardShortcut,
} from "../../lib/keyboardShortcuts";
import { api } from "../../lib/tauri";
import type {
  LibraryFolderOption,
  OrganizationOptions,
  PlaylistSaveRequest,
  PlaylistSong,
  PlaylistSummary,
  SongStatus,
  TrackDetails,
  TrackSummary,
} from "../../types/track";
import { usePlayer, type PlayReason } from "../player/PlayerContext";
import { AddToPlaylistDialog } from "../playlists/AddToPlaylistDialog";
import { useSettings } from "../settings/SettingsContext";
import { visibleFieldsForZone, type FieldVisibilityField } from "../settings/settings";
import {
  WORKFLOW_PRESET_STORAGE_KEY,
  trackMatchesWorkflowPreset,
  workflowPresetById,
  type WorkflowPresetId,
} from "../workflows/workflowPresets";
import { useI18n } from "../../i18n";
import { formatSystemValueList } from "../../i18n/systemLabels";
import { rankSuggestions } from "./affinity";
import {
  searchSessionTracks,
  SESSION_SEARCH_FIELDS,
  sessionSearchFieldLabel,
  type SessionSearchField,
} from "./search";

interface SessionViewProps {
  initialTrackId?: number;
  initialQueueIds?: number[];
  initialQueueName?: string;
  onOpenTrack: (section: "library" | "organization", trackId: number) => void;
}

const LIBRARY_QUERY = {
  search: null,
  folderPath: null,
  ratingMin: null,
  ratingMax: null,
  status: null,
  tagId: null,
  projectId: null,
  versionLabel: null,
  smartCollection: null,
  sortBy: "title" as const,
  sortDirection: "asc" as const,
  limit: 2_000,
  offset: 0,
};

const EMPTY_ORGANIZATION_OPTIONS: OrganizationOptions = {
  tags: [],
  projects: [],
  versions: [],
  models: [],
  smartCollections: [],
};

type SessionCriterion =
  | "all"
  | "unreviewed"
  | "unrated"
  | "idea"
  | "in_progress"
  | "daw_rescue"
  | "radio_ready"
  | "release_ready"
  | "archived"
  | "no_project"
  | "untagged"
  | "no_mood"
  | "no_language"
  | "potential"
  | "rejects_i_like"
  | "custom_model_seeds"
  | "release_candidates"
  | "needs_daw_work"
  | "needs_metadata";

const SESSION_CRITERIA: SessionCriterion[] = [
  "all",
  "unreviewed",
  "unrated",
  "idea",
  "in_progress",
  "daw_rescue",
  "radio_ready",
  "release_ready",
  "archived",
  "no_project",
  "untagged",
  "no_mood",
  "no_language",
  "potential",
  "rejects_i_like",
  "custom_model_seeds",
  "release_candidates",
  "needs_daw_work",
  "needs_metadata",
];

export function SessionView({
  initialTrackId,
  initialQueueIds,
  initialQueueName,
  onOpenTrack,
}: SessionViewProps) {
  const player = usePlayer();
  const { settings } = useSettings();
  const { t, language } = useI18n();
  const sessionCurrentFields = visibleFieldsForZone(settings.fieldVisibility, "sessionCurrent");
  const sessionResultsFields = visibleFieldsForZone(settings.fieldVisibility, "sessionResults");
  const sessionQueueFields = visibleFieldsForZone(settings.fieldVisibility, "sessionQueue");
  const initialPlayerTrackId = useRef(player.currentTrack?.id);
  const {
    playTrack: playPlayerTrack,
    setLibraryTracks,
    setSelectedTrack,
  } = player;
  const [library, setLibrary] = useState<TrackSummary[]>([]);
  const [folders, setFolders] = useState<LibraryFolderOption[]>([]);
  const [foldersLoaded, setFoldersLoaded] = useState(false);
  const [folderPath, setFolderPath] = useState("");
  const [track, setTrack] = useState<TrackDetails | null>(null);
  const [queue, setQueue] = useState<TrackSummary[]>([]);
  const [history, setHistory] = useState<TrackSummary[]>([]);
  const [playedIds, setPlayedIds] = useState<Set<number>>(new Set());
  const [playlistTrackIds, setPlaylistTrackIds] = useState<number[] | null>(null);
  const [organizationOptions, setOrganizationOptions] = useState<OrganizationOptions>(
    EMPTY_ORGANIZATION_OPTIONS,
  );
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState("");
  const [activePlaylistId, setActivePlaylistId] = useState<number | null>(null);
  const [activePlaylistName, setActivePlaylistName] = useState<string | null>(null);
  const [saveQueueOpen, setSaveQueueOpen] = useState(false);
  const [includePlayed, setIncludePlayed] = useState(settings.session.includePlayed);
  const [includeLowRated, setIncludeLowRated] = useState(
    !settings.session.excludeLowRated,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [searchField, setSearchField] = useState<SessionSearchField>("all");
  const [excludeArchivedSearch, setExcludeArchivedSearch] = useState(
    settings.session.excludeArchived,
  );
  const [workflowPresetId] = useState<WorkflowPresetId>(() => {
    const stored = window.localStorage.getItem(WORKFLOW_PRESET_STORAGE_KEY);
    return workflowPresetById(stored).id;
  });
  const [sessionCriterion, setSessionCriterion] = useState<SessionCriterion>("all");
  const [loading, setLoading] = useState(true);
  const [prepareRetryNonce, setPrepareRetryNonce] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focusedResultId, setFocusedResultId] = useState<number | null>(null);
  const endedTrackRef = useRef<number | null>(null);

  const loadTrack = useCallback(
    async (
      summary: TrackSummary,
      autoplay: boolean,
      reason: PlayReason = "session_queue_next",
    ) => {
      const details = await api.getTrack(summary.id);
      if (autoplay) await playPlayerTrack(details, reason);
      setTrack(details);
      setSelectedTrack(details);
      return details;
    },
    [playPlayerTrack, setSelectedTrack],
  );

  const loadTrackRef = useRef(loadTrack);

  useEffect(() => {
    loadTrackRef.current = loadTrack;
  }, [loadTrack]);

  const initialSessionKey = useMemo(
    () => `${initialTrackId ?? ""}:${initialQueueIds?.join(",") ?? ""}:${initialQueueName ?? ""}`,
    [initialQueueIds, initialQueueName, initialTrackId],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    if (import.meta.env.DEV) {
      console.debug("[Session] prepare start", { initialSessionKey });
    }

    async function prepareSession() {
      try {
        const page = await api.getLibraryTracks(LIBRARY_QUERY);
        if (cancelled) return;
        setLibrary(page.items);
        const byId = new Map(page.items.map((item) => [item.id, item]));
        const requestedIds =
          initialQueueIds && initialQueueIds.length > 0
            ? initialQueueIds
            : initialTrackId
              ? [initialTrackId]
              : initialPlayerTrackId.current
                ? [initialPlayerTrackId.current]
                : [];
        const ordered = requestedIds
          .map((id) => byId.get(id))
          .filter((item): item is TrackSummary => Boolean(item));
        const first =
          ordered[0] ??
          page.items.find((item) => item.status !== "archived") ??
          page.items[0];
        if (!first) {
          setTrack(null);
          setQueue([]);
          return;
        }
        const nextQueue =
          ordered.length > 0 ? ordered.slice(1) : [];
        setQueue(nextQueue);
        setHistory([]);
        setPlayedIds(new Set());
        setActivePlaylistId(null);
        setActivePlaylistName(initialQueueName ?? null);
        await loadTrackRef.current(first, Boolean(initialTrackId || initialQueueIds?.length));
        if (import.meta.env.DEV) {
          console.debug("[Session] prepare success", {
            queueLength: nextQueue.length,
            trackId: first.id,
          });
        }
      } catch (loadError) {
        if (import.meta.env.DEV) {
          console.debug("[Session] prepare error", loadError);
        }
        if (!cancelled) setError(String(loadError));
      } finally {
        if (import.meta.env.DEV) {
          console.debug("[Session] prepare finally", { cancelled });
        }
        if (!cancelled) setLoading(false);
      }
    }

    void prepareSession();
    return () => {
      cancelled = true;
    };
  }, [initialSessionKey, prepareRetryNonce]);

  useEffect(() => {
    void api
      .getPlaylists()
      .then((items) => {
        setPlaylists(items);
        setSelectedPlaylistId((current) => current || items[0]?.id.toString() || "");
      })
      .catch((loadError) => setError(String(loadError)));
  }, []);

  useEffect(() => {
    void api
      .getOrganizationOptions()
      .then(setOrganizationOptions)
      .catch((loadError) => setError(String(loadError)));
  }, []);

  useEffect(() => {
    void api
      .getLibraryFolders()
      .then((availableFolders) => {
        setFolders(availableFolders);
        setFoldersLoaded(true);
      })
      .catch((loadError) => setError(String(loadError)));
  }, []);

  useEffect(() => {
    if (folderPath && foldersLoaded && !hasLibraryFolder(folders, folderPath)) {
      setFolderPath("");
    }
  }, [folderPath, folders, foldersLoaded]);

  useEffect(() => {
    const currentId = player.currentTrack?.id;
    if (!currentId || currentId === track?.id) return;
    const summary = library.find((item) => item.id === currentId);
    if (!summary) return;
    if (track) {
      setHistory((current) => [...current, track]);
      setPlayedIds((current) => new Set(current).add(track.id));
    }
    setTrack(player.currentTrack);
  }, [library, player.currentTrack, track]);

  const sessionLibrary = useMemo(
    () => filterTracksByFolder(library, folderPath),
    [folderPath, library],
  );
  const workflowPreset = useMemo(
    () => workflowPresetById(workflowPresetId),
    [workflowPresetId],
  );
  const workflowSessionLibrary = useMemo(() => {
    const filtered = sessionLibrary.filter((item) =>
      trackMatchesWorkflowPreset(item, workflowPreset.id),
    );
    return filtered.length > 0 ? filtered : sessionLibrary;
  }, [sessionLibrary, workflowPreset.id]);
  const criterionSessionLibrary = useMemo(
    () => sessionLibrary.filter((item) => trackMatchesSessionCriterion(item, sessionCriterion)),
    [sessionCriterion, sessionLibrary],
  );
  const candidateSessionLibrary =
    criterionSessionLibrary.length > 0 || sessionCriterion !== "all"
      ? criterionSessionLibrary
      : workflowSessionLibrary;

  const playNext = useCallback(async () => {
    const [next, ...remaining] = queue;
    if (!next) {
      if (
        settings.session.queueEndAction === "repeat" &&
        (history.length > 0 || track)
      ) {
        const repeated = [...history, ...(track ? [track] : [])];
        const [first, ...rest] = repeated;
        if (first) {
          setHistory([]);
          setQueue(rest);
          await loadTrack(first, true);
          return;
        }
      }
      if (settings.session.queueEndAction === "suggest" && track) {
        const nextSuggestion = rankSuggestions(track, candidateSessionLibrary, {
          playedIds,
          excludePlayed: !settings.session.includePlayed,
          excludeLowRated: settings.session.excludeLowRated,
          excludeArchived: settings.session.excludeArchived,
          minimumRating: settings.session.minimumRating,
          priorities: settings.session.priorities,
        })[0]?.track;
        if (nextSuggestion) {
          await loadTrack(nextSuggestion, true);
          return;
        }
      }
      setNotice(t("session.queueEnded"));
      return;
    }
    if (track) {
      setHistory((current) => [...current, track]);
      setPlayedIds((current) => new Set(current).add(track.id));
    }
    setQueue(remaining);
    endedTrackRef.current = null;
    await loadTrack(next, true);
  }, [candidateSessionLibrary, history, loadTrack, playedIds, queue, settings.session, track]);

  useEffect(() => {
    if (
      player.state.status !== "ended" ||
      settings.player.endAction !== "stop" ||
      !track ||
      endedTrackRef.current === track.id
    ) {
      return;
    }
    endedTrackRef.current = track.id;
    void playNext();
  }, [playNext, player.state.status, settings.player.endAction, track]);

  const suggestions = useMemo(() => {
    if (!track) return [];
    return rankSuggestions(track, candidateSessionLibrary, {
      playedIds,
      queuedIds: new Set(queue.map((item) => item.id)),
      excludePlayed: !includePlayed,
      excludeLowRated: !includeLowRated,
      excludeArchived: settings.session.excludeArchived,
      minimumRating: settings.session.minimumRating,
      priorities: settings.session.priorities,
    }).slice(0, 12);
  }, [
    includeLowRated,
    includePlayed,
    playedIds,
    queue,
    settings.session,
    track,
    candidateSessionLibrary,
  ]);
  const searchResults = useMemo(
    () =>
      searchSessionTracks(
        candidateSessionLibrary,
        searchQuery,
        searchField,
        excludeArchivedSearch,
      ).slice(0, 100),
    [candidateSessionLibrary, excludeArchivedSearch, searchField, searchQuery],
  );
  const searchActive = searchQuery.trim().length > 0;
  const focusableSessionTracks = useMemo(
    () => (searchActive ? searchResults : suggestions.map((suggestion) => suggestion.track)),
    [searchActive, searchResults, suggestions],
  );

  useEffect(() => {
    if (
      focusedResultId !== null &&
      !focusableSessionTracks.some((item) => item.id === focusedResultId)
    ) {
      setFocusedResultId(null);
    }
  }, [focusableSessionTracks, focusedResultId]);

  useEffect(() => {
    if (focusedResultId === null) return;
    const element = document.querySelector<HTMLElement>(
      `[data-session-result-id="${focusedResultId}"]`,
    );
    element?.focus();
  }, [focusedResultId]);

  async function playNow(
    summary: TrackSummary,
    options: { preserveActivePlaylist?: boolean; removeFromQueue?: boolean } = {},
  ) {
    try {
      if (track) {
        setHistory((current) => [...current, track]);
        setPlayedIds((current) => new Set(current).add(track.id));
      }
      if (options.preserveActivePlaylist === false) {
        setActivePlaylistId(null);
        setActivePlaylistName(null);
      }
      if (options.removeFromQueue) {
        setQueue((current) => current.filter((item) => item.id !== summary.id));
      }
      await loadTrack(summary, true, "user_click");
    } catch (playError) {
      setError(String(playError));
    }
  }

  async function loadPlaylistIntoSession(playlistId: number) {
    if (!playlistId) return;
    try {
      const details = await api.getPlaylist(playlistId);
      const ordered = details.songs.map(playlistSongToSummary);
      const [first, ...remaining] = ordered;
      setHistory([]);
      setPlayedIds(new Set());
      setQueue(remaining);
      setActivePlaylistId(details.playlist.id);
      setActivePlaylistName(details.playlist.name);
      if (first) {
        await loadTrack(first, true, "session_playlist_loaded");
        setNotice(`${t("session.playlistLoaded")}: ${ordered.length} ${t("library.songs")}.`);
      } else {
        setNotice(t("session.playlistEmpty"));
      }
    } catch (loadError) {
      setNotice(t("session.playlistLoadFailed"));
      setError(String(loadError));
    }
  }

  const playPrevious = useCallback(async () => {
    const previous = history.at(-1);
    if (!previous) return;
    if (track) setQueue((current) => [track, ...current]);
    setHistory((current) => current.slice(0, -1));
    try {
      await loadTrack(previous, true, "session_queue_previous");
    } catch (playError) {
      setError(String(playError));
    }
  }, [history, loadTrack, track]);

  useEffect(() => {
    if (!track) {
      setLibraryTracks([], "session", {
        next: playNext,
        previous: playPrevious,
        ended: playNext,
      });
      return;
    }
    setLibraryTracks([track, ...queue], "session", {
      next: playNext,
      previous: playPrevious,
      ended: playNext,
    });
  }, [playNext, playPrevious, queue, setLibraryTracks, track]);

  function addToQueue(summary: TrackSummary) {
    if (track?.id === summary.id || queue.some((item) => item.id === summary.id)) {
      return;
    }
    setQueue((current) => [...current, summary]);
    setNotice(`“${summary.title || summary.fileName}” añadida a la cola.`);
  }

  async function updateStatus(status: SongStatus) {
    if (!track) return;
    try {
      await api.updateTrackOrganization([track.id], { status: { value: status } });
      await refreshTrack(track.id);
      setNotice(`${t("session.statusChangedTo")} ${t(`status.${status}`)}.`);
    } catch (updateError) {
      setError(String(updateError));
    }
  }

  async function updateRating(value: string) {
    if (!track) return;
    try {
      const updated = await api.updateTrackRating(
        track.id,
        value ? Number(value) : null,
      );
      replaceTrack(updated);
      setNotice("Rating actualizado.");
    } catch (updateError) {
      setError(String(updateError));
    }
  }

  async function updateModel(value: string) {
    if (!track) return;
    try {
      const updated = await api.saveCuration({
        trackId: track.id,
        rating: track.rating,
        organization: {},
        strongPart: track.strongPart,
        mainProblem: track.mainProblem,
        intendedUse: track.intendedUse,
        mood: track.mood,
        generationModel: value.trim() || null,
      });
      replaceTrack(updated);
      setNotice("Modelo actualizado.");
    } catch (updateError) {
      setError(String(updateError));
    }
  }

  async function updateProject(value: string) {
    if (!track) return;
    try {
      await api.updateTrackOrganization([track.id], {
        projectId: { value: value ? Number(value) : null },
      });
      await refreshTrack(track.id);
      setNotice(t("session.projectUpdated"));
    } catch (updateError) {
      setError(String(updateError));
    }
  }

  async function applyCustomShortcut(event: KeyboardEvent) {
    const rule = findShortcutForEvent(
      settings.customKeyboardShortcuts ?? [],
      "session",
      event,
    );
    if (!rule) return false;
    const value = rule.value.trim();
    if (rule.field === "rating") {
      await updateRating(value === "clear" ? "" : value);
    } else if (rule.field === "status" && value) {
      await updateStatus(value as SongStatus);
    } else if (rule.field === "mood" && track) {
      const current = splitValues(track.mood ?? "");
      const next = current.some((item) => item.toLocaleLowerCase() === value.toLocaleLowerCase())
        ? current
        : [...current, value].filter(Boolean);
      const updated = await api.saveCuration({
        trackId: track.id,
        rating: track.rating,
        organization: {},
        strongPart: track.strongPart,
        mainProblem: track.mainProblem,
        intendedUse: track.intendedUse,
        mood: next.join(", ") || null,
        generationModel: track.generationModel,
      });
      replaceTrack(updated);
    } else if (rule.field === "internal_tag" && track && value) {
      await api.updateTrackOrganization([track.id], {
        tagNames: [value],
        tagMode: "add",
      });
      await refreshTrack(track.id);
    } else if (rule.field === "model") {
      await updateModel(value);
    } else if (rule.field === "language" && track) {
      await api.updateTrackOrganization([track.id], {
        language: { value: value || null },
      });
      await refreshTrack(track.id);
    } else if (rule.field === "next_action" && track) {
      await api.updateTrackOrganization([track.id], {
        nextAction: { value: value || null },
      });
      await refreshTrack(track.id);
    } else if (rule.field === "project") {
      const project = organizationOptions.projects.find(
        (item) =>
          String(item.id) === value ||
          item.name.toLocaleLowerCase() === value.toLocaleLowerCase(),
      );
      await updateProject(project ? String(project.id) : "");
    } else if (rule.field === "action") {
      if (value === "play_pause") await player.togglePlayback();
      else if (value === "next") await playNext();
      else if (value === "previous") await playPrevious();
      else if (value === "add_to_playlist" && track) setPlaylistTrackIds([track.id]);
      else if (value === "reset_zoom") return true;
      else return false;
    } else {
      return false;
    }
    return true;
  }

  async function refreshTrack(id: number) {
    const updated = await api.getTrack(id);
    replaceTrack(updated);
  }

  function replaceTrack(updated: TrackDetails) {
    setTrack(updated);
    setSelectedTrack(updated);
    setLibrary((current) =>
      current.map((item) => (item.id === updated.id ? updated : item)),
    );
  }

  function moveFocusedResult(offset: -1 | 1) {
    if (focusableSessionTracks.length === 0) return;
    const currentIndex =
      focusedResultId === null
        ? -1
        : focusableSessionTracks.findIndex((item) => item.id === focusedResultId);
    const targetIndex =
      currentIndex < 0
        ? offset > 0
          ? 0
          : focusableSessionTracks.length - 1
        : Math.min(
            focusableSessionTracks.length - 1,
            Math.max(0, currentIndex + offset),
          );
    setFocusedResultId(focusableSessionTracks[targetIndex]?.id ?? null);
  }

  useEffect(() => {
    if (!settings.keyboardShortcutsEnabled) return;
    async function onKeyDown(event: KeyboardEvent) {
      if (shouldIgnoreKeyboardShortcut(event)) return;

      const focusedTrack =
        focusedResultId === null
          ? null
          : focusableSessionTracks.find((item) => item.id === focusedResultId) ?? null;

      const customShortcut = findShortcutForEvent(
        settings.customKeyboardShortcuts ?? [],
        "session",
        event,
      );
      if (customShortcut && await applyCustomShortcut(event)) {
        event.preventDefault();
        return;
      }

      const ratingShortcut = shortcutRatingFromKey(event.key);
      if (ratingShortcut !== null) {
        event.preventDefault();
        void updateRating(String(ratingShortcut));
        return;
      }

      const statusShortcut = shortcutStatusFromKey(event.key);
      if (statusShortcut) {
        event.preventDefault();
        void updateStatus(statusShortcut);
        return;
      }

      if (event.key === " ") {
        event.preventDefault();
        void player.togglePlayback();
        return;
      }
      if (event.key === "Enter") {
        if (focusedTrack) {
          event.preventDefault();
          void playNow(focusedTrack);
        } else if (track) {
          event.preventDefault();
          void player.playTrack(track, "user_click", "session");
        }
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        void playNext();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        void playPrevious();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        moveFocusedResult(1);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        moveFocusedResult(-1);
        return;
      }
      if (event.key.toLowerCase() === "q") {
        if (focusedTrack) {
          event.preventDefault();
          addToQueue(focusedTrack);
        }
        return;
      }
      if (event.key.toLowerCase() === "l" && focusedTrack) {
        event.preventDefault();
        setPlaylistTrackIds([focusedTrack.id]);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    focusableSessionTracks,
    focusedResultId,
    playNext,
    playPrevious,
    player,
    settings.keyboardShortcutsEnabled,
    track,
  ]);

  if (loading) {
    return (
      <div className="grid h-full place-items-center text-sm text-white/35">
        {t("session.preparing")}
      </div>
    );
  }

  return (
    <div className="app-surface flex h-full min-h-0 flex-col overflow-hidden">
      <header className="section-header flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-6 py-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Radio size={19} /> {t("session.title")}
          </h2>
          <p className="mt-1 text-xs text-white/40">
            {t("session.subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="flex items-center gap-2 text-xs text-white/40">
            {t("session.folder")}
            <select
              value={folderPath}
              onChange={(event) => setFolderPath(event.target.value)}
              aria-label={t("session.folder")}
              className="rounded-md border border-white/10 bg-[#202226] px-2.5 py-2 text-xs text-white/70"
            >
              <option value="">{t("library.wholeLibrary")}</option>
              {folders.map((folder) => (
                <option key={folder.path} value={folder.path}>
                  {folder.isRoot ? `${t("common.root")} - ` : ""}
                  {folder.name} ({folder.trackCount})
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-white/40">
            {t("session.criterion")}
            <select
              value={sessionCriterion}
              onChange={(event) => setSessionCriterion(event.target.value as SessionCriterion)}
              aria-label={t("session.criterion")}
              className="rounded-md border border-white/10 bg-[#202226] px-2.5 py-2 text-xs text-white/70"
            >
              {SESSION_CRITERIA.map((criterion) => (
                <option key={criterion} value={criterion}>
                  {t(`sessionCriterion.${criterion}`)}
                </option>
              ))}
            </select>
          </label>
          {track && (
            <>
              <button
                type="button"
                onClick={() => setPlaylistTrackIds([track.id])}
                className="toolbar-button"
              >
                <ListPlus size={15} /> {t("session.addTrackToPlaylist")}
              </button>
              <button
                type="button"
                onClick={() => onOpenTrack("organization", track.id)}
                className="toolbar-button"
              >
                <Workflow size={15} /> {t("nav.organization")}
              </button>
              <button
                type="button"
                onClick={() => onOpenTrack("library", track.id)}
                className="toolbar-button"
              >
                <Library size={15} /> {t("nav.library")}
              </button>
            </>
          )}
        </div>
      </header>

      {settings.keyboardShortcutsEnabled && (
        <details className="border-b border-white/8 bg-white/[0.02] px-6 py-2 text-xs text-white/45">
          <summary className="cursor-pointer font-medium text-white/65">
            {t("session.keyboardShortcuts")}
          </summary>
          <p className="mt-2 leading-relaxed">{t("session.shortcutsHelp")}</p>
        </details>
      )}

      {notice && (
        <p className="border-b border-[#d9ff43]/10 bg-[#d9ff43]/5 px-6 py-2 text-xs text-[#d9ff43]/70">
          {notice}
        </p>
      )}
      {error && (
        <div className="flex items-center justify-between gap-3 border-b border-red-400/15 bg-red-400/7 px-6 py-2 text-xs text-red-200">
          <span>{t("session.prepareFailed")} {error}</span>
          <button
            type="button"
            onClick={() => setPrepareRetryNonce((current) => current + 1)}
            className="rounded border border-red-200/25 px-2 py-1 text-red-100 hover:bg-red-200/10"
          >
            {t("session.retry")}
          </button>
        </div>
      )}

      {!track ? (
        <div className="grid min-h-0 flex-1 place-items-center text-center">
          <div>
            <Disc3 size={52} className="mx-auto text-white/15" />
            <h3 className="mt-4 font-semibold text-white/65">
              {t("session.noSongsAvailable")}
            </h3>
            <p className="mt-1 text-sm text-white/30">
              {t("session.scanFolderToStart")}
            </p>
          </div>
        </div>
      ) : (
        <main className="grid min-h-0 flex-1 grid-cols-[minmax(300px,0.9fr)_minmax(360px,1.2fr)_290px] overflow-hidden">
          <section className="panel-surface min-h-0 overflow-y-auto border-r border-white/8 p-5">
            <CurrentTrackCard
              track={track}
              player={player}
              visibleFields={sessionCurrentFields}
              projects={organizationOptions.projects}
              models={organizationOptions.models}
              canGoPrevious={history.length > 0}
              canGoNext={queue.length > 0}
              onPrevious={() => void playPrevious()}
              onNext={() => void playNext()}
              onRatingChange={(value) => void updateRating(value)}
              onStatusChange={(status) => void updateStatus(status)}
              onModelChange={(value) => void updateModel(value)}
              onProjectChange={(value) => void updateProject(value)}
            />
          </section>

          <section className="min-h-0 overflow-y-auto bg-[#15191e]/55 p-5">
            <div className="card-surface rounded-lg border border-white/8 p-3">
              <div className="flex items-center gap-2">
                <label className="elevated-surface flex min-w-0 flex-1 items-center gap-2 rounded-md border border-white/10 px-3 py-2">
                  <Search size={15} className="shrink-0 text-white/35" />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={t("session.searchSongsPlaceholder")}
                    aria-label={t("session.searchSongs")}
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/25"
                  />
                  {searchActive && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      aria-label={t("session.clearSearch")}
                      className="p-1 text-white/35 hover:text-white/70"
                    >
                      <X size={14} />
                    </button>
                  )}
                </label>
                <select
                  value={searchField}
                  onChange={(event) =>
                    setSearchField(event.target.value as SessionSearchField)
                  }
                  aria-label={t("session.searchField")}
                  className="shrink-0 rounded-md border border-white/10 bg-[#202226] px-2 py-2.5 text-xs text-white/70"
                >
                  {SESSION_SEARCH_FIELDS.map((field) => (
                    <option key={field} value={field}>
                      {sessionSearchFieldLabel(field, t)}
                    </option>
                  ))}
                </select>
              </div>
              {searchActive && (
                <label className="mt-2 flex items-center gap-1.5 text-[10px] text-white/38">
                  <input
                    type="checkbox"
                    checked={excludeArchivedSearch}
                    onChange={(event) =>
                      setExcludeArchivedSearch(event.target.checked)
                    }
                    className="accent-[#d9ff43]"
                  />
                  {t("settings.excludeArchived")}
                </label>
              )}
            </div>

            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="mt-4 text-base font-semibold">
                  {searchActive ? t("session.searchResults") : t("session.relatedSuggestions")}
                </h3>
                <p className="mt-1 text-xs text-white/35">
                  {searchActive
                    ? `${t("session.matchesIn")} ${sessionSearchFieldLabel(searchField, t).toLocaleLowerCase(language)}.`
                    : t("session.prioritizedBy")}
                </p>
              </div>
              {searchActive ? (
                <span className="text-[10px] text-white/38">
                  {searchResults.length} {t("session.results")}
                </span>
              ) : (
                <div className="flex flex-wrap items-center justify-end gap-3 text-[10px] text-white/38">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={includePlayed}
                      onChange={(event) => setIncludePlayed(event.target.checked)}
                      className="accent-[#d9ff43]"
                    />
                    {t("session.includePlayed")}
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={includeLowRated}
                      onChange={(event) => setIncludeLowRated(event.target.checked)}
                      className="accent-[#d9ff43]"
                    />
                    {t("session.includeLowRating")}
                  </label>
                  <span>{suggestions.length} {t("session.results")}</span>
                </div>
              )}
            </div>
            <div className="mt-4 space-y-2">
              {searchActive
                ? searchResults.map((result) => (
                    <SessionResultCard
                      key={result.id}
                      track={result}
                      visibleFields={sessionResultsFields}
                      focused={focusedResultId === result.id}
                      onFocus={() => setFocusedResultId(result.id)}
                      onPlay={() => void playNow(result)}
                      onQueue={() => addToQueue(result)}
                      onPlaylist={() => setPlaylistTrackIds([result.id])}
                      onOpen={(section) => onOpenTrack(section, result.id)}
                    />
                  ))
                : suggestions.map((suggestion) => (
                    <SessionResultCard
                      key={suggestion.track.id}
                      track={suggestion.track}
                      visibleFields={sessionResultsFields}
                      focused={focusedResultId === suggestion.track.id}
                      onFocus={() => setFocusedResultId(suggestion.track.id)}
                      score={suggestion.score}
                      reasons={suggestion.reasons}
                      onPlay={() => void playNow(suggestion.track)}
                      onQueue={() => addToQueue(suggestion.track)}
                      onPlaylist={() =>
                        setPlaylistTrackIds([suggestion.track.id])
                      }
                    />
                  ))}
              {(searchActive ? searchResults.length === 0 : suggestions.length === 0) && (
                <p className="rounded-lg border border-dashed border-white/10 px-4 py-10 text-center text-sm text-white/30">
                  {searchActive
                    ? t("session.noSearchMatches")
                    : t("session.noMoreSuggestions")}
                </p>
              )}
            </div>
          </section>

          <aside className="panel-surface flex min-h-0 flex-col border-l border-white/8 shadow-[-12px_0_30px_rgba(0,0,0,0.08)]">
            <div className="border-b border-white/8 p-4">
              <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <select
                  value={selectedPlaylistId}
                  onChange={(event) => setSelectedPlaylistId(event.target.value)}
                  aria-label={t("session.playlistToLoad")}
                  className="field min-w-0 text-xs"
                >
                  {playlists.length === 0 && <option value="">{t("playlists.noPlaylists")}</option>}
                  {playlists.map((playlist) => (
                    <option key={playlist.id} value={playlist.id}>
                      {playlist.name} ({playlist.songCount})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!selectedPlaylistId}
                  onClick={() => void loadPlaylistIntoSession(Number(selectedPlaylistId))}
                  className="toolbar-button"
                >
                  <ListMusic size={14} /> {t("session.loadPlaylist")}
                </button>
              </div>
              {activePlaylistName && (
                <p className="mb-3 truncate text-[10px] text-[#d9ff43]/65">
                  {t("session.activePlaylist")}: {activePlaylistName}
                </p>
              )}
              {activePlaylistName && track && (
                <p className="mb-3 text-[10px] text-white/35">
                  {t("library.song")} {history.length + 1} {t("common.of")} {history.length + queue.length + 1}
                </p>
              )}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{t("session.sessionQueue")}</h3>
                  <p className="mt-0.5 text-xs text-white/35">
                    {queue.length} {t("session.pending")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setQueue([]);
                    setActivePlaylistId(null);
                    setActivePlaylistName(null);
                  }}
                  disabled={queue.length === 0}
                  className="toolbar-button"
                  title={t("session.clearQueue")}
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <button
                type="button"
                disabled={queue.length === 0}
                onClick={() => setSaveQueueOpen(true)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-[#d9ff43] px-3 py-2.5 text-sm font-semibold text-[#101113] disabled:opacity-35"
              >
                <Save size={15} /> {t("session.saveQueueAsPlaylist")}
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {activePlaylistName && track && (
                <div className="mb-1 flex items-center gap-2 rounded-md border border-[#d9ff43]/30 bg-[#d9ff43]/10 px-2 py-2">
                  <span className="w-5 text-center text-[10px] font-semibold text-[#d9ff43]/80">
                    {history.length + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p hidden={!sessionQueueFields.has("title") && !sessionQueueFields.has("fileName")} className="truncate text-xs font-medium text-white/75">
                      {track.title || track.fileName}
                    </p>
                    <p hidden={!sessionQueueFields.has("artist")} className="truncate text-[10px] text-white/35">
                      {track.artist || t("explorer.unknownArtist")}
                    </p>
                  </div>
                  <span className="rounded bg-[#d9ff43]/12 px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-[#d9ff43]/75">
                    {t("session.current")}
                  </span>
                </div>
              )}
              {queue.map((item, index) => (
                <div
                  key={item.id}
                  className="group flex items-center gap-2 rounded-md px-2 py-2 hover:bg-white/5"
                >
                  <span className="w-5 text-center text-[10px] text-white/25">
                    {sessionQueueFields.has("playOrder") || sessionQueueFields.has("playlistPosition")
                      ? activePlaylistName && track
                        ? history.length + index + 2
                        : index + 1
                      : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      void playNow(item, {
                        preserveActivePlaylist: true,
                        removeFromQueue: true,
                      })
                    }
                    className="min-w-0 flex-1 text-left"
                  >
                    <p hidden={!sessionQueueFields.has("title") && !sessionQueueFields.has("fileName")} className="truncate text-xs text-white/70">
                      {item.title || item.fileName}
                    </p>
                    <p hidden={!sessionQueueFields.has("artist")} className="truncate text-[10px] text-white/30">
                      {item.artist || t("explorer.unknownArtist")}
                    </p>
                    {sessionQueueFields.has("mood") && item.mood && (
                      <p className="truncate text-[10px] text-white/25">{formatSystemValueList(language, "mood", item.mood)}</p>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setQueue((current) =>
                        current.filter((queued) => queued.id !== item.id),
                      )
                    }
                    aria-label={`${t("session.removeFromQueue")} ${item.title || item.fileName}`}
                    className="p-1 text-white/25 opacity-0 hover:text-red-200 group-hover:opacity-100"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
              {queue.length === 0 && !activePlaylistId && (
                <p className="px-4 py-10 text-center text-xs text-white/25">
                  {t("session.addSuggestionsEmpty")}
                </p>
              )}
            </div>
          </aside>
        </main>
      )}

      {playlistTrackIds && (
        <AddToPlaylistDialog
          trackIds={playlistTrackIds}
          onClose={() => setPlaylistTrackIds(null)}
          onComplete={setNotice}
        />
      )}
      {saveQueueOpen && track && (
        <SaveSessionQueueDialog
          trackIds={[track.id, ...queue.map((item) => item.id)]}
          onClose={() => setSaveQueueOpen(false)}
          onComplete={(message) => {
            setNotice(message);
            setSaveQueueOpen(false);
          }}
        />
      )}
    </div>
  );
}

function playlistSongToSummary(song: PlaylistSong): TrackSummary {
  return {
    id: song.id,
    filePath: song.filePath,
    fileName: song.fileName,
    title: song.title,
    artist: song.artist,
    album: song.album,
    albumArtist: null,
    genre: song.genre,
    year: null,
    trackNumber: null,
    durationMs: song.durationMs,
    audioFormat: song.audioFormat,
    bpm: null,
    musicalKey: null,
    playCount: 0,
    rating: song.rating,
    status: song.status,
    projectId: null,
    projectName: song.projectName,
    versionLabel: song.versionLabel,
    tagNames: song.tagNames,
    workflowNotes: song.workflowNotes,
    nextAction: song.nextAction,
    strongPart: song.strongPart,
    mainProblem: song.mainProblem,
    intendedUse: song.intendedUse,
    mood: song.mood,
    generationModel: song.generationModel ?? null,
    reviewedAt: null,
    lastReviewedAt: null,
    skipCount: 0,
    metadataReadError: null,
  };
}

function trackMatchesSessionCriterion(track: TrackSummary, criterion: SessionCriterion) {
  const tags = ` ${track.tagNames.toLocaleLowerCase("es")} `;
  const includesTag = (...needles: string[]) =>
    needles.some((needle) => tags.includes(needle.toLocaleLowerCase("es")));

  switch (criterion) {
    case "all":
      return true;
    case "unreviewed":
      return (
        track.lastReviewedAt === null &&
        track.reviewedAt === null &&
        (track.status === "review" ||
          (track.rating === null && track.projectId === null && track.tagNames.trim() === ""))
      );
    case "unrated":
      return track.rating === null;
    case "idea":
      return track.status === "idea";
    case "in_progress":
      return track.status === "generating" || track.status === "editing";
    case "daw_rescue":
      return track.status === "generating";
    case "radio_ready":
      return track.status === "selected";
    case "release_ready":
      return track.status === "final" || track.status === "published";
    case "archived":
      return track.status === "archived";
    case "no_project":
      return track.projectId === null;
    case "untagged":
      return track.tagNames.trim() === "";
    case "no_mood":
      return !track.mood?.trim();
    case "no_language":
      return !includesTag("language", "idioma", "english", "spanish", "español");
    case "potential":
      return includesTag("potential", "potencial");
    case "rejects_i_like":
      return includesTag("rejects", "reject", "descartes");
    case "custom_model_seeds":
      return includesTag("model seed", "custom model", "semilla") || Boolean(track.generationModel);
    case "release_candidates":
      return includesTag("release candidate", "candidata");
    case "needs_daw_work":
      return (
        track.status === "generating" ||
        includesTag("daw", "stem", "mix", "master", "rescue")
      );
    case "needs_metadata":
      return (
        !track.title?.trim() ||
        !track.artist?.trim() ||
        !track.genre?.trim() ||
        includesTag("metadata", "metadatos")
      );
  }
}

function SessionResultCard({
  track,
  visibleFields,
  score,
  reasons = [],
  onPlay,
  onQueue,
  onPlaylist,
  onOpen,
  focused = false,
  onFocus,
}: {
  track: TrackSummary;
  visibleFields: Set<FieldVisibilityField>;
  score?: number;
  reasons?: string[];
  onPlay: () => void;
  onQueue: () => void;
  onPlaylist: () => void;
  onOpen?: (section: "library" | "organization") => void;
  focused?: boolean;
  onFocus?: () => void;
}) {
  const { t, language } = useI18n();
  const show = (field: FieldVisibilityField) => visibleFields.has(field);

  return (
    <article
      aria-label={track.title || track.fileName}
      data-session-result-id={track.id}
      tabIndex={0}
      onFocus={onFocus}
      className={`card-surface rounded-lg border p-3 transition hover:border-[#3a424e] focus:outline-none ${
        focused
          ? "border-[#d9ff43]/45 shadow-[0_0_0_1px_rgba(217,255,67,0.18)]"
          : "border-white/8"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p hidden={!show("title") && !show("fileName")} className="truncate text-sm font-medium">
            {track.title || track.fileName}
          </p>
          <p hidden={!show("artist") && !show("album") && !show("project")} className="mt-0.5 truncate text-xs text-white/40">
            {track.artist || t("explorer.unknownArtist")}
            {track.album ? ` · ${track.album}` : ""}
            {track.projectName ? ` · ${track.projectName}` : ""}
          </p>
        </div>
        {show("affinity") && score !== undefined && (
          <span className="shrink-0 rounded bg-[#d9ff43]/10 px-2 py-1 text-[10px] font-semibold text-[#d9ff43]/75">
            {t("field.affinity")} {score}
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {[
          show("rating") ? track.rating === null ? t("organization.noRating") : `${track.rating} / 10` : null,
          show("status") ? t(`status.${track.status}`) : null,
          show("genre") ? track.genre || t("session.noGenre") : null,
          show("mood") ? formatSystemValueList(language, "mood", track.mood) || t("session.noMood") : null,
          show("duration") ? formatDuration(track.durationMs) : null,
        ]
          .filter((value): value is string => Boolean(value))
          .map((value, index) => (
            <span
              key={`${value}-${index}`}
              className="max-w-full truncate rounded border border-white/8 bg-white/6 px-2 py-1 text-[10px] text-white/55"
            >
              {value}
            </span>
          ))}
      </div>
      {show("suggestionReason") && score !== undefined && reasons.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {reasons.slice(0, 4).map((reason) => (
            <span
              key={reason}
              className="rounded border border-white/8 bg-white/6 px-2 py-1 text-[10px] text-white/55"
            >
              {sessionReasonLabel(reason, t)}
            </span>
          ))}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={onPlay} className="toolbar-button">
          <Play size={13} /> {t("session.playNow")}
        </button>
        <button type="button" onClick={onQueue} className="toolbar-button">
          <ListPlus size={13} /> {t("session.addToQueue")}
        </button>
        <button type="button" onClick={onPlaylist} className="toolbar-button">
          <ListMusic size={13} /> {t("session.addToPlaylist")}
        </button>
        {onOpen && (
          <>
            <button
              type="button"
              onClick={() => onOpen("organization")}
              className="toolbar-button"
            >
              <Workflow size={13} /> {t("nav.organization")}
            </button>
            <button
              type="button"
              onClick={() => onOpen("library")}
              className="toolbar-button"
            >
              <Library size={13} /> {t("nav.library")}
            </button>
          </>
        )}
      </div>
    </article>
  );
}

function sessionReasonLabel(reason: string, t: (key: string) => string) {
  const keys: Record<string, string> = {
    same_project: "session.reasonSameProject",
    genre_affinity: "session.reasonGenreAffinity",
    compatible_genres: "session.reasonCompatibleGenres",
    shared_mood: "session.reasonSharedMood",
    related_tags: "session.reasonRelatedTags",
    radio_ready: "field.radioReady",
    release_ready: "field.releaseReady",
    compatible_use: "session.reasonCompatibleUse",
  };
  return keys[reason] ? t(keys[reason]) : reason;
}

function CurrentTrackCard({
  track,
  player,
  visibleFields,
  projects,
  models,
  canGoPrevious,
  canGoNext,
  onPrevious,
  onNext,
  onRatingChange,
  onStatusChange,
  onModelChange,
  onProjectChange,
}: {
  track: TrackDetails;
  player: ReturnType<typeof usePlayer>;
  visibleFields: Set<FieldVisibilityField>;
  projects: OrganizationOptions["projects"];
  models: string[];
  canGoPrevious: boolean;
  canGoNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onRatingChange: (value: string) => void;
  onStatusChange: (status: SongStatus) => void;
  onModelChange: (value: string) => void;
  onProjectChange: (value: string) => void;
}) {
  const { t, language } = useI18n();
  const isCurrent = player.currentTrack?.id === track.id;
  const isPlaying = isCurrent && player.state.status === "playing";
  const duration = track.durationMs ?? player.state.durationMs ?? 0;
  const show = (field: FieldVisibilityField) => visibleFields.has(field);
  const [modelDraft, setModelDraft] = useState(track.generationModel ?? "");
  const [availableProjects, setAvailableProjects] = useState(projects);
  const [newProject, setNewProject] = useState("");
  const modelInputId = `session-model-${track.id}`;

  useEffect(() => {
    setModelDraft(track.generationModel ?? "");
  }, [track.generationModel, track.id]);

  useEffect(() => {
    setAvailableProjects(projects);
  }, [projects]);

  function commitModel() {
    const next = modelDraft.trim();
    if ((track.generationModel ?? "") !== next) onModelChange(next);
  }

  async function createAndAssignProject() {
    if (!newProject.trim()) return;
    const project = await api.createProject(newProject.trim());
    setAvailableProjects((current) =>
      current.some((item) => item.id === project.id)
        ? current
        : [...current, project],
    );
    setNewProject("");
    onProjectChange(String(project.id));
  }

  async function togglePlayback() {
    player.setSelectedTrack(track);
    if (!isCurrent) await player.playTrack(track, "user_click", "session");
    else await player.togglePlayback();
  }

  const trackDisplayTitle = displayTitleWithVersion({
    ...track,
    title: show("title") ? track.title : track.fileName,
  });

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-[minmax(170px,0.95fr)_minmax(170px,0.8fr)] sm:items-start">
        <div hidden={!show("coverArt")} aria-label={t("session.coverPlaceholder")} className="grid aspect-square max-h-64 place-items-center rounded-xl border border-white/8 bg-[radial-gradient(circle_at_top,#2d3428,#1a1c1f_68%)]">
          <Disc3 size={86} className="text-[#d9ff43]/28" />
        </div>
        <div className="grid gap-3">
          <label hidden={!show("rating")} className="text-xs text-white/40">
            <span className="mb-1.5 flex items-center gap-1"><Star size={12} /> {t("field.rating")}</span>
            <select
              value={track.rating ?? ""}
              onChange={(event) => onRatingChange(event.target.value)}
              className="field"
            >
              <option value="">{t("organization.noRating")}</option>
              {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
                <option key={value} value={value}>{value} / 10</option>
              ))}
            </select>
          </label>
          <label hidden={!show("status")} className="text-xs text-white/40">
            <span className="mb-1.5 flex items-center gap-1"><FolderKanban size={12} /> {t("field.status")}</span>
            <select
              value={track.status}
              onChange={(event) => onStatusChange(event.target.value as SongStatus)}
              className="field"
            >
              {(["review", "idea", "editing", "generating", "selected", "final", "archived"] as SongStatus[]).map((status) => (
                <option key={status} value={status}>{t(`status.${status}`)}</option>
              ))}
            </select>
          </label>
          <div hidden={!show("generationModel")} className="text-xs text-white/40">
            <label htmlFor={modelInputId} className="mb-1.5 block">{t("field.generationModel")}</label>
            <div className="relative">
              <input
                id={modelInputId}
                list="session-model-options"
                value={modelDraft}
                onChange={(event) => setModelDraft(event.target.value)}
                onBlur={commitModel}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
                className="field pr-8"
                placeholder={t("explorer.selectOrTypeModel")}
              />
              <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white/35">▼</span>
            </div>
            <datalist id="session-model-options">
              {[...new Set([track.generationModel, ...models].filter(Boolean) as string[])].map((model) => (
                <option key={model} value={model} />
              ))}
            </datalist>
          </div>
          <label hidden={!show("project")} className="text-xs text-white/40">
            <span className="mb-1.5 block">{t("field.project")}</span>
            <select
              value={track.projectId ?? ""}
              onChange={(event) => onProjectChange(event.target.value)}
              className="field"
            >
              <option value="">{t("organization.noProject")}</option>
              {availableProjects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </label>
          <div hidden={!show("project")} className="flex gap-2">
            <input
              value={newProject}
              onChange={(event) => setNewProject(event.target.value)}
              className="field"
              placeholder={t("explorer.createProject")}
            />
            <button
              type="button"
              aria-label={t("explorer.createProject")}
              onClick={() => void createAndAssignProject()}
              className="rounded-md border border-white/10 px-3 text-white/55 hover:bg-white/5"
            >
              +
            </button>
          </div>
        </div>
      </div>
      <h3 hidden={!show("title") && !show("fileName")} className="mt-5 truncate text-2xl font-semibold" title={trackDisplayTitle}>
        {trackDisplayTitle}
      </h3>
      <p hidden={!show("artist")} className="mt-1 truncate text-sm text-white/50">
        {track.artist || t("explorer.unknownArtist")}
      </p>
      <p hidden={!show("album")} className="mt-1 truncate text-xs text-white/30">
        {track.album || t("explorer.noAlbum")}
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5 text-[10px] text-white/45">
        <Badge>{track.versionLabel || t("session.noVersion")}</Badge>
        <Badge>{track.genre || t("session.noGenre")}</Badge>
        {show("mood") && <Badge>{formatSystemValueList(language, "mood", track.mood) || t("session.noMood")}</Badge>}
        {show("duration") && <Badge>{formatDuration(track.durationMs)}</Badge>}
        {show("format") && <Badge>{track.audioFormat.toUpperCase()}</Badge>}
      </div>
      {show("tags") && track.tagNames && (
        <p className="mt-3 line-clamp-2 text-xs text-sky-200/45">{track.tagNames}</p>
      )}
      <p hidden={!show("path")} className="mt-3 truncate text-[10px] text-white/22" title={track.filePath}>
        {track.filePath}
      </p>

      <div className="elevated-surface mt-5 rounded-lg border border-white/8 p-4 shadow-inner">
        <div className="flex items-center justify-center gap-3">
          <button type="button" onClick={onPrevious} disabled={!canGoPrevious} className="explorer-player-button" aria-label={t("common.previous")}>
            <ChevronLeft size={19} />
          </button>
          <button type="button" onClick={() => void player.stop()} disabled={!isCurrent} className="explorer-player-button" aria-label={t("common.stop")}>
            <Square size={14} fill="currentColor" />
          </button>
          <button type="button" onClick={() => void togglePlayback()} className="rounded-full bg-[#d9ff43] p-4 text-[#101113]" aria-label={isPlaying ? t("common.pause") : t("common.play")}>
            {isPlaying ? <Pause size={21} fill="currentColor" /> : <Play size={21} fill="currentColor" />}
          </button>
          <button type="button" onClick={onNext} disabled={!canGoNext} className="explorer-player-button" aria-label={t("common.next")}>
            <ChevronRight size={19} />
          </button>
        </div>
        <div className="mt-4 flex items-center gap-2 text-[10px] tabular-nums text-white/35">
          <span>{formatDuration(isCurrent ? player.state.positionMs : 0)}</span>
          <input
            type="range"
            min={0}
            max={Math.max(1, duration)}
            value={isCurrent ? Math.min(player.state.positionMs, Math.max(1, duration)) : 0}
            onChange={(event) => void player.seek(Number(event.target.value))}
            disabled={!isCurrent}
            aria-label={t("session.playbackProgress")}
            className="h-1 min-w-0 flex-1 accent-[#d9ff43]"
          />
          <span>{formatDuration(duration || null)}</span>
        </div>
        <label className="mt-4 flex items-center gap-3 text-xs text-white/35">
          <Volume2 size={15} />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={player.state.volume}
            onChange={(event) => void player.setVolume(Number(event.target.value))}
            aria-label={t("session.volume")}
            className="h-1 flex-1 accent-[#d9ff43]"
          />
        </label>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        <QuickStatus label={t("field.radioReady")} onClick={() => onStatusChange("selected")} />
        <QuickStatus label={t("field.releaseReady")} onClick={() => onStatusChange("final")} />
        <QuickStatus label={t("field.archived")} onClick={() => onStatusChange("archived")} danger />
      </div>
    </>
  );
}

function QuickStatus({
  label,
  onClick,
  danger = false,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2 py-2 text-[10px] ${
        danger
          ? "border-red-400/15 text-red-200/55 hover:bg-red-400/8"
          : "border-white/10 text-white/50 hover:bg-white/5"
      }`}
    >
      {danger && <Archive size={11} className="mr-1 inline" />}
      {label}
    </button>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-white/6 bg-white/5 px-2 py-1">
      {children}
    </span>
  );
}

function splitValues(value: string) {
  return value
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function SaveSessionQueueDialog({
  trackIds,
  onClose,
  onComplete,
}: {
  trackIds: number[];
  onClose: () => void;
  onComplete: (message: string) => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(
    `${t("session.defaultQueueName")} ${new Date().toLocaleDateString(t("session.dateLocale"))}`,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveQueue() {
    setSaving(true);
    setError(null);
    try {
      const request: PlaylistSaveRequest = {
        name: name.trim(),
        description: t("session.savedQueueDescription"),
        playlistType: "session",
      };
      const playlist = await api.createPlaylist(request);
      const result = await api.addTracksToPlaylist(playlist.id, trackIds);
      onComplete(
        `${t("session.queueSavedPrefix")} "${playlist.name}" ${t("session.queueSavedWith")} ${result.changed} ${t("library.songs")}.`,
      );
    } catch (saveError) {
      setError(String(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-6">
      <section role="dialog" aria-modal="true" aria-label={t("session.saveQueueAsPlaylist")} className="card-surface w-full max-w-md rounded-xl border border-white/10 shadow-2xl">
        <header className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <div>
            <h2 className="font-semibold">{t("session.saveQueueAsPlaylist")}</h2>
            <p className="mt-1 text-xs text-white/35">{trackIds.length} {t("library.songs")} · {t("session.typeSession")}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t("common.close")} className="p-2 text-white/45"><X size={18} /></button>
        </header>
        <div className="p-5">
          <label className="text-xs text-white/45">
            {t("field.playlistName")}
            <input autoFocus value={name} onChange={(event) => setName(event.target.value)} className="field mt-1.5" />
          </label>
          {error && <p className="mt-3 rounded-md border border-red-400/20 bg-red-400/8 px-3 py-2 text-xs text-red-200">{error}</p>}
        </div>
        <footer className="flex justify-end gap-2 border-t border-white/8 px-5 py-4">
          <button type="button" onClick={onClose} className="toolbar-button">{t("common.cancel")}</button>
          <button type="button" disabled={saving || !name.trim()} onClick={() => void saveQueue()} className="rounded-md bg-[#d9ff43] px-4 py-2 text-sm font-semibold text-[#101113] disabled:opacity-40">
            {saving ? t("common.saving") : t("session.saveSession")}
          </button>
        </footer>
      </section>
    </div>
  );
}
