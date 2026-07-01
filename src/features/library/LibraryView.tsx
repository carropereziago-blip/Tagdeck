import { open } from "@tauri-apps/plugin-dialog";
import { startDrag } from "@crabnebula/tauri-plugin-drag";
import { FolderSearch, ListPlus, Pencil, Radio, RefreshCw, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../lib/tauri";
import { hasLibraryFolder } from "../../lib/libraryFolders";
import {
  shortcutRatingFromKey,
  shortcutStatusFromKey,
  findShortcutForEvent,
  shouldIgnoreKeyboardShortcut,
} from "../../lib/keyboardShortcuts";
import {
  panelZoomActionFromKey,
  updatePanelZoomSetting,
  type PanelZoomAction,
} from "../../lib/panelZoom";
import { useI18n } from "../../i18n";
import type {
  ExplorerCriterion,
  LibraryFolderOption,
  MetadataEditSummary,
  MetadataPatch,
  OrganizationOptions,
  OrganizationPatch,
  Project,
  ScanSummary,
  SortDirection,
  TrackDetails,
  TrackSortField,
  TrackSummary,
} from "../../types/track";
import { MetadataEditor } from "../editor/MetadataEditor";
import { InternalOrganizationEditor } from "./InternalOrganizationEditor";
import { TrackInspector } from "../inspector/TrackInspector";
import { usePlayer } from "../player/PlayerContext";
import { useSettings } from "../settings/SettingsContext";
import { visibleFieldsForZone, visibleLibraryColumns } from "../settings/settings";
import { AddToPlaylistDialog } from "../playlists/AddToPlaylistDialog";
import {
  AutoNumberVersionsDialog,
  type AutoNumberVersionPlanItem,
} from "./AutoNumberVersionsDialog";
import { TrackTable } from "./TrackTable";

interface EditorSession {
  kind: "metadata" | "organization";
  mode: "single" | "bulk";
  trackIds: number[];
}

const EMPTY_ORGANIZATION_OPTIONS: OrganizationOptions = {
  tags: [],
  projects: [],
  versions: [],
  models: [],
  smartCollections: [],
};

interface PlaylistSession {
  trackIds: number[];
  title: string;
  createOnly: boolean;
}

interface RemoveConfirmation {
  trackIds: number[];
}

const LIBRARY_FILTERS_KEY = "tagdeck.library.filters";

export function LibraryView({
  focusTrackId,
  onOpenSession,
  onOpenExplorerTrack,
  onStartReviewing,
  scanRequest = 0,
}: {
  focusTrackId?: number;
  onOpenSession?: (trackId: number, queueIds?: number[], queueName?: string) => void;
  onOpenExplorerTrack?: (trackId: number, queueIds?: number[]) => void;
  onStartReviewing?: (criterion?: ExplorerCriterion) => void;
  scanRequest?: number;
}) {
  const [tracks, setTracks] = useState<TrackSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedTrack, setSelectedTrack] = useState<TrackDetails | null>(null);
  const [selectedMetadata, setSelectedMetadata] = useState<Awaited<
    ReturnType<typeof api.readAudioMetadata>
  > | null>(null);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [folders, setFolders] = useState<LibraryFolderOption[]>([]);
  const [foldersLoaded, setFoldersLoaded] = useState(false);
  const [folderPath, setFolderPath] = useState("");
  const [ratingMin, setRatingMin] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<TrackSortField>("title");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [scanSummary, setScanSummary] = useState<ScanSummary | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [editorSession, setEditorSession] = useState<EditorSession | null>(null);
  const [organizationOptions, setOrganizationOptions] = useState<OrganizationOptions>(
    EMPTY_ORGANIZATION_OPTIONS,
  );
  const [playlistSession, setPlaylistSession] = useState<PlaylistSession | null>(null);
  const [removeConfirmation, setRemoveConfirmation] =
    useState<RemoveConfirmation | null>(null);
  const [emptyLibraryConfirmationOpen, setEmptyLibraryConfirmationOpen] =
    useState(false);
  const [emptyLibraryConfirmationText, setEmptyLibraryConfirmationText] =
    useState("");
  const [autoNumberVersionTracks, setAutoNumberVersionTracks] = useState<
    TrackSummary[] | null
  >(null);
  const [dragIconPath, setDragIconPath] = useState<string | null>(null);
  const { settings, updateSettings } = useSettings();
  const { t } = useI18n();
  const pageSize = settings.library.visibleLimit;
  const visibleLimitOptions = [1000, 5000, 10000, 20000] as const;
  const nextVisibleLimit = visibleLimitOptions.find((limit) => limit > pageSize) ?? null;
  const showInspector =
    settings.layout.inspectorVisible && !settings.layout.focusMode;
  const libraryTableColumns = visibleLibraryColumns(
    settings.fieldVisibility,
    settings.library.columnOrder,
  );
  const libraryInspectorFields = visibleFieldsForZone(
    settings.fieldVisibility,
    "libraryInspector",
  );
  const filtersHydrated = useRef(false);
  const selectionAnchorTrackId = useRef<number | null>(null);
  const {
    setLibraryTracks,
    setSelectedTrack: setPlayerSelectedTrack,
    forgetTracks,
    playTrack,
    togglePlayback,
    playNext,
    playPrevious,
    state: playerState,
    stop,
  } = usePlayer();

  useEffect(() => {
    if (!settings.library.rememberFilters) return;
    try {
      const saved = JSON.parse(localStorage.getItem(LIBRARY_FILTERS_KEY) ?? "{}") as {
        search?: string;
        folderPath?: string;
        ratingMin?: number | null;
        sortBy?: TrackSortField;
        sortDirection?: SortDirection;
      };
      if (typeof saved.search === "string") {
        setSearchInput(saved.search);
        setDebouncedSearchQuery(saved.search);
      }
      if (typeof saved.folderPath === "string") setFolderPath(saved.folderPath);
      if (saved.ratingMin === null || typeof saved.ratingMin === "number") {
        setRatingMin(saved.ratingMin ?? null);
      }
      if (saved.sortBy) setSortBy(saved.sortBy);
      if (saved.sortDirection) setSortDirection(saved.sortDirection);
    } catch {
      localStorage.removeItem(LIBRARY_FILTERS_KEY);
    } finally {
      filtersHydrated.current = true;
    }
  }, [settings.library.rememberFilters]);

  useEffect(() => {
    if (!settings.library.rememberFilters || !filtersHydrated.current) return;
    localStorage.setItem(
      LIBRARY_FILTERS_KEY,
      JSON.stringify({ search: searchInput, folderPath, ratingMin, sortBy, sortDirection }),
    );
  }, [
    folderPath,
    ratingMin,
    searchInput,
    settings.library.rememberFilters,
    sortBy,
    sortDirection,
  ]);

  useEffect(() => {
    setLibraryTracks(tracks, "library");
  }, [setLibraryTracks, tracks]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearchQuery(searchInput);
    }, 200);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const loadFolders = useCallback(async () => {
    try {
      const availableFolders = await api.getLibraryFolders();
      setFolders(availableFolders);
      setFoldersLoaded(true);
    } catch (folderError) {
      setError(String(folderError));
    }
  }, []);

  const loadOrganizationOptions = useCallback(async () => {
    try {
      setOrganizationOptions(await api.getOrganizationOptions());
    } catch (optionsError) {
      setError(String(optionsError));
    }
  }, []);

  useEffect(() => {
    void loadFolders();
    void loadOrganizationOptions();
  }, [loadFolders, loadOrganizationOptions]);

  useEffect(() => {
    if (folderPath && foldersLoaded && !hasLibraryFolder(folders, folderPath)) {
      setFolderPath("");
    }
  }, [folderPath, folders, foldersLoaded]);

  useEffect(() => {
    void api.getDragIconPath().then(setDragIconPath).catch((dragError) => {
      setError(String(dragError));
    });
  }, []);

  const loadLibrary = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const startedAt =
        typeof performance !== "undefined" ? performance.now() : null;
      const page = await api.getLibraryTracks({
        search: debouncedSearchQuery.trim() || null,
        folderPath: folderPath || null,
        ratingMin,
        ratingMax: null,
        status: null,
        tagId: null,
        projectId: null,
        versionLabel: null,
        smartCollection: null,
        sortBy,
        sortDirection,
        limit: pageSize,
        offset: 0,
      });
      setTracks(page.items);
      setTotal(page.total);
      const visibleIds = new Set(page.items.map((track) => track.id));
      setSelectedIds(
        (current) => new Set([...current].filter((id) => visibleIds.has(id))),
      );
      if (
        selectionAnchorTrackId.current !== null &&
        !visibleIds.has(selectionAnchorTrackId.current)
      ) {
        selectionAnchorTrackId.current = null;
      }
      if (
        import.meta.env.DEV &&
        import.meta.env.MODE !== "test" &&
        startedAt !== null
      ) {
        console.debug("[Library] loaded", {
          filtered: page.total,
          visible: page.items.length,
          ms: Math.round(performance.now() - startedAt),
        });
      }

    } catch (loadError) {
      setError(String(loadError));
    } finally {
      setLoading(false);
    }
  }, [
    folderPath,
    ratingMin,
    debouncedSearchQuery,
    sortBy,
    sortDirection,
    pageSize,
  ]);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  const handleScan = useCallback(async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      defaultPath:
        settings.library.rememberScanFolder && settings.library.lastScanFolder
          ? settings.library.lastScanFolder
          : undefined,
      title: t("library.selectMusicFolder"),
    });

    if (!selected) {
      return;
    }

    setScanning(true);
    setError(null);
    try {
      if (settings.library.rememberScanFolder) {
        updateSettings((current) => ({
          ...current,
          library: { ...current.library, lastScanFolder: selected },
        }));
      }
      const summary = await api.scanFolder(selected);
      setScanSummary(summary);
      await Promise.all([loadLibrary(), loadFolders()]);
    } catch (scanError) {
      setError(String(scanError));
    } finally {
      setScanning(false);
    }
  }, [loadFolders, loadLibrary, settings.library, t, updateSettings]);

  useEffect(() => {
    if (scanRequest > 0) void handleScan();
  }, [handleScan, scanRequest]);

  const handleSelect = useCallback(async (track: TrackSummary) => {
    selectionAnchorTrackId.current = track.id;
    try {
      const details = await api.getTrack(track.id);
      setSelectedTrack(details);
      setPlayerSelectedTrack(details);
      setSelectedMetadata(null);
      setMetadataError(null);
      setMetadataLoading(true);
      try {
        setSelectedMetadata(await api.readAudioMetadata(details.filePath));
      } catch (metadataError) {
        const message = String(metadataError);
        setMetadataError(message);
        setError(message);
      } finally {
        setMetadataLoading(false);
      }
    } catch (selectError) {
      setError(String(selectError));
    }
  }, [setPlayerSelectedTrack]);

  useEffect(() => {
    if (!focusTrackId) return;
    const summary = tracks.find((track) => track.id === focusTrackId);
    if (summary) void handleSelect(summary);
  }, [focusTrackId, handleSelect, tracks]);

  const handlePlay = useCallback(async (track: TrackSummary) => {
    try {
      const details = await api.getTrack(track.id);
      setSelectedTrack(details);
      setPlayerSelectedTrack(details);
      await playTrack(details, "user_click", "library");
      setSelectedMetadata(null);
      setMetadataError(null);
      setMetadataLoading(true);
      try {
        setSelectedMetadata(await api.readAudioMetadata(details.filePath));
      } catch (metadataError) {
        const message = String(metadataError);
        setMetadataError(message);
        setError(message);
      } finally {
        setMetadataLoading(false);
      }
    } catch (playError) {
      setError(String(playError));
    }
  }, [playTrack, setPlayerSelectedTrack]);

  const refreshSelectedTrack = useCallback(async (id: number) => {
    const refreshed = await api.getTrack(id);
    setSelectedTrack(refreshed);
    setPlayerSelectedTrack(refreshed);
    setSelectedMetadata(null);
    setMetadataError(null);
    setMetadataLoading(true);
    try {
      setSelectedMetadata(await api.readAudioMetadata(refreshed.filePath));
    } catch (refreshError) {
      setMetadataError(String(refreshError));
    } finally {
      setMetadataLoading(false);
    }
    return refreshed;
  }, [setPlayerSelectedTrack]);

  const handleRatingChange = useCallback(async (id: number, rating: number | null) => {
    try {
      const updated = await api.updateTrackRating(id, rating);
      setTracks((current) =>
        current.map((track) =>
          track.id === id ? { ...track, rating: updated.rating } : track,
        ),
      );
      if (selectedTrack?.id === id) {
        setSelectedTrack(updated);
        setPlayerSelectedTrack(updated);
      }
    } catch (ratingError) {
      setError(String(ratingError));
      throw ratingError;
    }
  }, [selectedTrack?.id, setPlayerSelectedTrack]);

  const handleExternalDrag = useCallback((track: TrackSummary) => {
    if (!dragIconPath) {
      setError("El arrastre de archivos todavía no está preparado.");
      return;
    }

    const draggedTracks =
      selectedIds.has(track.id) && selectedIds.size > 0
        ? tracks.filter((candidate) => selectedIds.has(candidate.id))
        : [track];
    void startDrag({
      item: draggedTracks.map((candidate) => candidate.filePath),
      icon: dragIconPath,
      mode: "copy",
    }).catch((dragError) => setError(String(dragError)));
  }, [dragIconPath, selectedIds, tracks]);

  const selectedActionTrack = useMemo(() => {
    if (selectedIds.size > 0) {
      return tracks.find((track) => selectedIds.has(track.id)) ?? null;
    }
    return selectedTrack;
  }, [selectedIds, selectedTrack, tracks]);

  const selectedActionTrackIdsInTableOrder = useMemo(() => {
    if (selectedIds.size > 0) {
      return tracks
        .filter((track) => selectedIds.has(track.id))
        .map((track) => track.id);
    }
    return selectedActionTrack ? [selectedActionTrack.id] : [];
  }, [selectedActionTrack, selectedIds, tracks]);

  const hasActionSelection = selectedIds.size > 0 || selectedTrack !== null;
  const canOpenExplorerTrack = selectedActionTrackIdsInTableOrder.length > 0;

  const handleOpenSelectedInExplorer = useCallback(() => {
    const [firstTrackId] = selectedActionTrackIdsInTableOrder;
    if (!firstTrackId) {
      setNotice(t("library.selectSongsFirst"));
      return;
    }
    onOpenExplorerTrack?.(firstTrackId, selectedActionTrackIdsInTableOrder);
  }, [onOpenExplorerTrack, selectedActionTrackIdsInTableOrder, t]);

  const handleSelectionChange = useCallback((
    id: number,
    selected: boolean,
    options?: { shiftKey?: boolean },
  ) => {
    setSelectedIds((current) => {
      const anchorId = selectionAnchorTrackId.current;
      const shouldApplyRange = Boolean(options?.shiftKey && anchorId !== null);
      const anchorIndex = shouldApplyRange
        ? tracks.findIndex((track) => track.id === anchorId)
        : -1;
      const clickedIndex = shouldApplyRange
        ? tracks.findIndex((track) => track.id === id)
        : -1;
      const next = new Set(current);

      if (anchorIndex >= 0 && clickedIndex >= 0) {
        const start = Math.min(anchorIndex, clickedIndex);
        const end = Math.max(anchorIndex, clickedIndex);
        for (const track of tracks.slice(start, end + 1)) {
          if (selected) {
            next.add(track.id);
          } else {
            next.delete(track.id);
          }
        }
        return next;
      }

      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      selectionAnchorTrackId.current = id;
      return next;
    });
  }, [tracks]);

  const handleSelectAll = useCallback((selected: boolean) => {
    selectionAnchorTrackId.current = null;
    setSelectedIds(selected ? new Set(tracks.map((track) => track.id)) : new Set());
  }, [tracks]);

  const handleSelectAllVisibleShortcut = useCallback(() => {
    handleSelectAll(true);
    setNotice(
      t("library.visibleSongsSelected").replace("{count}", String(tracks.length)),
    );
  }, [handleSelectAll, t, tracks.length]);

  const handleClearSelectionShortcut = useCallback(() => {
    if (selectedIds.size === 0) return;
    selectionAnchorTrackId.current = null;
    setSelectedIds(new Set());
    setNotice(t("library.selectionCleared"));
  }, [selectedIds.size, t]);

  const updateLayout = useCallback(
    (patch: Partial<typeof settings.layout>) => {
      updateSettings((current) => ({
        ...current,
        layout: { ...current.layout, ...patch },
      }));
    },
    [updateSettings],
  );

  const changeLibraryInspectorZoom = useCallback(
    (action: PanelZoomAction) => {
      updateSettings((current) =>
        updatePanelZoomSetting(current, "libraryInspectorZoom", action),
      );
    },
    [updateSettings],
  );

  const increaseVisibleLimit = useCallback(() => {
    if (!nextVisibleLimit) return;
    updateSettings((current) => ({
      ...current,
      library: {
        ...current.library,
        visibleLimit: nextVisibleLimit,
      },
    }));
  }, [nextVisibleLimit, updateSettings]);

  const handleMetadataSave = useCallback(async (
    patch: MetadataPatch,
  ): Promise<MetadataEditSummary> => {
    if (!editorSession) {
      throw new Error(t("library.noActiveEditSelection"));
    }
    const trackIds = editorSession.trackIds;
    if (
      ((trackIds.length > 1 && settings.metadata.confirmBulkEdit) ||
        settings.metadata.warnBeforeWrite) &&
      !window.confirm(
        trackIds.length > 1
          ? `${t("library.writeMetadataManyPrefix")} ${trackIds.length} ${t("library.writeMetadataManySuffix")}`
          : t("library.writeMetadataOneConfirm"),
      )
    ) {
      throw new Error(t("library.editCancelled"));
    }
    const result = await api.updateTrackMetadata(trackIds, patch);
    await loadLibrary();

    if (selectedTrack && trackIds.includes(selectedTrack.id)) {
      const refreshed = await api.getTrack(selectedTrack.id);
      setSelectedTrack(refreshed);
      setPlayerSelectedTrack(refreshed);
      setMetadataLoading(true);
      setMetadataError(null);
      try {
        setSelectedMetadata(await api.readAudioMetadata(refreshed.filePath));
      } catch (refreshError) {
        setMetadataError(String(refreshError));
      } finally {
        setMetadataLoading(false);
      }
    }

    if (result.failed > 0) {
      setError(
        `Edición terminada: ${result.succeeded} guardadas y ${result.failed} con error.`,
      );
    } else {
      setError(null);
    }
    return result;
  }, [
    editorSession,
    loadLibrary,
    selectedTrack,
    setPlayerSelectedTrack,
    settings.metadata,
  ]);

  const handleInternalOrganizationSave = useCallback(async (patch: OrganizationPatch) => {
    if (!editorSession || editorSession.kind !== "organization") {
      throw new Error(t("library.noActiveEditSelection"));
    }
    const trackIds = editorSession.trackIds;
    const result = await api.updateTrackOrganization(trackIds, patch);
    await Promise.all([loadLibrary(), loadOrganizationOptions()]);
    if (selectedTrack && trackIds.includes(selectedTrack.id)) {
      await refreshSelectedTrack(selectedTrack.id);
    }
    setError(null);
    setNotice(
      `${result.updated} ${result.updated === 1 ? t("organization.songUpdated") : t("organization.songsUpdated")}`,
    );
    setEditorSession(null);
  }, [
    editorSession,
    loadLibrary,
    loadOrganizationOptions,
    refreshSelectedTrack,
    selectedTrack,
    t,
  ]);

  const handleCreateProjectFromEditor = useCallback(async (name: string): Promise<Project> => {
    const project = await api.createProject(name);
    await loadOrganizationOptions();
    return project;
  }, [loadOrganizationOptions]);

  const handleInlineMetadataSave = useCallback(async (patch: MetadataPatch) => {
    if (!selectedTrack) {
      throw new Error(t("library.noSelectedSong"));
    }
    if (
      settings.metadata.warnBeforeWrite &&
      !window.confirm(
        "¿Escribir este metadato en el archivo? Se creará un backup del original.",
      )
    ) {
      throw new Error("Edición cancelada.");
    }
    const result = await api.updateTrackMetadata([selectedTrack.id], patch);
    await loadLibrary();
    await refreshSelectedTrack(selectedTrack.id);
    if (result.failed > 0) {
      const message = result.items.find((item) => !item.success)?.error;
      throw new Error(message || t("library.metadataSaveFailed"));
    }
    setNotice(
      patch.unsyncedLyrics ? t("library.lyricsSavedSafely") : t("library.metadataSaved"),
    );
  }, [
    loadLibrary,
    refreshSelectedTrack,
    selectedTrack,
    settings.metadata.warnBeforeWrite,
  ]);

  const handleInlineOrganizationSave = useCallback(async (patch: OrganizationPatch) => {
    if (!selectedTrack) {
      throw new Error(t("library.noSelectedSong"));
    }
    await api.updateTrackOrganization([selectedTrack.id], patch);
    await loadLibrary();
    await refreshSelectedTrack(selectedTrack.id);
    setNotice(t("library.internalOrganizationSaved"));
  }, [loadLibrary, refreshSelectedTrack, selectedTrack]);

  const handleInlineProjectNameSave = useCallback(async (name: string | null) => {
    if (!selectedTrack) {
      throw new Error(t("library.noSelectedSong"));
    }
    if (!name) {
      await api.updateTrackOrganization([selectedTrack.id], {
        projectId: { value: null },
      });
    } else {
      const project = await api.createProject(name);
      await api.updateTrackOrganization([selectedTrack.id], {
        projectId: { value: project.id },
      });
    }
    await loadLibrary();
    await refreshSelectedTrack(selectedTrack.id);
    setNotice(t("library.internalProjectSaved"));
  }, [loadLibrary, refreshSelectedTrack, selectedTrack]);

  const handleInlineCurationSave = useCallback(async (
    patch: Partial<
      Pick<
        TrackDetails,
        "strongPart" | "mainProblem" | "intendedUse" | "mood" | "generationModel"
      >
    >,
  ) => {
    if (!selectedTrack) {
      throw new Error(t("library.noSelectedSong"));
    }
    await api.saveCuration({
      trackId: selectedTrack.id,
      rating: selectedTrack.rating,
      organization: {},
      strongPart: Object.prototype.hasOwnProperty.call(patch, "strongPart")
        ? patch.strongPart ?? null
        : selectedTrack.strongPart,
      mainProblem: Object.prototype.hasOwnProperty.call(patch, "mainProblem")
        ? patch.mainProblem ?? null
        : selectedTrack.mainProblem,
      intendedUse: Object.prototype.hasOwnProperty.call(patch, "intendedUse")
        ? patch.intendedUse ?? null
        : selectedTrack.intendedUse,
      mood: Object.prototype.hasOwnProperty.call(patch, "mood")
        ? patch.mood ?? null
        : selectedTrack.mood,
      generationModel: Object.prototype.hasOwnProperty.call(patch, "generationModel")
        ? patch.generationModel ?? null
        : selectedTrack.generationModel,
      markReviewed: false,
    });
    await loadLibrary();
    await refreshSelectedTrack(selectedTrack.id);
    setNotice(t("library.curationFieldSaved"));
  }, [loadLibrary, refreshSelectedTrack, selectedTrack]);

  const handleSort = useCallback((field: TrackSortField) => {
    if (sortBy === field) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDirection("asc");
    }
  }, [sortBy]);

  const openBulkEditor = useCallback(() => {
    const trackIds = [...selectedIds];
    if (trackIds.length > 0) {
      setEditorSession({ kind: "metadata", mode: "bulk", trackIds });
    }
  }, [selectedIds]);

  const selectedTracksInTableOrder = useMemo(
    () => tracks.filter((track) => selectedIds.has(track.id)),
    [selectedIds, tracks],
  );

  const handleOpenAutoNumberVersions = useCallback(() => {
    if (selectedTracksInTableOrder.length < 2) {
      setNotice(t("library.selectTwoSongsFirst"));
      return;
    }
    setAutoNumberVersionTracks(selectedTracksInTableOrder);
  }, [selectedTracksInTableOrder, t]);

  const handleApplyAutoNumberVersions = useCallback(
    async (plan: AutoNumberVersionPlanItem[]) => {
      const updates = plan.filter((item) => !item.skipped && item.versionLabel);
      const skipped = plan.length - updates.length;
      await Promise.all(
        updates.map((item) =>
          api.updateTrackOrganization([item.track.id], {
            versionLabel: { value: item.versionLabel },
          }),
        ),
      );
      setTracks((current) =>
        current.map((track) => {
          const update = updates.find((item) => item.track.id === track.id);
          return update ? { ...track, versionLabel: update.versionLabel } : track;
        }),
      );
      if (selectedTrack && updates.some((item) => item.track.id === selectedTrack.id)) {
        await refreshSelectedTrack(selectedTrack.id);
      }
      await loadLibrary();
      setAutoNumberVersionTracks(null);
      setNotice(
        skipped > 0
          ? t("library.autoNumberUpdatedSkipped")
              .replace("{updated}", String(updates.length))
              .replace("{skipped}", String(skipped))
          : t("library.autoNumberUpdated").replace("{count}", String(updates.length)),
      );
    },
    [loadLibrary, refreshSelectedTrack, selectedTrack, t],
  );

  const handleEditSelected = useCallback(() => {
    const checkedTrackIds = [...selectedIds];
    if (checkedTrackIds.length > 0) {
      setEditorSession({ kind: "metadata", mode: "bulk", trackIds: checkedTrackIds });
    } else if (selectedTrack) {
      setEditorSession({ kind: "metadata", mode: "single", trackIds: [selectedTrack.id] });
    }
  }, [selectedIds, selectedTrack]);

  const handleEditInternalOrganization = useCallback(() => {
    const checkedTrackIds = [...selectedIds];
    void loadOrganizationOptions();
    if (checkedTrackIds.length > 0) {
      setEditorSession({
        kind: "organization",
        mode: "bulk",
        trackIds: checkedTrackIds,
      });
    } else if (selectedTrack) {
      setEditorSession({
        kind: "organization",
        mode: "single",
        trackIds: [selectedTrack.id],
      });
    }
  }, [loadOrganizationOptions, selectedIds, selectedTrack]);

  const handleCloseEditor = useCallback(() => setEditorSession(null), []);

  const filterTrackIdsForPlaylist = useCallback(() => {
    const ordered = [...tracks];
    if (settings.playlists.filterListOrder === "rating") {
      ordered.sort((left, right) => (right.rating ?? -1) - (left.rating ?? -1));
    } else if (settings.playlists.filterListOrder === "title") {
      ordered.sort((left, right) =>
        (left.title ?? left.fileName).localeCompare(
          right.title ?? right.fileName,
          "es",
        ),
      );
    }
    return ordered.map((track) => track.id);
  }, [settings.playlists.filterListOrder, tracks]);

  const clearTrackState = useCallback((trackIds: number[]) => {
    const removedIds = new Set(trackIds);
    setSelectedIds((current) => {
      const next = new Set(current);
      trackIds.forEach((trackId) => next.delete(trackId));
      return next;
    });
    if (selectedTrack && removedIds.has(selectedTrack.id)) {
      setSelectedTrack(null);
      setSelectedMetadata(null);
      setMetadataError(null);
      setPlayerSelectedTrack(null);
    }
    setEditorSession((session) =>
      session?.trackIds.some((trackId) => removedIds.has(trackId)) ? null : session,
    );
    forgetTracks(trackIds);
  }, [forgetTracks, selectedTrack, setPlayerSelectedTrack]);

  const handleRemoveSelected = useCallback(() => {
    const trackIds =
      selectedIds.size > 0
        ? [...selectedIds]
        : selectedTrack
          ? [selectedTrack.id]
          : [];
    if (trackIds.length === 0) {
      return;
    }

    setRemoveConfirmation({ trackIds });
  }, [selectedIds, selectedTrack]);

  const confirmRemoveSelected = useCallback(async () => {
    if (!removeConfirmation) {
      return;
    }
    const { trackIds } = removeConfirmation;

    setRemoving(true);
    setError(null);
    setNotice(null);
    try {
      if (playerState.trackId !== null && trackIds.includes(playerState.trackId)) {
        await stop();
      }
      const result = await api.removeTracksFromLibrary(trackIds);
      clearTrackState(trackIds);
      setNotice(
        `${result.removed} ${result.removed === 1 ? t("library.songRemoved") : t("library.songsRemoved")} ${t("library.fromLibrary")}. ${t("library.filesStillIntact")}`,
      );
      await Promise.all([loadLibrary(), loadFolders()]);
    } catch (removeError) {
      setError(String(removeError));
    } finally {
      setRemoving(false);
      setRemoveConfirmation(null);
    }
  }, [
    clearTrackState,
    loadFolders,
    loadLibrary,
    playerState.trackId,
    removeConfirmation,
    stop,
    t,
  ]);

  const handleClearLibrary = useCallback(() => {
    setEmptyLibraryConfirmationText("");
    setEmptyLibraryConfirmationOpen(true);
  }, []);

  const confirmClearLibrary = useCallback(async () => {
    setRemoving(true);
    setError(null);
    setNotice(null);
    try {
      await stop();
      await api.clearLibrary();
      forgetTracks(null);
      setSelectedTrack(null);
      setPlayerSelectedTrack(null);
      setSelectedMetadata(null);
      setMetadataError(null);
      setTracks([]);
      setTotal(0);
      setFolders([]);
      setFolderPath("");
      setSelectedIds(new Set());
      setEditorSession(null);
      setAutoNumberVersionTracks(null);
      setNotice(t("library.emptyLibrarySuccess"));
    } catch (clearError) {
      setError(String(clearError));
    } finally {
      setRemoving(false);
      setEmptyLibraryConfirmationOpen(false);
      setEmptyLibraryConfirmationText("");
    }
  }, [forgetTracks, setPlayerSelectedTrack, stop, t]);

  const selectedOrCheckedTrackIds = useCallback(() => {
    if (selectedIds.size > 0) {
      return tracks
        .filter((track) => selectedIds.has(track.id))
        .map((track) => track.id);
    }
    return selectedTrack ? [selectedTrack.id] : [];
  }, [selectedIds, selectedTrack, tracks]);

  const applyShortcutRating = useCallback(
    async (rating: number) => {
      const trackIds = selectedOrCheckedTrackIds();
      if (trackIds.length === 0) {
        setNotice(t("library.selectSongForShortcut"));
        return;
      }
      await Promise.all(trackIds.map((id) => handleRatingChange(id, rating)));
      setNotice(
        t("library.ratingApplied")
          .replace("{rating}", String(rating))
          .replace("{count}", String(trackIds.length)),
      );
    },
    [handleRatingChange, selectedOrCheckedTrackIds, t],
  );

  const applyShortcutStatus = useCallback(
    async (status: TrackDetails["status"]) => {
      const trackIds = selectedOrCheckedTrackIds();
      if (trackIds.length === 0) {
        setNotice(t("library.selectSongForShortcut"));
        return;
      }
      await api.updateTrackOrganization(trackIds, { status: { value: status } });
      setTracks((current) =>
        current.map((track) =>
          trackIds.includes(track.id) ? { ...track, status } : track,
        ),
      );
      if (selectedTrack && trackIds.includes(selectedTrack.id)) {
        await refreshSelectedTrack(selectedTrack.id);
      }
      setNotice(`${t("field.status")}: ${t(`status.${status}`)}.`);
    },
    [refreshSelectedTrack, selectedOrCheckedTrackIds, selectedTrack, t],
  );

  const applyCustomShortcut = useCallback(async (event: KeyboardEvent) => {
    const rule = findShortcutForEvent(
      settings.customKeyboardShortcuts ?? [],
      "library",
      event,
    );
    if (!rule) return false;
    const trackIds = selectedOrCheckedTrackIds();
    const value = rule.value.trim();
    if (rule.field !== "action" && trackIds.length === 0) {
      setNotice(t("library.selectSongForShortcut"));
      return true;
    }
    if (rule.field === "rating") {
      await Promise.all(
        trackIds.map((id) =>
          handleRatingChange(id, value === "clear" ? null : Number(value)),
        ),
      );
    } else if (rule.field === "status" && value) {
      await api.updateTrackOrganization(trackIds, { status: { value } });
    } else if (rule.field === "mood") {
      await api.updateTrackOrganization(trackIds, { mood: { value: value || null } });
    } else if (rule.field === "internal_tag" && value) {
      await api.updateTrackOrganization(trackIds, {
        tagNames: [value],
        tagMode: "add",
      });
    } else if (rule.field === "model") {
      await api.updateTrackOrganization(trackIds, {
        generationModel: { value: value || null },
      });
    } else if (rule.field === "language") {
      await api.updateTrackOrganization(trackIds, {
        language: { value: value || null },
      });
    } else if (rule.field === "next_action") {
      await api.updateTrackOrganization(trackIds, {
        nextAction: { value: value || null },
      });
    } else if (rule.field === "project") {
      const project = organizationOptions.projects.find(
        (item) =>
          String(item.id) === value ||
          item.name.toLocaleLowerCase() === value.toLocaleLowerCase(),
      );
      await api.updateTrackOrganization(trackIds, {
        projectId: { value: project?.id ?? null },
      });
    } else if (rule.field === "action") {
      if (value === "open_in_explorer") handleOpenSelectedInExplorer();
      else if (value === "open_in_session" && onOpenSession) {
        const [firstId] = selectedActionTrackIdsInTableOrder;
        if (firstId) onOpenSession(firstId, selectedActionTrackIdsInTableOrder);
      } else if (value === "clear_selection") handleClearSelectionShortcut();
      else if (value === "play_pause") await togglePlayback();
      else if (value === "next") await playNext();
      else if (value === "previous") await playPrevious();
      else if (value === "reset_zoom") changeLibraryInspectorZoom("reset");
      else return false;
      return true;
    } else {
      return false;
    }
    await loadLibrary();
    if (selectedTrack && trackIds.includes(selectedTrack.id)) {
      await refreshSelectedTrack(selectedTrack.id);
    }
    setNotice(t("library.curationFieldSaved"));
    return true;
  }, [
    changeLibraryInspectorZoom,
    handleClearSelectionShortcut,
    handleOpenSelectedInExplorer,
    handleRatingChange,
    loadLibrary,
    onOpenSession,
    organizationOptions.projects,
    playNext,
    playPrevious,
    refreshSelectedTrack,
    selectedActionTrackIdsInTableOrder,
    selectedOrCheckedTrackIds,
    selectedTrack,
    settings.customKeyboardShortcuts,
    t,
    togglePlayback,
  ]);

  const selectTrackByOffset = useCallback(
    (offset: -1 | 1) => {
      if (tracks.length === 0) return;
      const currentIndex = selectedTrack
        ? tracks.findIndex((track) => track.id === selectedTrack.id)
        : -1;
      const targetIndex =
        currentIndex < 0
          ? offset > 0
            ? 0
            : tracks.length - 1
          : Math.min(tracks.length - 1, Math.max(0, currentIndex + offset));
      const target = tracks[targetIndex];
      if (target) void handleSelect(target);
    },
    [handleSelect, selectedTrack, tracks],
  );

  useEffect(() => {
    if (!settings.keyboardShortcutsEnabled) return;
    async function onKeyDown(event: KeyboardEvent) {
      if (shouldIgnoreKeyboardShortcut(event)) return;
      const zoomAction = panelZoomActionFromKey(event.key, event.ctrlKey || event.metaKey);
      if (zoomAction) {
        event.preventDefault();
        changeLibraryInspectorZoom(zoomAction);
        return;
      }

      if (event.ctrlKey && event.key.toLowerCase() === "a") {
        event.preventDefault();
        handleSelectAllVisibleShortcut();
        return;
      }
      if (event.key === " ") {
        event.preventDefault();
        void togglePlayback();
        return;
      }
      if (event.key === "Enter") {
        const summary = selectedTrack
          ? tracks.find((track) => track.id === selectedTrack.id)
          : null;
        if (summary) {
          event.preventDefault();
          void handlePlay(summary);
        }
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        selectTrackByOffset(1);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        selectTrackByOffset(-1);
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
      if (event.key === "Escape") {
        event.preventDefault();
        handleClearSelectionShortcut();
        return;
      }
      if (event.key === "Delete") {
        event.preventDefault();
        void handleRemoveSelected();
        return;
      }

      const customShortcut = findShortcutForEvent(
        settings.customKeyboardShortcuts ?? [],
        "library",
        event,
      );
      if (customShortcut && await applyCustomShortcut(event)) {
        event.preventDefault();
        return;
      }

      const ratingShortcut = shortcutRatingFromKey(event.key);
      if (ratingShortcut !== null && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        void applyShortcutRating(ratingShortcut);
        return;
      }

      const statusShortcut = shortcutStatusFromKey(event.key);
      if (statusShortcut) {
        event.preventDefault();
        void applyShortcutStatus(statusShortcut);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    applyShortcutRating,
    applyShortcutStatus,
    changeLibraryInspectorZoom,
    handleClearSelectionShortcut,
    handlePlay,
    handleRemoveSelected,
    handleSelectAllVisibleShortcut,
    playNext,
    playPrevious,
    selectTrackByOffset,
    selectedIds.size,
    selectedTrack,
    settings.keyboardShortcutsEnabled,
    togglePlayback,
    tracks,
  ]);

  const selectionRequiredTitle = hasActionSelection
    ? undefined
    : t("library.selectSongsFirst");
  const emptyLibraryConfirmWord = t("library.emptyLibraryConfirmWord");
  const emptyLibraryCanConfirm =
    emptyLibraryConfirmationText === emptyLibraryConfirmWord;

  return (
    <>
      <div
        className={`library-shell h-full min-h-0 ${
          showInspector ? "" : "library-shell--wide"
        }`}
      >
        <section className="flex min-h-0 min-w-0 flex-col">
        <header className="section-header border-b border-white/8 px-5 py-3">
          <div
            className="flex flex-wrap items-start justify-between gap-3"
            data-testid="library-header-primary"
          >
            <div className="min-w-44">
              <div className="flex flex-wrap items-baseline gap-2">
                <h2 className="text-lg font-semibold">{t("library.title")}</h2>
                <p className="text-xs text-white/40">
                  {total} {total === 1 ? t("library.song") : t("library.songs")}
                  {folderPath ? ` ${t("explorer.inThisFolder")}` : ""}
                  {total > tracks.length
                    ? `, ${t("library.showing")} ${tracks.length} ${t("common.of")} ${total}`
                    : ""}
                </p>
              </div>
              {total > tracks.length && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/40">
                  <span>{t("library.visibleLimitNotice")}</span>
                  {nextVisibleLimit && (
                    <button
                      type="button"
                      onClick={increaseVisibleLimit}
                      className="text-[#d9ff43]/75 hover:text-[#d9ff43]"
                    >
                      {t("library.increaseVisibleLimit").replace(
                        "{count}",
                        String(nextVisibleLimit),
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => void handleRemoveSelected()}
                disabled={!hasActionSelection || removing}
                title={selectionRequiredTitle}
                className="flex items-center gap-2 rounded-md border border-red-400/25 px-3 py-2 text-sm font-medium text-red-200/80 hover:bg-red-400/8 disabled:cursor-not-allowed disabled:opacity-35"
              >
                <Trash2 size={16} />
                {selectedIds.size > 1
                  ? `${t("common.remove")} ${selectedIds.size}`
                  : t("library.removeSong")}
              </button>
              <button
                type="button"
                onClick={() => void handleClearLibrary()}
                disabled={removing}
                className="flex items-center gap-2 rounded-md border border-red-400/20 px-3 py-2 text-sm text-red-200/60 hover:bg-red-400/8 disabled:opacity-30"
              >
                <Trash2 size={16} />
                {t("library.emptyLibrary")}
              </button>
              <button
                type="button"
                onClick={handleOpenSelectedInExplorer}
                disabled={!canOpenExplorerTrack || !onOpenExplorerTrack}
                title={canOpenExplorerTrack ? undefined : selectionRequiredTitle}
                className="toolbar-button disabled:cursor-not-allowed disabled:opacity-35"
              >
                {t("library.openSongInExplorer")}
              </button>
              <button
                type="button"
                onClick={() => void handleScan()}
                disabled={scanning || removing}
                className="flex items-center gap-2 rounded-md bg-[#d9ff43] px-4 py-2 text-sm font-semibold text-[#101113] transition hover:bg-[#e4ff72] disabled:opacity-50"
              >
                <FolderSearch size={17} />
                {scanning ? t("library.scanning") : t("library.scanFolder")}
              </button>
            </div>
          </div>

          <div
            className="mt-2 flex flex-wrap items-center justify-end gap-2"
            data-testid="library-header-secondary"
          >
            <button
              type="button"
              onClick={() =>
                updateLayout({
                  inspectorVisible: !settings.layout.inspectorVisible,
                  focusMode: false,
                })
              }
              className="toolbar-button"
            >
              {showInspector ? t("library.hideInspector") : t("library.showInspector")}
            </button>
            <button
              type="button"
              onClick={() =>
                updateLayout({
                  focusMode: !settings.layout.focusMode,
                  sidebarMode: settings.layout.focusMode
                    ? settings.layout.sidebarMode
                    : "expanded",
                })
              }
              className="toolbar-button"
            >
              {settings.layout.focusMode ? t("library.exitFocus") : t("library.focusMode")}
            </button>
            {onOpenSession && (
              <button
                type="button"
                onClick={() => {
                  const orderedIds = selectedActionTrackIdsInTableOrder;
                  if (orderedIds[0]) {
                    onOpenSession(
                      orderedIds[0],
                      orderedIds,
                      t("session.librarySelectionQueue").replace(
                        "{count}",
                        String(orderedIds.length),
                      ),
                    );
                  }
                }}
                disabled={!hasActionSelection}
                title={selectionRequiredTitle}
                className="toolbar-button disabled:cursor-not-allowed disabled:opacity-35"
              >
                <Radio size={16} />
                {t("library.openSessionMode")}
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                setPlaylistSession({
                  trackIds:
                    selectedIds.size > 0
                      ? [...selectedIds]
                      : selectedTrack
                        ? [selectedTrack.id]
                        : [],
                  title: t("library.addToPlaylist"),
                  createOnly: false,
                })
              }
              disabled={!hasActionSelection}
              title={selectionRequiredTitle}
              className="toolbar-button disabled:cursor-not-allowed disabled:opacity-35"
            >
              <ListPlus size={16} />
              {t("library.addToPlaylist")}
            </button>
            <button
              type="button"
              onClick={() =>
                setPlaylistSession({
                  trackIds: filterTrackIdsForPlaylist(),
                  title: t("organization.createListFromFilter"),
                  createOnly: true,
                })
              }
              disabled={tracks.length === 0}
              className="toolbar-button disabled:cursor-not-allowed disabled:opacity-35"
            >
              <ListPlus size={16} />
              {t("library.listFromFilter")}
            </button>
            {selectedIds.size > 0 && (
              <button
                type="button"
                onClick={openBulkEditor}
                className="flex items-center gap-2 rounded-md border border-[#d9ff43]/25 px-3 py-2 text-sm font-medium text-[#d9ff43]/80 hover:bg-[#d9ff43]/5"
              >
                <Pencil size={16} />
                {t("common.edit")} {selectedIds.size}
              </button>
            )}
            <button
              type="button"
              onClick={handleEditInternalOrganization}
              disabled={!hasActionSelection}
              title={selectionRequiredTitle}
              className="toolbar-button disabled:cursor-not-allowed disabled:opacity-35"
            >
              <Pencil size={16} />
              {selectedIds.size > 1
                ? t("library.editInternalOrganizationBulk").replace(
                    "{count}",
                    String(selectedIds.size),
                  )
                : t("library.editInternalOrganization")}
            </button>
            {selectedIds.size >= 2 && (
              <button
                type="button"
                onClick={handleOpenAutoNumberVersions}
                className="toolbar-button"
              >
                {t("library.autoNumberVersions")}
              </button>
            )}
            <button
              type="button"
              onClick={() => void Promise.all([loadLibrary(), loadFolders()])}
              disabled={loading || scanning || removing}
              className="rounded-md border border-white/10 p-2 text-white/60 transition hover:bg-white/5 disabled:opacity-40"
              aria-label={t("library.refresh")}
              title={t("library.refresh")}
            >
              <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
            </button>
          </div>

          <div
            className="mt-2 flex items-center gap-3"
            data-testid="library-header-search"
          >
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-white/10 bg-white/4 px-3 py-2">
              <Search size={16} className="shrink-0 text-white/35" />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={t("library.searchPlaceholder")}
                aria-label={t("library.searchAllFields")}
                className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/25"
              />
            </label>

            <label className="flex items-center gap-2 text-xs text-white/45">
              {t("library.folder")}
              <select
                value={folderPath}
                onChange={(event) => setFolderPath(event.target.value)}
                aria-label={t("library.folder")}
                className="max-w-72 rounded-md border border-white/10 bg-[#1c1d20] px-2.5 py-2 text-sm text-white"
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

            <label className="flex items-center gap-2 text-xs text-white/45">
              {t("library.minimumRating")}
              <select
                value={ratingMin ?? ""}
                onChange={(event) =>
                  setRatingMin(event.target.value ? Number(event.target.value) : null)
                }
                className="rounded-md border border-white/10 bg-[#1c1d20] px-2.5 py-2 text-sm text-white"
              >
                <option value="">{t("common.all")}</option>
                {Array.from({ length: 10 }, (_, index) => index + 1).map((rating) => (
                  <option key={rating} value={rating}>
                    {rating}+
                  </option>
                ))}
              </select>
            </label>
          </div>

          {scanSummary && (
            <p className="mt-3 text-xs text-white/45">
              {t("library.scanFinished")}: {scanSummary.discovered} {t("library.detected")},{" "}
              {scanSummary.inserted} {t("library.newItems")}, {scanSummary.updated} {t("library.updated")},{" "}
              {scanSummary.failed} {t("library.failed")}
            </p>
          )}
          {notice && (
            <p className="mt-3 rounded-md border border-[#d9ff43]/15 bg-[#d9ff43]/5 px-3 py-2 text-xs text-[#d9ff43]/75">
              {notice}
            </p>
          )}
          {error && (
            <p className="mt-3 rounded-md border border-red-400/20 bg-red-400/8 px-3 py-2 text-xs text-red-200">
              {error}
            </p>
          )}
        </header>

        <div className="min-h-0 flex-1">
          <TrackTable
            tracks={tracks}
            selectedId={selectedTrack?.id ?? null}
            selectedIds={selectedIds}
            sortBy={sortBy}
            sortDirection={sortDirection}
            loading={loading}
            onSort={handleSort}
            onSelect={handleSelect}
            onPlay={handlePlay}
            onExternalDrag={handleExternalDrag}
            onRatingChange={handleRatingChange}
            onSelectionChange={handleSelectionChange}
            onSelectAll={handleSelectAll}
            visibleColumns={libraryTableColumns}
            columnOrder={settings.library.columnOrder}
            doubleClickPlays={settings.player.doubleClickPlay}
          />
        </div>
      </section>

      {showInspector && (
        <TrackInspector
          track={selectedTrack}
          metadata={selectedMetadata}
          metadataLoading={metadataLoading}
          metadataError={metadataError}
          onRatingChange={handleRatingChange}
          onEdit={handleEditSelected}
          editSelectionCount={selectedIds.size}
          onMetadataInlineSave={handleInlineMetadataSave}
          onOrganizationInlineSave={handleInlineOrganizationSave}
          onCurationInlineSave={handleInlineCurationSave}
          onProjectNameInlineSave={handleInlineProjectNameSave}
          visibleFields={libraryInspectorFields}
          zoom={settings.layout.libraryInspectorZoom}
          onZoomChange={changeLibraryInspectorZoom}
        />
      )}
      </div>

      {editorSession?.kind === "metadata" && (
        <MetadataEditor
          mode={editorSession.mode}
          selectedCount={editorSession.trackIds.length}
          track={editorSession.mode === "single" ? selectedTrack : null}
          metadata={editorSession.mode === "single" ? selectedMetadata : null}
          onClose={handleCloseEditor}
          onSave={handleMetadataSave}
        />
      )}
      {editorSession?.kind === "organization" && (
        <InternalOrganizationEditor
          mode={editorSession.mode}
          selectedCount={editorSession.trackIds.length}
          track={editorSession.mode === "single" ? selectedTrack : null}
          options={organizationOptions}
          onClose={handleCloseEditor}
          onCreateProject={handleCreateProjectFromEditor}
          onSave={handleInternalOrganizationSave}
        />
      )}
      {playlistSession && (
        <AddToPlaylistDialog
          trackIds={playlistSession.trackIds}
          title={playlistSession.title}
          createOnly={playlistSession.createOnly}
          onClose={() => setPlaylistSession(null)}
          onComplete={setNotice}
        />
      )}
      {autoNumberVersionTracks && (
        <AutoNumberVersionsDialog
          tracks={autoNumberVersionTracks}
          onCancel={() => setAutoNumberVersionTracks(null)}
          onApply={handleApplyAutoNumberVersions}
        />
      )}
      {removeConfirmation && (
        <RemoveFromLibraryDialog
          count={removeConfirmation.trackIds.length}
          removing={removing}
          onCancel={() => setRemoveConfirmation(null)}
          onConfirm={confirmRemoveSelected}
          t={t}
        />
      )}
      {emptyLibraryConfirmationOpen && (
        <EmptyLibraryDialog
          confirmationText={emptyLibraryConfirmationText}
          confirmWord={emptyLibraryConfirmWord}
          canConfirm={emptyLibraryCanConfirm}
          removing={removing}
          onChange={setEmptyLibraryConfirmationText}
          onCancel={() => {
            setEmptyLibraryConfirmationOpen(false);
            setEmptyLibraryConfirmationText("");
          }}
          onConfirm={confirmClearLibrary}
          t={t}
        />
      )}
    </>
  );
}

function RemoveFromLibraryDialog({
  count,
  removing,
  onCancel,
  onConfirm,
  t,
}: {
  count: number;
  removing: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  t: (key: string) => string;
}) {
  const title =
    count === 1
      ? t("library.removeOneConfirmTitle")
      : t("library.removeManyConfirmTitle").replace("{count}", String(count));
  const body =
    count === 1
      ? t("library.removeOneConfirmBody")
      : t("library.removeManyConfirmBody");
  const action =
    count === 1
      ? t("library.removeFromLibrary")
      : t("library.removeManyAction").replace("{count}", String(count));

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-5">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-library-title"
        className="card-surface w-full max-w-md rounded-xl border border-red-400/25 p-5 shadow-2xl"
      >
        <h3 id="remove-library-title" className="text-lg font-semibold text-white">
          {title}
        </h3>
        <p className="mt-4 whitespace-pre-line text-sm leading-6 text-white/70">
          {body}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="toolbar-button">
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={removing}
            className="rounded-md bg-red-400 px-4 py-2 text-sm font-semibold text-[#190b0b] transition hover:bg-red-300 disabled:opacity-45"
          >
            {action}
          </button>
        </div>
      </section>
    </div>
  );
}

function EmptyLibraryDialog({
  confirmationText,
  confirmWord,
  canConfirm,
  removing,
  onChange,
  onCancel,
  onConfirm,
  t,
}: {
  confirmationText: string;
  confirmWord: string;
  canConfirm: boolean;
  removing: boolean;
  onChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  t: (key: string) => string;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-5">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="empty-library-title"
        className="card-surface w-full max-w-lg rounded-xl border border-red-400/30 p-5 shadow-2xl"
      >
        <h3 id="empty-library-title" className="text-lg font-semibold text-white">
          {t("library.emptyLibraryConfirmTitle")}
        </h3>
        <p className="mt-4 whitespace-pre-line text-sm leading-6 text-white/72">
          {t("library.emptyLibraryConfirmBody")}
        </p>
        <label className="mt-5 block text-sm font-medium text-white/80">
          {t("library.emptyLibraryTypeToConfirm").replace("{word}", confirmWord)}
          <input
            value={confirmationText}
            onChange={(event) => onChange(event.target.value)}
            className="mt-2 w-full rounded-md border border-red-400/25 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-red-300/60"
            autoFocus
          />
        </label>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="toolbar-button">
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm || removing}
            className="rounded-md bg-red-400 px-4 py-2 text-sm font-semibold text-[#190b0b] transition hover:bg-red-300 disabled:cursor-not-allowed disabled:opacity-35"
          >
            {t("library.emptyLibrary")}
          </button>
        </div>
      </section>
    </div>
  );
}
