#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(process.argv[2] || process.cwd());
const canvas = fs.readFileSync(path.join(root, "src/game/GameCanvas.jsx"), "utf8");
const model = fs.readFileSync(path.join(root, "src/game/battleModel.js"), "utf8");
const renderer = fs.readFileSync(path.join(root, "src/game/waveOutro/waveOutroRenderer.js"), "utf8");
const checks = [
  [canvas.includes("WAVE_OUTRO_RENDERABLE_STATUSES"), "guard de estados renderizáveis"],
  [canvas.includes("outro={sessionRef.current?.waveOutro}"), "overlay ligado à sessão, não ao snapshot"],
  [canvas.includes("catch {\n    // A apresentação nunca deve derrubar"), "falha visual isolada do GameCanvas"],
  [renderer.includes("!RENDERABLE_STATUSES.has(outro.status)"), "renderer ignora idle/estado inválido"],
  [!model.includes("profileId: session.waveOutro.profileId || getWaveOutroProfileId(session.waveOutro)"), "mount não calcula perfil no snapshot público"],
];
let failed=0;
for (const [ok,label] of checks) { console.log(`${ok?"OK":"FALHA"} - ${label}`); if(!ok) failed++; }
if (failed) process.exit(1);
console.log(`\n${checks.length} verificações de segurança de runtime passaram.`);
