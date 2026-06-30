import { describe, expect, it } from "vitest";
import { filterTracksByFolder, hasLibraryFolder, isTrackInFolder } from "./libraryFolders";

const tracks = [
  { id: 1, filePath: String.raw`C:\Music\Pop\song-a.mp3` },
  { id: 2, filePath: String.raw`C:\Music\Pop\Sub\song-b.mp3` },
  { id: 3, filePath: String.raw`C:\Music\Pop Rock\song-c.mp3` },
  { id: 4, filePath: "C:/Music/Suno/song-d.mp3" },
];

describe("libraryFolders", () => {
  it("filtra rutas de carpeta de forma recursiva", () => {
    expect(
      filterTracksByFolder(tracks, String.raw`C:\Music\Pop`).map((track) => track.id),
    ).toEqual([1, 2]);
  });

  it("no confunde carpetas con prefijos parecidos", () => {
    expect(
      isTrackInFolder(String.raw`C:\Music\Pop Rock\song.mp3`, String.raw`C:\Music\Pop`),
    ).toBe(false);
  });

  it("tolera mayusculas y barras distintas", () => {
    expect(isTrackInFolder("C:/MUSIC/SUNO/song.mp3", String.raw`c:\music\suno`)).toBe(
      true,
    );
  });

  it("devuelve la lista original si no hay carpeta seleccionada", () => {
    expect(filterTracksByFolder(tracks, "")).toBe(tracks);
  });

  it("detecta si la carpeta seleccionada sigue disponible", () => {
    expect(
      hasLibraryFolder(
        [{ path: String.raw`C:\Music\Suno`, name: "Suno", trackCount: 1, isRoot: true }],
        "c:/music/suno/",
      ),
    ).toBe(true);
  });
});
