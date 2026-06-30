import { describe, expect, it } from "vitest";
import { displayTitleWithVersion } from "./displayTitle";

describe("displayTitleWithVersion", () => {
  it("muestra solo titulo cuando no hay version", () => {
    expect(
      displayTitleWithVersion({
        title: "Free",
        fileName: "Free.mp3",
        filePath: "C:\\Music\\Free.mp3",
        versionLabel: null,
      }),
    ).toBe("Free");
  });

  it("muestra titulo y version interna si existe", () => {
    expect(
      displayTitleWithVersion({
        title: "Free",
        fileName: "Free.mp3",
        filePath: "C:\\Music\\Free.mp3",
        versionLabel: "v3",
      }),
    ).toBe("Free · v3");
  });

  it("no muestra null undefined ni guion como version", () => {
    expect(
      displayTitleWithVersion({
        title: "Free",
        fileName: "Free.mp3",
        filePath: "C:\\Music\\Free.mp3",
        versionLabel: "—",
      }),
    ).toBe("Free");

    expect(
      displayTitleWithVersion({
        title: "Free",
        fileName: "Free.mp3",
        filePath: "C:\\Music\\Free.mp3",
        versionLabel: undefined,
      }),
    ).toBe("Free");
  });
});
