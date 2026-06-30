// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("./components/PlayerBar", () => ({
  PlayerBar: () => <div data-testid="player-bar" />,
}));

vi.mock("./features/player/PlayerContext", () => ({
  PlayerProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("./features/library/LibraryView", () => ({
  LibraryView: ({
    onOpenExplorerTrack,
  }: {
    onOpenExplorerTrack?: (trackId: number) => void;
  }) => (
    <div data-testid="library-view">
      Library main
      <button type="button" onClick={() => onOpenExplorerTrack?.(42)}>
        Open selected in Explorer
      </button>
    </div>
  ),
}));

vi.mock("./features/organization/OrganizationView", () => ({
  OrganizationView: () => (
    <div data-testid="organization-view">
      Organization center
    </div>
  ),
}));

vi.mock("./features/explorer/ExplorerView", () => ({
  ExplorerView: ({ focusTrackId }: { focusTrackId?: number }) => (
    <div data-testid="explorer-view">Curator Mode {focusTrackId ?? "none"}</div>
  ),
}));

vi.mock("./features/dashboard/DashboardView", () => ({
  DashboardView: () => <div data-testid="dashboard-view">Dashboard center</div>,
}));

vi.mock("./features/playlists/PlaylistsView", () => ({
  PlaylistsView: () => <div data-testid="playlists-view">Internal playlists</div>,
}));

vi.mock("./features/settings/SettingsView", () => ({
  SettingsView: () => <div data-testid="settings-view">Settings center</div>,
}));

afterEach(cleanup);

describe("App navigation", () => {
  it("opens a dedicated screen for Organization", () => {
    const view = render(<App />);

    expect(view.getByTestId("library-view")).toBeInTheDocument();
    fireEvent.click(view.getByRole("button", { name: "Organization" }));

    expect(view.queryByTestId("library-view")).not.toBeInTheDocument();
    expect(view.getByTestId("organization-view")).toBeInTheDocument();
  });

  it("keeps tags integrated into Organization without a separate screen", () => {
    const view = render(<App />);

    expect(view.queryByRole("button", { name: "Tags" })).not.toBeInTheDocument();
  });

  it("opens Curator Mode from Explorer", () => {
    const view = render(<App />);

    fireEvent.click(view.getByRole("button", { name: "Explorer" }));

    expect(view.getByTestId("explorer-view")).toBeInTheDocument();
    expect(view.queryByTestId("library-view")).not.toBeInTheDocument();
  });

  it("opens Explorer focused on a library song", () => {
    const view = render(<App />);

    fireEvent.click(view.getByRole("button", { name: "Open selected in Explorer" }));

    expect(view.getByTestId("explorer-view")).toHaveTextContent("42");
    expect(view.queryByTestId("library-view")).not.toBeInTheDocument();
  });

  it("opens Playlists", () => {
    const view = render(<App />);

    fireEvent.click(view.getByRole("button", { name: "Playlists" }));

    expect(view.getByTestId("playlists-view")).toBeInTheDocument();
    expect(view.queryByTestId("library-view")).not.toBeInTheDocument();
  });

  it("opens Settings", () => {
    const view = render(<App />);

    fireEvent.click(view.getByRole("button", { name: "Settings" }));

    expect(view.getByTestId("settings-view")).toBeInTheDocument();
    expect(view.queryByTestId("library-view")).not.toBeInTheDocument();
  });

  it("opens Dashboard", () => {
    const view = render(<App />);

    fireEvent.click(view.getByRole("button", { name: "Dashboard" }));

    expect(view.getByTestId("dashboard-view")).toBeInTheDocument();
    expect(view.queryByTestId("library-view")).not.toBeInTheDocument();
  });
});
