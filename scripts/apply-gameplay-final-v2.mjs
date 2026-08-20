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
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`${label}: trecho não é único em ${file}`);
  }
  write(file, source.slice(0, first) + after + source.slice(first + before.length));
}

function replaceRange(file, startMarker, endMarker, replacement, label) {
  const source = read(file);
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`${label}: início não encontrado em ${file}`);
  const end = source.indexOf(endMarker, start);
  if (end < 0) throw new Error(`${label}: fim não encontrado em ${file}`);
  write(file, source.slice(0, start) + replacement + source.slice(end));
}

const engine = "src/game/battle/engine.js";

replaceOnce(
  engine,
  `  const initialChargeReady = !enemy.salamandraInitialChargeUsed
    && session.elapsed >= enemy.spawnedAt + (config.charge.delayAfterSpawnMs || 0);
  if (!charging && config.charge.enabled && target
    && ((distance >= config.charge.minDistance && distance <= config.charge.maxDistance) || initialChargeReady)
    && session.elapsed >= enemy.salamandraNextChargeAt) {`,
  `  if (!charging && config.charge.enabled && target
    && distance >= config.charge.minDistance && distance <= config.charge.maxDistance
    && session.elapsed >= enemy.salamandraNextChargeAt) {`,
  "Salamandra respeita min/max range",
);

replaceOnce(
  engine,
  `      moveEnemyTowardX(session, enemy, repositionTargetX, dt, events, 3);`,
  `      moveEnemyTowardX(session, enemy, repositionTargetX, dt, events);`,
  "Cuspidor sem multiplicador 3x",
);

replaceOnce(
  engine,
  `  const target = chapterFourRangedTarget(session, enemy, config.range);
  const hasLiveTarget = session.troops.some((troop) => !troop.dead && troop.row === enemy.row
    && troop.x <= enemy.x && enemy.x - troop.x <= config.range * CELL.width);
  const distance = target ? enemy.x - target.x : Infinity;`,
  `  const target = chapterFourRangedTarget(session, enemy, config.range);
  const distance = target ? enemy.x - target.x : Infinity;`,
  "remove hasLiveTarget indevido da Nimbarca",
);

replaceOnce(
  engine,
  `    if (!target || !hasLiveTarget) {`,
  `    if (!target) {`,
  "corrige ReferenceError do Gorjal",
);

const wind = "src/game/windCurrent.js";

replaceOnce(
  wind,
  `    collisionDamageRatio: 0.25,`,
  `    collisionDamageRatio: 0.2,`,
  "restaura dano de colisão do Wind",
);

replaceOnce(
  wind,
  `function troopAt(session, row, col) {
  return session.troops.find((troop) => !troop.dead && troop.row === row && troop.col === col) || null;
}`,
  `function troopAt(session, row, col) {
  return session.troops.find((troop) => !troop.dead && !troop.windRecovery
    && troop.row === row && troop.col === col) || null;
}`,
  "ignora tropas em recuperação no grid do Wind",
);

replaceRange(
  wind,
  `function applyLateralTroopColumnShift(session, config, dependencies, events) {`,
  `function enemyEligible(enemy, dependencies) {`,
  `function applyLateralTroopColumnShift(session, config, dependencies, events) {
  const wind = session.windCurrent;
  const troop = troopAt(session, wind.sourceRow, wind.sourceCol);
  if (!troop || isWindAnchor(troop, dependencies)
    || dependencies.troops?.[troop.type]?.windClass === "structure") return;

  const targetRow = wind.sourceRow + wind.verticalDirection;
  if (targetRow < 0 || targetRow >= FIELD.rows) {
    permanentlyEjectTroop(session, troop, wind.verticalDirection, dependencies, events);
    return;
  }

  const blockers = [];
  let cursor = troopAt(session, targetRow, wind.sourceCol);
  while (cursor) {
    if (isWindAnchor(cursor, dependencies)
      || dependencies.troops?.[cursor.type]?.windClass === "structure") break;
    blockers.push(cursor);
    cursor = troopAt(session, targetRow, cursor.col + 1);
  }

  const destination = blockers.length ? blockers.at(-1).col + 1 : wind.sourceCol;
  const chainBlocked = blockers.length && (
    destination > FIELD.lastTroopCol
    || cellBlocked(session, targetRow, destination, dependencies, blockers.at(-1).id)
  );
  if (cursor || chainBlocked
    || (!blockers.length && cellBlocked(session, targetRow, wind.sourceCol, dependencies, troop.id))) {
    const blocker = troopAt(session, targetRow, wind.sourceCol);
    if (blocker && isWindAnchor(blocker, dependencies)) {
      applyWindCollisionDamage(session, troop, blocker, config, dependencies, events);
    }
    return;
  }

  for (let index = blockers.length - 1; index >= 0; index -= 1) {
    const blocker = blockers[index];
    moveTroop(blocker, targetRow, blocker.col + 1, session.elapsed, events, "windTroopChainShifted");
    session.windCurrent.shiftedTroopIds.push(blocker.id);
  }
  moveTroop(troop, targetRow, wind.sourceCol, session.elapsed, events, "windTroopColumnShifted");
  session.windCurrent.shiftedTroopIds.push(troop.id);
}

`,
  "restaura cadeia lateral do Wind",
);

const windTest = "src/game/windCurrent.test.js";
replaceOnce(
  windTest,
  `  it("abre destino ocupado com cadeia para frente", () => {
    const session = createWindBattle({ troopCount: 0, direction: "lateral", sourceRow: 1, verticalDirection: 1 });
    const shifted = createTroopEntity(session, "sniper", 1, 5);
    const first = createTroopEntity(session, "marine", 2, 5);
    const second = createTroopEntity(session, "marine", 2, 6);
    session.troops.push(shifted, first, second,
      createTroopEntity(session, "marine", 0, 1), createTroopEntity(session, "marine", 3, 1));
    const events = applyGust(session);
    expect([shifted.row, shifted.col]).toEqual([1, 5]);
    expect(first.col).toBe(5);
    expect(second.col).toBe(6);
    expect(events.filter((event) => event.type === "windTroopChainShifted")).toHaveLength(0);
  });`,
  `  it("abre destino ocupado com cadeia para frente", () => {
    const session = createWindBattle({ troopCount: 0, direction: "lateral", sourceRow: 1, verticalDirection: 1 });
    const shifted = createTroopEntity(session, "sniper", 1, 5);
    const first = createTroopEntity(session, "marine", 2, 5);
    const second = createTroopEntity(session, "marine", 2, 6);
    session.troops.push(shifted, first, second,
      createTroopEntity(session, "marine", 0, 1), createTroopEntity(session, "marine", 3, 1));
    const rolls = [0, 0, 0, 0.999];
    session.rng = () => rolls.length ? rolls.shift() : 0;
    const events = applyGust(session);
    expect([shifted.row, shifted.col]).toEqual([2, 5]);
    expect(first.col).toBe(6);
    expect(second.col).toBe(7);
    expect(events.filter((event) => event.type === "windTroopChainShifted")).toHaveLength(2);
  });`,
  "teste real da cadeia lateral",
);

const packageFile = "package.json";
replaceOnce(
  packageFile,
  `npm run sprites:audit:icaro && npm run audit:colosso-caldeira`,
  `npm run sprites:audit:icaro && npm run audit:chapter-six && npm run audit:colosso-caldeira`,
  "audit C6 no CI",
);

const stress = "scripts/stress-phase48.mjs";
replaceOnce(
  stress,
  `  let phaseIndex = 0;
  let forcedAttackIndex = 0;
  let bossRef = null;
  const attacks = ["rift", "fracture", "seismic", "slam"];`,
  `  let phaseIndex = 0;
  let bossRef = null;
  const forcedAttacks = new Set();
  const phaseAttackPlan = new Map([
    [0, ["rift", "slam"]],
    [1, ["fracture"]],
    [2, ["seismic"]],
  ]);`,
  "plano de ataques por fase do stress F48",
);

replaceOnce(
  stress,
  `      if (boss.colossoState === "idle" && !boss.colossoQueuedAttack) {
        if (forcedAttackIndex < attacks.length) {
          const attack = attacks[forcedAttackIndex++];
          if (forceColossoAttack(session, attack).ok) metrics.attackSequence.push(attack);
        } else if (phaseIndex === 0 && ratio > .70) boss.hp = boss.maxHp * .69;
        else if (phaseIndex === 1 && ratio > .35) boss.hp = boss.maxHp * .34;
        else if (phaseIndex === 2 && ratio > .15) boss.hp = boss.maxHp * .14;
        else if (phaseIndex === 3 && ratio > .01) boss.hp = 0;
      }`,
  `      if (boss.colossoState === "idle" && !boss.colossoQueuedAttack) {
        const plannedAttack = (phaseAttackPlan.get(phaseIndex) || [])
          .find((attack) => !forcedAttacks.has(attack));
        if (plannedAttack) {
          const forced = forceColossoAttack(session, plannedAttack);
          if (forced.ok) {
            forcedAttacks.add(plannedAttack);
            metrics.attackSequence.push(plannedAttack);
          }
        } else if (phaseIndex === 0 && ratio > .70) boss.hp = boss.maxHp * .69;
        else if (phaseIndex === 1 && ratio > .35) boss.hp = boss.maxHp * .34;
        else if (phaseIndex === 2 && ratio > .15) boss.hp = boss.maxHp * .14;
        else if (phaseIndex === 3 && ratio > .01) boss.hp = 0;
      }`,
  "força ataques somente nas fases válidas",
);

replaceOnce(
  stress,
  `  if (metrics.peakRegularEnemies > phase.waves[5].maximumLivingEnemies) {
    throw new Error(\`seed \${seed}: limite de inimigos comuns excedido (\${metrics.peakRegularEnemies})\`);
  }
  metrics.averageStepMs = metrics.totalSteps ? metrics.stepMsTotal / metrics.totalSteps : 0;`,
  `  if (metrics.peakRegularEnemies > phase.waves[5].maximumLivingEnemies) {
    throw new Error(\`seed \${seed}: limite de inimigos comuns excedido (\${metrics.peakRegularEnemies})\`);
  }
  const requiredAttacks = ["rift", "slam", "fracture", "seismic"];
  for (const attack of requiredAttacks) {
    if (!metrics.attackSequence.includes(attack)) {
      throw new Error(\`seed \${seed}: ataque obrigatório não exercitado: \${attack}\`);
    }
  }
  for (const bossPhase of [2, 3, "finalCollapse"]) {
    if (!metrics.bossPhases.includes(bossPhase)) {
      throw new Error(\`seed \${seed}: fase do Colosso não exercitada: \${bossPhase}\`);
    }
  }
  if (metrics.peakAlphaEnemies < 1 || metrics.alphaTypes.length < 1) {
    throw new Error(\`seed \${seed}: Alpha não foi exercitado\`);
  }
  if (metrics.riftsOpened < 1) throw new Error(\`seed \${seed}: Rift não foi exercitado\`);
  if (metrics.reinforcementsSpawned < 1) throw new Error(\`seed \${seed}: reforços não foram exercitados\`);
  if (metrics.peakBossEnemies !== 1) throw new Error(\`seed \${seed}: quantidade de bosses inválida (\${metrics.peakBossEnemies})\`);
  const maximumAlphaAlive = session.phase.alphaPressure?.maximumAlphaAlive ?? 1;
  if (metrics.peakAlphaEnemies > maximumAlphaAlive) {
    throw new Error(\`seed \${seed}: limite de Alphas excedido (\${metrics.peakAlphaEnemies}/\${maximumAlphaAlive})\`);
  }
  if (metrics.invalidNumbers !== 0) throw new Error(\`seed \${seed}: números inválidos detectados\`);
  metrics.averageStepMs = metrics.totalSteps ? metrics.stepMsTotal / metrics.totalSteps : 0;`,
  "asserts obrigatórios do stress F48",
);

const portrait = "src/loadout/TroopPortraitTile.jsx";
replaceOnce(
  portrait,
  `import { getTroopPreviewUrl } from "../game/assets/troopPreviewCatalog.js";`,
  `import { getTroopPreviewUrl } from "../game/assets/troopPreviewCatalog.js";
import { getLoadoutTroopVisual } from "./loadoutVisualCatalog.js";`,
  "visual do retrato no loadout",
);
replaceOnce(
  portrait,
  `}) {
  return <article`,
  `}) {
  const portraitClass = getLoadoutTroopVisual(troop).portraitClass;
  return <article`,
  "classe visual do retrato",
);
replaceOnce(
  portrait,
  `      <span className="troop-portrait-image"><img src={getTroopPreviewUrl(troop.id)} alt="" loading="lazy" decoding="async" /></span>`,
  `      <span className={\`troop-portrait-image \${portraitClass}\`.trim()}><img src={getTroopPreviewUrl(troop.id)} alt="" loading="lazy" decoding="async" /></span>`,
  "wide-sprite no retrato",
);

const loadoutTest = "src/loadout/LoadoutPage.test.jsx";
replaceOnce(
  loadoutTest,
  `  it("não cria botões aninhados nem mais de um canvas", () => {`,
  `  it("mantém o retrato largo da Artilheira sem alterar os demais", () => {
    const { container } = renderLoadout({ phase: PHASES[8] });
    const artilheira = screen.getByRole("button", { name: "Selecionar Artilheira de Morteiro" });
    expect(artilheira.closest("article").querySelector(".troop-portrait-image")).toHaveClass("wide-sprite");
    expect(container.querySelectorAll(".troop-portrait-image.wide-sprite")).toHaveLength(1);
  });

  it("mantém o loadout do capítulo 2 em cinco tropas", () => {
    const phase = PHASES[8];
    expect(phase.loadoutLimit).toBe(5);
    renderLoadout({ phase, selected: ["colono"] });
    const dock = screen.getByRole("heading", { name: "Esquadrão" }).closest("section");
    expect(within(dock).getAllByRole("listitem")).toHaveLength(5);
  });

  it("exibe o título do Vórtice no palco e no dossiê", () => {
    renderLoadout({ phase: PHASES[8] });
    const vortex = screen.getByRole("button", { name: "Selecionar Vórtice" });
    fireEvent.mouseEnter(vortex.closest("article"));
    expect(within(stage()).getByText("Executor de Arco")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Informações de Vórtice" }));
    expect(within(screen.getByRole("dialog", { name: "Vórtice" })).getByText("Executor de Arco")).toBeInTheDocument();
  });

  it("abre o dossiê correto sem alterar a seleção", () => {
    const onToggle = vi.fn();
    renderLoadout({ phase: PHASES[8], onToggle });
    const marine = screen.getByRole("button", { name: "Selecionar Marine" });
    fireEvent.mouseEnter(marine.closest("article"));
    fireEvent.click(screen.getByRole("button", { name: "Informações de Marine" }));
    expect(onToggle).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog", { name: "Marine" });
    expect(within(dialog).getByText("Três disparos rápidos contra alvos comuns.")).toBeInTheDocument();
    expect(within(dialog).getByText("4 por disparo")).toBeInTheDocument();
    expect(within(dialog).getByText("3 tiros · intervalo 0,12 s")).toBeInTheDocument();
  });

  it("fecha o dossiê por Escape e backdrop restaurando o foco", async () => {
    renderLoadout();
    const trigger = screen.getByRole("button", { name: "Informações de Colono" });
    fireEvent.click(trigger);
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();

    fireEvent.click(trigger);
    fireEvent.mouseDown(document.querySelector(".troop-info-backdrop"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("não cria botões aninhados nem mais de um canvas", () => {`,
  "restaura cobertura de UI do loadout",
);

const campaignTest = "src/campaign/CampaignPage.test.jsx";
replaceOnce(
  campaignTest,
  `import CampaignWebGLFallback from "./CampaignWebGLFallback.jsx";`,
  `import CampaignWebGLFallback from "./CampaignWebGLFallback.jsx";
import { RouteTransitionProvider } from "../routing/RouteTransitionProvider.jsx";`,
  "provider de transição no teste da campanha",
);

replaceOnce(
  campaignTest,
  `  it("exibe estrelas, melhor tempo e integridade salvos", () => {`,
  `  it("abre a rota da fase apenas pelo botão Preparar operação", async () => {
    localStorage.setItem("genesis-defense:settings:v1", JSON.stringify({ reduceMotion: true, quality: "low" }));
    const campaign = makeCampaign(2);
    render(<MemoryRouter initialEntries={["/fases?capitulo=1"]}>
      <RouteTransitionProvider>
        <Routes>
          <Route path="/fases" element={<><CampaignPage campaign={campaign} /><LocationProbe /></>} />
          <Route path="/jogar/:phaseId" element={<><div>BRIEFING ABERTO</div><LocationProbe /></>} />
        </Routes>
      </RouteTransitionProvider>
    </MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "Cratera Norte" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Cratera Norte" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Preparar operação/i }));
    expect(await screen.findByText("BRIEFING ABERTO")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/jogar/fase_03");
  });

  it("exibe estrelas, melhor tempo e integridade salvos", () => {`,
  "restaura teste de navegação Preparar operação",
);

console.log("Correções gameplay-contracts-final-v2 aplicadas.");