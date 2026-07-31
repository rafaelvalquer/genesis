import { describe, expect, it, vi } from "vitest";
import { compactActive } from "./battleCollections.js";
import {
  getBattleIndex,
  livingEnemyById,
  rebuildBattleIndex,
  registerEnemyInIndex,
} from "./battleIndex.js";
import {
  createProjectileTrail,
  forEachProjectileTrailPoint,
  pushProjectileTrail,
} from "./projectileTrail.js";
import { drawProjectileCollection } from "./projectileRenderer.js";

describe("estruturas reutilizáveis da batalha", () => {
  it("reconstrói o mesmo índice e registra spawns incrementais", () => {
    const troop = { id: "t1", type: "marine", row: 1, col: 2 };
    const enemy = { id: "e1", type: "vexar", row: 1, x: 330, hp: 10, packetId: "p1" };
    const session = { troops: [troop], enemies: [enemy] };
    const first = rebuildBattleIndex(session);
    const spawned = { id: "e2", type: "vexar", row: 1, x: 350, hp: 10, packetId: "p1" };
    session.enemies.push(spawned);
    registerEnemyInIndex(first, spawned);
    expect(livingEnemyById(first, "e2")).toBe(spawned);
    expect(first.enemiesByPacket.get("p1")).toEqual([enemy, spawned]);
    expect(rebuildBattleIndex(session)).toBe(first);
    expect(getBattleIndex(session)).toBe(first);
  });

  it("compacta em ordem sem substituir a coleção", () => {
    const items = [{ active: true, id: 1 }, { active: false, id: 2 }, { active: true, id: 3 }];
    const reference = items;
    expect(compactActive(items, (item) => item.active)).toBe(reference);
    expect(items.map((item) => item.id)).toEqual([1, 3]);
  });

  it("reutiliza os pontos do rastro após wrap-around", () => {
    const trail = createProjectileTrail(3, 0, 0);
    const references = [...trail.points];
    pushProjectileTrail(trail, 1, 1);
    pushProjectileTrail(trail, 2, 2);
    pushProjectileTrail(trail, 3, 3);
    pushProjectileTrail(trail, 4, 4);
    const coordinates = [];
    forEachProjectileTrailPoint(trail, 3, (point) => coordinates.push([point.x, point.y]));
    expect(coordinates).toEqual([[2, 2], [3, 3], [4, 4]]);
    expect(trail.points.every((point) => references.includes(point))).toBe(true);
  });

  it("interpola a coleção sem alterar a entidade lógica", () => {
    const projectile = {
      launched: true, visualKind: "unknown", x: 100, y: 40,
      previousRenderX: 80, previousRenderY: 20, vx: 1, vy: 0, color: "#fff",
    };
    const ctx = {
      save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(),
      lineTo: vi.fn(), stroke: vi.fn(),
      set strokeStyle(value) { this._strokeStyle = value; },
      set lineWidth(value) { this._lineWidth = value; },
      set shadowBlur(value) { this._shadowBlur = value; },
      set shadowColor(value) { this._shadowColor = value; },
      globalAlpha: 1,
    };
    drawProjectileCollection(ctx, [projectile], 0.5, { quality: "low" });
    expect(ctx.lineTo).toHaveBeenCalledWith(90, 30);
    expect(projectile).toMatchObject({ x: 100, y: 40 });
  });
});

