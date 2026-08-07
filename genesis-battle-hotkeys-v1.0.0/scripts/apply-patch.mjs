#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || process.cwd());
const canvasPath = path.join(root, "src/game/GameCanvas.jsx");
const stylesPath = path.join(root, "src/styles.css");

const read = (file) => fs.readFileSync(file, "utf8");
const write = (file, content) => fs.writeFileSync(file, content, "utf8");

function replaceOnce(content, search, replacement, label) {
  const index = content.indexOf(search);
  if (index < 0) throw new Error(`Âncora não encontrada: ${label}`);
  if (content.indexOf(search, index + search.length) >= 0) {
    throw new Error(`Âncora ambígua: ${label}`);
  }
  return content.slice(0, index) + replacement + content.slice(index + search.length);
}

let canvas = read(canvasPath);

if (!canvas.includes('from "./battleHotkeys.js"')) {
  canvas = replaceOnce(
    canvas,
    'import { useBattleLoopControls } from "./hooks/useBattleLoop.js";',
    'import { useBattleLoopControls } from "./hooks/useBattleLoop.js";\nimport {\n  getNextBattleSpeed,\n  getTroopSlotAvailability,\n  resolveBattleHotkey,\n  useBattleHotkeys,\n} from "./battleHotkeys.js";',
    "importação de useBattleLoopControls",
  );
}

if (!canvas.includes("useBattleHotkeys((event) =>")) {
  const anchor = '  const positionalTargeting = fortuneTargeting || Boolean(targetingDecision) || waveOutroActive;\n\n  if (!loading.ready) {';
  const block = `  const positionalTargeting = fortuneTargeting || Boolean(targetingDecision) || waveOutroActive;

  useBattleHotkeys((event) => {
    const action = resolveBattleHotkey(event);
    if (!action || snapshot.outcome) return;

    event.preventDefault();

    if (action.type === "togglePause") {
      if (!fortuneTargeting) setPaused((current) => !current);
      return;
    }

    if (action.type === "selectTroop") {
      const troopId = loadout[action.loadoutIndex];
      const troop = TROOPS[troopId];
      if (!troopId || !troop) return;

      const availability = getTroopSlotAvailability({
        troopId,
        troop,
        snapshot,
        sandbox,
        sandboxSettings: sandboxSettingsState,
        positionalTargeting,
      });

      if (!availability.available) {
        setMessage(availability.message);
        return;
      }

      if (selectedTroop === troopId && !removeMode) {
        setSelectedTroop(null);
        setMessage("Mão livre ativada.");
        return;
      }

      setRemoveMode(false);
      setSelectedTroop(troopId);
      setMessage(
        troop.label + " selecionado · tecla " + (action.loadoutIndex + 1) + ".",
      );
      return;
    }

    if (action.type === "cancelTool") {
      if (targetingDecision || sessionRef.current.adaptiveAid?.status === "targeting") return;
      setSelectedTroop(null);
      setRemoveMode(false);
      setMessage("Ferramenta cancelada · mão livre ativada.");
      return;
    }

    if (action.type === "toggleRemove") {
      if (positionalTargeting) return;
      setSelectedTroop(null);
      setRemoveMode((current) => {
        const next = !current;
        setMessage(next ? "Modo de remoção ativado · tecla R." : "Modo de remoção desativado.");
        return next;
      });
      return;
    }

    if (action.type === "startWave") {
      const hotkeyCanStartWave = !sandbox
        && snapshot.preparing
        && !snapshot.pendingDecision
        && !waveOutroActive
        && !targetingDecision
        && !snapshot.outcome
        && !fortuneBlocksIntermission;

      if (hotkeyCanStartWave) handleStartWave();
      else setMessage("A onda não pode ser iniciada agora.");
      return;
    }

    if (action.type === "adjustSpeed") {
      if (paused || fortuneTargeting) return;
      const nextSpeed = getNextBattleSpeed(speed, sandbox, action.direction);
      if (nextSpeed !== speed) {
        setSpeed(nextSpeed);
        setMessage("Velocidade alterada para " + nextSpeed + "×.");
      }
    }
  }, loading.ready);

  if (!loading.ready) {`;
  canvas = replaceOnce(canvas, anchor, block, "início do loader de batalha");
}

if (!canvas.includes("loadout.map((troopId, index) =>")) {
  canvas = replaceOnce(
    canvas,
    "loadout.map((troopId) => {",
    "loadout.map((troopId, index) => {",
    "mapeamento visual do loadout",
  );
}

if (!canvas.includes('aria-keyshortcuts={String(index + 1)}')) {
  canvas = replaceOnce(
    canvas,
    "disabled={disabled} aria-label={slotLabel} aria-describedby=",
    "disabled={disabled} aria-label={slotLabel} aria-keyshortcuts={String(index + 1)} aria-describedby=",
    "atributos acessíveis do slot",
  );
}

if (!canvas.includes('className="troop-hotkey"')) {
  canvas = replaceOnce(
    canvas,
    'onClick={() => { setRemoveMode(false); setSelectedTroop(troopId); }}>\n              <span className="troop-portrait"',
    'onClick={() => { setRemoveMode(false); setSelectedTroop(troopId); }}>\n              <span className="troop-hotkey" aria-hidden="true">{index + 1}</span>\n              <span className="troop-portrait"',
    "conteúdo do cartão da tropa",
  );
}

if (!canvas.includes('aria-keyshortcuts="Space"')) {
  canvas = replaceOnce(
    canvas,
    '<button className="icon-button" disabled={fortuneTargeting} onClick={() => setPaused((value) => !value)}>{paused ? "▶" : "Ⅱ"}</button>',
    '<button type="button" className="icon-button" disabled={fortuneTargeting} aria-label={paused ? "Continuar simulação" : "Pausar simulação"} aria-keyshortcuts="Space" title="Pausar ou continuar · Espaço" onClick={() => setPaused((value) => !value)}>{paused ? "▶" : "Ⅱ"}</button>',
    "botão de pausa",
  );
}

if (!canvas.includes('aria-keyshortcuts="+ -"')) {
  canvas = replaceOnce(
    canvas,
    '<button className="speed-button" disabled={paused || fortuneTargeting}',
    '<button type="button" className="speed-button" aria-label="Alterar velocidade da batalha" aria-keyshortcuts="+ -" title="Velocidade · teclas + e -" disabled={paused || fortuneTargeting}',
    "botão de velocidade",
  );
}

if (!canvas.includes('aria-keyshortcuts="Escape"')) {
  canvas = replaceOnce(
    canvas,
    'className="release-tool-button topbar-tool-button" disabled={positionalTargeting} onClick={releaseMouseTool} title="Também disponível com o botão direito no campo"',
    'className="release-tool-button topbar-tool-button" disabled={positionalTargeting} aria-keyshortcuts="Escape" onClick={releaseMouseTool} title="Mão livre · Esc ou botão direito no campo"',
    "botão de mão livre",
  );
}

if (!canvas.includes('aria-keyshortcuts="R"')) {
  canvas = replaceOnce(
    canvas,
    '<button type="button" disabled={positionalTargeting} className={`remove-button ${removeMode ? "active" : ""}`} onClick={() => { setRemoveMode((value) => !value); setSelectedTroop(null); }}>⌫ Remover · {Math.round(snapshot.refundRate * 100)}%</button>',
    '<button type="button" disabled={positionalTargeting} aria-keyshortcuts="R" className={`remove-button ${removeMode ? "active" : ""}`} onClick={() => { setRemoveMode((value) => !value); setSelectedTroop(null); }}>⌫ Remover · {Math.round(snapshot.refundRate * 100)}% <kbd>R</kbd></button>',
    "botão de remoção",
  );
}

if (!canvas.includes('className="battle-hotkey-help"')) {
  canvas = replaceOnce(
    canvas,
    '          {inspectedTroop && <div id={`troop-help-${inspectedTroopId}`} className="troop-tooltip"',
    '          <div className="battle-hotkey-help" aria-label="Atalhos da batalha">\n            <span><kbd>1–8</kbd> Tropas</span><span><kbd>Espaço</kbd> Pausa</span><span><kbd>R</kbd> Remover</span><span><kbd>Esc</kbd> Cancelar</span><span><kbd>Enter</kbd> Onda</span>\n          </div>\n          {inspectedTroop && <div id={`troop-help-${inspectedTroopId}`} className="troop-tooltip"',
    "tooltip da tropa",
  );
}

if (!canvas.includes('aria-keyshortcuts="Enter"')) {
  canvas = replaceOnce(
    canvas,
    '<button className="start-wave containment-start-wave" onClick={handleStartWave}>',
    '<button type="button" className="start-wave containment-start-wave" aria-keyshortcuts="Enter" title="Iniciar onda · Enter" onClick={handleStartWave}>',
    "botão de início de onda",
  );
}

if (!canvas.includes("Pressione Espaço para continuar")) {
  canvas = replaceOnce(
    canvas,
    '{paused && <div className="pause-overlay"><span>SIMULAÇÃO PAUSADA</span><button onClick={() => setPaused(false)}>Continuar</button></div>}',
    '{paused && <div className="pause-overlay"><span>SIMULAÇÃO PAUSADA</span><small>Pressione Espaço para continuar</small><button type="button" onClick={() => setPaused(false)}>Continuar</button></div>}',
    "sobreposição de pausa",
  );
}

write(canvasPath, canvas);

let styles = read(stylesPath);
const styleMarker = "/* Genesis battle hotkeys v1.0.0 */";
if (!styles.includes(styleMarker)) {
  styles += `

${styleMarker}
.troop-slot {
  position: relative;
}

.troop-hotkey {
  position: absolute;
  top: 7px;
  left: 7px;
  z-index: 4;
  display: grid;
  place-items: center;
  min-width: 23px;
  height: 23px;
  padding: 0 5px;
  border: 1px solid color-mix(in srgb, var(--troop-color) 72%, #e2e8f0);
  border-radius: 6px;
  background: rgba(2, 6, 23, .9);
  color: #f8fafc;
  font: 700 12px/1 "Chakra Petch", Inter, sans-serif;
  box-shadow: 0 0 10px color-mix(in srgb, var(--troop-color) 28%, transparent);
  pointer-events: none;
}

.troop-slot.selected .troop-hotkey {
  background: color-mix(in srgb, var(--troop-color) 32%, rgba(2, 6, 23, .94));
  border-color: #f8fafc;
  transform: translateY(-1px);
}

.troop-slot:disabled .troop-hotkey {
  opacity: .52;
  filter: grayscale(.35);
}

.remove-button kbd,
.battle-hotkey-help kbd {
  display: inline-grid;
  place-items: center;
  min-width: 22px;
  min-height: 20px;
  padding: 1px 5px;
  border: 1px solid rgba(148, 163, 184, .48);
  border-bottom-color: rgba(226, 232, 240, .72);
  border-radius: 5px;
  background: rgba(15, 23, 42, .84);
  color: #e2e8f0;
  font: 700 10px/1 "Chakra Petch", Inter, sans-serif;
  box-shadow: inset 0 -2px 0 rgba(255, 255, 255, .08);
}

.battle-hotkey-help {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 9px;
  margin-top: 10px;
  padding: 9px 10px;
  border: 1px solid rgba(56, 189, 248, .16);
  border-radius: 8px;
  background: rgba(2, 6, 23, .44);
  color: rgba(203, 213, 225, .78);
  font-size: 10px;
  line-height: 1.35;
}

.battle-hotkey-help span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.pause-overlay small {
  color: rgba(226, 232, 240, .72);
  font: 600 12px/1.4 Inter, sans-serif;
  letter-spacing: .02em;
}

@media (max-width: 900px), (pointer: coarse) {
  .battle-hotkey-help {
    display: none;
  }

  .troop-hotkey {
    opacity: .68;
  }
}
`;
  write(stylesPath, styles);
}

console.log("Hotkeys de batalha aplicadas com sucesso.");
