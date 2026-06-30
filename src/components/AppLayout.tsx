import type { ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Compass,
  EyeOff,
  Library,
  ListMusic,
  Menu,
  Radio,
  Settings,
  BarChart3,
  Workflow,
} from "lucide-react";
import { useSettings } from "../features/settings/SettingsContext";
import { useI18n } from "../i18n";

export type MainSection =
  | "library"
  | "organization"
  | "explorer"
  | "playlists"
  | "session"
  | "dashboard"
  | "settings"
  | "demo";

interface AppLayoutProps {
  children: ReactNode;
  player: ReactNode | null;
  activeSection: MainSection;
  onSectionChange: (section: MainSection) => void;
}

const NAV_ITEMS: Array<{
  section: MainSection;
  labelKey: string;
  icon: ReactNode;
  footer?: boolean;
}> = [
  { section: "library", labelKey: "nav.library", icon: <Library size={17} /> },
  { section: "organization", labelKey: "nav.organization", icon: <Workflow size={17} /> },
  { section: "explorer", labelKey: "nav.explorer", icon: <Compass size={17} /> },
  { section: "playlists", labelKey: "nav.playlists", icon: <ListMusic size={17} /> },
  { section: "session", labelKey: "nav.session", icon: <Radio size={17} /> },
  { section: "dashboard", labelKey: "nav.dashboard", icon: <BarChart3 size={17} /> },
  { section: "settings", labelKey: "nav.settings", icon: <Settings size={17} />, footer: true },
];

export function AppLayout({
  children,
  player,
  activeSection,
  onSectionChange,
}: AppLayoutProps) {
  const { settings, updateSettings } = useSettings();
  const { t } = useI18n();
  const sidebarMode = settings.layout.focusMode ? "hidden" : settings.layout.sidebarMode;
  const showSidebar = sidebarMode !== "hidden";
  const collapsed = sidebarMode === "collapsed";
  const gridColumns = showSidebar
    ? collapsed
      ? "grid-cols-[72px_1fr]"
      : "grid-cols-[224px_1fr]"
    : "grid-cols-[1fr]";

  function patchLayout(patch: Partial<typeof settings.layout>) {
    updateSettings((current) => ({
      ...current,
      layout: { ...current.layout, ...patch },
    }));
  }

  const navClass = (section: MainSection) =>
    `flex w-full items-center rounded-md py-2.5 text-left transition ${
      collapsed ? "justify-center px-2" : "gap-3 px-3"
    } ${
      activeSection === section
        ? "nav-item-active bg-white/9 font-medium text-white shadow-sm"
        : "text-white/55 hover:bg-white/6 hover:text-white/80"
    }`;

  const renderNavItem = (item: (typeof NAV_ITEMS)[number]) => {
    const label = t(item.labelKey);
    return (
      <button
        key={item.section}
        type="button"
        onClick={() => onSectionChange(item.section)}
        className={navClass(item.section)}
        title={collapsed ? label : undefined}
        aria-label={label}
      >
        {item.icon}
        {!collapsed && label}
      </button>
    );
  };

  return (
    <div
      className={`app-surface grid h-screen overflow-hidden text-[var(--color-text)] ${
        player ? "grid-rows-[minmax(0,1fr)_92px]" : "grid-rows-[minmax(0,1fr)]"
      }`}
    >
      {!showSidebar && (
        <button
          type="button"
          onClick={() =>
            patchLayout({ sidebarMode: "expanded", focusMode: false })
          }
          className="toolbar-button fixed left-3 top-3 z-40 bg-[var(--color-card)] shadow-lg"
        >
          <Menu size={15} />
          {settings.layout.focusMode ? t("library.focusMode") : t("common.open")}
        </button>
      )}

      <div className={`grid min-h-0 ${gridColumns}`}>
        {showSidebar && (
          <aside className="sidebar-surface flex min-h-0 flex-col border-r border-white/8">
            <div className={`border-b border-white/8 ${collapsed ? "px-3 py-4" : "px-5 py-5"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className={collapsed ? "sr-only" : ""}>
                  <p className="brand-kicker text-[10px] font-semibold uppercase tracking-[0.24em] text-[#d9ff43]">
                    Soundbender
                  </p>
                  <h1 className="brand-title mt-1 text-xl font-semibold tracking-tight">
                    TagDeck
                  </h1>
                </div>
                {collapsed && (
                  <div className="mx-auto text-center">
                    <p className="brand-kicker text-[10px] font-semibold uppercase tracking-[0.12em] text-[#d9ff43]">
                      SB
                    </p>
                    <h1 className="brand-title text-sm font-semibold">TD</h1>
                  </div>
                )}
              </div>
              <div className="mt-3 flex justify-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    patchLayout({
                      sidebarMode: collapsed ? "expanded" : "collapsed",
                      focusMode: false,
                    })
                  }
                  className="rounded-md border border-white/10 p-1.5 text-white/45 hover:bg-white/6 hover:text-white/75"
                  title={collapsed ? t("layout.expandSidebar") : t("layout.collapseSidebar")}
                  aria-label={collapsed ? t("layout.expandSidebar") : t("layout.collapseSidebar")}
                >
                  {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    patchLayout({ sidebarMode: "hidden", focusMode: false })
                  }
                  className="rounded-md border border-white/10 p-1.5 text-white/45 hover:bg-white/6 hover:text-white/75"
                  title={t("layout.hideSidebar")}
                  aria-label={t("layout.hideSidebar")}
                >
                  <EyeOff size={14} />
                </button>
              </div>
            </div>

            <nav className="space-y-1 p-3 text-sm">
              {NAV_ITEMS.filter((item) => !item.footer).map(renderNavItem)}
            </nav>

            <div className="mt-auto border-t border-white/8 p-3">
              {NAV_ITEMS.filter((item) => item.footer).map(renderNavItem)}
            </div>
          </aside>
        )}

        <main className="min-h-0 min-w-0 overflow-hidden">{children}</main>
      </div>
      {player}
    </div>
  );
}
