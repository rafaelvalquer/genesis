import fs from "node:fs/promises";
import path from "node:path";

const output = path.resolve("src/game/assets/sfx");
const sounds = {
  colosso_awaken: [64, 1.7], colosso_rift_charge: [165, .72], colosso_rift_open: [84, .88],
  colosso_slam_charge: [95, .72], colosso_slam_impact: [48, .82], colosso_fracture: [112, .92],
  colosso_seismic_charge: [72, .85], colosso_seismic_impact: [38, 1.0], colosso_core_open: [210, .8],
  colosso_phase2: [98, 1.1], colosso_phase3: [58, 1.2], colosso_final_collapse: [46, 1.45], colosso_death: [36, 1.8],
};
const rate = 22050;

function wav(frequency, duration, seed) {
  const length = Math.floor(rate * duration); const pcm = Buffer.alloc(length * 2);
  for (let sample = 0; sample < length; sample += 1) {
    const t = sample / rate; const envelope = Math.pow(1 - sample / length, 1.55);
    const noise = Math.sin((sample + seed * 71) * .137) * .16;
    const value = (Math.sin(Math.PI * 2 * frequency * t) * .55 + Math.sin(Math.PI * 2 * frequency * .49 * t) * .25 + noise) * envelope;
    pcm.writeInt16LE(Math.max(-1, Math.min(1, value)) * 32767, sample * 2);
  }
  const header = Buffer.alloc(44); header.write("RIFF", 0); header.writeUInt32LE(36 + pcm.length, 4); header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22); header.writeUInt32LE(rate, 24); header.writeUInt32LE(rate * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write("data", 36); header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

await fs.mkdir(output, { recursive: true });
for (const [index, [name, [frequency, duration]]] of Object.entries(sounds).entries()) await fs.writeFile(path.join(output, `${name}.wav`), wav(frequency, duration, index));
console.log(`Generated ${Object.keys(sounds).length} Colosso SFX files.`);
