import fs from "node:fs";

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function write(file, content) {
  fs.writeFileSync(file, content);
}

function replaceOnce(file, before, after, label) {
  const source = read(file);
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`${label}: trecho não encontrado em ${file}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`${label}: trecho não é único em ${file}`);
  write(file, source.slice(0, first) + after + source.slice(first + before.length));
}

const engine = "src/game/battle/engine.js";

replaceOnce(
  engine,
  `      session.troops.filter((troop) => !troop.dead && ["colono", "lumiUrsa7", "muralhaReforcada", "colossoImpacto"].includes(troop.type))`,
  `      session.troops.filter((troop) => !troop.dead && ["colono", "lumiUrsa7", "muralhaReforcada", "colossoImpacto", "bastiaoMare"].includes(troop.type))`,
  "frontline doctrine consistente para Bastiao do Mar",
);

replaceOnce(
  engine,
  `    const maxDeployed = getTroopDeploymentLimit(troopId);`,
  `    const maxDeployed = getTroopDeploymentLimit(troopId, session);`,
  "snapshot respeita limite de deploy da missao",
);

replaceOnce(
  "src/game/domain.js",
  `  frontline_doctrine: ["colono", "lumiUrsa7", "muralhaReforcada", "colossoImpacto"],`,
  `  frontline_doctrine: ["colono", "lumiUrsa7", "muralhaReforcada", "colossoImpacto", "bastiaoMare"],`,
  "elegibilidade da frontline doctrine inclui Bastiao do Mar",
);

write("src/game/latestHardening.test.js", `import { describe, expect, it } from "vitest";
import { PHASES } from "./content.js";
import { createBattleSession, getSnapshot, placeTroop, selectDecision } from "./battleModel.js";

describe("latest-version hardening", () => {
  it("expõe no snapshot o limite de deploy específico da missão", () => {
    const phase = {
      ...PHASES[0],
      id: "snapshot_deployment_limit_contract",
      startingTroopRules: {
        ...(PHASES[0].startingTroopRules || {}),
        deploymentLimits: { marine: 1 },
      },
    };
    const session = createBattleSession(phase, ["marine"], 99101, { sandbox: true });
    expect(getSnapshot(session).deploymentStats.marine.maxDeployed).toBe(1);
  });

  it("aplica frontline_doctrine ao Bastiao do Mar já posicionado", () => {
    const session = createBattleSession(PHASES[0], ["bastiaoMare"], 99102, { sandbox: true });
    const placed = placeTroop(session, "bastiaoMare", 1, 2);
    expect(placed.ok).toBe(true);
    const troop = placed.troop;
    const originalMaxHp = troop.maxHp;

    session.pendingDecision = [{ id: "frontline_doctrine" }];
    session.pendingDecisionLevel = "specialization";
    expect(selectDecision(session, { id: "frontline_doctrine" })).toBe(true);
    expect(troop.maxHp).toBeCloseTo(originalMaxHp * 1.2, 5);

    const second = placeTroop(session, "bastiaoMare", 2, 2);
    expect(second.ok).toBe(true);
    expect(second.troop.maxHp).toBeCloseTo(troop.maxHp, 5);
  });
});
`);
