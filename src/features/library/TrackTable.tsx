import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type Row,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown, GripVertical } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type UIEvent } from "react";
import { formatDuration } from "../../lib/format";
import { useI18n } from "../../i18n";
import { formatSystemValueList } from "../../i18n/systemLabels";
import type {
  SortDirection,
  TrackSortField,
  TrackSummary,
} from "../../types/track";
import {
  DEFAULT_LIBRARY_COLUMNS,
  type LibraryColumn,
} from "../settings/settings";

interface TrackTableProps {
  tracks: TrackSummary[];
  selectedId: number | null;
  selectedIds: Set<number>;
  sortBy: TrackSortField;
  sortDirection: SortDirection;
  loading: boolean;
  onSort: (field: TrackSortField) => void;
  onSelect: (track: TrackSummary) => void;
  onPlay: (track: TrackSummary) => void;
  onExternalDrag: (track: TrackSummary) => void;
  onRatingChange: (id: number, rating: number | null) => Promise<void>;
  onSelectionChange: (
    id: number,
    selected: boolean,
    options?: { shiftKey?: boolean },
  ) => void;
  onSelectAll: (selected: boolean) => void;
  visibleColumns?: LibraryColumn[];
  doubleClickPlays?: boolean;
}

const columnHelper = createColumnHelper<TrackSummary>();
const ROW_HEIGHT = 44;
const DEFAULT_VIEWPORT_HEIGHT = 640;
const OVERSCAN_ROWS = 8;

export const TrackTable = memo(function TrackTable({
  tracks,
  selectedId,
  selectedIds,
  sortBy,
  sortDirection,
  loading,
  onSort,
  onSelect,
  onPlay,
  onExternalDrag,
  onRatingChange,
  onSelectionChange,
  onSelectAll,
  visibleColumns = DEFAULT_LIBRARY_COLUMNS,
  doubleClickPlays = true,
}: TrackTableProps) {
  const { t, language } = useI18n();
  const EMPTY_VALUE = "—";
  const allSelected =
    tracks.length > 0 && tracks.every((track) => selectedIds.has(track.id));
  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "drag",
        header: "",
        cell: () => (
          <GripVertical
            size={15}
            className="text-white/25"
            aria-label={t("library.dragFileOutside")}
          />
        ),
      }),
      columnHelper.display({
        id: "selection",
        header: () => (
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(event) => onSelectAll(event.target.checked)}
            aria-label={t("organization.selectAllVisible")}
            className="accent-[#d9ff43]"
          />
        ),
        cell: (info) => (
          <input
            type="checkbox"
            checked={selectedIds.has(info.row.original.id)}
            onClick={(event) => {
              event.stopPropagation();
              onSelectionChange(info.row.original.id, !selectedIds.has(info.row.original.id), {
                shiftKey: event.shiftKey,
              });
            }}
            onChange={() => undefined}
            aria-label={`${t("organization.selectSongAction")} ${
              info.row.original.title ?? info.row.original.fileName
            }`}
            className="accent-[#d9ff43]"
          />
        ),
      }),
      columnHelper.accessor("trackNumber", {
        header: t("field.trackNumber"),
        cell: (info) => info.getValue() ?? EMPTY_VALUE,
        meta: { sortField: "trackNumber" satisfies TrackSortField },
      }),
      columnHelper.accessor("title", {
        header: t("field.title"),
        cell: (info) => info.getValue() || info.row.original.fileName,
        meta: { sortField: "title" satisfies TrackSortField },
      }),
      columnHelper.accessor("artist", {
        header: t("field.artist"),
        cell: (info) => info.getValue() || EMPTY_VALUE,
        meta: { sortField: "artist" satisfies TrackSortField },
      }),
      columnHelper.accessor("album", {
        header: t("field.album"),
        cell: (info) => info.getValue() || EMPTY_VALUE,
        meta: { sortField: "album" satisfies TrackSortField },
      }),
      columnHelper.accessor("albumArtist", {
        header: t("field.albumArtist"),
        cell: (info) => info.getValue() || EMPTY_VALUE,
        meta: { sortField: "albumArtist" satisfies TrackSortField },
      }),
      columnHelper.accessor("genre", {
        header: t("field.genre"),
        cell: (info) => info.getValue() || EMPTY_VALUE,
        meta: { sortField: "genre" satisfies TrackSortField },
      }),
      columnHelper.accessor("status", {
        header: t("field.status"),
        cell: (info) => t(`status.${info.getValue()}`),
        meta: { sortField: "status" satisfies TrackSortField },
      }),
      columnHelper.accessor("projectName", {
        header: t("field.project"),
        cell: (info) => info.getValue() || EMPTY_VALUE,
        meta: { sortField: "project" satisfies TrackSortField },
      }),
      columnHelper.accessor("versionLabel", {
        header: t("field.version"),
        cell: (info) => formatSystemValueList(language, "mood", info.getValue()) || EMPTY_VALUE,
        meta: { sortField: "version" satisfies TrackSortField },
      }),
      columnHelper.accessor("tagNames", {
        header: "Tags",
        cell: (info) => info.getValue() || EMPTY_VALUE,
        meta: { sortField: "tags" satisfies TrackSortField },
      }),
      columnHelper.accessor("mood", {
        header: "Mood",
        cell: (info) => info.getValue() || EMPTY_VALUE,
        meta: { sortField: "mood" satisfies TrackSortField },
      }),
      columnHelper.accessor("year", {
        header: t("field.year"),
        cell: (info) => info.getValue() ?? EMPTY_VALUE,
        meta: { sortField: "year" satisfies TrackSortField },
      }),
      columnHelper.accessor("audioFormat", {
        header: t("field.format"),
        meta: { sortField: "audioFormat" satisfies TrackSortField },
      }),
      columnHelper.accessor("durationMs", {
        header: t("field.duration"),
        cell: (info) => formatDuration(info.getValue()),
        meta: { sortField: "durationMs" satisfies TrackSortField },
      }),
      columnHelper.accessor("bpm", {
        header: "BPM",
        cell: (info) => info.getValue() ?? EMPTY_VALUE,
        meta: { sortField: "bpm" satisfies TrackSortField },
      }),
      columnHelper.accessor("musicalKey", {
        header: t("field.musicalKey"),
        cell: (info) => info.getValue() || EMPTY_VALUE,
        meta: { sortField: "musicalKey" satisfies TrackSortField },
      }),
      columnHelper.accessor("playCount", {
        header: t("field.playCount"),
        cell: (info) => info.getValue(),
        meta: { sortField: "playCount" satisfies TrackSortField },
      }),
      columnHelper.accessor("nextAction", {
        header: t("field.nextAction"),
        cell: (info) => info.getValue() || EMPTY_VALUE,
        meta: { sortField: "nextAction" satisfies TrackSortField },
      }),
      columnHelper.accessor(
        (track) => track.lastReviewedAt ?? track.reviewedAt,
        {
          id: "reviewedAt",
          header: t("field.reviewedAt"),
          cell: (info) => info.getValue() || EMPTY_VALUE,
          meta: { sortField: "reviewedAt" satisfies TrackSortField },
        },
      ),
      columnHelper.accessor("intendedUse", {
        header: t("field.intendedUse"),
        cell: (info) => formatSystemValueList(language, "intendedUse", info.getValue()) || EMPTY_VALUE,
        meta: { sortField: "intendedUse" satisfies TrackSortField },
      }),
      columnHelper.accessor("rating", {
        header: t("field.rating"),
        meta: { sortField: "rating" satisfies TrackSortField },
        cell: (info) => (
          <select
            value={info.getValue() ?? ""}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => {
              const rating = event.target.value ? Number(event.target.value) : null;
              void onRatingChange(info.row.original.id, rating);
            }}
            aria-label={`${t("field.rating")} ${info.row.original.title ?? info.row.original.fileName}`}
            className="w-16 rounded border border-white/10 bg-[#202226] px-1.5 py-1 text-xs text-white"
          >
            <option value="">{EMPTY_VALUE}</option>
            {Array.from({ length: 10 }, (_, index) => index + 1).map((rating) => (
              <option key={rating} value={rating}>
                {rating}
              </option>
            ))}
          </select>
        ),
      }),
      columnHelper.accessor("filePath", {
        header: t("field.path"),
        cell: (info) => info.getValue(),
        meta: { sortField: "path" satisfies TrackSortField },
      }),
    ],
    [
      allSelected,
      onRatingChange,
      onSelectAll,
      onSelectionChange,
      selectedIds,
      t,
      language,
    ],
  );

  const table = useReactTable({
    data: tracks,
    columns,
    getCoreRowModel: getCoreRowModel(),
    state: {
      columnVisibility: {
        trackNumber: visibleColumns.includes("trackNumber"),
        title: visibleColumns.includes("title"),
        artist: visibleColumns.includes("artist"),
        album: visibleColumns.includes("album"),
        albumArtist: visibleColumns.includes("albumArtist"),
        genre: visibleColumns.includes("genre"),
        rating: visibleColumns.includes("rating"),
        status: visibleColumns.includes("status"),
        projectName: visibleColumns.includes("project"),
        versionLabel: visibleColumns.includes("version"),
        tagNames: visibleColumns.includes("tags"),
        mood: visibleColumns.includes("mood"),
        durationMs: visibleColumns.includes("duration"),
        audioFormat: visibleColumns.includes("format"),
        bpm: visibleColumns.includes("bpm"),
        musicalKey: visibleColumns.includes("musicalKey"),
        playCount: visibleColumns.includes("playCount"),
        nextAction: visibleColumns.includes("nextAction"),
        reviewedAt: visibleColumns.includes("reviewedAt"),
        intendedUse: visibleColumns.includes("intendedUse"),
        filePath: visibleColumns.includes("path"),
      },
    },
  });
  const rows = table.getRowModel().rows;
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(DEFAULT_VIEWPORT_HEIGHT);
  const visibleColumnCount = table.getVisibleFlatColumns().length;

  const handleScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const measure = () => {
      setViewportHeight(container.clientHeight || DEFAULT_VIEWPORT_HEIGHT);
    };
    measure();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollTop = 0;
    setScrollTop(0);
  }, [sortBy, sortDirection, tracks.length]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || selectedId === null) return;
    const selectedIndex = rows.findIndex((row) => row.original.id === selectedId);
    if (selectedIndex < 0) return;

    const rowTop = selectedIndex * ROW_HEIGHT;
    const rowBottom = rowTop + ROW_HEIGHT;
    const visibleTop = container.scrollTop;
    const visibleBottom = visibleTop + container.clientHeight;
    if (rowTop < visibleTop) {
      container.scrollTop = rowTop;
      setScrollTop(rowTop);
    } else if (rowBottom > visibleBottom) {
      const nextScrollTop = Math.max(0, rowBottom - container.clientHeight);
      container.scrollTop = nextScrollTop;
      setScrollTop(nextScrollTop);
    }
  }, [rows, selectedId]);

  const startIndex = Math.max(
    0,
    Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN_ROWS,
  );
  const visibleCount =
    Math.ceil(viewportHeight / ROW_HEIGHT) + OVERSCAN_ROWS * 2;
  const endIndex = Math.min(rows.length, startIndex + visibleCount);
  const visibleRows = rows.slice(startIndex, endIndex);
  const topPadding = startIndex * ROW_HEIGHT;
  const bottomPadding = Math.max(0, (rows.length - endIndex) * ROW_HEIGHT);

  if (!loading && tracks.length === 0) {
    return (
      <div className="grid h-full min-h-60 place-items-center px-6 text-center">
        <div>
          <p className="font-medium text-white/60">{t("library.emptyStateTitle")}</p>
          <p className="mt-1 text-sm text-white/30">
            {t("library.emptyStateHelp")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className="h-full overflow-auto"
      data-testid="library-virtualized-table"
    >
      <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
        <thead className="card-surface sticky top-0 z-10 text-[11px] uppercase tracking-wider text-white/45 shadow-[0_4px_14px_rgba(0,0,0,0.1)]">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const field = (
                  header.column.columnDef.meta as { sortField?: TrackSortField } | undefined
                )?.sortField;
                return (
                  <th key={header.id} className="border-b border-white/8 px-3 py-2.5 font-medium">
                    {field ? (
                      <button
                        type="button"
                        onClick={() => onSort(field)}
                        className="flex items-center gap-1.5 hover:text-white/70"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sortBy === field ? (
                          sortDirection === "asc" ? (
                            <ArrowUp size={12} />
                          ) : (
                            <ArrowDown size={12} />
                          )
                        ) : (
                          <ChevronsUpDown size={12} className="opacity-35" />
                        )}
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody className={loading ? "opacity-45" : ""}>
          {topPadding > 0 && (
            <tr aria-hidden="true">
              <td colSpan={visibleColumnCount} className="border-0 p-0" style={{ height: topPadding }} />
            </tr>
          )}
          {visibleRows.map((row) => (
            <VirtualTrackRow
              key={row.id}
              row={row}
              selected={selectedId === row.original.id}
              doubleClickPlays={doubleClickPlays}
              onExternalDrag={onExternalDrag}
              onPlay={onPlay}
              onSelect={onSelect}
              onSelectionChange={onSelectionChange}
            />
          ))}
          {bottomPadding > 0 && (
            <tr aria-hidden="true">
              <td colSpan={visibleColumnCount} className="border-0 p-0" style={{ height: bottomPadding }} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
});

interface VirtualTrackRowProps {
  row: Row<TrackSummary>;
  selected: boolean;
  doubleClickPlays: boolean;
  onSelect: (track: TrackSummary) => void;
  onPlay: (track: TrackSummary) => void;
  onExternalDrag: (track: TrackSummary) => void;
  onSelectionChange: (
    id: number,
    selected: boolean,
    options?: { shiftKey?: boolean },
  ) => void;
}

const VirtualTrackRow = memo(function VirtualTrackRow({
  row,
  selected,
  doubleClickPlays,
  onSelect,
  onPlay,
  onExternalDrag,
  onSelectionChange,
}: VirtualTrackRowProps) {
  return (
    <tr
      tabIndex={0}
      draggable
      aria-current={selected ? "true" : undefined}
      onDragStart={(event) => {
        if ((event.target as HTMLElement).closest("input, select, button")) {
          event.preventDefault();
          return;
        }
        event.preventDefault();
        onExternalDrag(row.original);
      }}
      onClick={(event) => {
        if (event.shiftKey) {
          onSelectionChange(row.original.id, true, { shiftKey: true });
          return;
        }
        onSelect(row.original);
      }}
      onFocus={(event) => {
        if ((event.target as HTMLElement).closest("input, select, button")) {
          return;
        }
        onSelect(row.original);
      }}
      onDoubleClick={() => {
        if (doubleClickPlays) onPlay(row.original);
      }}
      className={`cursor-grab border-b border-white/[0.055] outline-none transition hover:bg-white/[0.055] focus-visible:bg-white/[0.07] active:cursor-grabbing ${
        selected ? "bg-[#d9ff43]/12 shadow-[inset_3px_0_0_#d9ff43]" : ""
      }`}
      style={{ height: ROW_HEIGHT }}
    >
      {row.getVisibleCells().map((cell) => (
        <td
          key={cell.id}
          className={`max-w-64 truncate px-3 py-2.5 ${
            row.original.metadataReadError ? "text-amber-200/70" : "text-white/70"
          }`}
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </td>
      ))}
    </tr>
  );
});
