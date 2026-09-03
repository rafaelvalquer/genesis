import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const screenPath = path.join(root, "src", "game", "BattleScreen.jsx");
const hookPath = path.join(root, "src", "game", "hooks", "useBattleInteractions.js");

describe("useBattleInteractions boundary", () => {
  it("mantém pointer e targeting fora da BattleScreen", () => {
    const screen = fs.readFileSync(screenPath, "utf8");
    const hook = fs.readFileSync(hookPath, "utf8");

    expect(screen).toContain('from "./hooks/useBattleInteractions.js"');
    expect(screen).toContain("useBattleInteractions({");
    expect(screen).not.toContain("const handleCanvasClick =");
    expect(screen).not.toContain("const handleCanvasMove =");
    expect(screen).not.toContain("const handleCanvasContextMenu =");
    expect(hook).toContain("const handleCanvasClick =");
    expect(hook).toContain("getBattleFieldPoint(event, VIEWPORT)");
  });
});
