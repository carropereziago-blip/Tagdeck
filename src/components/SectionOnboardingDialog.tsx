import { Compass, FolderSearch, X } from "lucide-react";
import { useState } from "react";
import { useI18n } from "../i18n";
import type { SectionOnboardingId } from "../features/settings/settings";

const BULLET_COUNT = 4;

export function SectionOnboardingDialog({
  section,
  onClose,
  onPrimaryAction,
}: {
  section: SectionOnboardingId;
  onClose: (hidePermanently: boolean) => void;
  onPrimaryAction?: () => void;
}) {
  const { t } = useI18n();
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const prefix = `sectionOnboarding.${section}`;
  const actionLabel = t(`${prefix}.action`);
  const hasAction = actionLabel !== `${prefix}.action` && onPrimaryAction;

  function close(hidePermanently: boolean) {
    onClose(hidePermanently);
  }

  function runPrimaryAction() {
    onPrimaryAction?.();
    close(true);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-5">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={t(`${prefix}.title`)}
        className="card-surface w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/8 px-6 py-5">
          <div>
            <p className="brand-kicker text-[10px] font-semibold uppercase tracking-[0.22em] text-[#d9ff43]">
              {t("sectionOnboarding.kicker")}
            </p>
            <h2 className="mt-2 text-2xl font-semibold">{t(`${prefix}.title`)}</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/45">
              {t(`${prefix}.body`)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => close(dontShowAgain)}
            aria-label={t("common.close")}
            className="rounded-md p-2 text-white/45 hover:bg-white/8 hover:text-white/75"
          >
            <X size={18} />
          </button>
        </header>

        <div className="px-6 py-5">
          <ul className="grid gap-2 text-sm text-white/70">
            {Array.from({ length: BULLET_COUNT }, (_, index) => {
              const value = t(`${prefix}.bullet${index + 1}`);
              return value === `${prefix}.bullet${index + 1}` ? null : (
                <li
                  key={value}
                  className="rounded-lg border border-white/8 bg-white/[0.025] px-3 py-2.5"
                >
                  {value}
                </li>
              );
            })}
          </ul>

          <label className="mt-5 flex items-center gap-2 text-xs text-white/45">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(event) => setDontShowAgain(event.target.checked)}
              className="accent-[#d9ff43]"
            />
            {t("sectionOnboarding.dontShowAgain")}
          </label>

          <div className="mt-5 flex flex-wrap justify-end gap-2">
            {hasAction && (
              <button
                type="button"
                onClick={runPrimaryAction}
                className="flex items-center justify-center gap-2 rounded-md border border-[#d9ff43]/30 px-4 py-2.5 text-sm font-semibold text-[#d9ff43] hover:bg-[#d9ff43]/8"
              >
                {section === "library" ? <FolderSearch size={16} /> : <Compass size={16} />}
                {actionLabel}
              </button>
            )}
            <button
              type="button"
              onClick={() => close(true)}
              className="rounded-md bg-[#d9ff43] px-4 py-2.5 text-sm font-semibold text-[#101113]"
            >
              {t("sectionOnboarding.gotIt")}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
