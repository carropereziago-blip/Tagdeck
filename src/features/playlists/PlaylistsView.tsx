import { startDrag } from "@crabnebula/tauri-plugin-drag";
import { open, save } from "@tauri-apps/plugin-dialog";
import {
  ArrowDown,
  ArrowUp,
  Download,
  FolderOpen,
  GripVertical,
  Library,
  ListMusic,
  Pencil,
  Play,
  Plus,
  Radio,
  Save,
  Trash2,
  Workflow,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDuration } from "../../lib/format";
import { api } from "../../lib/tauri";
import { useI18n } from "../../i18n";
import type {
  PlaylistDetails,
  PlaylistGroup,
  PlaylistPurpose,
  PlaylistSaveRequest,
  PlaylistSong,
  PlaylistSummary,
  PlaylistType,
  TrackSummary,
} from "../../types/track";
import { usePlayer } from "../player/PlayerContext";
import { useSettings } from "../settings/SettingsContext";
import { visibleFieldsForZone, type FieldVisibilityField } from "../settings/settings";
import { PLAYLIST_TYPES, playlistTypeLabel } from "./playlistOptions";

const PLAYLIST_PURPOSES: PlaylistPurpose[] = [
  "idea_capture",
  "deep_review",
  "daw_rescue",
  "release_candidates",
  "radio",
  "custom_model_seed",
  "rejects_i_like",
  "archive_cleanup",
  "metadata_cleanup",
  "archive",
  "general",
];

export function PlaylistsView({
  onOpenTrack,
  onOpenSession,
}: {
  onOpenTrack: (section: "library" | "organization", trackId: number) => void;
  onOpenSession?: (trackId: number, queueIds?: number[]) => void;
}) {
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [groups, setGroups] = useState<PlaylistGroup[]>([]);
  const [details, setDetails] = useState<PlaylistDetails | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragIconPath, setDragIconPath] = useState<string | null>(null);
  const player = usePlayer();
  const { t } = useI18n();
  const { settings, updateSettings } = useSettings();
  const playlistTableFields = visibleFieldsForZone(settings.fieldVisibility, "playlistsTable");
  const { setLibraryTracks } = player;

  const loadGroups = useCallback(async () => {
    setGroups(await api.getPlaylistGroups());
  }, []);

  const loadPlaylists = useCallback(async (preferredId?: number) => {
    const items = await api.getPlaylists();
    setPlaylists(items);
    const targetId =
      preferredId && items.some((item) => item.id === preferredId)
        ? preferredId
        : items[0]?.id;
    if (targetId) {
      const nextDetails = await api.getPlaylist(targetId);
      setDetails(nextDetails);
      setLibraryTracks(nextDetails.songs.map(toTrackSummary), "playlist");
    } else {
      setDetails(null);
      setLibraryTracks([], "playlist");
    }
  }, [setLibraryTracks]);

  useEffect(() => {
    setLoading(true);
    void Promise.all([loadGroups(), loadPlaylists()])
      .catch((loadError) => setError(String(loadError)))
      .finally(() => setLoading(false));
  }, [loadGroups, loadPlaylists]);

  useEffect(() => {
    void api.getDragIconPath().then(setDragIconPath).catch(() => undefined);
  }, []);

  const groupedPlaylists = useMemo(() => {
    const byGroup = new Map<number | null, PlaylistSummary[]>();
    for (const playlist of playlists) {
      const key = playlist.groupId ?? null;
      byGroup.set(key, [...(byGroup.get(key) ?? []), playlist]);
    }
    return {
      grouped: groups.map((group) => ({
        group,
        playlists: byGroup.get(group.id) ?? [],
      })),
      ungrouped: byGroup.get(null) ?? [],
    };
  }, [groups, playlists]);

  async function openPlaylist(id: number) {
    try {
      const nextDetails = await api.getPlaylist(id);
      setDetails(nextDetails);
      setSelectedIds(new Set());
      setCreating(false);
      setLibraryTracks(nextDetails.songs.map(toTrackSummary), "playlist");
    } catch (loadError) {
      setError(String(loadError));
    }
  }

  async function savePlaylist(request: PlaylistSaveRequest) {
    try {
      const saved = creating
        ? await api.createPlaylist(request)
        : await api.updatePlaylist(details!.playlist.id, request);
      setCreating(false);
      await loadGroups();
      await loadPlaylists(saved.id);
      setNotice(creating ? t("playlists.playlistCreated") : t("playlists.playlistUpdated"));
    } catch (saveError) {
      setError(String(saveError));
      throw saveError;
    }
  }

  async function createGroup() {
    const name = window.prompt(t("playlists.groupNamePrompt"));
    if (!name?.trim()) return;
    try {
      await api.createPlaylistGroup(name);
      await loadGroups();
      setNotice(t("playlists.groupCreated"));
    } catch (groupError) {
      setError(String(groupError));
    }
  }

  async function renameGroup(group: PlaylistGroup) {
    const name = window.prompt(t("playlists.groupNamePrompt"), group.name);
    if (!name?.trim()) return;
    try {
      await api.updatePlaylistGroup(group.id, name);
      await loadGroups();
      await loadPlaylists(details?.playlist.id);
      setNotice(t("playlists.groupUpdated"));
    } catch (groupError) {
      setError(String(groupError));
    }
  }

  async function deleteGroup(group: PlaylistGroup) {
    if (group.playlistCount > 0) {
      setError(t("playlists.groupMustBeEmpty"));
      return;
    }
    try {
      await api.deletePlaylistGroup(group.id);
      await loadGroups();
      setNotice(t("playlists.groupDeleted"));
    } catch (groupError) {
      setError(String(groupError));
    }
  }

  async function deleteCurrent() {
    if (!details) return;
    if (
      settings.playlists.confirmDelete &&
      !window.confirm(`${t("playlists.deleteConfirmPrefix")} "${details.playlist.name}"?\n\n${t("playlists.deleteConfirmBody")}`)
    ) return;
    try {
      await api.deletePlaylist(details.playlist.id);
      await loadPlaylists();
      setSelectedIds(new Set());
      setNotice(t("playlists.playlistDeleted"));
    } catch (deleteError) {
      setError(String(deleteError));
    }
  }

  async function removeSelected(songId?: number) {
    if (!details) return;
    const ids = songId ? [songId] : [...selectedIds];
    if (ids.length === 0) return;
    if (
      settings.playlists.confirmRemoveTracks &&
      !window.confirm(
        ids.length === 1
          ? t("playlists.removeOneConfirm")
          : `${t("playlists.removeManyConfirmPrefix")} ${ids.length} ${t("library.songs")} ${t("playlists.removeManyConfirmSuffix")}`,
      )
    ) return;
    try {
      const result = await api.removeTracksFromPlaylist(details.playlist.id, ids);
      await loadPlaylists(details.playlist.id);
      setSelectedIds(new Set());
      setNotice(`${result.changed} ${result.changed === 1 ? t("playlists.songRemoved") : t("playlists.songsRemoved")} ${t("playlists.fromPlaylist")}.`);
    } catch (removeError) {
      setError(String(removeError));
    }
  }

  async function move(songId: number, direction: "up" | "down") {
    if (!details) return;
    try {
      const nextDetails = await api.movePlaylistTrack(
        details.playlist.id,
        songId,
        direction,
      );
      setDetails(nextDetails);
      setPlaylists(await api.getPlaylists());
      setLibraryTracks(nextDetails.songs.map(toTrackSummary), "playlist");
    } catch (moveError) {
      setError(String(moveError));
    }
  }

  async function reorder(trackIds: number[]) {
    if (!details) return;
    try {
      const nextDetails = await api.reorderPlaylistTracks(
        details.playlist.id,
        trackIds,
      );
      setDetails(nextDetails);
      setPlaylists(await api.getPlaylists());
      setLibraryTracks(nextDetails.songs.map(toTrackSummary), "playlist");
    } catch (reorderError) {
      setError(String(reorderError));
    }
  }

  async function play(song: PlaylistSong) {
    try {
      const track = await api.getTrack(song.id);
      player.setSelectedTrack(track);
      await player.playTrack(track, "playlist_next", "playlist");
    } catch (playError) {
      setError(String(playError));
    }
  }

  async function exportCurrent(format: "csv" | "json") {
    if (!details) return;
    const path = await save({
      title: `${t("settings.exportPlaylistTitle")} ${format.toUpperCase()}`,
      defaultPath:
        settings.export.rememberFolder && settings.export.lastFolder
          ? `${settings.export.lastFolder}\\${safeFileName(details.playlist.name)}.${format}`
          : `${safeFileName(details.playlist.name)}.${format}`,
      filters: [{ name: format.toUpperCase(), extensions: [format] }],
    });
    if (!path) return;
    try {
      const summary = await api.exportPlaylist(details.playlist.id, format, path, {
        csvDelimiter: settings.export.csvDelimiter,
        includePath: settings.export.includePath,
        includeInternal: settings.export.includeInternal,
        includeTechnical: settings.export.includeTechnical,
        includeCuration: settings.export.includeCuration,
      });
      setNotice(`${summary.count} ${t("settings.songsExported")} ${format.toUpperCase()}: ${summary.path}`);
      if (settings.export.rememberFolder) {
        const separator = Math.max(summary.path.lastIndexOf("\\"), summary.path.lastIndexOf("/"));
        updateSettings((current) => ({
          ...current,
          export: {
            ...current.export,
            lastFolder: separator >= 0 ? summary.path.slice(0, separator) : "",
          },
        }));
      }
      if (settings.export.openFolderAfterExport) await api.revealFile(path);
    } catch (exportError) {
      setError(String(exportError));
    }
  }

  function orderedTransferSongs() {
    if (!details) return [];
    return selectedIds.size > 0
      ? details.songs.filter((song) => selectedIds.has(song.id))
      : details.songs;
  }

  async function copyCurrentToFolder() {
    const songs = orderedTransferSongs();
    if (songs.length === 0) return;
    const destination = await open({
      title: t("playlists.copyPlaylistToFolder"),
      directory: true,
      multiple: false,
    });
    if (!destination || Array.isArray(destination)) return;
    try {
      const result = await api.copyPlaylistFiles(
        songs.map((song) => song.id),
        destination,
        true,
      );
      const issues = result.missing + result.failed;
      setNotice(
        issues === 0
          ? `${result.copied} ${t("playlists.filesCopiedInOrder")} ${result.destinationPath}.`
          : `${result.copied} ${t("playlists.copied")}; ${result.missing} ${t("playlists.missing")} ${result.failed} ${t("playlists.failedWithError")}.`,
      );
    } catch (copyError) {
      setError(String(copyError));
    }
  }

  function dragCurrentOutside() {
    const songs = orderedTransferSongs();
    if (!dragIconPath || songs.length === 0) return;
    void startDrag({
      item: songs.map((song) => song.filePath),
      icon: dragIconPath,
      mode: "copy",
    }).catch((dragError) => setError(String(dragError)));
  }

  function renderPlaylistButton(playlist: PlaylistSummary) {
    return (
      <button
        key={playlist.id}
        type="button"
        onClick={() => void openPlaylist(playlist.id)}
        className={`w-full rounded-md px-3 py-3 text-left ${
          details?.playlist.id === playlist.id
            ? "bg-[#d9ff43]/9 text-white/85"
            : "text-white/55 hover:bg-white/5"
        }`}
      >
        <p className="truncate text-sm font-medium">{playlist.name}</p>
        <p className="mt-1 flex justify-between text-[10px] text-white/30">
          <span>{playlistTypeLabel(playlist.playlistType, t)}</span>
          <span>{playlist.songCount} Â· {formatDuration(playlist.totalDurationMs)}</span>
        </p>
      </button>
    );
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-[270px_minmax(0,1fr)]">
      <aside className="panel-surface min-h-0 overflow-y-auto border-r border-white/8">
        <div className="panel-surface sticky top-0 border-b border-white/8 p-4">
          <button
            type="button"
            onClick={() => {
              setCreating(true);
              setDetails(null);
              setSelectedIds(new Set());
            }}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-[#d9ff43] px-3 py-2.5 text-sm font-semibold text-[#101113]"
          >
            <Plus size={16} /> {t("playlists.newPlaylist")}
          </button>
          <p className="mt-3 text-[11px] leading-relaxed text-sky-200/40">
            {t("playlists.help")}
          </p>
          <button
            type="button"
            onClick={() => void createGroup()}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-white/10 px-3 py-2 text-xs text-white/55 hover:bg-white/5"
          >
            <Plus size={14} /> {t("playlists.newGroup")}
          </button>
        </div>
        <div className="space-y-1 p-2">
          {groupedPlaylists.grouped.map(({ group, playlists: groupPlaylists }) => (
            <div key={group.id} className="rounded-lg border border-white/6 bg-white/[0.015] p-1">
              <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35">
                  {group.name}
                </p>
                <div className="flex gap-1">
                  <button type="button" onClick={() => void renameGroup(group)} className="rounded p-1 text-white/35 hover:bg-white/5" aria-label={t("playlists.renameGroup")}>
                    <Pencil size={12} />
                  </button>
                  <button type="button" onClick={() => void deleteGroup(group)} className="rounded p-1 text-red-200/45 hover:bg-red-400/8" aria-label={t("playlists.deleteGroup")}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              {groupPlaylists.length > 0 ? (
                groupPlaylists.map(renderPlaylistButton)
              ) : (
                <p className="px-2 pb-2 text-[11px] text-white/25">{t("playlists.emptyGroup")}</p>
              )}
            </div>
          ))}
          {groupedPlaylists.ungrouped.length > 0 && (
            <div className="rounded-lg border border-white/6 bg-white/[0.015] p-1">
              <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35">
                {t("playlists.ungrouped")}
              </p>
              {groupedPlaylists.ungrouped.map(renderPlaylistButton)}
            </div>
          )}
          {false && playlists.map((playlist) => (
            <button
              key={playlist.id}
              type="button"
              onClick={() => void openPlaylist(playlist.id)}
              className={`w-full rounded-md px-3 py-3 text-left ${
                details?.playlist.id === playlist.id
                  ? "bg-[#d9ff43]/9 text-white/85"
                  : "text-white/55 hover:bg-white/5"
              }`}
            >
              <p className="truncate text-sm font-medium">{playlist.name}</p>
              <p className="mt-1 flex justify-between text-[10px] text-white/30">
                <span>{playlistTypeLabel(playlist.playlistType, t)}</span>
                <span>{playlist.songCount} · {formatDuration(playlist.totalDurationMs)}</span>
              </p>
            </button>
          ))}
          {!loading && playlists.length === 0 && (
            <p className="px-3 py-8 text-center text-xs text-white/30">
              {t("playlists.noPlaylistsYet")}
            </p>
          )}
        </div>
      </aside>

      <main className="app-surface flex min-h-0 min-w-0 flex-col">
        {creating ? (
          <PlaylistEditor title={t("playlists.createPlaylist")} groups={groups} onSave={savePlaylist} />
        ) : details ? (
          <>
            <PlaylistHeader
              details={details}
              groups={groups}
              selectedCount={selectedIds.size}
              onSave={savePlaylist}
              onDelete={() => void deleteCurrent()}
              onRemoveSelected={() => void removeSelected()}
              onExport={exportCurrent}
              onCopy={() => void copyCurrentToFolder()}
              onExternalDrag={dragCurrentOutside}
              onOpenSession={
                onOpenSession && details.songs[0]
                  ? () =>
                      onOpenSession(
                        details.songs[0].id,
                        details.songs.map((song) => song.id),
                      )
                  : undefined
              }
            />
            {notice && <p className="border-b border-[#d9ff43]/10 bg-[#d9ff43]/5 px-5 py-2 text-xs text-[#d9ff43]/70">{notice}</p>}
            {error && <p className="border-b border-red-400/15 bg-red-400/7 px-5 py-2 text-xs text-red-200">{error}</p>}
            <div className="min-h-0 flex-1 overflow-auto">
              <PlaylistTable
                songs={details.songs}
                selectedIds={selectedIds}
                currentTrackId={player.state.trackId}
                visibleFields={playlistTableFields}
                onSelectionChange={(id, checked) =>
                  setSelectedIds((current) => {
                    const next = new Set(current);
                    checked ? next.add(id) : next.delete(id);
                    return next;
                  })
                }
                onSelectAll={(checked) =>
                  setSelectedIds(
                    checked ? new Set(details.songs.map((song) => song.id)) : new Set(),
                  )
                }
                onPlay={(song) => void play(song)}
                onMove={(id, direction) => void move(id, direction)}
                onReorder={(ids) => void reorder(ids)}
                onRemove={(id) => void removeSelected(id)}
                onOpenTrack={onOpenTrack}
              />
            </div>
          </>
        ) : (
          <div className="grid h-full place-items-center text-center">
            <div>
              <ListMusic size={48} className="mx-auto text-white/15" />
              <h2 className="mt-4 font-semibold text-white/65">{t("playlists.createFirstPlaylist")}</h2>
              <p className="mt-1 text-sm text-white/30">
                {t("playlists.emptyHelp")}
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function PlaylistHeader({
  details,
  groups,
  selectedCount,
  onSave,
  onDelete,
  onRemoveSelected,
  onExport,
  onCopy,
  onExternalDrag,
  onOpenSession,
}: {
  details: PlaylistDetails;
  groups: PlaylistGroup[];
  selectedCount: number;
  onSave: (request: PlaylistSaveRequest) => Promise<void>;
  onDelete: () => void;
  onRemoveSelected: () => void;
  onExport: (format: "csv" | "json") => Promise<void>;
  onCopy: () => void;
  onExternalDrag: () => void;
  onOpenSession?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const { t } = useI18n();
  if (editing) {
    return (
      <PlaylistEditor
        title={t("playlists.editPlaylist")}
        playlist={details.playlist}
        groups={groups}
        onCancel={() => setEditing(false)}
        onSave={async (request) => {
          await onSave(request);
          setEditing(false);
        }}
      />
    );
  }
  return (
    <header className="section-header border-b border-white/8 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold">{details.playlist.name}</h2>
          <p className="mt-1 text-xs text-white/35">
            {playlistTypeLabel(details.playlist.playlistType, t)} · {details.playlist.songCount} {t("library.songs")} · {formatDuration(details.playlist.totalDurationMs)}
          </p>
          {(details.playlist.groupName || details.playlist.purpose) && (
            <p className="mt-1 text-[11px] text-white/35">
              {details.playlist.groupName ?? t("playlists.noGroup")}
              {details.playlist.purpose ? ` / ${t(`playlistPurpose.${details.playlist.purpose}`)}` : ""}
            </p>
          )}
          {details.playlist.description && (
            <p className="mt-2 max-w-3xl text-sm text-white/45">{details.playlist.description}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {onOpenSession && (
            <button type="button" onClick={onOpenSession} className="toolbar-button">
              <Radio size={15} /> {t("playlists.playInSessionMode")}
            </button>
          )}
          <button
            type="button"
            draggable
            onDragStart={onExternalDrag}
            className="toolbar-button"
            title={t("playlists.dragCopyTooltip")}
          >
            <GripVertical size={15} /> {t("playlists.dragFiles")}
          </button>
          <button type="button" onClick={onCopy} className="toolbar-button">
            <FolderOpen size={15} /> {t("playlists.copyToFolderPrefix")} {selectedCount > 0 ? t("playlists.selection") : t("playlists.list")} {t("playlists.toFolder")}
          </button>
          {selectedCount > 0 && (
            <button type="button" onClick={onRemoveSelected} className="toolbar-button text-red-200/70">
              <Trash2 size={15} /> {t("common.remove")} {selectedCount}
            </button>
          )}
          <button type="button" onClick={() => void onExport("csv")} className="toolbar-button">
            <Download size={15} /> CSV
          </button>
          <button type="button" onClick={() => void onExport("json")} className="toolbar-button">JSON</button>
          <button type="button" onClick={() => setEditing(true)} className="toolbar-button">
            <Pencil size={15} /> {t("common.edit")}
          </button>
          <button type="button" onClick={onDelete} className="toolbar-button text-red-200/65">
            <Trash2 size={15} /> {t("common.delete")}
          </button>
        </div>
      </div>
    </header>
  );
}

function PlaylistEditor({
  title,
  playlist,
  groups,
  onCancel,
  onSave,
}: {
  title: string;
  playlist?: PlaylistSummary;
  groups: PlaylistGroup[];
  onCancel?: () => void;
  onSave: (request: PlaylistSaveRequest) => Promise<void>;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(playlist?.name ?? "");
  const [description, setDescription] = useState(playlist?.description ?? "");
  const [playlistType, setPlaylistType] = useState<PlaylistType>(
    playlist?.playlistType ?? "manual",
  );
  const [groupId, setGroupId] = useState(playlist?.groupId ? String(playlist.groupId) : "");
  const [purpose, setPurpose] = useState<PlaylistPurpose | "">(playlist?.purpose ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || null,
        playlistType,
        groupId: groupId ? Number(groupId) : null,
        purpose: purpose || null,
      });
    } catch (saveError) {
      setError(String(saveError));
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="section-header border-b border-white/8 p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-4 grid max-w-4xl gap-3 md:grid-cols-[1fr_220px]">
        <label className="text-xs text-white/45">
          {t("field.playlistName")}
          <input value={name} onChange={(event) => setName(event.target.value)} className="field mt-1.5" />
        </label>
        <label className="text-xs text-white/45">
          {t("field.playlistType")}
          <select value={playlistType} onChange={(event) => setPlaylistType(event.target.value as PlaylistType)} className="field mt-1.5">
            {PLAYLIST_TYPES.map((item) => <option key={item.value} value={item.value}>{playlistTypeLabel(item.value, t)}</option>)}
          </select>
        </label>
        <label className="text-xs text-white/45">
          {t("playlists.group")}
          <select value={groupId} onChange={(event) => setGroupId(event.target.value)} className="field mt-1.5">
            <option value="">{t("playlists.noGroup")}</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-white/45">
          {t("playlists.purpose")}
          <select value={purpose} onChange={(event) => setPurpose(event.target.value as PlaylistPurpose | "")} className="field mt-1.5">
            <option value="">{t("playlists.noPurpose")}</option>
            {PLAYLIST_PURPOSES.map((item) => (
              <option key={item} value={item}>
                {t(`playlistPurpose.${item}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-white/45 md:col-span-2">
          {t("field.comment")}
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} className="field mt-1.5 resize-y" />
        </label>
      </div>
      {error && <p className="mt-3 text-xs text-red-200">{error}</p>}
      <div className="mt-4 flex gap-2">
        <button type="button" disabled={saving || !name.trim()} onClick={() => void submit()} className="flex items-center gap-2 rounded-md bg-[#d9ff43] px-4 py-2 text-sm font-semibold text-[#101113] disabled:opacity-40">
          <Save size={15} /> {saving ? t("common.saving") : t("common.save")}
        </button>
        {onCancel && <button type="button" onClick={onCancel} className="toolbar-button">{t("common.cancel")}</button>}
      </div>
    </section>
  );
}

function PlaylistTable({
  songs,
  selectedIds,
  currentTrackId,
  visibleFields,
  onSelectionChange,
  onSelectAll,
  onPlay,
  onMove,
  onReorder,
  onRemove,
  onOpenTrack,
}: {
  songs: PlaylistSong[];
  selectedIds: Set<number>;
  currentTrackId: number | null;
  visibleFields: Set<FieldVisibilityField>;
  onSelectionChange: (id: number, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onPlay: (song: PlaylistSong) => void;
  onMove: (id: number, direction: "up" | "down") => void;
  onReorder: (trackIds: number[]) => void;
  onRemove: (id: number) => void;
  onOpenTrack: (section: "library" | "organization", trackId: number) => void;
}) {
  const { t } = useI18n();
  const allSelected = songs.length > 0 && songs.every((song) => selectedIds.has(song.id));
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dropId, setDropId] = useState<number | null>(null);
  const show = (field: FieldVisibilityField) => visibleFields.has(field);

  function dropOn(targetId: number) {
    if (draggedId === null || draggedId === targetId) {
      setDraggedId(null);
      setDropId(null);
      return;
    }
    const reordered = songs.map((song) => song.id);
    const sourceIndex = reordered.indexOf(draggedId);
    const targetIndex = reordered.indexOf(targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    setDraggedId(null);
    setDropId(null);
    onReorder(reordered);
  }
  if (songs.length === 0) {
    return (
      <div className="grid h-full min-h-64 place-items-center text-center text-sm text-white/30">
        {t("playlists.addSongsEmpty")}
      </div>
    );
  }
  return (
    <table className="w-full min-w-[1300px] border-collapse text-left text-sm">
      <thead className="card-surface sticky top-0 z-10 text-[10px] uppercase tracking-wider text-white/45 shadow-[0_4px_14px_rgba(0,0,0,0.1)]">
        <tr>
          <th className="border-b border-white/8 px-3 py-2.5"><input type="checkbox" checked={allSelected} onChange={(event) => onSelectAll(event.target.checked)} aria-label={t("playlists.selectWholeList")} className="accent-[#d9ff43]" /></th>
          <th className="border-b border-white/8 px-3 py-2.5">{t("field.playlistPosition")}</th>
          <th className="border-b border-white/8 px-3 py-2.5">{t("field.title")}</th>
          <th hidden={!show("artist")} className="border-b border-white/8 px-3 py-2.5">{t("field.artist")}</th>
          <th className="border-b border-white/8 px-3 py-2.5">{t("field.album")}</th>
          <th hidden={!show("rating")} className="border-b border-white/8 px-3 py-2.5">Rating</th>
          <th hidden={!show("status")} className="border-b border-white/8 px-3 py-2.5">{t("field.status")}</th>
          <th hidden={!show("project")} className="border-b border-white/8 px-3 py-2.5">{t("field.project")}</th>
          <th hidden={!show("tags")} className="border-b border-white/8 px-3 py-2.5">Tags</th>
          <th className="border-b border-white/8 px-3 py-2.5">{t("field.duration")}</th>
          <th hidden={!show("format")} className="border-b border-white/8 px-3 py-2.5">{t("field.format")}</th>
          <th className="border-b border-white/8 px-3 py-2.5">{t("playlists.actions")}</th>
        </tr>
      </thead>
      <tbody>
        {songs.map((song, index) => (
          <tr
            key={song.id}
            draggable
            onDragStart={(event) => {
              setDraggedId(song.id);
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", String(song.id));
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setDropId(song.id);
            }}
            onDragLeave={() => setDropId((current) => current === song.id ? null : current)}
            onDrop={(event) => {
              event.preventDefault();
              dropOn(song.id);
            }}
            onDragEnd={() => {
              setDraggedId(null);
              setDropId(null);
            }}
            onDoubleClick={() => onPlay(song)}
            className={`border-b border-white/[0.055] hover:bg-white/[0.055] ${
              currentTrackId === song.id
                ? "bg-[#d9ff43]/8 shadow-[inset_3px_0_0_#d9ff43]"
                : ""
            } ${draggedId === song.id ? "opacity-45" : ""} ${
              dropId === song.id && draggedId !== song.id
                ? "border-t-2 border-t-[#d9ff43]/70"
                : ""
            }`}
          >
            <td className="px-3 py-2"><input type="checkbox" checked={selectedIds.has(song.id)} onChange={(event) => onSelectionChange(song.id, event.target.checked)} aria-label={`${t("organization.selectSongAction")} ${song.title || song.fileName}`} className="accent-[#d9ff43]" /></td>
            <td className="px-3 py-2 text-white/45">
              <span className="flex cursor-grab items-center gap-2 active:cursor-grabbing">
                <GripVertical size={15} aria-hidden="true" />
                <span className="tabular-nums">{song.position}</span>
                <span className="sr-only">{t("playlists.drag")} {song.title || song.fileName}</span>
              </span>
            </td>
            <td className="max-w-60 truncate px-3 py-2 text-white/75">{song.title || song.fileName}</td>
            <td hidden={!show("artist")} className="max-w-44 truncate px-3 py-2 text-white/55">{song.artist || "—"}</td>
            <td className="max-w-44 truncate px-3 py-2 text-white/55">{song.album || "—"}</td>
            <td hidden={!show("rating")} className="px-3 py-2 text-white/60">{song.rating ?? "—"}</td>
            <td hidden={!show("status")} className="px-3 py-2 text-white/60">{t(`status.${song.status}`)}</td>
            <td hidden={!show("project")} className="max-w-40 truncate px-3 py-2 text-white/50">{song.projectName || "—"}</td>
            <td hidden={!show("tags")} className="max-w-52 truncate px-3 py-2 text-white/50">{song.tagNames || "—"}</td>
            <td className="px-3 py-2 tabular-nums text-white/45">{formatDuration(song.durationMs)}</td>
            <td hidden={!show("format")} className="px-3 py-2 text-white/45">{song.audioFormat.toUpperCase()}</td>
            <td className="px-3 py-2">
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => onPlay(song)} aria-label={`${t("common.play")} ${song.title || song.fileName}`} className="rounded p-1.5 text-[#d9ff43]/70 hover:bg-white/8"><Play size={14} /></button>
                <button type="button" disabled={index === 0} onClick={() => onMove(song.id, "up")} aria-label={t("playlists.moveUp")} className="rounded p-1.5 text-white/45 hover:bg-white/8 disabled:opacity-20"><ArrowUp size={14} /></button>
                <button type="button" disabled={index === songs.length - 1} onClick={() => onMove(song.id, "down")} aria-label={t("playlists.moveDown")} className="rounded p-1.5 text-white/45 hover:bg-white/8 disabled:opacity-20"><ArrowDown size={14} /></button>
                <button type="button" onClick={() => onOpenTrack("library", song.id)} aria-label={t("playlists.openSongInLibrary")} className="rounded p-1.5 text-white/45 hover:bg-white/8"><Library size={14} /></button>
                <button type="button" onClick={() => onOpenTrack("organization", song.id)} aria-label={t("playlists.openSongInOrganization")} className="rounded p-1.5 text-white/45 hover:bg-white/8"><Workflow size={14} /></button>
                <button type="button" onClick={() => onRemove(song.id)} aria-label={t("playlists.removeFromPlaylist")} className="rounded p-1.5 text-red-200/50 hover:bg-red-400/8"><Trash2 size={14} /></button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function toTrackSummary(song: PlaylistSong): TrackSummary {
  return {
    id: song.id,
    stableId: song.stableId,
    relativePath: null,
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

function safeFileName(name: string) {
  return name.replace(/[<>:"/\\|?*]/g, "_").trim() || "tagdeck-playlist";
}
