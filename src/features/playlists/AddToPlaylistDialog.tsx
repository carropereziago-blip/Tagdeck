import { ListMusic, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../lib/tauri";
import { useI18n } from "../../i18n";
import type {
  PlaylistSaveRequest,
  PlaylistSummary,
  PlaylistType,
} from "../../types/track";
import { PLAYLIST_TYPES, playlistTypeLabel } from "./playlistOptions";

interface AddToPlaylistDialogProps {
  trackIds: number[];
  title?: string;
  createOnly?: boolean;
  onClose: () => void;
  onComplete: (message: string) => void;
}

export function AddToPlaylistDialog({
  trackIds,
  title,
  createOnly = false,
  onClose,
  onComplete,
}: AddToPlaylistDialogProps) {
  const { t } = useI18n();
  const dialogTitle = title ?? t("library.addToPlaylist");
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [playlistId, setPlaylistId] = useState("");
  const [creating, setCreating] = useState(createOnly);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [playlistType, setPlaylistType] = useState<PlaylistType>("manual");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api
      .getPlaylists()
      .then((items) => {
        setPlaylists(items);
        if (items[0]) setPlaylistId(String(items[0].id));
        if (items.length === 0) setCreating(true);
      })
      .catch((loadError) => setError(String(loadError)));
  }, []);

  async function submit() {
    if (trackIds.length === 0) {
      setError(t("playlists.noSongsToAdd"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let targetId = Number(playlistId);
      let targetName = playlists.find((item) => item.id === targetId)?.name ?? "";
      if (creating) {
        const request: PlaylistSaveRequest = {
          name: name.trim(),
          description: description.trim() || null,
          playlistType,
        };
        const created = await api.createPlaylist(request);
        targetId = created.id;
        targetName = created.name;
      }
      if (!targetId) throw new Error(t("playlists.selectOrCreatePlaylist"));
      const result = await api.addTracksToPlaylist(targetId, trackIds);
      onComplete(
        `${result.changed} ${t("common.of")} ${result.requested} ${t("playlists.songsAddedTo")} "${targetName}".`,
      );
      onClose();
    } catch (saveError) {
      setError(String(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={dialogTitle}
        className="w-full max-w-lg rounded-xl border border-white/10 bg-[#18191c] shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 font-semibold">
              <ListMusic size={18} /> {dialogTitle}
            </h2>
            <p className="mt-1 text-xs text-white/35">
              {trackIds.length} {trackIds.length === 1 ? t("library.song") : t("library.songs")}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label={t("common.close")} className="p-2 text-white/45">
            <X size={18} />
          </button>
        </header>

        <div className="space-y-4 p-5">
          {!createOnly && playlists.length > 0 && (
            <div className="flex gap-2 rounded-lg bg-white/[0.035] p-1">
              <button
                type="button"
                onClick={() => setCreating(false)}
                className={`flex-1 rounded-md px-3 py-2 text-sm ${!creating ? "bg-white/10 text-white/80" : "text-white/40"}`}
              >
                {t("playlists.existingPlaylist")}
              </button>
              <button
                type="button"
                onClick={() => setCreating(true)}
                className={`flex flex-1 items-center justify-center gap-1 rounded-md px-3 py-2 text-sm ${creating ? "bg-white/10 text-white/80" : "text-white/40"}`}
              >
                <Plus size={14} /> {t("playlists.newPlaylist")}
              </button>
            </div>
          )}

          {creating ? (
            <>
              <label className="block text-xs text-white/45">
                {t("field.playlistName")}
                <input
                  autoFocus
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="field mt-1.5"
                  placeholder="Mejores Suno"
                />
              </label>
              <label className="block text-xs text-white/45">
                {t("field.playlistType")}
                <select
                  value={playlistType}
                  onChange={(event) => setPlaylistType(event.target.value as PlaylistType)}
                  className="field mt-1.5"
                >
                  {PLAYLIST_TYPES.map((item) => (
                    <option key={item.value} value={item.value}>{playlistTypeLabel(item.value, t)}</option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-white/45">
                {t("field.comment")}
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={3}
                  className="field mt-1.5 resize-y"
                />
              </label>
            </>
          ) : (
            <label className="block text-xs text-white/45">
              {t("field.playlistName")}
              <select
                value={playlistId}
                onChange={(event) => setPlaylistId(event.target.value)}
                className="field mt-1.5"
              >
                {playlists.map((playlist) => (
                  <option key={playlist.id} value={playlist.id}>
                    {playlist.name} ({playlist.songCount})
                  </option>
                ))}
              </select>
            </label>
          )}

          <p className="text-[11px] text-sky-200/45">
            {t("playlists.help")}
          </p>
          {error && <p className="rounded-md border border-red-400/20 bg-red-400/8 px-3 py-2 text-xs text-red-200">{error}</p>}
        </div>

        <footer className="flex justify-end gap-2 border-t border-white/8 px-5 py-4">
          <button type="button" onClick={onClose} className="toolbar-button">{t("common.cancel")}</button>
          <button
            type="button"
            disabled={saving || (creating && !name.trim())}
            onClick={() => void submit()}
            className="rounded-md bg-[#d9ff43] px-4 py-2 text-sm font-semibold text-[#101113] disabled:opacity-40"
          >
            {saving ? t("common.saving") : creating ? t("playlists.createAndAdd") : t("common.add")}
          </button>
        </footer>
      </section>
    </div>
  );
}
