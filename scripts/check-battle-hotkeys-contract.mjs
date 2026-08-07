#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || process.cwd());
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const checks = [];
const requireText = (content, value, label) => checks.push({ ok: content.includes(value), label });

const canvas = read("src/game/GameCanvas.jsx");
const styles = read("src/styles.css");
const hotkeys = read("src/game/battleHotkeys.js");

requireText(canvas, 'from "./battleHotkeys.js"', "importação do módulo de hotkeys");
requireText(canvas, "useBattleHotkeys((event) =>", "listener central de teclado");
requireText(canvas, "resolveBattleHotkey(event)", "resolução das ações de teclado");
requireText(canvas, "getTroopSlotAvailability({", "validação do slot antes da seleção");
requireText(canvas, "loadout.map((troopId, index) =>", "índice visual do loadout");
requireText(canvas, 'className="troop-hotkey"', "marcador numérico no cartão");
requireText(canvas, 'aria-keyshortcuts={String(index + 1)}', "atalho acessível do slot");
requireText(canvas, 'className="battle-hotkey-help"', "ajuda rápida de controles");
requireText(canvas, 'aria-keyshortcuts="Space"', "atalho acessível da pausa");
requireText(styles, "Genesis battle hotkeys v1.0.0", "estilos da funcionalidade");
requireText(hotkeys, 'event.code === "Space"', "mapeamento da barra de espaço");
requireText(hotkeys, 'event.code === "KeyR"', "mapeamento do modo de remoção");
requireText(hotkeys, 'event.code === "Enter"', "mapeamento do início de onda");

const failed = checks.filter((entry) => !entry.ok);
if (failed.length) {
  console.error(`Contrato de hotkeys reprovado: ${failed.length} falha(s).`);
  failed.forEach((entry) => console.error(`- ${entry.label}`));
  process.exit(1);
}
console.log(`Contrato de hotkeys aprovado: ${checks.length} verificações.`);
