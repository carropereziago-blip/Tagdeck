import { useState } from "react";
import { AppLayout } from "./components/AppLayout";
import type { MainSection } from "./components/AppLayout";
import { OnboardingDialog } from "./components/OnboardingDialog";
import { SectionOnboardingDialog } from "./components/SectionOnboardingDialog";
import { DashboardView } from "./features/dashboard/DashboardView";
import { DemoView } from "./features/demo/DemoView";
import { PlayerBar } from "./components/PlayerBar";
import { LibraryView } from "./features/library/LibraryView";
import { ExplorerView } from "./features/explorer/ExplorerView";
import { OrganizationView } from "./features/organization/OrganizationView";
import { PlayerProvider } from "./features/player/PlayerContext";
import { PlaylistsView } from "./features/playlists/PlaylistsView";
import { SessionView } from "./features/session/SessionView";
import { SettingsProvider, useSettings } from "./features/settings/SettingsContext";
import { SettingsView } from "./features/settings/SettingsView";
import {
  SECTION_ONBOARDING_IDS,
  type SectionOnboardingId,
} from "./features/settings/settings";
import type { ExplorerCriterion } from "./types/track";

export default function App() {
  return (
    <SettingsProvider>
      <PlayerProvider>
        <TagDeckApp />
      </PlayerProvider>
    </SettingsProvider>
  );
}

function TagDeckApp() {
  const [activeSection, setActiveSection] = useState<MainSection>("library");
  const { settings, loaded, updateSettings } = useSettings();
  const [dismissedSectionTip, setDismissedSectionTip] =
    useState<SectionOnboardingId | null>(null);
  const [libraryScanRequest, setLibraryScanRequest] = useState(0);
  const [explorerLaunch, setExplorerLaunch] = useState<{
    criterion: ExplorerCriterion;
    token: number;
    focusTrackId?: number;
  }>({ criterion: "unreviewed", token: 0 });
  const [navigationTarget, setNavigationTarget] = useState<{
    section: "library" | "organization";
    trackId: number;
  } | null>(null);
  const [sessionLaunch, setSessionLaunch] = useState<{
    trackId?: number;
    queueIds?: number[];
  }>({});

  function openTrack(section: "library" | "organization", trackId: number) {
    setNavigationTarget({ section, trackId });
    navigate(section);
  }

  function openSession(trackId: number, queueIds?: number[]) {
    setSessionLaunch({ trackId, queueIds });
    navigate("session");
  }

  function navigate(section: MainSection) {
    setDismissedSectionTip(null);
    setActiveSection(section);
  }

  function markOnboardingSeen() {
    updateSettings((current) => ({ ...current, hasSeenOnboarding: true }));
  }

  function startReviewing(criterion: ExplorerCriterion = "unreviewed") {
    markOnboardingSeen();
    setExplorerLaunch((current) => ({
      criterion,
      token: current.token + 1,
      focusTrackId: undefined,
    }));
    navigate("explorer");
  }

  function openTrackInExplorer(trackId: number) {
    markOnboardingSeen();
    setExplorerLaunch((current) => ({
      criterion: "all",
      token: current.token + 1,
      focusTrackId: trackId,
    }));
    navigate("explorer");
  }

  function scanFromOnboarding() {
    markOnboardingSeen();
    navigate("library");
    setLibraryScanRequest((value) => value + 1);
  }

  function openDemo() {
    markOnboardingSeen();
    navigate("demo");
  }

  const activeOnboardingSection = isSectionOnboardingId(activeSection)
    ? activeSection
    : null;
  const showSectionOnboarding =
    loaded &&
    settings.hasSeenOnboarding &&
    activeOnboardingSection !== null &&
    dismissedSectionTip !== activeOnboardingSection &&
    !settings.hiddenSectionOnboarding[activeOnboardingSection];

  function closeSectionOnboarding(section: SectionOnboardingId, hide: boolean) {
    if (hide) {
      updateSettings((current) => ({
        ...current,
        hiddenSectionOnboarding: {
          ...current.hiddenSectionOnboarding,
          [section]: true,
        },
      }));
      return;
    }
    setDismissedSectionTip(section);
  }

  function sectionOnboardingAction(section: SectionOnboardingId) {
    if (section === "library") {
      setLibraryScanRequest((value) => value + 1);
    } else if (section === "explorer" || section === "dashboard") {
      startReviewing("unreviewed");
    }
  }

  return (
    <>
      <AppLayout
        player={settings.player.showGlobalBar ? <PlayerBar /> : null}
        activeSection={activeSection}
        onSectionChange={navigate}
      >
        {activeSection === "library" ? (
          <LibraryView
            onOpenSession={openSession}
            onStartReviewing={startReviewing}
            onOpenExplorerTrack={openTrackInExplorer}
            scanRequest={libraryScanRequest}
            focusTrackId={
              navigationTarget?.section === "library"
                ? navigationTarget.trackId
                : undefined
            }
          />
        ) : activeSection === "explorer" ? (
          <ExplorerView
            onNavigate={setActiveSection}
            onOpenSession={openSession}
            initialCriterion={explorerLaunch.criterion}
            launchToken={explorerLaunch.token}
            focusTrackId={explorerLaunch.focusTrackId}
          />
        ) : activeSection === "playlists" ? (
          <PlaylistsView onOpenTrack={openTrack} onOpenSession={openSession} />
        ) : activeSection === "session" ? (
          <SessionView
            initialTrackId={sessionLaunch.trackId}
            initialQueueIds={sessionLaunch.queueIds}
            onOpenTrack={openTrack}
          />
        ) : activeSection === "dashboard" ? (
          <DashboardView onStartReviewing={startReviewing} />
        ) : activeSection === "settings" ? (
          <SettingsView onOpenOnboarding={() => updateSettings((current) => ({ ...current, hasSeenOnboarding: false }))} onOpenDemo={openDemo} />
        ) : activeSection === "demo" ? (
          <DemoView onNavigate={navigate} onStartReviewing={() => startReviewing("unreviewed")} />
        ) : (
          <OrganizationView
            onOpenSession={openSession}
            focusTrackId={
              navigationTarget?.section === "organization"
                ? navigationTarget.trackId
                : undefined
            }
          />
        )}
      </AppLayout>
      {loaded && !settings.hasSeenOnboarding && (
        <OnboardingDialog
          onClose={markOnboardingSeen}
          onStartReviewing={() => startReviewing("unreviewed")}
          onScanFolder={scanFromOnboarding}
          onOpenDemo={openDemo}
        />
      )}
      {showSectionOnboarding && activeOnboardingSection && (
        <SectionOnboardingDialog
          section={activeOnboardingSection}
          onClose={(hide) => closeSectionOnboarding(activeOnboardingSection, hide)}
          onPrimaryAction={
            ["library", "explorer", "dashboard"].includes(activeOnboardingSection)
              ? () => sectionOnboardingAction(activeOnboardingSection)
              : undefined
          }
        />
      )}
    </>
  );
}

function isSectionOnboardingId(section: MainSection): section is SectionOnboardingId {
  return SECTION_ONBOARDING_IDS.includes(section as SectionOnboardingId);
}
