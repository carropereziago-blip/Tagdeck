import { Compass, FolderSearch, PlayCircle, X } from "lucide-react";
import { useI18n } from "../i18n";

export function OnboardingDialog({
  onClose,
  onStartReviewing,
  onScanFolder,
  onOpenDemo,
}: {
  onClose: () => void;
  onStartReviewing: () => void;
  onScanFolder: () => void;
  onOpenDemo: () => void;
}) {
  const { t } = useI18n();
  const steps = [
    t("onboarding.stepScan"),
    t("onboarding.stepReview"),
    t("onboarding.stepRate"),
    t("onboarding.stepPlaylists"),
    t("onboarding.stepExport"),
  ];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/68 p-5">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={t("onboarding.title")}
        className="card-surface w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/8 px-6 py-5">
          <div>
            <p className="brand-kicker text-[10px] font-semibold uppercase tracking-[0.22em] text-[#d9ff43]">
              Soundbender TagDeck
            </p>
            <h2 className="mt-2 text-2xl font-semibold">{t("onboarding.title")}</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/45">
              {t("onboarding.subtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="rounded-md p-2 text-white/45 hover:bg-white/8 hover:text-white/75"
          >
            <X size={18} />
          </button>
        </header>

        <div className="px-6 py-5">
          <ol className="grid gap-2 text-sm text-white/70">
            {steps.map((step, index) => (
              <li
                key={step}
                className="flex items-center gap-3 rounded-lg border border-white/8 bg-white/[0.025] px-3 py-2.5"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#d9ff43]/12 text-xs font-semibold text-[#d9ff43]">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>

          <div className="mt-6 grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={onScanFolder}
              className="flex items-center justify-center gap-2 rounded-md bg-[#d9ff43] px-4 py-3 text-sm font-semibold text-[#101113]"
            >
              <FolderSearch size={16} /> {t("onboarding.scanFolder")}
            </button>
            <button
              type="button"
              onClick={onStartReviewing}
              className="flex items-center justify-center gap-2 rounded-md border border-[#d9ff43]/30 px-4 py-3 text-sm font-semibold text-[#d9ff43] hover:bg-[#d9ff43]/8"
            >
              <Compass size={16} /> {t("onboarding.startReviewing")}
            </button>
            <button
              type="button"
              onClick={onOpenDemo}
              className="flex items-center justify-center gap-2 rounded-md border border-white/10 px-4 py-3 text-sm text-white/65 hover:bg-white/6"
            >
              <PlayCircle size={16} /> {t("onboarding.openDemo")}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
