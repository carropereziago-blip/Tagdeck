import { BarChart3, Compass } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../lib/tauri";
import type { ExplorerCriterion, OrganizationOptions } from "../../types/track";
import { useI18n } from "../../i18n";

export function DashboardView({
  onStartReviewing,
}: {
  onStartReviewing: (criterion?: ExplorerCriterion) => void;
}) {
  const { t } = useI18n();
  const [options, setOptions] = useState<OrganizationOptions | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api
      .getOrganizationOptions()
      .then(setOptions)
      .catch((loadError) => setError(String(loadError)));
  }, []);

  return (
    <div className="app-surface h-full overflow-y-auto">
      <header className="section-header border-b border-white/8 px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-semibold">
              <BarChart3 size={22} /> {t("nav.dashboard")}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/45">
              {t("dashboard.subtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onStartReviewing("unreviewed")}
            className="flex items-center gap-2 rounded-md bg-[#d9ff43] px-4 py-2.5 text-sm font-semibold text-[#101113]"
          >
            <Compass size={16} /> {t("dashboard.startReviewing")}
          </button>
        </div>
      </header>

      <main className="p-6">
        {error && (
          <p className="mb-4 rounded-lg border border-red-400/20 bg-red-400/8 px-4 py-3 text-xs text-red-200">
            {error}
          </p>
        )}
        <section className="card-surface rounded-xl border border-white/8 p-5">
          <h3 className="font-semibold">{t("dashboard.progress")}</h3>
          <DashboardMetrics options={options} onStartReviewing={onStartReviewing} />
        </section>
      </main>
    </div>
  );
}

function DashboardMetrics({
  options,
  onStartReviewing,
}: {
  options: OrganizationOptions | null;
  onStartReviewing: (criterion?: ExplorerCriterion) => void;
}) {
  const { t } = useI18n();
  const count = (id: string) =>
    options?.smartCollections.find((collection) => collection.id === id)?.count ?? 0;
  const metrics: Array<{
    id: string;
    label: string;
    value: number;
    criterion?: ExplorerCriterion;
  }> = [
    { id: "total", label: t("dashboard.totalSongs"), value: count("all"), criterion: "all" },
    { id: "unreviewed", label: t("dashboard.unreviewed"), value: count("unreviewed"), criterion: "unreviewed" },
    { id: "radio_ready", label: t("field.radioReady"), value: count("radio_ready"), criterion: "radio_ready" },
    { id: "release_ready", label: t("field.releaseReady"), value: count("release_ready"), criterion: "release_ready" },
    { id: "daw_rescue", label: t("field.dawRescue"), value: count("daw_rescue"), criterion: "daw_rescue" },
    { id: "archived", label: t("field.archived"), value: count("archived"), criterion: "archived" },
    { id: "needs_action", label: t("organization.withNextAction"), value: count("needs_action"), criterion: "needs_action" },
    { id: "unrated", label: t("organization.noRating"), value: count("unrated"), criterion: "unrated" },
    { id: "no_project", label: t("organization.noProject"), value: count("no_project"), criterion: "no_project" },
  ];

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {metrics.map((metric) => (
        <button
          key={metric.id}
          type="button"
          onClick={() => metric.criterion && onStartReviewing(metric.criterion)}
          className="rounded-xl border border-white/8 bg-[var(--card-bg)] px-4 py-4 text-left hover:border-[#d9ff43]/25 hover:bg-[#d9ff43]/5"
        >
          <span className="block text-[10px] uppercase tracking-wide text-white/30">
            {metric.label}
          </span>
          <span className="mt-2 block text-3xl font-semibold text-white/80">
            {metric.value.toLocaleString()}
          </span>
        </button>
      ))}
    </div>
  );
}
