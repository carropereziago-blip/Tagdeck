import { Minus, RotateCcw, Plus } from "lucide-react";
import { formatPanelZoom, type PanelZoomAction } from "../lib/panelZoom";
import { useI18n } from "../i18n";

export function PanelZoomControls({
  value,
  onChange,
}: {
  value: number;
  onChange: (action: PanelZoomAction) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-1 text-[11px] text-white/45">
      <button
        type="button"
        onClick={() => onChange("out")}
        aria-label={t("panelZoom.zoomOut")}
        title={t("panelZoom.zoomOut")}
        className="rounded border border-white/10 px-2 py-1 hover:bg-white/5"
      >
        <Minus size={12} />
      </button>
      <span className="min-w-11 text-center tabular-nums">
        {formatPanelZoom(value)}
      </span>
      <button
        type="button"
        onClick={() => onChange("in")}
        aria-label={t("panelZoom.zoomIn")}
        title={t("panelZoom.zoomIn")}
        className="rounded border border-white/10 px-2 py-1 hover:bg-white/5"
      >
        <Plus size={12} />
      </button>
      <button
        type="button"
        onClick={() => onChange("reset")}
        aria-label={t("panelZoom.reset")}
        title={t("panelZoom.reset")}
        className="rounded border border-white/10 px-2 py-1 hover:bg-white/5"
      >
        <RotateCcw size={12} />
      </button>
    </div>
  );
}
