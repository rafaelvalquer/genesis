#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || process.cwd());
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const checks = [];
const requireText = (content, value, label) => checks.push({
  ok: content.includes(value),
  label,
});
const rejectText = (content, value, label) => checks.push({
  ok: !content.includes(value),
  label,
});

const canvas = read("src/game/GameCanvas.jsx");
const styles = read("src/styles.css");
const hotkeys = read("src/game/battleHotkeys.js");
const icons = read("src/game/components/BattleControlIcons.jsx");
const fullscreen = read("src/game/hooks/useBattleFullscreen.js");

requireText(canvas, 'from "./components/BattleControlIcons.jsx"', "importação dos ícones");
requireText(canvas, 'from "./hooks/useBattleFullscreen.js"', "importação do hook de tela cheia");
requireText(canvas, "useBattleFullscreen(battleShellRef)", "inicialização do fullscreen");
requireText(canvas, "ref={battleShellRef}", "alvo da Fullscreen API");
requireText(canvas, "<PauseIcon />", "ícone real de pausa");
requireText(canvas, "<PlayIcon />", "ícone de continuar");
requireText(canvas, "<EnterFullscreenIcon />", "ícone para entrar em tela cheia");
requireText(canvas, "<ExitFullscreenIcon />", "ícone para sair da tela cheia");
requireText(canvas, 'aria-keyshortcuts="F"', "atalho acessível de tela cheia");
requireText(canvas, 'action.type === "toggleFullscreen"', "tratamento da hotkey F");
requireText(canvas, 'action.type === "cancelTool" && isFullscreen', "prioridade do Escape");
requireText(canvas, "handleBattleExit", "saída segura da batalha");
rejectText(canvas, '{paused ? "▶" : "Ⅱ"}', "remoção do numeral romano do botão");
requireText(hotkeys, 'event.code === "KeyF"', "mapeamento da tecla F");
requireText(icons, "<rect", "barras vetoriais da pausa");
requireText(fullscreen, "requestFullscreen", "entrada pela Fullscreen API");
requireText(fullscreen, "exitFullscreen", "saída pela Fullscreen API");
requireText(fullscreen, "webkitRequestFullscreen", "fallback WebKit");
requireText(styles, "Genesis battle controls fullscreen v1.1.0", "estilos dos controles");
requireText(styles, ".battle-shell:fullscreen", "layout em tela cheia");

const failed = checks.filter((entry) => !entry.ok);
if (failed.length) {
  console.error(`Contrato dos controles reprovado: ${failed.length} falha(s).`);
  failed.forEach((entry) => console.error(`- ${entry.label}`));
  process.exit(1);
}

console.log(`Contrato dos controles aprovado: ${checks.length} verificações.`);
