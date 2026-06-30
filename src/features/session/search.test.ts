import { describe, expect, it } from "vitest";
import type { TrackSummary } from "../../types/track";
import { searchSessionTracks, type SessionSearchField } from "./search";

function track(id: number, patch: Partial<TrackSummary> = {}): TrackSummary {
  return {
    id,
    filePath: `C:\\Music\\${id}.mp3`,
    fileName: `${id}.mp3`,
    title: `Tema ${id}`,
    artist: "Soundbender",
    album: "Suno Lab",
    albumArtist: null,
    genre: null,
    year: null,
    trackNumber: null,
    durationMs: 180_000,
    audioFormat: "mp3",
    bpm: null,
    musicalKey: null,
    playCount: 0,
    rating: null,
    status: "review",
    projectId: null,
    projectName: null,
    versionLabel: null,
    tagNames: "",
    workflowNotes: null,
    nextAction: null,
    strongPart: null,
    mainProblem: null,
    intendedUse: null,
    mood: null,
    generationModel: null,
    reviewedAt: null,
    lastReviewedAt: null,
    skipCount: 0,
    metadataReadError: null,
    ...patch,
  };
}

const searchable = track(1, {
  title: "Love River Rising",
  artist: "Luna Divine",
  album: "Celestial Waters",
  genre: "Psytrance; Electronic",
  mood: "Cósmico, Energético",
  tagNames: "Favorita, Radio",
  projectName: "Divine Sessions",
  versionLabel: "Extended v2",
  status: "selected",
  rating: 9,
  intendedUse: "Radio, Publicación",
  strongPart: "Voz principal",
  mainProblem: "Mezcla oscura",
  nextAction: "Revisar master",
  workflowNotes: "Preparar para emisión nocturna",
  filePath: "D:\\Suno\\Divine\\love-river.mp3",
});

describe("búsqueda de Modo Sesión", () => {
  it.each<[SessionSearchField, string]>([
    ["title", "river"],
    ["artist", "luna divine"],
    ["album", "celestial"],
    ["genre", "trance"],
    ["mood", "cosmico"],
    ["tags", "favor"],
    ["project", "divine"],
    ["version", "extended"],
    ["status", "radio ready"],
    ["rating", "9/10"],
    ["intendedUse", "publicacion"],
    ["strongPart", "voz"],
    ["mainProblem", "mezcla"],
    ["nextAction", "master"],
    ["notes", "emision"],
    ["path", "love-river"],
  ])("encuentra por %s usando coincidencia parcial", (field, query) => {
    expect(searchSessionTracks([searchable], query, field)).toEqual([searchable]);
  });

  it("busca varias palabras sin importar acentos, mayúsculas ni orden", () => {
    expect(searchSessionTracks([searchable], "RIVER love", "title")).toEqual([
      searchable,
    ]);
    expect(searchSessionTracks([searchable], "energetico COSMICO", "mood")).toEqual([
      searchable,
    ]);
  });

  it("busca en todos los campos y exige que coincidan todos los términos", () => {
    expect(searchSessionTracks([searchable], "love divine radio", "all")).toEqual([
      searchable,
    ]);
    expect(searchSessionTracks([searchable], "love jazz", "all")).toEqual([]);
  });

  it("excluye archivadas por defecto y permite incluirlas", () => {
    const archived = track(2, { title: "Archivo profundo", status: "archived" });
    expect(searchSessionTracks([archived], "archivo", "title")).toEqual([]);
    expect(searchSessionTracks([archived], "archivo", "title", false)).toEqual([
      archived,
    ]);
  });
});
