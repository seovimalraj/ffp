import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getSafePartDisplayName } from "../part-display-name";

describe("part display name cleanup", () => {
  it("trims and normalizes whitespace", () => {
    assert.equal(getSafePartDisplayName("  Bracket   Cover  ", 0), "Bracket Cover");
  });

  it("removes control characters", () => {
    assert.equal(getSafePartDisplayName("Part\u0000\u0007 Name", 1), "Part Name");
  });

  it("falls back for unreadable mojibake-like names", () => {
    assert.equal(getSafePartDisplayName("Ã©Ã§â€”", 2), "Part 3");
    assert.equal(getSafePartDisplayName("\uFFFD\uFFFD", 3), "Part 4");
  });

  it("falls back for missing or empty names", () => {
    assert.equal(getSafePartDisplayName(undefined, 4), "Part 5");
    assert.equal(getSafePartDisplayName("   ", 5), "Part 6");
  });
});
