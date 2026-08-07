#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
const root=path.resolve(process.argv[2]||process.cwd());
const read=(p)=>fs.readFileSync(path.join(root,p),"utf8");
const canvas=read("src/game/GameCanvas.jsx");
const battle=read("src/game/battleModel.js");
const gfx=read("src/game/graphicsRuntime.js");
const css=read("src/styles.css");
const checks=[
 [!canvas.includes('from "./waveOutro/'),"GameCanvas sem imports dos módulos v2 antigos"],
 [!battle.includes('from "./waveOutro/'),"battleModel sem imports dos módulos v2 antigos"],
 [canvas.includes("SAFE_WAVE_OUTRO_PROFILES"),"perfil cinematográfico seguro presente"],
 [canvas.includes("getSafeWaveOutroMusicVolume"),"ducking seguro presente"],
 [canvas.includes("export function getWaveOutroCameraTransform"),"câmera local presente"],
 [canvas.includes("session={sessionRef.current}"),"overlay recebe sessão somente como dado"],
 [battle.includes("finalKillSlowMotionMs: 600"),"timing lógico estável restaurado"],
 [battle.includes("const WAVE_OUTRO_PHASE_ENDS = Object.freeze"),"limites lógicos estáveis restaurados"],
 [battle.includes("function rememberEnemyKill(session, enemy, sourceTroopId = null)"),"snapshot de kill estável restaurado"],
 [!battle.includes("profileId: getWaveOutroProfileId"),"campos experimentais removidos do motor"],
 [!gfx.includes("cinematicFreezeUntil"),"hit-stop experimental removido do runtime"],
 [css.includes("wave-outro-cinematic-safe-v2.1"),"CSS seguro presente"],
 [!css.includes("wave-outro-cinematic-v2 */"),"CSS experimental anterior removido"],
];
let failed=0; for(const [ok,label] of checks){ console.log(`${ok?"OK":"FALHOU"} - ${label}`); if(!ok) failed++; }
if(failed){ console.error(`\n${failed} verificação(ões) falharam.`); process.exit(1); }
console.log(`\n${checks.length}/${checks.length} verificações estruturais passaram.`);
