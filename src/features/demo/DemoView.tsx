import { Archive, Compass, Disc3, Download, ListMusic, Radio, Star } from "lucide-react";
import type { ReactNode } from "react";
import type { MainSection } from "../../components/AppLayout";
import { useI18n } from "../../i18n";

const DEMO_TRACKS = [
  { title: "Neon Machine Heart", statusKey: "status.review", rating: null, mood: "Cosmic", tag: "unreviewed" },
  { title: "FINAL - Midnight River", statusKey: "status.final", rating: 10, mood: "Triumphant", tag: "Final Version" },
  { title: "DAW Rescue - Vocal Fix", statusKey: "status.generating", rating: 5, mood: "Emotional", tag: "DAW Rescue" },
  { title: "Rejects I Like - Strange Hook", statusKey: "status.idea", rating: 6, mood: "Hypnotic", tag: "Rejects I Like" },
  { title: "Release Candidate 01", statusKey: "status.final", rating: 9, mood: "Cinematic", tag: "Release Candidate" },
  { title: "Lyrics Check - Love River", statusKey: "status.editing", rating: 7, mood: "Romantic", tag: "lyrics" },
  { title: "Stem Mock - Drums/Bass/Vox", statusKey: "status.editing", rating: 7, mood: "Energetic", tag: "stems" },
  { title: "Cover Video Mock - Solar Gate", statusKey: "status.selected", rating: 8, mood: "Atmospheric", tag: "cover-video" },
  { title: "Archive Test Sketch", statusKey: "status.archived", rating: 2, mood: "Dark", tag: "archive" },
  { title: "Custom Model Seed - Velvet Chorus", statusKey: "status.idea", rating: 9, mood: "Deep", tag: "Custom Model Seed" },
];

export function DemoView({
  onNavigate,
  onStartReviewing,
}: {
  onNavigate: (section: MainSection) => void;
  onStartReviewing: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="app-surface h-full overflow-y-auto">
      <header className="section-header border-b border-white/8 px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="brand-kicker text-[10px] font-semibold uppercase tracking-[0.22em] text-[#d9ff43]">
              {t("demo.kicker")}
            </p>
            <h2 className="mt-2 flex items-center gap-2 text-2xl font-semibold">
              <Disc3 size={22} /> {t("demo.title")}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/45">
              {t("demo.subtitle")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onStartReviewing} className="rounded-md bg-[#d9ff43] px-4 py-2.5 text-sm font-semibold text-[#101113]">
              {t("onboarding.startReviewing")}
            </button>
            <button type="button" onClick={() => onNavigate("library")} className="toolbar-button">
              {t("nav.library")}
            </button>
          </div>
        </div>
      </header>

      <main className="grid gap-5 p-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
        <section className="card-surface rounded-xl border border-white/8 p-5">
          <h3 className="font-semibold">{t("demo.fakeLibrary")}</h3>
          <p className="mt-1 text-xs text-white/35">{t("demo.fakeLibraryHelp")}</p>
          <div className="mt-4 grid gap-2">
            {DEMO_TRACKS.map((track) => (
              <article key={track.title} className="grid gap-3 rounded-lg border border-white/8 bg-white/[0.025] p-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <div className="min-w-0">
                  <h4 className="truncate text-sm font-medium text-white/75">{track.title}</h4>
                  <p className="mt-1 text-xs text-white/35">
                    Soundbender Demo · {track.mood} · #{track.tag}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="rounded bg-white/6 px-2 py-1 text-white/50">
                    {t(track.statusKey)}
                  </span>
                  <span className="rounded bg-[#d9ff43]/10 px-2 py-1 text-[#d9ff43]/75">
                    {track.rating ? `${track.rating}/10` : t("organization.noRating")}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className="grid content-start gap-3">
          <DemoStep icon={<Compass size={18} />} title={t("demo.flowReview")} text={t("demo.flowReviewText")} />
          <DemoStep icon={<Star size={18} />} title={t("demo.flowRate")} text={t("demo.flowRateText")} />
          <DemoStep icon={<Radio size={18} />} title={t("demo.flowRadio")} text={t("demo.flowRadioText")} />
          <DemoStep icon={<ListMusic size={18} />} title={t("demo.flowPlaylists")} text={t("demo.flowPlaylistsText")} />
          <DemoStep icon={<Download size={18} />} title={t("demo.flowPacks")} text={t("demo.flowPacksText")} />
          <DemoStep icon={<Archive size={18} />} title={t("demo.noPersistence")} text={t("demo.noPersistenceText")} />
        </aside>
      </main>
    </div>
  );
}

function DemoStep({
  icon,
  title,
  text,
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <article className="card-surface rounded-xl border border-white/8 p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-white/75">
        <span className="text-[#d9ff43]">{icon}</span>
        {title}
      </h3>
      <p className="mt-2 text-xs leading-relaxed text-white/38">{text}</p>
    </article>
  );
}
