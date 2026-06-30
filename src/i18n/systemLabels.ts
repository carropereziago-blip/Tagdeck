import type { SupportedLanguage } from ".";

export type SystemOptionGroup = "strongPart" | "mainProblem" | "intendedUse" | "mood";

export type SystemOption = {
  value: string;
  labels: Record<SupportedLanguage, string>;
};

export const SYSTEM_OPTIONS: Record<SystemOptionGroup, SystemOption[]> = {
  strongPart: [
    option("Voz", "Vocals"),
    option("Letra", "Lyrics"),
    option("Bajo", "Bass"),
    option("Beat", "Beat"),
    option("Piano / teclas", "Piano / keys"),
    option("Guitarra", "Guitar"),
    option("Drop", "Drop"),
    option("Coro", "Chorus"),
    option("Instrumental", "Instrumental"),
    option("Atmósfera", "Atmosphere"),
    option("Estructura", "Structure"),
    option("Energía", "Energy"),
  ],
  mainProblem: [
    option("Voz artificial", "Artificial vocals"),
    option("Letra floja", "Weak lyrics"),
    option("Mezcla sucia", "Muddy mix"),
    option("Estructura rara", "Odd structure"),
    option("Corte brusco", "Abrupt cut"),
    option("Demasiado larga", "Too long"),
    option("Demasiado corta", "Too short"),
    option("Falta energía", "Lacks energy"),
    option("Mal master", "Poor master"),
    option("Necesita stems", "Needs stems"),
    option("Necesita edición", "Needs editing"),
    option("Ninguno claro", "No clear issue"),
  ],
  intendedUse: [
    option("Radio", "Radio"),
    option("Publicación", "Release"),
    option("Álbum", "Album"),
    option("Demo", "Demo"),
    option("DAW Rescue", "DAW Rescue"),
    option("Referencia", "Reference"),
    option("Rehacer letra", "Rewrite lyrics"),
    option("Extraer stems", "Extract stems"),
    option("Archivo", "Archive"),
    option("Descartar", "Discard"),
  ],
  mood: [
    option("Alegre", "Happy"),
    option("Energético", "Energetic"),
    option("Oscuro", "Dark"),
    option("Melancólico", "Melancholic"),
    option("Emotivo", "Emotional"),
    option("Espiritual", "Spiritual"),
    option("Cósmico", "Cosmic"),
    option("Hipnótico", "Hypnotic"),
    option("Relajado", "Relaxed"),
    option("Agresivo", "Aggressive"),
    option("Cinemático", "Cinematic"),
    option("Romántico", "Romantic"),
    option("Triunfal", "Triumphant"),
    option("Profundo", "Deep"),
    option("Atmosférico", "Atmospheric"),
    option("Bailable", "Danceable"),
  ],
};

export function systemOptionLabel(
  language: SupportedLanguage,
  group: SystemOptionGroup,
  value: string | null | undefined,
) {
  if (!value) return "";
  const normalized = normalizeSystemValue(value);
  const match = SYSTEM_OPTIONS[group].find(
    (item) => normalizeSystemValue(item.value) === normalized,
  );
  return match?.labels[language] ?? value;
}

export function formatSystemValueList(
  language: SupportedLanguage,
  group: SystemOptionGroup,
  value: string | null | undefined,
) {
  if (!value) return "";
  return value
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => systemOptionLabel(language, group, item))
    .join(", ");
}

function option(value: string, en: string): SystemOption {
  return { value, labels: { es: value, en } };
}

function normalizeSystemValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es")
    .trim();
}
