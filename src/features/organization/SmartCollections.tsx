import { FolderKanban, Sparkles, Tag } from "lucide-react";
import type { OrganizationOptions, SongStatus } from "../../types/track";
import { useI18n } from "../../i18n";

interface SmartCollectionsProps {
  options: OrganizationOptions;
  smartCollection: string | null;
  status: SongStatus | null;
  tagId: number | null;
  projectId: number | null;
  versionLabel: string | null;
  onSmartCollectionChange: (value: string | null) => void;
  onStatusChange: (value: SongStatus | null) => void;
  onTagChange: (value: number | null) => void;
  onProjectChange: (value: number | null) => void;
  onVersionChange: (value: string | null) => void;
}

export const STATUS_LABELS: Record<SongStatus, string> = {
  review: "Sin revisar",
  idea: "Idea",
  generating: "DAW Rescue",
  editing: "En proceso",
  selected: "Radio Ready",
  final: "Release Ready",
  published: "Release Ready",
  archived: "Archivada",
};

export const SONG_STATUSES: SongStatus[] = [
  "review",
  "idea",
  "editing",
  "generating",
  "selected",
  "final",
  "archived",
];

export function SmartCollections({
  options,
  smartCollection,
  status,
  tagId,
  projectId,
  versionLabel,
  onSmartCollectionChange,
  onStatusChange,
  onTagChange,
  onProjectChange,
  onVersionChange,
}: SmartCollectionsProps) {
  const { t } = useI18n();
  return (
    <aside className="panel-surface min-h-0 overflow-y-auto border-r border-white/8 p-3">
      <p className="px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">
        {t("organization.smartCollections")}
      </p>
      <div className="space-y-1">
        {options.smartCollections.map((collection) => (
          <button
            key={collection.id}
            type="button"
            onClick={() =>
              onSmartCollectionChange(
                smartCollection === collection.id ? null : collection.id,
              )
            }
            className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs ${
              smartCollection === collection.id
                ? "bg-[#d9ff43]/10 text-[#d9ff43]"
                : "text-white/55 hover:bg-white/5"
            }`}
          >
            <span className="flex items-center gap-2">
              <Sparkles size={13} />
              {smartCollectionLabel(collection.id, collection.name, t)}
            </span>
            <span className="text-[10px] opacity-60">{collection.count}</span>
          </button>
        ))}
      </div>

      <FilterSelect
        label={t("field.status")}
        icon={<Sparkles size={13} />}
        value={status ?? ""}
        onChange={(value) => onStatusChange((value || null) as SongStatus | null)}
        options={SONG_STATUSES.map((value) => ({
          value,
          label: t(`status.${value}`),
        }))}
      />
      <FilterSelect
        label={t("field.project")}
        icon={<FolderKanban size={13} />}
        value={projectId?.toString() ?? ""}
        onChange={(value) => onProjectChange(value ? Number(value) : null)}
        options={options.projects.map((project) => ({
          value: String(project.id),
          label: `${project.name} (${project.trackCount})`,
        }))}
      />
      <FilterSelect
        label={t("field.version")}
        icon={<Sparkles size={13} />}
        value={versionLabel ?? ""}
        onChange={(value) => onVersionChange(value || null)}
        options={options.versions.map((version) => ({
          value: version,
          label: version,
        }))}
      />
      <FilterSelect
        label={t("field.tags")}
        icon={<Tag size={13} />}
        value={tagId?.toString() ?? ""}
        onChange={(value) => onTagChange(value ? Number(value) : null)}
        options={options.tags.map((tag) => ({
          value: String(tag.id),
          label: `${tag.name} (${tag.usageCount})`,
        }))}
      />
    </aside>
  );
}

function FilterSelect({
  label,
  icon,
  value,
  options,
  onChange,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  const { t } = useI18n();
  return (
    <label className="mt-5 block px-2">
      <span className="mb-1.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
        {icon}
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-white/10 bg-[#1c1d20] px-2 py-2 text-xs text-white/70"
      >
        <option value="">{t("common.all")}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function smartCollectionLabel(
  id: string,
  fallback: string,
  t: (key: string) => string,
) {
  const keyById: Record<string, string> = {
    all: "library.wholeLibrary",
    active: "organization.activeWork",
    active_work: "organization.activeWork",
    needs_action: "organization.withNextAction",
    unreviewed: "status.review",
    untagged: "organization.noTags",
    no_project: "organization.noProject",
    no_rating: "organization.noRating",
    unrated: "organization.noRating",
    tag_potential: "smartCollection.potential",
    tag_strong_idea: "smartCollection.strongIdeas",
    tag_maybe_later: "smartCollection.maybeLater",
    tag_rejects_i_like: "smartCollection.rejectsILike",
    tag_custom_model_seed: "smartCollection.customModelSeeds",
    tag_release_candidate: "smartCollection.releaseCandidates",
    tag_final_version: "smartCollection.finalVersions",
    needs_daw_work: "smartCollection.needsDawWork",
    tag_needs_stems: "smartCollection.needsStems",
    tag_needs_mix: "smartCollection.needsMix",
    tag_needs_master: "smartCollection.needsMaster",
    needs_metadata: "smartCollection.needsMetadata",
    tag_useful_fragment: "smartCollection.usefulFragments",
    tag_core_seed: "smartCollection.coreSeeds",
    tag_reference_only: "smartCollection.referenceOnly",
    archived: "field.archived",
  };
  return keyById[id] ? t(keyById[id]) : fallback;
}
