import { describe, expect, it } from "vitest";
import { normalizeRating } from "./rating";

describe("normalizeRating", () => {
  it("accepts null and ratings from 1 to 10", () => {
    expect(normalizeRating(null)).toBeNull();
    expect(normalizeRating(1)).toBe(1);
    expect(normalizeRating(10)).toBe(10);
  });

  it("rejects ratings outside the valid range", () => {
    expect(() => normalizeRating(0)).toThrow(RangeError);
    expect(() => normalizeRating(11)).toThrow(RangeError);
    expect(() => normalizeRating(1.5)).toThrow(RangeError);
  });
});
