export function normalizeRating(value: number | null): number | null {
  if (value === null) {
    return null;
  }

  if (!Number.isInteger(value) || value < 1 || value > 10) {
    throw new RangeError("El rating debe ser un entero entre 1 y 10.");
  }

  return value;
}
