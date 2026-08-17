import { describe, expect, it } from "vitest";
import { GENESIS_BEACON_NAMES, GENESIS_CHAPTER_BEACONS } from "./genesisChapterBeacons.js";

describe("contrato de beacons Genesis", () => {
  it("declara um beacon para cada um dos seis capítulos", () => {
    expect(GENESIS_CHAPTER_BEACONS).toEqual({
      chapter_01: "Beacon_Colony",
      chapter_02: "Beacon_Glass",
      chapter_03: "Beacon_Chitin",
      chapter_04: "Beacon_Storm",
      chapter_05: "Beacon_Eclipse",
      chapter_06: "Beacon_Magma",
    });
    expect(GENESIS_BEACON_NAMES).toHaveLength(6);
  });
});
