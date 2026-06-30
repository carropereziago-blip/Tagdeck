import { save } from "@tauri-apps/plugin-dialog";
import { Download, ListPlus, Plus, Radio, RefreshCw, Save, Search, Workflow } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../lib/tauri";
import type {
  OrganizationOptions,
  OrganizationPatch,
  Project,
  SongStatus,
  SortDirection,
  TrackDetails,
  TrackSortField,
  TrackSummary,
} from "../../types/track";
import { usePlayer } from "../player/PlayerContext";
import { AddToPlaylistDialog } from "../playlists/AddToPlaylistDialog";
import { useSettings } from "../settings/SettingsContext";
import { visibleFieldsForZone, type FieldVisibilityField } from "../settings/settings";
import {
  WORKFLOW_PRESET_STORAGE_KEY,
  WORKFLOW_PRESETS,
  workflowPresetById,
  type WorkflowPreset,
  type WorkflowPresetId,
} from "../workflows/workflowPresets";
import { useI18n } from "../../i18n";
import { OrganizationTable } from "./OrganizationTable";
import { SmartCollections, SONG_STATUSES } from "./SmartCollections";

const PAGE_SIZE = 1_000;
const EMPTY_OPTIONS: OrganizationOptions = {
  tags: [],
  projects: [],
  versions: [],
  models: [],
  smartCollections: [],
};

export function OrganizationView({
  focusTrackId,
  onOpenSession,
}: {
  focusTrackId?: number;
  onOpenSession?: (trackId: number, queueIds?: number[]) => void;
}) {
  const [tracks, setTracks] = useState<TrackSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedTrack, setSelectedTrack] = useState<TrackDetails | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [options, setOptions] = useState<OrganizationOptions>(EMPTY_OPTIONS);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<SongStatus | null>(null);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [tagId, setTagId] = useState<number | null>(null);
  const [versionLabel, setVersionLabel] = useState<string | null>(null);
  const [smartCollection, setSmartCollection] = useState<string | null>(null);
  const [workflowPresetId, setWorkflowPresetId] = useState<WorkflowPresetId>(() => {
    const stored = window.localStorage.getItem(WORKFLOW_PRESET_STORAGE_KEY);
    return workflowPresetById(stored).id;
  });
  const [sortBy, setSortBy] = useState<TrackSortField>("title");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playlistSession, setPlaylistSession] = useState<{
    trackIds: number[];
    title: string;
    createOnly: boolean;
  } | null>(null);
  const { playTrack, setSelectedTrack: setPlayerSelectedTrack, setLibraryTracks } =
    usePlayer();
  const { settings } = useSettings();
  const { t } = useI18n();
  const organizationTableFields = visibleFieldsForZone(settings.fieldVisibility, "organizationTable");
  const organizationPanelFields = visibleFieldsForZone(settings.fieldVisibility, "organizationPanel");
  const workflowPreset = useMemo(
    () => workflowPresetById(workflowPresetId),
    [workflowPresetId],
  );

  const query = useMemo(
    () => ({
      search: search.trim() || null,
      ratingMin: null,
      ratingMax: null,
      status,
      tagId,
      projectId,
      versionLabel,
      smartCollection,
      sortBy,
      sortDirection,
      limit: PAGE_SIZE,
      offset: 0,
    }),
    [
      projectId,
      search,
      smartCollection,
      sortBy,
      sortDirection,
      status,
      tagId,
      versionLabel,
    ],
  );

  const loadOptions = useCallback(async () => {
    setOptions(await api.getOrganizationOptions());
  }, []);

  const loadTracks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await api.getLibraryTracks(query);
      setTracks(page.items);
      setTotal(page.total);
      const visibleIds = new Set(page.items.map((track) => track.id));
      setSelectedIds(
        (current) => new Set([...current].filter((id) => visibleIds.has(id))),
      );
    } catch (loadError) {
      setError(String(loadError));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void Promise.all([loadTracks(), loadOptions()]).catch((loadError) =>
      setError(String(loadError)),
    );
  }, [loadOptions, loadTracks]);

  useEffect(() => {
    setLibraryTracks(tracks, "organization");
  }, [setLibraryTracks, tracks]);

  async function selectTrack(track: TrackSummary) {
    try {
      const details = await api.getTrack(track.id);
      setSelectedTrack(details);
      setPlayerSelectedTrack(details);
    } catch (selectError) {
      setError(String(selectError));
    }
  }

  useEffect(() => {
    if (!focusTrackId) return;
    const summary = tracks.find((track) => track.id === focusTrackId);
    if (summary) void selectTrack(summary);
  }, [focusTrackId, tracks]);

  async function playSelected(track: TrackSummary) {
    try {
      const details = await api.getTrack(track.id);
      setSelectedTrack(details);
      setPlayerSelectedTrack(details);
      await playTrack(details, "organization_play", "organization");
    } catch (playError) {
      setError(String(playError));
    }
  }

  async function saveOrganization(patch: OrganizationPatch) {
    const ids = selectedIds.size > 0
      ? [...selectedIds]
      : selectedTrack
        ? [selectedTrack.id]
        : [];
    if (ids.length === 0) {
      throw new Error(t("organization.selectOrMarkSong"));
    }
    await api.updateTrackOrganization(ids, patch);
    await Promise.all([loadTracks(), loadOptions()]);
    if (selectedTrack && ids.includes(selectedTrack.id)) {
      const refreshed = await api.getTrack(selectedTrack.id);
      setSelectedTrack(refreshed);
      setPlayerSelectedTrack(refreshed);
    }
    setNotice(
      `${ids.length} ${ids.length === 1 ? t("organization.songUpdated") : t("organization.songsUpdated")}.`,
    );
  }

  async function createProject(name: string): Promise<Project> {
    const project = await api.createProject(name);
    await loadOptions();
    return project;
  }

  async function exportFiltered(format: "csv" | "json") {
    const path = await save({
      title: `${t("organization.exportAs")} ${format.toUpperCase()}`,
      defaultPath: `tagdeck-organization.${format}`,
      filters: [{ name: format.toUpperCase(), extensions: [format] }],
    });
    if (!path) return;
    try {
      const summary = await api.exportLibrary(query, format, path);
      setNotice(`${summary.count} ${t("settings.songsExported")} ${format.toUpperCase()}: ${summary.path}`);
    } catch (exportError) {
      setError(String(exportError));
    }
  }

  function applyWorkflowFilter(preset: WorkflowPreset) {
    setWorkflowPresetId(preset.id);
    window.localStorage.setItem(WORKFLOW_PRESET_STORAGE_KEY, preset.id);
    setTagId(null);
    setProjectId(null);
    setVersionLabel(null);
    setStatus(null);
    setSmartCollection(preset.defaultQueue.smartCollection ?? smartCollectionFromCriterion(preset.defaultQueue.criterion));
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-[210px_minmax(0,1fr)_340px]">
      <SmartCollections
        options={options}
        smartCollection={smartCollection}
        status={status}
        tagId={tagId}
        projectId={projectId}
        versionLabel={versionLabel}
        onSmartCollectionChange={setSmartCollection}
        onStatusChange={setStatus}
        onTagChange={setTagId}
        onProjectChange={setProjectId}
        onVersionChange={setVersionLabel}
      />

      <section className="flex min-h-0 min-w-0 flex-col">
        <header className="section-header border-b border-white/8 px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Workflow size={18} />
                {t("organization.center")}
              </h2>
              <p className="mt-1 text-xs text-white/40">
                {total} {total === 1 ? t("library.song") : t("library.songs")} {t("organization.inCurrentFilter")}
              </p>
              <p className="mt-1 text-[11px] text-sky-200/45">
                {t("organization.help")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-xs text-white/40">
                {t("workflow.activePreset")}
                <select
                  value={workflowPreset.id}
                  onChange={(event) =>
                    applyWorkflowFilter(workflowPresetById(event.target.value as WorkflowPresetId))
                  }
                  className="rounded-md border border-white/10 bg-[#202226] px-2.5 py-2 text-xs text-white/70"
                >
                  {WORKFLOW_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {t(preset.labelKey)}
                    </option>
                  ))}
                </select>
              </label>
              {(selectedIds.size > 0 || selectedTrack) && onOpenSession && (
                <button
                  type="button"
                  onClick={() => {
                    const orderedIds =
                      selectedIds.size > 0
                        ? tracks
                            .filter((track) => selectedIds.has(track.id))
                            .map((track) => track.id)
                        : selectedTrack
                          ? [selectedTrack.id]
                          : [];
                    if (orderedIds[0]) onOpenSession(orderedIds[0], orderedIds);
                  }}
                  className="toolbar-button"
                >
                  <Radio size={15} /> {t("library.openSessionMode")}
                </button>
              )}
              {(selectedIds.size > 0 || selectedTrack) && (
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
                  className="toolbar-button"
                >
                  <ListPlus size={15} /> {t("library.addToPlaylist")}
                </button>
              )}
              {tracks.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setPlaylistSession({
                      trackIds: tracks.map((track) => track.id),
                      title: t("organization.createListFromFilter"),
                      createOnly: true,
                    })
                  }
                  className="toolbar-button"
                >
                  <ListPlus size={15} /> {t("library.listFromFilter")}
                </button>
              )}
              <button type="button" onClick={() => void exportFiltered("csv")} className="toolbar-button" title={t("organization.exportFilteredCsv")}>
                <Download size={15} /> CSV
              </button>
              <button type="button" onClick={() => void exportFiltered("json")} className="toolbar-button" title={t("organization.exportFilteredJson")}>
                JSON
              </button>
              <button type="button" onClick={() => void Promise.all([loadTracks(), loadOptions()])} className="toolbar-button" aria-label={t("organization.refresh")}>
                <RefreshCw size={15} />
              </button>
            </div>
          </div>
          <label className="mt-4 flex items-center gap-2 rounded-md border border-white/10 bg-white/4 px-3 py-2">
            <Search size={15} className="text-white/35" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("library.searchPlaceholder")}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/25"
            />
          </label>
          {notice && <p className="mt-3 text-xs text-[#d9ff43]/75">{notice}</p>}
          {error && <p className="mt-3 rounded-md border border-red-400/20 bg-red-400/8 px-3 py-2 text-xs text-red-200">{error}</p>}
        </header>

        <div className="min-h-0 flex-1 overflow-auto">
          <OrganizationTable
            tracks={tracks}
            selectedId={selectedTrack?.id ?? null}
            selectedIds={selectedIds}
            loading={loading}
            visibleFields={organizationTableFields}
            onSelect={(track) => void selectTrack(track)}
            onPlay={(track) => void playSelected(track)}
            onSelectionChange={(id, checked) =>
              setSelectedIds((current) => {
                const next = new Set(current);
                checked ? next.add(id) : next.delete(id);
                return next;
              })
            }
            onSelectAll={(checked) =>
              setSelectedIds(checked ? new Set(tracks.map((track) => track.id)) : new Set())
            }
          />
        </div>
      </section>

      <OrganizationWorkspace
        track={selectedTrack}
        selectedCount={selectedIds.size}
        options={options}
        visibleFields={organizationPanelFields}
        onCreateProject={createProject}
        onSave={saveOrganization}
      />
      {playlistSession && (
        <AddToPlaylistDialog
          trackIds={playlistSession.trackIds}
          title={playlistSession.title}
          createOnly={playlistSession.createOnly}
          onClose={() => setPlaylistSession(null)}
          onComplete={setNotice}
        />
      )}
    </div>
  );
}

type WorkspaceField = "status" | "project" | "version" | "tags" | "nextAction" | "notes";

function OrganizationWorkspace({
  track,
  selectedCount,
  options,
  visibleFields,
  onCreateProject,
  onSave,
}: {
  track: TrackDetails | null;
  selectedCount: number;
  options: OrganizationOptions;
  visibleFields: Set<FieldVisibilityField>;
  onCreateProject: (name: string) => Promise<Project>;
  onSave: (patch: OrganizationPatch) => Promise<void>;
}) {
  const { t } = useI18n();
  const selectionMode = selectedCount > 0;
  const key = [
    track?.id ?? "none",
    selectedCount,
    track?.status,
    track?.projectId,
    track?.versionLabel,
    track?.tagNames,
    track?.nextAction,
    track?.workflowNotes,
  ].join("-");
  return (
    <OrganizationWorkspaceForm
      key={key}
      track={selectionMode ? null : track}
      selectedCount={selectedCount}
      options={options}
      visibleFields={visibleFields}
      onCreateProject={onCreateProject}
      onSave={onSave}
    />
  );
}

function OrganizationWorkspaceForm({
  track,
  selectedCount,
  options,
  visibleFields,
  onCreateProject,
  onSave,
}: {
  track: TrackDetails | null;
  selectedCount: number;
  options: OrganizationOptions;
  visibleFields: Set<FieldVisibilityField>;
  onCreateProject: (name: string) => Promise<Project>;
  onSave: (patch: OrganizationPatch) => Promise<void>;
}) {
  const { t } = useI18n();
  const selectionMode = selectedCount > 0;
  const multiple = selectedCount > 1;
  const [enabled, setEnabled] = useState<Set<WorkspaceField>>(
    new Set(selectionMode ? [] : ["status", "project", "version", "tags", "nextAction", "notes"]),
  );
  const [status, setStatus] = useState<SongStatus>(track?.status ?? "review");
  const [projectId, setProjectId] = useState(track?.projectId?.toString() ?? "");
  const [version, setVersion] = useState(track?.versionLabel ?? "");
  const [tags, setTags] = useState(track?.tagNames ?? "");
  const [nextAction, setNextAction] = useState(track?.nextAction ?? "");
  const [notes, setNotes] = useState(track?.workflowNotes ?? "");
  const [newProject, setNewProject] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const showPanel = (field: FieldVisibilityField) => visibleFields.has(field);

  const activate = (field: WorkspaceField) => {
    if (selectionMode) setEnabled((current) => new Set(current).add(field));
  };
  const toggle = (field: WorkspaceField) =>
    setEnabled((current) => {
      const next = new Set(current);
      next.has(field) ? next.delete(field) : next.add(field);
      return next;
    });

  async function submit() {
    const patch: OrganizationPatch = {};
    if (enabled.has("status")) patch.status = { value: status };
    if (enabled.has("project")) patch.projectId = { value: projectId ? Number(projectId) : null };
    if (enabled.has("version")) patch.versionLabel = { value: version.trim() || null };
    if (enabled.has("tags")) patch.tagNames = tags.split(",").map((tag) => tag.trim()).filter(Boolean);
    if (enabled.has("nextAction")) patch.nextAction = { value: nextAction.trim() || null };
    if (enabled.has("notes")) patch.workflowNotes = { value: notes.trim() || null };
    if (Object.keys(patch).length === 0) {
      setError(t("organization.selectAtLeastOneField"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(patch);
    } catch (saveError) {
      setError(String(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <aside className="panel-surface min-h-0 overflow-y-auto border-l border-white/8 p-4">
      <h3 className="font-semibold">
        {multiple
          ? t("organization.organizeSelection")
          : selectionMode
            ? t("organization.organizeSong")
          : track
            ? t("organization.organizeSong")
            : t("organization.selectSong")}
      </h3>
      <p className="mt-1 truncate text-xs text-white/35">
        {multiple
          ? `${selectedCount} ${t("organization.selectedSongs")}`
          : selectionMode
            ? `1 ${t("organization.selectedSong")}`
            : track?.title || track?.fileName || t("organization.multiSelectHint")}
      </p>

      <div className="mt-5 space-y-4">
        <WorkspaceControl hidden={!showPanel("status")} label={t("field.status")} field="status" bulk={selectionMode} enabled={enabled} onToggle={toggle}>
          <select value={status} onChange={(event) => { setStatus(event.target.value as SongStatus); activate("status"); }} className="field">
            {SONG_STATUSES.map((value) => <option key={value} value={value}>{t(`status.${value}`)}</option>)}
          </select>
        </WorkspaceControl>
        <WorkspaceControl hidden={!showPanel("project")} label={t("field.project")} field="project" bulk={selectionMode} enabled={enabled} onToggle={toggle}>
          <select value={projectId} onChange={(event) => { setProjectId(event.target.value); activate("project"); }} className="field">
            <option value="">{t("organization.noProject")}</option>
            {options.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </WorkspaceControl>
        <div hidden={!showPanel("project")} className="flex gap-2">
          <input value={newProject} onChange={(event) => setNewProject(event.target.value)} placeholder={t("explorer.createProject")} className="field" />
          <button type="button" onClick={async () => {
            if (!newProject.trim()) return;
            const project = await onCreateProject(newProject);
            setProjectId(String(project.id));
            setNewProject("");
            activate("project");
          }} className="rounded-md border border-white/10 px-3"><Plus size={14} /></button>
        </div>
        <WorkspaceControl hidden={!showPanel("version")} label={t("field.version")} field="version" bulk={selectionMode} enabled={enabled} onToggle={toggle}>
          <input list="version-options" value={version} onChange={(event) => { setVersion(event.target.value); activate("version"); }} className="field" placeholder="v1, remix..." />
          <datalist id="version-options">{options.versions.map((item) => <option key={item} value={item} />)}</datalist>
          <p className="mt-1 text-[10px] text-white/25">
            {t("organization.newVersionHint")}
          </p>
        </WorkspaceControl>
        <WorkspaceControl hidden={!showPanel("tags")} label={t("field.tags")} field="tags" bulk={selectionMode} enabled={enabled} onToggle={toggle}>
          <input value={tags} onChange={(event) => { setTags(event.target.value); activate("tags"); }} className="field" placeholder="suno, cinematic..." />
          <p className="mt-1 text-[10px] text-white/25">
            {t("organization.tagsHint")}
          </p>
        </WorkspaceControl>
        <WorkspaceControl hidden={!showPanel("nextAction")} label={t("field.nextAction")} field="nextAction" bulk={selectionMode} enabled={enabled} onToggle={toggle}>
          <input value={nextAction} onChange={(event) => { setNextAction(event.target.value); activate("nextAction"); }} className="field" />
        </WorkspaceControl>
        <WorkspaceControl hidden={!showPanel("notes")} label={t("field.notes")} field="notes" bulk={selectionMode} enabled={enabled} onToggle={toggle}>
          <textarea value={notes} onChange={(event) => { setNotes(event.target.value); activate("notes"); }} rows={5} className="field resize-y" />
        </WorkspaceControl>
      </div>
      {error && <p className="mt-4 text-xs text-red-200">{error}</p>}
      <button type="button" disabled={saving || (!track && !selectionMode)} onClick={() => void submit()} className="mt-5 flex w-full items-center justify-center gap-2 rounded-md bg-[#d9ff43] px-4 py-2.5 text-sm font-semibold text-[#101113] disabled:opacity-35">
        <Save size={15} /> {saving ? t("common.saving") : multiple ? t("organization.applyToSelection") : t("organization.saveOrganization")}
      </button>
    </aside>
  );
}

function WorkspaceControl({
  label,
  field,
  bulk,
  enabled,
  onToggle,
  hidden = false,
  children,
}: {
  label: string;
  field: WorkspaceField;
  bulk: boolean;
  enabled: Set<WorkspaceField>;
  onToggle: (field: WorkspaceField) => void;
  hidden?: boolean;
  children: React.ReactNode;
}) {
  if (hidden) return null;

  return (
    <label className="block text-xs text-white/45">
      <span className="mb-1.5 flex items-center gap-2">
        {bulk && <input type="checkbox" checked={enabled.has(field)} onChange={() => onToggle(field)} className="accent-[#d9ff43]" />}
        {label}
      </span>
      {children}
    </label>
  );
}

function smartCollectionFromCriterion(criterion: WorkflowPreset["defaultQueue"]["criterion"]) {
  const byCriterion: Record<string, string | null> = {
    unreviewed: "unreviewed",
    unrated: "unrated",
    no_project: "no_project",
    untagged: "untagged",
    needs_action: "needs_action",
    daw_rescue: "daw_rescue",
    radio_ready: "radio_ready",
    release_ready: "release_ready",
    archived: "archived",
    random: null,
    all: null,
  };
  return byCriterion[criterion] ?? null;
}
