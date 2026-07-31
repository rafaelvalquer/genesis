import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { auditSpriteFile, auditSpriteRoots } from "../../tools/auditSprites.mjs";

let fixtureRoot;

async function png(target, width, height, {
  left = 2, top = 2, usefulWidth = width - 4, usefulHeight = height - 4, alpha = true,
} = {}) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  const background = alpha ? { r: 0, g: 0, b: 0, alpha: 0 } : { r: 4, g: 8, b: 12 };
  await sharp({
    create: { width, height, channels: alpha ? 4 : 3, background },
  }).composite([{
    input: {
      create: {
        width: usefulWidth, height: usefulHeight, channels: 4,
        background: { r: 32, g: 180, b: 240, alpha: 1 },
      },
    },
    left,
    top,
  }]).png().toFile(target);
}

beforeEach(async () => {
  const parent = path.join(process.cwd(), ".codex-tmp");
  await fs.mkdir(parent, { recursive: true });
  fixtureRoot = await fs.mkdtemp(path.join(parent, "sprite-audit-"));
});

afterEach(async () => {
  await fs.rm(fixtureRoot, { recursive: true, force: true });
});

describe("auditoria de sprites", () => {
  it("mede bounding box, margens, transparência e ocupação", async () => {
    const file = path.join(fixtureRoot, "unit", "idle", "frame0.png");
    await png(file, 20, 16, { left: 3, top: 2, usefulWidth: 12, usefulHeight: 10 });
    const result = await auditSpriteFile(file);
    expect(result).toMatchObject({
      width: 20,
      height: 16,
      hasAlpha: true,
      bbox: { x: 3, y: 2, width: 12, height: 10, right: 14, bottom: 11 },
      margins: { top: 2, right: 5, bottom: 4, left: 3 },
    });
  });

  it("detecta lacunas, dimensões inconsistentes e grava relatórios", async () => {
    const state = path.join(fixtureRoot, "unit", "idle");
    await png(path.join(state, "frame0.png"), 20, 20);
    await png(path.join(state, "frame2.png"), 22, 20);
    const outputJson = path.join(fixtureRoot, "report.json");
    const outputMarkdown = path.join(fixtureRoot, "report.md");
    const report = await auditSpriteRoots({
      roots: [fixtureRoot],
      outputJson,
      outputMarkdown,
      displayHeights: { unit: 5 },
    });
    expect(report.summary.errors).toBe(1);
    expect(report.states[0].missingFrames).toEqual([1]);
    expect(report.states[0].issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["FRAME_GAPS", "DIMENSION_MISMATCH"]),
    );
    expect(JSON.parse(await fs.readFile(outputJson, "utf8")).summary.files).toBe(2);
    expect(await fs.readFile(outputMarkdown, "utf8")).toContain("| unit | idle | 2 | ERROR |");
  });
});
