import {
  Archive,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Compass,
  Disc3,
  ListPlus,
  Pause,
  Play,
  Plus,
  Radio,
  Save,
  SkipForward,
  Square,
  Volume2,
} from "lucide-react";
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PanelZoomControls } from "../../components/PanelZoomControls";
import { displayTitleWithVersion } from "../../lib/displayTitle";
import type { MainSection } from "../../components/AppLayout";
import { formatDuration } from "../../lib/format";
import {
  shortcutRatingFromKey,
  shortcutStatusFromKey,
  shouldIgnoreKeyboardShortcut,
} from "../../lib/keyboardShortcuts";
import {
  panelZoomActionFromKey,
  updatePanelZoomSetting,
  type PanelZoomAction,
} from "../../lib/panelZoom";
import { hasLibraryFolder } from "../../lib/libraryFolders";
import { api } from "../../lib/tauri";
import type {
  CurationSaveRequest,
  ExplorerCriterion,
  LibraryFolderOption,
  MetadataPatch,
  OrganizationOptions,
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
  WORKFLOW_PRESET_IDS,
  WORKFLOW_PRESETS,
  workflowPresetById,
  type WorkflowAction,
  type WorkflowPreset,
type WorkflowPresetId,
  type WorkflowQuickAction,
} from "../workflows/workflowPresets";
import { useI18n } from "../../i18n";
import { SYSTEM_OPTIONS, type SystemOption } from "../../i18n/systemLabels";

type CompactOption = {
  value: string;
  label: string;
};

const CRITERIA: ExplorerCriterion[] = [
  "unreviewed",
  "unrated",
  "no_project",
  "untagged",
  "needs_action",
  "daw_rescue",
  "radio_ready",
  "release_ready",
  "archived",
  "random",
  "all",
];

const STRONG_PARTS = SYSTEM_OPTIONS.strongPart;
const MAIN_PROBLEMS = SYSTEM_OPTIONS.mainProblem;
const INTENDED_USES = SYSTEM_OPTIONS.intendedUse;
const MOODS = SYSTEM_OPTIONS.mood;
const GENERATION_MODELS = [
  "Suno v4.5",
  "Suno v4",
  "Udio",
  "Remaster",
  "Modelo propio",
  "Otro",
];
const GENRES = [
  "Pop",
  "Rock",
  "Funk",
  "Soul",
  "R&B",
  "Hip Hop",
  "House",
  "Deep House",
  "Afro House",
  "Techno",
  "Trance",
  "Psytrance",
  "Ambient",
  "Cinematic",
  "Reggae",
  "Reggae Rock",
  "Latin",
  "Flamenco",
  "Jazz",
  "Blues",
  "Folk",
  "Experimental",
  "Electronic",
  "World",
  "Orchestral",
];
const QUICK_STATUSES: SongStatus[] = [
  "idea",
  "editing",
  "generating",
  "selected",
  "final",
  "archived",
];
const LEFT_CARD_WORKFLOW_FIELDS: FieldVisibilityField[] = [
  "rating",
  "status",
  "generationModel",
  "project",
];
const ALL_WORKFLOW_CARD_FIELDS: FieldVisibilityField[] = [
  "title",
  "artist",
  "album",
  "albumArtist",
  "genre",
  "year",
  "trackNumber",
  "discNumber",
  "comment",
  "lyrics",
  "bpm",
  "musicalKey",
  "coverArt",
  "duration",
  "format",
  "rating",
  "status",
  "generationModel",
  "project",
  "version",
  "tags",
  "strongPart",
  "mainProblem",
  "intendedUse",
  "mood",
  "nextAction",
  "notes",
  "skipCount",
  "lastReviewedAt",
  "playCount",
];
const EMPTY_OPTIONS: OrganizationOptions = {
  tags: [],
  projects: [],
  versions: [],
  models: [],
  smartCollections: [],
};

type ExplorerMetadataField =
  | "title"
  | "artist"
  | "album"
  | "albumArtist"
  | "genre"
  | "year"
  | "trackNumber"
  | "discNumber"
  | "comment"
  | "lyrics"
  | "bpm"
  | "musicalKey";

type ExplorerMetadataValues = Record<ExplorerMetadataField, string>;

type ExplorerSelectionReason =
  | "explorer_init"
  | "explorer_focus_track"
  | "explorer_criterion_changed"
  | "explorer_folder_changed"
  | "explorer_save"
  | "explorer_save_and_next"
  | "explorer_skip"
  | "explorer_next_button"
  | "explorer_previous_button";

export function ExplorerView({
  onNavigate,
  onOpenSession,
  initialCriterion,
  launchToken,
  focusTrackId,
}: {
  onNavigate: (section: MainSection) => void;
  onOpenSession?: (trackId: number, queueIds?: number[]) => void;
  initialCriterion?: ExplorerCriterion;
  launchToken?: number;
  focusTrackId?: number;
}) {
  const { settings, updateSettings } = useSettings();
  const { t } = useI18n();
  const [criterion, setCriterion] = useState<ExplorerCriterion>(
    initialCriterion ?? settings.explorer.defaultCriterion,
  );
  const [workflowPresetId, setWorkflowPresetId] = useState<WorkflowPresetId>(() => {
    const stored = window.localStorage.getItem(WORKFLOW_PRESET_STORAGE_KEY);
    return WORKFLOW_PRESET_IDS.includes(stored as WorkflowPresetId)
      ? (stored as WorkflowPresetId)
      : "idea_capture";
  });
  const workflowPreset = useMemo(
    () => workflowPresetById(workflowPresetId),
    [workflowPresetId],
  );
  const [workflowSmartCollection, setWorkflowSmartCollection] = useState<string | null>(
    workflowPreset.defaultQueue.smartCollection ?? null,
  );
  const [queue, setQueue] = useState<TrackSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [track, setTrack] = useState<TrackDetails | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [options, setOptions] = useState<OrganizationOptions>(EMPTY_OPTIONS);
  const [folders, setFolders] = useState<LibraryFolderOption[]>([]);
  const [foldersLoaded, setFoldersLoaded] = useState(false);
  const [folderPath, setFolderPath] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const { playTrack, setLibraryTracks, setSelectedTrack, stop } = usePlayer();
  const explorerCardFields = visibleFieldsForZone(settings.fieldVisibility, "explorerCard");
  const explorerEditorFields = visibleFieldsForZone(settings.fieldVisibility, "explorerEditor");
  const explorerControls = useRef({
    next: async () => {},
    previous: async () => {},
  });
  const previousLoadParams = useRef<{
    initialized: boolean;
    criterion: ExplorerCriterion;
    folderPath: string;
    workflowSmartCollection: string | null;
  }>({
    initialized: false,
    criterion,
    folderPath,
    workflowSmartCollection,
  });
  const lastSelection = useRef<{
    trackId: number;
    selectedAt: number;
    reason: ExplorerSelectionReason;
  } | null>(null);

  useEffect(() => {
    if (initialCriterion) setCriterion(initialCriterion);
  }, [initialCriterion, launchToken]);

  const commitTrackSelection = useCallback(
    (
      details: TrackDetails,
      reason: ExplorerSelectionReason,
      userAction: boolean,
    ) => {
      const now = Date.now();
      const previous = lastSelection.current;
      if (
        !userAction &&
        previous &&
        previous.trackId !== details.id &&
        now - previous.selectedAt < 1_000
      ) {
        console.error(
          `[EXPLORER] BLOCKED rapid auto navigation previous=${previous.trackId} next=${details.id} reason=${reason}`,
        );
        return false;
      }
      lastSelection.current = { trackId: details.id, selectedAt: now, reason };
      setTrack(details);
      setSelectedTrack(details);
      console.info(
        `[EXPLORER] selected song id=${details.id} reason=${reason} userAction=${userAction}`,
      );
      return true;
    },
    [setSelectedTrack],
  );

  const loadTrack = useCallback(
    async (
      summary: TrackSummary,
      reason: ExplorerSelectionReason,
      userAction: boolean,
    ) => {
      const details = await api.getTrack(summary.id);
      return commitTrackSelection(details, reason, userAction) ? details : null;
    },
    [commitTrackSelection],
  );

  const loadQueue = useCallback(
    async (reason: ExplorerSelectionReason, userAction: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const [page, organizationOptions] = await Promise.all([
          api.getExplorerTracks({
            criterion,
            limit: 1_000,
            folderPath: folderPath || null,
            smartCollection: workflowSmartCollection,
          }),
          api.getOrganizationOptions(),
        ]);
        const available =
          settings.explorer.hideArchived && criterion !== "archived"
            ? page.items.filter((item) => item.status !== "archived")
            : page.items;
        const shuffled = settings.explorer.randomQueue
          ? shuffleTracks(available)
          : available;
        setTotal(page.total);
        setOptions(organizationOptions);
        const focusedIndex =
          focusTrackId === undefined
            ? -1
            : shuffled.findIndex((item) => item.id === focusTrackId);
        if (focusTrackId !== undefined) {
          const details = await api.getTrack(focusTrackId);
          const focusedSummary =
            focusedIndex > -1 ? shuffled[focusedIndex] : trackToSummary(details);
          const remaining = shuffled.filter((item) => item.id !== focusTrackId);
          setLibraryTracks([focusedSummary, ...remaining], "explorer", {
            next: () => explorerControls.current.next(),
            previous: () => explorerControls.current.previous(),
          });
          setQueue(remaining);
          console.info(
            `[EXPLORER] focused song loaded id=${focusTrackId} queue=${remaining.length} reason=${reason}`,
          );
          commitTrackSelection(details, "explorer_focus_track", true);
          return details;
        }
        setLibraryTracks(shuffled, "explorer", {
          next: () => explorerControls.current.next(),
          previous: () => explorerControls.current.previous(),
        });
        const ordered = shuffled;
        const [next, ...remaining] = ordered;
        console.info(
          `[EXPLORER] queue initialized criterion=${criterion} count=${ordered.length} first=${next?.id ?? "none"} reason=${reason}`,
        );
        setQueue(remaining);
        if (next) {
          return await loadTrack(next, reason, userAction);
        } else {
          setTrack(null);
          setSelectedTrack(null);
          return null;
        }
      } catch (loadError) {
        setError(String(loadError));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [
      criterion,
      folderPath,
      focusTrackId,
      commitTrackSelection,
      loadTrack,
      setLibraryTracks,
      setSelectedTrack,
      settings.explorer.hideArchived,
      settings.explorer.randomQueue,
      workflowSmartCollection,
    ],
  );

  useEffect(() => {
    const previous = previousLoadParams.current;
    const reason: ExplorerSelectionReason = !previous.initialized
      ? "explorer_init"
      : previous.folderPath !== folderPath
        ? "explorer_folder_changed"
        : previous.criterion !== criterion ||
            previous.workflowSmartCollection !== workflowSmartCollection
          ? "explorer_criterion_changed"
          : "explorer_init";
    const userAction = previous.initialized && reason !== "explorer_init";
    previousLoadParams.current = {
      initialized: true,
      criterion,
      folderPath,
      workflowSmartCollection,
    };
    setHistory([]);
    void loadQueue(reason, userAction);
  }, [criterion, folderPath, loadQueue, workflowSmartCollection]);

  useEffect(() => {
    void api
      .getLibraryFolders()
      .then((availableFolders) => {
        setFolders(availableFolders);
        setFoldersLoaded(true);
      })
      .catch((folderError) => setError(String(folderError)));
  }, []);

  useEffect(() => {
    if (folderPath && foldersLoaded && !hasLibraryFolder(folders, folderPath)) {
      setFolderPath("");
    }
  }, [folderPath, folders, foldersLoaded]);

  async function playExplicitExplorerTrack(details: TrackDetails, reason: PlayReason) {
    try {
      await playTrack(details, reason, "explorer");
    } catch (playError) {
      setError(`${t("explorer.playFailed")} ${String(playError)}`);
    }
  }

  async function advance(autoplay: boolean, reason: "explorer_next_button" | "explorer_save_and_next" | "explorer_skip") {
    if (track) {
      setHistory((current) => [...current, track.id].slice(-1_000));
    }
    const [next, ...remaining] = queue;
    setQueue(remaining);
    if (next) {
      const details = await loadTrack(next, reason, true);
      if (details && autoplay) await playExplicitExplorerTrack(details, reason);
      return details;
    } else {
      setTrack(null);
      setSelectedTrack(null);
      await stop();
      return null;
    }
  }

  async function goNext() {
    await advance(true, "explorer_next_button");
  }

  async function goPrevious() {
    const previousId = history.at(-1);
    if (!previousId) return;
    try {
      const details = await api.getTrack(previousId);
      setHistory((current) => current.slice(0, -1));
      if (track) {
        setQueue((current) => [trackToSummary(track), ...current]);
      }
      if (commitTrackSelection(details, "explorer_previous_button", true)) {
        await playExplicitExplorerTrack(details, "explorer_previous_button");
      }
    } catch (previousError) {
      setError(String(previousError));
    }
  }

  explorerControls.current = {
    next: goNext,
    previous: goPrevious,
  };

  async function saveCurationAndMaybeAdvance(
    request: CurationSaveRequest,
    metadataPatch: MetadataPatch,
    advanceAfterSave: boolean,
  ) {
    if (metadataPatch.genre) {
      if (
        settings.metadata.confirmExplorerGenreWrite &&
        !window.confirm(
          t("explorer.genreWriteConfirm"),
        )
      ) {
        throw new Error(t("explorer.genreWriteCancelled"));
      }
    }

    if (hasMetadataPatch(metadataPatch)) {
      const result = await api.updateTrackMetadata([request.trackId], {
        ...metadataPatch,
      });
      if (result.failed > 0) {
        throw new Error(
          result.items.find((item) => !item.success)?.error ??
            t("explorer.metadataWriteFailed"),
        );
      }
    }
    const updated = await api.saveCuration({
      ...request,
      markReviewed: settings.explorer.saveMarksReviewed,
    });
    setNotice(`${t("explorer.saved")}: ${updated.title || updated.fileName}`);
    if (advanceAfterSave) {
      await advance(true, "explorer_save_and_next");
    } else {
      commitTrackSelection(updated, "explorer_save", true);
    }
  }

  async function skipAndNext() {
    if (!track) return;
    try {
      await api.skipCurationTrack(track.id);
      setNotice(t("explorer.skippedNotice"));
      await advance(true, "explorer_skip");
    } catch (skipError) {
      setError(String(skipError));
    }
  }

  function changeWorkflowPreset(nextPresetId: WorkflowPresetId) {
    setWorkflowPresetId(nextPresetId);
    window.localStorage.setItem(WORKFLOW_PRESET_STORAGE_KEY, nextPresetId);
  }

  function loadSuggestedWorkflowQueue(preset: WorkflowPreset) {
    setCriterion(preset.defaultQueue.criterion);
    setWorkflowSmartCollection(preset.defaultQueue.smartCollection ?? null);
    setNotice(t("workflow.loadSuggestedQueueNotice"));
  }

  function changeExplorerPanelZoom(action: PanelZoomAction) {
    updateSettings((current) =>
      updatePanelZoomSetting(current, "explorerRightPanelZoom", action),
    );
  }

  return (
    <div className="app-surface flex h-full min-h-0 flex-col overflow-hidden">
      <header className="section-header flex flex-wrap items-center justify-between gap-4 border-b border-white/8 px-6 py-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Compass size={19} />
            {t("explorer.title")}
          </h2>
          <p className="mt-1 text-xs text-white/40">
            {t("explorer.curatorMode")} · {total}{" "}
            {total === 1 ? t("explorer.pendingSong") : t("explorer.pendingSongs")}
            {folderPath ? ` ${t("explorer.inThisFolder")}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-white/40">
            {t("library.folder")}
            <select
              value={folderPath}
              onChange={(event) => setFolderPath(event.target.value)}
              className="ml-2 max-w-72 rounded-md border border-white/10 bg-[#202226] px-3 py-2 text-sm text-white/75"
            >
              <option value="">{t("explorer.wholeLibrary")}</option>
              {folders.map((folder) => (
                <option key={folder.path} value={folder.path}>
                  {folder.isRoot ? `${t("common.root")} · ` : ""}
                  {folder.name} ({folder.trackCount})
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-white/40">
            {t("explorer.criterion")}
            <select
              value={criterion}
              onChange={(event) => {
                setCriterion(event.target.value as ExplorerCriterion);
                setWorkflowSmartCollection(null);
              }}
              className="ml-2 rounded-md border border-white/10 bg-[#202226] px-3 py-2 text-sm text-white/75"
            >
              {CRITERIA.map((item) => (
                <option key={item} value={item}>
                  {criterionLabel(item, t)}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => onNavigate("library")} className="toolbar-button">
            {t("nav.library")}
          </button>
          {track && (
            <>
              {onOpenSession && (
                <button
                  type="button"
                  onClick={() =>
                    onOpenSession(track.id, [
                      track.id,
                      ...queue.map((item) => item.id),
                    ])
                  }
                  className="toolbar-button"
                >
                  <Radio size={15} /> {t("library.openSessionMode")}
                </button>
              )}
              <button type="button" onClick={() => setPlaylistOpen(true)} className="toolbar-button">
                <ListPlus size={15} /> {t("library.addToPlaylist")}
              </button>
            </>
          )}
          <button type="button" onClick={() => onNavigate("organization")} className="toolbar-button">
            {t("nav.organization")}
          </button>
        </div>
      </header>

      {notice && <p className="border-b border-[#d9ff43]/10 bg-[#d9ff43]/5 px-6 py-2 text-xs text-[#d9ff43]/70">{notice}</p>}
      {error && <p className="border-b border-red-400/15 bg-red-400/7 px-6 py-2 text-xs text-red-200">{error}</p>}

      <main className="min-h-0 flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="grid h-full place-items-center text-sm text-white/35">{t("explorer.loadingSongs")}</div>
        ) : track ? (
          <ExplorerWorkspace
            key={track.id}
            track={track}
            options={options}
            canGoPrevious={history.length > 0}
            cardFields={explorerCardFields}
            editorFields={explorerEditorFields}
            workflowPreset={workflowPreset}
            onWorkflowPresetChange={changeWorkflowPreset}
            onLoadSuggestedQueue={loadSuggestedWorkflowQueue}
            queueTotal={total}
            currentCriterion={criterion}
            currentSmartCollection={workflowSmartCollection}
            onPrevious={() => void goPrevious()}
            onNext={() => void goNext()}
            onSkip={() => void skipAndNext()}
            onSave={saveCurationAndMaybeAdvance}
            confirmArchive={settings.explorer.confirmArchive}
            simpleMode={settings.interfaceMode === "simple"}
            shortcutsEnabled={settings.keyboardShortcutsEnabled}
            rightPanelZoom={settings.layout.explorerRightPanelZoom}
            onRightPanelZoomChange={changeExplorerPanelZoom}
          />
        ) : (
          <div className="grid h-full place-items-center text-center">
            <div>
              <Disc3 size={48} className="mx-auto text-white/15" />
              <h3 className="mt-4 font-semibold text-white/65">{t("explorer.noPendingSongs")}</h3>
              <p className="mt-1 text-sm text-white/35">{t("explorer.changeCriterion")}</p>
            </div>
          </div>
        )}
      </main>
      {playlistOpen && track && (
        <AddToPlaylistDialog
          trackIds={[track.id]}
          onClose={() => setPlaylistOpen(false)}
          onComplete={setNotice}
        />
      )}
    </div>
  );
}

function ExplorerWorkspace({
  track,
  options,
  canGoPrevious,
  cardFields,
  editorFields,
  workflowPreset,
  onWorkflowPresetChange,
  onLoadSuggestedQueue,
  queueTotal,
  currentCriterion,
  currentSmartCollection,
  onPrevious,
  onNext,
  onSkip,
  onSave,
  confirmArchive,
  simpleMode,
  shortcutsEnabled,
  rightPanelZoom,
  onRightPanelZoomChange,
}: {
  track: TrackDetails;
  options: OrganizationOptions;
  canGoPrevious: boolean;
  cardFields: Set<FieldVisibilityField>;
  editorFields: Set<FieldVisibilityField>;
  workflowPreset: WorkflowPreset;
  onWorkflowPresetChange: (preset: WorkflowPresetId) => void;
  onLoadSuggestedQueue: (preset: WorkflowPreset) => void;
  queueTotal: number;
  currentCriterion: ExplorerCriterion;
  currentSmartCollection: string | null;
  onPrevious: () => void;
  onNext: () => void;
  onSkip: () => void;
  onSave: (
    request: CurationSaveRequest,
    metadataPatch: MetadataPatch,
    advanceAfterSave: boolean,
  ) => Promise<void>;
  confirmArchive: boolean;
  simpleMode: boolean;
  shortcutsEnabled: boolean;
  rightPanelZoom: number;
  onRightPanelZoomChange: (action: PanelZoomAction) => void;
}) {
  const { t, language } = useI18n();
  const player = usePlayer();
  const [rating, setRating] = useState(track.rating?.toString() ?? "");
  const [status, setStatus] = useState<SongStatus>(track.status);
  const [projectId, setProjectId] = useState(track.projectId?.toString() ?? "");
  const [projects, setProjects] = useState(options.projects);
  const [newProject, setNewProject] = useState("");
  const [version, setVersion] = useState(track.versionLabel ?? "");
  const [tags, setTags] = useState(track.tagNames);
  const [nextAction, setNextAction] = useState(track.nextAction ?? "");
  const [notes, setNotes] = useState(track.workflowNotes ?? "");
  const [strongPart, setStrongPart] = useState(track.strongPart ?? "");
  const [mainProblem, setMainProblem] = useState(track.mainProblem ?? "");
  const [intendedUse, setIntendedUse] = useState(track.intendedUse ?? "");
  const [mood, setMood] = useState(track.mood ?? "");
  const [generationModel, setGenerationModel] = useState(track.generationModel ?? "");
  const [fileMetadata, setFileMetadata] = useState<ExplorerMetadataValues>(() =>
    explorerMetadataValues(track),
  );
  const [savingAction, setSavingAction] = useState<"save" | "saveNext" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localNotice, setLocalNotice] = useState<string | null>(null);
  const [showAdvancedFields, setShowAdvancedFields] = useState(!simpleMode);
  const isCurrent = player.state.trackId === track.id;
  const isPlaying = isCurrent && player.state.status === "playing";
  const duration = player.state.durationMs ?? track.durationMs ?? 0;
  const advancedFields = new Set<FieldVisibilityField>([
    "strongPart",
    "mainProblem",
    "intendedUse",
    "version",
  ]);
  const simpleVisibleFields = new Set<FieldVisibilityField>([
    "rating",
    "status",
    "generationModel",
    "project",
    "tags",
    "mood",
    "genre",
    "notes",
    "nextAction",
  ]);
  const allowField = (field: FieldVisibilityField) =>
    !simpleMode ||
    showAdvancedFields ||
    simpleVisibleFields.has(field) ||
    !advancedFields.has(field);
  const showCard = (field: FieldVisibilityField) =>
    cardFields.has(field) && allowField(field);
  const showEditor = (field: FieldVisibilityField) =>
    editorFields.has(field) && allowField(field);
  const presetShowsField = (field: FieldVisibilityField) => {
    if (workflowPreset.primaryFields.includes(field)) return true;
    if (simpleMode && !showAdvancedFields) return false;
    return workflowPreset.secondaryFields.includes(field);
  };
  const showDecisionField = (field: FieldVisibilityField) =>
    showEditor(field) && presetShowsField(field);

  function changeStatus(nextStatus: SongStatus) {
    if (
      nextStatus === "archived" &&
      confirmArchive &&
      !window.confirm(t("explorer.archiveConfirm"))
    ) {
      return false;
    }
    setStatus(nextStatus);
    return true;
  }

  function hasQuickTag(tagName: string, source = tags) {
    const normalized = normalizeSelectionValue(tagName);
    return splitValues(source).some((tag) => normalizeSelectionValue(tag) === normalized);
  }

  function addQuickTag(tagName: string) {
    const current = splitValues(tags);
    if (hasQuickTag(tagName, tags)) return tags;
    const next = [...current, tagName].join(", ");
    setTags(next);
    return next;
  }

  function removeQuickTag(tagName: string) {
    const next = splitValues(tags).filter(
      (tag) => normalizeSelectionValue(tag) !== normalizeSelectionValue(tagName),
    );
    const nextTags = next.join(", ");
    setTags(nextTags);
    return nextTags;
  }

  function toggleQuickTag(tagName: string) {
    if (hasQuickTag(tagName)) {
      removeQuickTag(tagName);
      return "removed" as const;
    }
    addQuickTag(tagName);
    return "added" as const;
  }

  function workflowActionLabel(labelKey: string | undefined, action: WorkflowAction) {
    return labelKey ? safeT(t, labelKey, action.value) : action.value;
  }

  function isWorkflowActionActive(action: WorkflowAction) {
    if (action.kind === "tag" || action.kind === "removeTag") return hasQuickTag(action.value);
    if (action.kind === "status") return status === action.value;
    if (action.kind === "nextAction") return nextAction.trim() === action.value;
    return false;
  }

  function applyWorkflowAction(action: WorkflowAction, labelKey?: string) {
    setLocalNotice(null);
    const label = workflowActionLabel(labelKey, action);
    if (action.kind === "tag") {
      const result = toggleQuickTag(action.value);
      setLocalNotice(`${t(result === "added" ? "workflow.added" : "workflow.removed")}: ${label}`);
    } else if (action.kind === "removeTag") {
      removeQuickTag(action.value);
      setLocalNotice(`${t("workflow.removed")}: ${label}`);
    } else if (action.kind === "status") {
      if (changeStatus(action.value)) {
        setLocalNotice(`${t("workflow.statusChanged")}: ${t(`status.${action.value}`)}`);
      }
    } else if (action.kind === "nextAction") {
      setNextAction(action.value);
      setLocalNotice(`${t("workflow.actionApplied")}: ${label}`);
    }
  }

  const appliedTagActions = workflowPreset.quickActions.filter(
    (quickAction) => quickAction.action.kind === "tag" && hasQuickTag(quickAction.action.value),
  );

  const request = useMemo<CurationSaveRequest>(
    () => ({
      trackId: track.id,
      rating: rating ? Number(rating) : null,
      organization: {
        status: { value: status },
        projectId: { value: projectId ? Number(projectId) : null },
        versionLabel: { value: version.trim() || null },
        tagNames: splitValues(tags),
        nextAction: { value: nextAction.trim() || null },
        workflowNotes: { value: notes.trim() || null },
      },
      strongPart: strongPart.trim() || null,
      mainProblem: mainProblem.trim() || null,
      intendedUse: intendedUse.trim() || null,
      mood: mood.trim() || null,
      generationModel: generationModel.trim() || null,
    }),
    [
      generationModel,
      intendedUse,
      mainProblem,
      mood,
      nextAction,
      notes,
      projectId,
      rating,
      status,
      strongPart,
      tags,
      track.id,
      version,
    ],
  );
  const hasPendingMetadataChanges = hasExplorerMetadataChanges(fileMetadata, track);

  function setMetadataField(field: ExplorerMetadataField, value: string) {
    setFileMetadata((current) => ({ ...current, [field]: value }));
  }

  async function submit(advanceAfterSave: boolean) {
    setSavingAction(advanceAfterSave ? "saveNext" : "save");
    setError(null);
    try {
      const metadataPatch = buildExplorerMetadataPatch(fileMetadata, track, t);
      await onSave(request, metadataPatch, advanceAfterSave);
    } catch (saveError) {
      setError(String(saveError));
    } finally {
      setSavingAction(null);
    }
  }

  async function togglePlayback() {
    player.setSelectedTrack(track);
    if (!isCurrent) {
      await player.playTrack(track, "user_click", "explorer");
    } else {
      await player.togglePlayback();
    }
  }

  useEffect(() => {
    setShowAdvancedFields(!simpleMode);
  }, [simpleMode, track.id]);

  useEffect(() => {
    if (!shortcutsEnabled) return;
    function onKeyDown(event: KeyboardEvent) {
      if (shouldIgnoreKeyboardShortcut(event)) return;
      const zoomAction = panelZoomActionFromKey(event.key, event.ctrlKey || event.metaKey);
      if (zoomAction) {
        event.preventDefault();
        onRightPanelZoomChange(zoomAction);
        return;
      }
      if (event.ctrlKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void submit(false);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        void submit(true);
        return;
      }
      if (event.key === " ") {
        event.preventDefault();
        void togglePlayback();
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        onNext();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onPrevious();
        return;
      }
      const ratingShortcut = shortcutRatingFromKey(event.key);
      if (ratingShortcut !== null && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        setRating(String(ratingShortcut));
        setLocalNotice(t("explorer.ratingApplied").replace("{rating}", String(ratingShortcut)));
        return;
      }
      const shortcutStatus = shortcutStatusFromKey(event.key);
      if (shortcutStatus) {
        event.preventDefault();
        changeStatus(shortcutStatus);
        return;
      }
      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        onSkip();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const queueMatchesPreset =
    currentCriterion === workflowPreset.defaultQueue.criterion &&
    (currentSmartCollection ?? null) === (workflowPreset.defaultQueue.smartCollection ?? null);

  const visibleRecommendedFields = new Set(
    [...workflowPreset.primaryFields, ...workflowPreset.secondaryFields].filter(
      (field) => !LEFT_CARD_WORKFLOW_FIELDS.includes(field),
    ),
  );
  const hiddenRecommendedFields = [...visibleRecommendedFields].filter(
    (field) => !showPresetField(field),
  );
  const primaryFields = workflowPreset.primaryFields.filter(showWorkflowPanelField);
  const secondaryFields = workflowPreset.secondaryFields.filter(showWorkflowPanelField);
  const allFields = ALL_WORKFLOW_CARD_FIELDS.filter(
    (field) =>
      !workflowPreset.primaryFields.includes(field) &&
      !workflowPreset.secondaryFields.includes(field) &&
      showWorkflowPanelField(field),
  );
  const workflowWorkCardTitle = safeT(
    t,
    `workflowWorkCard.${workflowPreset.id}`,
    t("workflow.primaryFields"),
  );

  function showPresetField(field: FieldVisibilityField) {
    return showEditor(field);
  }

  function showWorkflowPanelField(field: FieldVisibilityField) {
    return !LEFT_CARD_WORKFLOW_FIELDS.includes(field) && showPresetField(field);
  }

  function metricValue(metric: WorkflowPreset["progressMetrics"][number]) {
    if (metric.kind === "queue") return queueTotal;
    if (!metric.smartCollectionId) return "-";
    return options.smartCollections.find((item) => item.id === metric.smartCollectionId)?.count ?? 0;
  }

  function renderWorkflowField(field: FieldVisibilityField) {
    switch (field) {
      case "rating":
        return (
          <Field key={field} label={t("field.rating")}>
            <select value={rating} onChange={(event) => setRating(event.target.value)} className="field">
              <option value="">{t("organization.noRating")}</option>
              {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value} / 10</option>)}
            </select>
          </Field>
        );
      case "status":
        return (
          <Field key={field} label={t("field.status")}>
            <select value={status} onChange={(event) => changeStatus(event.target.value as SongStatus)} className="field">
              {(["review", "idea", "editing", "generating", "selected", "final", "archived"] as SongStatus[]).map((value) => <option key={value} value={value}>{t(`status.${value}`)}</option>)}
            </select>
          </Field>
        );
      case "generationModel":
        return (
          <Field key={field} label={t("field.generationModel")}>
            <input
              list="generation-model-options-workflow"
              value={generationModel}
              onChange={(event) => setGenerationModel(event.target.value)}
              className="field"
              placeholder={t("explorer.selectOrTypeModel")}
            />
            <datalist id="generation-model-options-workflow">
              {[...new Set([...GENERATION_MODELS, ...options.models])].map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </Field>
        );
      case "project":
        return (
          <Field key={field} label={t("field.project")}>
            <select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="field">
              <option value="">{t("organization.noProject")}</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </Field>
        );
      case "version":
        return (
          <Field key={field} label={t("field.version")}>
            <input value={version} onChange={(event) => setVersion(event.target.value)} className="field" placeholder="v1, remix..." />
          </Field>
        );
      case "tags":
        return (
          <CompactMultiSelectField
            key={field}
            label={t("field.tags")}
            options={options.tags.map((tag) => ({ value: tag.name, label: tag.name }))}
            value={tags}
            onChange={setTags}
            placeholder={t("explorer.selectTags")}
          />
        );
      case "strongPart":
        return <CompactMultiSelectField key={field} label={t("field.strongPart")} options={systemOptions(STRONG_PARTS, language)} value={strongPart} onChange={setStrongPart} placeholder={t("explorer.selectStrongParts")} />;
      case "mainProblem":
        return <CompactMultiSelectField key={field} label={t("field.mainProblem")} options={systemOptions(MAIN_PROBLEMS, language)} value={mainProblem} onChange={setMainProblem} placeholder={t("explorer.selectMainProblems")} />;
      case "intendedUse":
        return <CompactMultiSelectField key={field} label={t("field.intendedUse")} options={systemOptions(INTENDED_USES, language)} value={intendedUse} onChange={setIntendedUse} placeholder={t("explorer.selectIntendedUses")} />;
      case "mood":
        return <CompactMultiSelectField key={field} label={t("field.mood")} options={systemOptions(MOODS, language)} value={mood} onChange={setMood} placeholder={t("explorer.selectMood")} />;
      case "genre":
        return (
          <CompactMultiSelectField
            key={field}
            label={t("field.genre")}
            options={GENRES.map((item) => ({ value: item, label: item }))}
            value={fileMetadata.genre}
            onChange={(value) => setMetadataField("genre", normalizeGenre(value) ?? "")}
            placeholder={t("explorer.selectGenre")}
          />
        );
      case "title":
      case "artist":
      case "album":
      case "albumArtist":
      case "year":
      case "trackNumber":
      case "discNumber":
      case "comment":
      case "lyrics":
      case "bpm":
      case "musicalKey":
        return (
          <EditableMetadataWorkflowField
            key={field}
            field={field}
            value={fileMetadata[field]}
            onChange={(value) => setMetadataField(field, value)}
          />
        );
      case "coverArt":
        return (
          <ReadOnlyWorkflowField
            key={field}
            label={t("field.coverArt")}
            value={
              track.hasCoverArt
                ? safeT(t, "common.yes", "Yes")
                : safeT(t, "common.no", "No")
            }
            help={t("explorer.coverEditingUnavailable")}
          />
        );
      case "nextAction":
        return (
          <Field key={field} label={t("field.nextAction")}>
            <input value={nextAction} onChange={(event) => setNextAction(event.target.value)} className="field" />
          </Field>
        );
      case "notes":
        return (
          <Field key={field} label={t("field.notes")} className="sm:col-span-2">
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} className="field resize-y" />
          </Field>
        );
      default:
        return (
          <ReadOnlyWorkflowField
            key={field}
            label={fieldLabel(field, t)}
            value={workflowFieldValue(field, track, t)}
          />
        );
    }
  }

  const trackDisplayTitle = displayTitleWithVersion({
    ...track,
    title: showCard("title") ? track.title : track.fileName,
  });

  return (
    <div className="mx-auto grid w-full max-w-[1380px] gap-5 xl:grid-cols-[minmax(360px,0.9fr)_minmax(520px,1.35fr)]">
      <section className="card-surface rounded-xl border border-white/8 p-5">
        <div className="mb-4 rounded-lg border border-[#d9ff43]/15 bg-[#d9ff43]/5 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#d9ff43]/75">
            {t("explorer.creativeDecision")}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-white/45">
            {t("explorer.reviewFlow")}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-[minmax(170px,0.95fr)_minmax(170px,0.8fr)] sm:items-start">
          <div hidden={!showCard("coverArt")} aria-label="Placeholder de portada" className="grid aspect-square max-h-72 place-items-center rounded-xl border border-white/8 bg-[radial-gradient(circle_at_top,#293029,#1b1d20_65%)]">
            <Disc3 size={82} className="text-[#d9ff43]/28" />
          </div>
          <div className="grid gap-3">
            <Field hidden={!showEditor("rating")} label={t("field.rating")}>
              <select value={rating} onChange={(event) => setRating(event.target.value)} className="field">
                <option value="">{t("organization.noRating")}</option>
                {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value} / 10</option>)}
              </select>
            </Field>
            <Field hidden={!showEditor("status")} label={t("field.status")}>
              <select value={status} onChange={(event) => changeStatus(event.target.value as SongStatus)} className="field">
                {(["review", "idea", "editing", "generating", "selected", "final", "archived"] as SongStatus[]).map((value) => <option key={value} value={value}>{t(`status.${value}`)}</option>)}
              </select>
            </Field>
            <Field hidden={!showEditor("generationModel")} label={t("field.generationModel")}>
              <input
                list="generation-model-options"
                value={generationModel}
                onChange={(event) => setGenerationModel(event.target.value)}
                className="field"
                placeholder={t("explorer.selectOrTypeModel")}
              />
              <datalist id="generation-model-options">
                {[...new Set([...GENERATION_MODELS, ...options.models])].map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </Field>
            <Field hidden={!showEditor("project")} label={t("field.project")}>
              <select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="field">
                <option value="">{t("organization.noProject")}</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
            </Field>
            <div hidden={!showEditor("project")} className="flex gap-2">
              <input value={newProject} onChange={(event) => setNewProject(event.target.value)} className="field" placeholder={t("explorer.createProject")} />
              <button
                type="button"
                aria-label={t("explorer.createProject")}
                onClick={async () => {
                  if (!newProject.trim()) return;
                  try {
                    const project = await api.createProject(newProject);
                    setProjects((current) =>
                      current.some((item) => item.id === project.id)
                        ? current
                        : [...current, project],
                    );
                    setProjectId(String(project.id));
                    setNewProject("");
                  } catch (projectError) {
                    setError(String(projectError));
                  }
                }}
                className="rounded-md border border-white/10 px-3 text-white/55 hover:bg-white/5"
              >
                <Plus size={15} />
              </button>
            </div>
          </div>
        </div>
        <h3
          hidden={!showCard("title") && !showCard("fileName")}
          className="mt-5 truncate text-2xl font-semibold"
          title={trackDisplayTitle}
        >
          {trackDisplayTitle}
        </h3>
        <p hidden={!showCard("artist")} className="mt-1 truncate text-sm text-white/45">{track.artist || t("explorer.unknownArtist")}</p>
        <p className="mt-1 truncate text-xs text-white/30">{track.album || t("explorer.noAlbum")}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-white/40">
          <span hidden={!showCard("duration")} className="rounded bg-white/5 px-2 py-1">{formatDuration(track.durationMs)}</span>
          <span hidden={!showCard("format")} className="rounded bg-white/5 px-2 py-1">{track.audioFormat.toUpperCase()}</span>
          <span hidden={!showCard("skipCount")} className="rounded bg-white/5 px-2 py-1">{track.skipCount} {t("explorer.skips")}</span>
          <span hidden={!showCard("lastReviewedAt")} className="rounded bg-white/5 px-2 py-1">
            {track.lastReviewedAt ? `${t("explorer.reviewedAt")}: ${new Date(track.lastReviewedAt).toLocaleDateString()}` : t("explorer.reviewedNever")}
          </span>
        </div>
        <p hidden={!showCard("path")} className="mt-3 truncate text-[11px] text-white/25">{track.filePath}</p>

        <div className="elevated-surface mt-6 rounded-lg border border-white/8 p-4 shadow-inner">
          <div className="flex items-center justify-center gap-3">
            <button type="button" onClick={onPrevious} disabled={!canGoPrevious} aria-label={t("common.previous")} className="explorer-player-button">
              <ChevronLeft size={19} />
            </button>
            <button type="button" onClick={() => void player.stop()} disabled={!isCurrent} aria-label={t("common.stop")} className="explorer-player-button">
              <Square size={15} fill="currentColor" />
            </button>
            <button type="button" onClick={() => void togglePlayback()} aria-label={isPlaying ? t("common.pause") : t("common.play")} className="rounded-full bg-[#d9ff43] p-3.5 text-[#101113]">
              {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
            </button>
            <button type="button" onClick={onNext} aria-label={t("common.next")} className="explorer-player-button">
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
              aria-label={t("explorer.playbackProgress")}
              className="h-1 min-w-0 flex-1 accent-[#d9ff43]"
            />
            <span>{formatDuration(duration || null)}</span>
          </div>
          <label className="mt-4 flex items-center gap-3 text-xs text-white/35">
            <Volume2 size={15} />
            <input type="range" min={0} max={1} step={0.01} value={player.state.volume} onChange={(event) => void player.setVolume(Number(event.target.value))} aria-label={t("explorer.volume")} className="h-1 flex-1 accent-[#d9ff43]" />
          </label>
        </div>

        <div className="mt-5 grid gap-2">
          <button type="button" disabled={savingAction !== null} onClick={() => void submit(false)} className="flex w-full items-center justify-center gap-2 rounded-md border border-[#d9ff43]/35 px-4 py-3 text-sm font-semibold text-[#d9ff43] hover:bg-[#d9ff43]/8 disabled:opacity-45">
            <Save size={16} /> {savingAction === "save" ? t("common.saving") : t("common.save")}
          </button>
          <button type="button" disabled={savingAction !== null} onClick={() => void submit(true)} className="flex w-full items-center justify-center gap-2 rounded-md bg-[#d9ff43] px-4 py-3 text-sm font-semibold text-[#101113] disabled:opacity-45">
            <Save size={16} /> {savingAction === "saveNext" ? t("common.saving") : t("explorer.saveAndNext")}
          </button>
          <button type="button" onClick={onSkip} className="flex flex-1 items-center justify-center gap-2 rounded-md border border-white/10 px-3 py-2.5 text-sm text-white/55 hover:bg-white/5">
            <SkipForward size={16} /> {t("explorer.skipForNow")}
          </button>
        </div>
      </section>

      <section
        data-testid="explorer-right-panel"
        className="card-surface right-panel-zoom rounded-xl border border-white/8 p-5"
        style={
          { "--right-panel-zoom": rightPanelZoom } as CSSProperties &
            Record<"--right-panel-zoom", number>
        }
      >
        <div className="mb-3 flex justify-end">
          <PanelZoomControls
            value={rightPanelZoom}
            onChange={onRightPanelZoomChange}
          />
        </div>
        {simpleMode && !showAdvancedFields && (
          <div className="mb-4 rounded-lg border border-[#d9ff43]/20 bg-[#d9ff43]/5 p-3">
            <p className="text-xs leading-relaxed text-white/45">
              {t("settings.simpleModeHelp")}
            </p>
            <button
              type="button"
              onClick={() => setShowAdvancedFields(true)}
              className="mt-2 text-xs font-semibold text-[#d9ff43]/80 hover:text-[#d9ff43]"
            >
              {t("settings.showAdvancedFields")}
            </button>
          </div>
        )}
        {shortcutsEnabled && (
          <details className="mb-4 rounded-lg border border-white/8 bg-white/[0.02] p-3 text-xs text-white/45">
            <summary className="cursor-pointer font-medium text-white/65">
              {t("explorer.keyboardShortcuts")}
            </summary>
            <p className="mt-2 leading-relaxed">
              {t("explorer.shortcutsHelp")}
            </p>
          </details>
        )}
        <div
          data-testid="workflow-compact-header"
          className="mb-3 rounded-lg border border-white/8 bg-white/[0.025] p-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex min-w-0 flex-1 items-center gap-2 text-xs text-white/45">
              <span className="shrink-0 font-semibold text-white/65">
                {t("workflow.workflowLabel")}
              </span>
            <select
              value={workflowPreset.id}
              onChange={(event) =>
                onWorkflowPresetChange(event.target.value as WorkflowPresetId)
              }
                className="field min-w-48 flex-1 py-1.5 text-xs"
            >
              {WORKFLOW_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {t(preset.labelKey)}
                </option>
              ))}
            </select>
            </label>
            <button
              type="button"
              onClick={() => onLoadSuggestedQueue(workflowPreset)}
              className="rounded-md border border-[#d9ff43]/25 px-2.5 py-1.5 text-[11px] font-semibold text-[#d9ff43]/80 hover:bg-[#d9ff43]/8"
            >
              {t("workflow.loadSuggestedQueue")}
            </button>
            <details
              data-testid="workflow-metrics"
              className="rounded-md border border-white/10 bg-white/[0.02] px-2.5 py-1.5 text-[11px] text-white/45"
            >
              <summary className="cursor-pointer font-semibold text-white/60">
                {t("workflow.metrics")}
              </summary>
              <div className="mt-2 flex max-w-sm flex-wrap gap-1.5" data-testid="workflow-metric-chips">
                {workflowPreset.progressMetrics.slice(0, 4).map((metric) => (
                  <span key={metric.id} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/55">
                    {safeT(t, metric.labelKey)}: {metricValue(metric)}
                  </span>
                ))}
              </div>
            </details>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-[11px] text-white/40">
            {t(workflowPreset.descriptionKey)}
          </p>
          {!queueMatchesPreset && (
              <span
                data-testid="workflow-queue-mismatch"
                title={t("workflow.queueMismatchTooltip")}
                className="rounded-full border border-amber-300/20 bg-amber-300/7 px-2.5 py-1 text-[10px] font-semibold text-amber-100/70"
              >
                {t("workflow.queueMismatchShort")}
              </span>
          )}
          </div>
          {hiddenRecommendedFields.length > 0 && (
            <p className="mt-3 rounded-md border border-amber-300/15 bg-amber-300/5 px-3 py-2 text-[11px] text-amber-100/65">
              {t("workflow.hiddenRecommendedFields")}
            </p>
          )}
          {localNotice && (
            <p className="mt-3 rounded-md border border-[#d9ff43]/15 bg-[#d9ff43]/5 px-3 py-2 text-[11px] text-[#d9ff43]/75">
              {localNotice}
            </p>
          )}
          {hasPendingMetadataChanges && (
            <p className="mt-3 rounded-md border border-amber-300/15 bg-amber-300/5 px-3 py-2 text-[11px] text-amber-100/65">
              {t("explorer.unsavedMetadataChanges")}
            </p>
          )}
          {appliedTagActions.length > 0 && (
            <div className="mt-3 rounded-md border border-white/8 bg-white/[0.02] px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
                {t("workflow.appliedActions")}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {appliedTagActions.map((quickAction) => (
                  <button
                    key={quickAction.id}
                    type="button"
                    onClick={() => applyWorkflowAction(quickAction.action, quickAction.labelKey)}
                    className="rounded-full border border-[#d9ff43]/30 bg-[#d9ff43]/10 px-2.5 py-1 text-[11px] font-semibold text-[#d9ff43] hover:bg-[#d9ff43]/15"
                    aria-label={`${t("workflow.removeAppliedAction")}: ${safeT(t, quickAction.labelKey, quickAction.action.value)}`}
                  >
                    {safeT(t, quickAction.labelKey, quickAction.action.value)} ×
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {workflowPreset.quickActions.map((quickAction) => (
              <WorkflowActionButton
                key={quickAction.id}
                action={quickAction}
                active={isWorkflowActionActive(quickAction.action)}
                recommended={Boolean(quickAction.primary)}
                onClick={() => applyWorkflowAction(quickAction.action, quickAction.labelKey)}
              />
            ))}
          </div>
        </div>
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#d9ff43]/60">
            {workflowWorkCardTitle}
          </h3>
          <div data-testid="workflow-primary-fields" className="mt-3 grid gap-4 sm:grid-cols-2">
            {primaryFields.map((field) => renderWorkflowField(field))}
          </div>
          {workflowPreset.checklistKeys && (
            <details
              data-testid="workflow-checklist"
              className="mt-3 rounded-md border border-white/8 bg-white/[0.02] px-3 py-2 text-xs text-white/45"
            >
              <summary className="cursor-pointer font-medium text-white/65">
                {t("workflow.releaseChecklist")}
              </summary>
              <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {workflowPreset.checklistKeys.map((key) => (
                  <label key={key} className="flex items-center gap-2 rounded border border-white/8 bg-white/[0.02] px-2 py-1.5 text-[11px]">
                    <input type="checkbox" disabled className="accent-[#d9ff43]" />
                    {safeT(t, key)}
                  </label>
                ))}
              </div>
            </details>
          )}
        </section>

        {secondaryFields.length > 0 && (
          <details open={!simpleMode || showAdvancedFields} className="mt-5 rounded-lg border border-white/8 bg-white/[0.02] p-3">
            <summary className="cursor-pointer text-xs font-semibold text-white/65">
              {t("workflow.moreDetails")}
            </summary>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {secondaryFields.map((field) => renderWorkflowField(field))}
            </div>
          </details>
        )}

        {(!simpleMode || showAdvancedFields) && allFields.length > 0 && (
          <details className="mt-4 rounded-lg border border-white/8 bg-white/[0.02] p-3">
            <summary className="cursor-pointer text-xs font-semibold text-white/65">
              {t("workflow.allFields")}
            </summary>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {allFields.map((field) => renderWorkflowField(field))}
            </div>
          </details>
        )}

        <p className="mt-3 text-[10px] leading-relaxed text-amber-200/50">
          {t("explorer.genresSavedInFile")} {t("explorer.creativeDataInternal")}
        </p>

        <div className="mt-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">{t("explorer.quickStatus")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {QUICK_STATUSES.map((item) => (
              <button key={item} type="button" onClick={() => changeStatus(item)} className={`rounded-full border px-3 py-1.5 text-xs ${status === item ? "border-[#d9ff43]/45 bg-[#d9ff43]/10 text-[#d9ff43]" : "border-white/10 text-white/45 hover:bg-white/5"}`}>
                {item === "archived" && <Archive size={12} className="mr-1 inline" />}
                {item === "archived" ? t("field.archived") : t(`status.${item}`)}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="mt-4 rounded-md border border-red-400/20 bg-red-400/7 px-3 py-2 text-xs text-red-200">{error}</p>}
        <p className="mt-6 text-center text-[10px] text-white/25">{t("explorer.creativeDataInternal")}</p>
      </section>
    </div>
  );
}

function Field({
  label,
  className = "",
  hidden = false,
  children,
}: {
  label: string;
  className?: string;
  hidden?: boolean;
  children: React.ReactNode;
}) {
  if (hidden) return null;

  return (
    <label className={`block text-xs text-white/45 ${className}`}>
      <span className="mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

function EditableMetadataWorkflowField({
  field,
  value,
  onChange,
}: {
  field: ExplorerMetadataField;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useI18n();
  const label = field === "lyrics" ? t("field.lyrics") : t(`field.${field}`);
  const numeric = ["year", "trackNumber", "discNumber", "bpm"].includes(field);

  if (field === "comment" || field === "lyrics") {
    return (
      <Field label={label} className="sm:col-span-2">
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={field === "lyrics" ? 5 : 3}
          className="field resize-y"
          placeholder={field === "lyrics" ? t("explorer.lyricsPlaceholder") : undefined}
        />
      </Field>
    );
  }

  return (
    <Field label={label}>
      <input
        type={numeric ? "number" : "text"}
        step={field === "bpm" ? "0.01" : undefined}
        min={numeric ? 0 : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="field"
      />
    </Field>
  );
}

function WorkflowActionButton({
  action,
  active,
  recommended,
  onClick,
}: {
  action: WorkflowQuickAction;
  active: boolean;
  recommended: boolean;
  onClick: () => void;
}) {
  const { t } = useI18n();
  const label = safeT(t, action.labelKey, humanizeActionId(action.id));
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "rounded-full border border-[#d9ff43]/45 bg-[#d9ff43]/15 px-3 py-1.5 text-xs font-semibold text-[#d9ff43] hover:bg-[#d9ff43]/20"
          : recommended
          ? "rounded-full border border-white/25 bg-white/[0.025] px-3 py-1.5 text-xs font-semibold text-white/70 hover:bg-white/7"
          : "rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/50 hover:bg-white/5"
      }
      title={active ? t("workflow.applied") : recommended ? t("workflow.recommended") : undefined}
    >
      {label}
      {!active && recommended && (
        <span aria-hidden="true" className="ml-1.5 text-[10px] font-medium text-white/35">
          {t("workflow.recommended")}
        </span>
      )}
    </button>
  );
}

function ReadOnlyWorkflowField({
  label,
  value,
  help,
}: {
  label: string;
  value: string;
  help?: string;
}) {
  return (
    <div className="rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2 text-xs">
      <p className="text-white/35">{label}</p>
      {help && <p className="mt-1 text-[11px] leading-relaxed text-white/35">{help}</p>}
      <p className="mt-1 min-h-5 whitespace-pre-wrap break-words text-white/65">
        {value || "—"}
      </p>
    </div>
  );
}

function CompactMultiSelectField({
  label,
  options,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  options: CompactOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [customValue, setCustomValue] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selectedValues = splitValues(value);
  const selected = new Set(selectedValues.map(normalizeSelectionValue));
  const mergedOptions = mergeSelectedOptions(options, selectedValues);
  const filteredOptions = mergedOptions.filter((option) =>
    option.label.toLocaleLowerCase().includes(filter.trim().toLocaleLowerCase()) ||
    option.value.toLocaleLowerCase().includes(filter.trim().toLocaleLowerCase()),
  );
  const summary = summarizeSelection(selectedValues, mergedOptions, placeholder);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && containerRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function toggle(option: string) {
    const normalizedOption = normalizeSelectionValue(option);
    const next = new Map(selectedValues.map((item) => [normalizeSelectionValue(item), item]));
    next.has(normalizedOption) ? next.delete(normalizedOption) : next.set(normalizedOption, option);
    onChange([...next.values()].join(", "));
  }

  function addCustom() {
    const nextValue = customValue.trim();
    if (!nextValue) return;
    const next = new Map(selectedValues.map((item) => [normalizeSelectionValue(item), item]));
    next.set(normalizeSelectionValue(nextValue), nextValue);
    onChange([...next.values()].join(", "));
    setCustomValue("");
  }

  return (
    <div ref={containerRef} className="relative text-xs" data-ignore-shortcuts="true">
      <p className="mb-1.5 text-white/45">{label}</p>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((current) => !current)}
        className="field flex min-h-10 w-full items-center justify-between gap-2 text-left"
      >
        <span className={selectedValues.length > 0 ? "truncate text-white/75" : "truncate text-white/35"}>
          {summary}
        </span>
        <ChevronDown size={15} className={`shrink-0 text-white/40 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 z-50 mt-2 rounded-lg border border-white/10 bg-[#181b20] p-3 shadow-2xl shadow-black/40">
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="field mb-2"
            placeholder={t("multiSelect.search")}
          />
          <div role="listbox" aria-label={label} className="max-h-48 overflow-y-auto pr-1">
            {filteredOptions.map((option) => {
              const checked = selected.has(normalizeSelectionValue(option.value));
              return (
                <label key={option.value} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-white/60 hover:bg-white/5">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(option.value)}
                    className="accent-[#d9ff43]"
                  />
                  <span className="truncate">{option.label}</span>
                </label>
              );
            })}
            {filteredOptions.length === 0 && (
              <p className="px-2 py-2 text-white/35">{t("multiSelect.noOptions")}</p>
            )}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={customValue}
              onChange={(event) => setCustomValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addCustom();
                }
              }}
              className="field min-w-0 flex-1"
              placeholder={t("multiSelect.customPlaceholder")}
            />
            <button
              type="button"
              onClick={addCustom}
              className="rounded-md border border-white/10 px-3 text-xs text-white/60 hover:bg-white/5"
            >
              {t("multiSelect.addCustom")}
            </button>
          </div>
          <div className="mt-3 flex justify-between gap-2">
            <button
              type="button"
              onClick={() => onChange("")}
              className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-white/50 hover:bg-white/5"
            >
              {t("common.clear")}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-[#d9ff43]/30 px-3 py-1.5 text-xs font-semibold text-[#d9ff43]/85 hover:bg-[#d9ff43]/8"
            >
              {t("common.apply")}
            </button>
          </div>
        </div>
      )}
      <div className="mt-1 flex min-h-5 flex-wrap gap-1 overflow-hidden">
        {selectedValues.slice(0, 4).map((item) => (
          <span key={item} className="max-w-full truncate rounded-full border border-white/8 bg-white/[0.03] px-2 py-0.5 text-[10px] text-white/45">
            {labelForValue(item, mergedOptions)}
          </span>
        ))}
        {selectedValues.length > 4 && (
          <span className="rounded-full border border-white/8 bg-white/[0.03] px-2 py-0.5 text-[10px] text-white/45">
            +{selectedValues.length - 4}
          </span>
        )}
      </div>
    </div>
  );
}

function systemOptions(options: SystemOption[], language: "en" | "es"): CompactOption[] {
  return options.map((option) => ({
    value: option.value,
    label: option.labels[language],
  }));
}

function mergeSelectedOptions(options: CompactOption[], selectedValues: string[]) {
  const merged = [...options];
  const known = new Set(options.map((option) => normalizeSelectionValue(option.value)));
  for (const value of selectedValues) {
    const normalized = normalizeSelectionValue(value);
    if (!known.has(normalized)) {
      merged.push({ value, label: value });
      known.add(normalized);
    }
  }
  return merged;
}

function summarizeSelection(
  selectedValues: string[],
  options: CompactOption[],
  placeholder: string,
) {
  if (selectedValues.length === 0) return placeholder;
  const labels = selectedValues.map((value) => labelForValue(value, options));
  if (labels.length <= 2) return labels.join(", ");
  return `${labels.slice(0, 2).join(", ")} +${labels.length - 2}`;
}

function labelForValue(value: string, options: CompactOption[]) {
  const normalized = normalizeSelectionValue(value);
  return options.find((option) => normalizeSelectionValue(option.value) === normalized)?.label ?? value;
}

function normalizeSelectionValue(value: string) {
  return value.trim().toLocaleLowerCase();
}

function fieldLabel(field: FieldVisibilityField, t: (key: string) => string) {
  return safeT(t, `field.${field}`, humanizeFieldName(field));
}

function workflowFieldValue(
  field: FieldVisibilityField,
  track: TrackDetails,
  t: (key: string) => string,
) {
  switch (field) {
    case "title":
      return track.title || track.fileName;
    case "artist":
      return track.artist || t("explorer.unknownArtist");
    case "album":
      return track.album || t("explorer.noAlbum");
    case "albumArtist":
      return track.albumArtist || "—";
    case "year":
      return track.year ? String(track.year) : "—";
    case "trackNumber":
      return track.trackNumber ? String(track.trackNumber) : "—";
    case "discNumber":
      return track.discNumber ? String(track.discNumber) : "—";
    case "comment":
      return track.comment || "—";
    case "lyrics":
      return track.lyrics || "—";
    case "bpm":
      return track.bpm ? String(track.bpm) : "—";
    case "musicalKey":
      return track.musicalKey || "—";
    case "coverArt":
      return track.hasCoverArt ? safeT(t, "common.yes", "Yes") : safeT(t, "common.no", "No");
    case "duration":
      return formatDuration(track.durationMs);
    case "format":
      return track.audioFormat.toUpperCase();
    case "skipCount":
      return String(track.skipCount);
    case "lastReviewedAt":
      return track.lastReviewedAt
        ? new Date(track.lastReviewedAt).toLocaleDateString()
        : t("explorer.reviewedNever");
    case "playCount":
      return String(track.playCount);
    default:
      return "—";
  }
}

function safeT(
  t: (key: string) => string,
  key: string,
  fallback = humanizeFieldName(key.split(".").pop() ?? key),
) {
  const value = t(key);
  return value === key ? fallback : value;
}

function humanizeActionId(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toLocaleUpperCase());
}

function humanizeFieldName(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toLocaleUpperCase());
}

function splitValues(value: string) {
  return value
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function shuffleTracks<T>(items: T[], random = Math.random): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

function normalizeGenre(value: string | null) {
  const values = (value ?? "")
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
  return values.length > 0 ? [...new Set(values)].join("; ") : null;
}

function explorerMetadataValues(track: TrackDetails): ExplorerMetadataValues {
  return {
    title: track.title ?? "",
    artist: track.artist ?? "",
    album: track.album ?? "",
    albumArtist: track.albumArtist ?? "",
    genre: normalizeGenre(track.genre) ?? "",
    year: track.year?.toString() ?? "",
    trackNumber: track.trackNumber?.toString() ?? "",
    discNumber: track.discNumber?.toString() ?? "",
    comment: track.comment ?? "",
    lyrics: track.lyrics ?? "",
    bpm: track.bpm?.toString() ?? "",
    musicalKey: track.musicalKey ?? "",
  };
}

function normalizedTextValue(value: string) {
  return value.trim() || null;
}

function normalizedNumberValue(
  value: string,
  label: string,
  allowDecimal = false,
) {
  const raw = value.trim();
  if (!raw) return null;
  const parsed = allowDecimal ? Number(raw.replace(",", ".")) : Number(raw);
  if (!Number.isFinite(parsed) || (!allowDecimal && !Number.isInteger(parsed))) {
    throw new Error(`${label}: ${raw}`);
  }
  return parsed;
}

function hasExplorerMetadataChanges(
  values: ExplorerMetadataValues,
  track: TrackDetails,
) {
  const initial = explorerMetadataValues(track);
  return (Object.keys(values) as ExplorerMetadataField[]).some(
    (field) => values[field] !== initial[field],
  );
}

function buildExplorerMetadataPatch(
  values: ExplorerMetadataValues,
  track: TrackDetails,
  t: (key: string) => string,
): MetadataPatch {
  const patch: MetadataPatch = {};
  const initial = explorerMetadataValues(track);

  function changed(field: ExplorerMetadataField) {
    return values[field] !== initial[field];
  }

  if (changed("title")) patch.title = { value: normalizedTextValue(values.title) };
  if (changed("artist")) patch.artist = { value: normalizedTextValue(values.artist) };
  if (changed("album")) patch.album = { value: normalizedTextValue(values.album) };
  if (changed("albumArtist")) {
    patch.albumArtist = { value: normalizedTextValue(values.albumArtist) };
  }
  if (changed("genre")) {
    patch.genre = { value: normalizeGenre(values.genre) };
  }
  if (changed("year")) {
    patch.year = {
      value: normalizedNumberValue(values.year, t("field.year")),
    };
  }
  if (changed("trackNumber")) {
    patch.trackNumber = {
      value: normalizedNumberValue(values.trackNumber, t("field.trackNumber")),
    };
  }
  if (changed("discNumber")) {
    patch.discNumber = {
      value: normalizedNumberValue(values.discNumber, t("field.discNumber")),
    };
  }
  if (changed("comment")) patch.comment = { value: normalizedTextValue(values.comment) };
  if (changed("lyrics")) {
    patch.unsyncedLyrics = { value: normalizedTextValue(values.lyrics) };
  }
  if (changed("bpm")) {
    patch.bpm = {
      value: normalizedNumberValue(values.bpm, "BPM", true),
    };
  }
  if (changed("musicalKey")) {
    patch.musicalKey = { value: normalizedTextValue(values.musicalKey) };
  }

  return patch;
}

function hasMetadataPatch(patch: MetadataPatch) {
  return Object.keys(patch).length > 0;
}

function criterionLabel(value: ExplorerCriterion, t: (key: string) => string) {
  const labels: Record<ExplorerCriterion, string> = {
    unreviewed: t("status.review"),
    unrated: t("organization.noRating"),
    no_project: t("organization.noProject"),
    untagged: t("organization.noTags"),
    needs_action: t("organization.withNextAction"),
    daw_rescue: "DAW Rescue",
    radio_ready: "Radio Ready",
    release_ready: "Release Ready",
    archived: t("field.archived"),
    random: t("common.all"),
    all: t("common.all"),
  };
  return labels[value];
}

function trackToSummary(track: TrackDetails): TrackSummary {
  const {
    fileExtension: _fileExtension,
    fileSize: _fileSize,
    trackTotal: _trackTotal,
    discNumber: _discNumber,
    discTotal: _discTotal,
    comment: _comment,
    lyrics: _lyrics,
    bitrateKbps: _bitrateKbps,
    sampleRateHz: _sampleRateHz,
    channels: _channels,
    hasCoverArt: _hasCoverArt,
    ...summary
  } = track;
  return summary;
}
