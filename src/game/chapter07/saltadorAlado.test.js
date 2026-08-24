import { describe, expect, it } from "vitest";
import { ENEMIES } from "../content.js";
import { CELL } from "../visualGeometry.js";
import { updateSaltadorAlado } from "./saltadorAlado.js";

function harness() {
  let elapsed = 0; const events = []; const target = { id: "escort", row: 1, x: 350, dead: false };
  const enemy = { id: "s1", type: "saltadorAlado", row: 1, x: 380, y: 180, moving: true, dead: false, speed: 28, damage: 6,
    spawnedAt: 0, attackReadyAt: 99999, meleeAttackPending: false, meleeTargetId: null, meleeImpactAt: Infinity,
    canopyJumpReadyAt: 0, saltadorState: "walking", saltadorStateStartedAt: 0, saltadorStateEndsAt: Infinity,
    escortInstinctActive: false, rasanteReadyAt: Infinity, airborne: false, visualOffsetY: 0, groundMeleeTargetable: true };
  const runtime = {
    get elapsed() { return elapsed; }, troops: () => [target], escortIds: () => ["escort"], convoyX: () => 500,
    rng: () => .5, troopBlockDistance: () => CELL.width * .62, moveEnemy: () => {}, damageTroop: () => { events.push("damage"); },
  };
  return { enemy, runtime, target, events, setTime: (value) => { elapsed = value; } };
}

describe("Saltador Alado", () => {
  it("salta uma única tropa sem causar dano e usa RNG determinístico", () => {
    const h = harness(); const config = ENEMIES.saltadorAlado;
    updateSaltadorAlado(h.runtime, h.enemy, config, 16, h.events);
    expect(h.enemy.saltadorState).toBe("jumpPrep"); expect(h.events[0].type).toBe("saltadorJumpStart");
    h.setTime(240); updateSaltadorAlado(h.runtime, h.enemy, config, 16, h.events);
    expect(h.enemy.saltadorState).toBe("jumpAir");
    h.setTime(660); updateSaltadorAlado(h.runtime, h.enemy, config, 16, h.events);
    expect(h.enemy.escortInstinctActive).toBe(true); expect(h.events).not.toContain("damage");
    expect(h.enemy.canopyJumpReadyAt).toBe(6660);
  });
  it("não ataca diretamente o comboio", () => {
    expect(ENEMIES.saltadorAlado.canAttackConvoy).toBe(false);
  });
});
