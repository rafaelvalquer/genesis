import { mkdir, writeFile } from "node:fs/promises";

const sampleRate = 22050;
const output = new URL("../src/game/assets/sfx/", import.meta.url);
await mkdir(output, { recursive: true });

function wav(samples) {
  const dataBytes = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write("RIFF", 0); buffer.writeUInt32LE(36 + dataBytes, 4); buffer.write("WAVE", 8);
  buffer.write("fmt ", 12); buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22); buffer.writeUInt32LE(sampleRate, 24); buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34); buffer.write("data", 36); buffer.writeUInt32LE(dataBytes, 40);
  samples.forEach((sample, index) => buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample)) * 32767), 44 + index * 2));
  return buffer;
}

let noiseState = 0x7f4a7c15;
const noise = () => {
  noiseState ^= noiseState << 13; noiseState ^= noiseState >>> 17; noiseState ^= noiseState << 5;
  return ((noiseState >>> 0) / 0xffffffff) * 2 - 1;
};
const render = (seconds, synth) => Float32Array.from({ length: Math.floor(seconds * sampleRate) }, (_, index) => synth(index / sampleRate, index));
const tone = (frequency, time, phase = 0) => Math.sin(Math.PI * 2 * frequency * time + phase);
const fade = (time, duration, attack = .02, release = .12) => Math.min(1, time / attack, (duration - time) / release);

const assets = {
  "c7_engine_loop.wav": render(8, (t) => .22 * tone(42, t) + .1 * tone(84, t) + .05 * tone(126, t) + .025 * noise()),
  "c7_escort_online.wav": render(1.15, (t) => fade(t, 1.15) * (.22 * tone(330 + t * 180, t) + .16 * tone(495 + t * 220, t) + .08 * tone(990, t))),
  "c7_escort_lost.wav": render(1.05, (t) => fade(t, 1.05, .006, .2) * (.2 * tone(460 - t * 230, t) + .14 * tone(690 - t * 310, t) + .08 * noise())),
  "c7_convoy_attack.wav": render(.9, (t) => fade(t, .9, .005, .25) * (.34 * noise() * Math.exp(-t * 5) + .3 * tone(86 - t * 35, t) + .11 * tone(172, t))),
  "c7_convoy_hit.wav": render(.42, (t) => fade(t, .42, .002, .16) * ((.38 * noise() + .24 * tone(74, t)) * Math.exp(-t * 8))),
  "c7_convoy_critical.wav": render(1.4, (t) => fade(t, 1.4, .004, .22) * (.21 * tone(118, t) + .16 * tone(94, t) * (Math.sin(Math.PI * 2 * 4 * t) > 0 ? 1 : .2))),
  "c7_checkpoint.wav": render(1.8, (t) => fade(t, 1.8, .01, .28) * (.18 * tone(220, t) + .2 * tone(330, t) + .18 * tone(440, t) + .09 * tone(880, t))),
  "c7_logistics.wav": render(.7, (t) => fade(t, .7, .008, .16) * (.16 * tone(620 + t * 430, t) + .13 * tone(930 + t * 260, t) + .06 * noise())),
  "c7_reserve_empty.wav": render(1.25, (t) => fade(t, 1.25, .004, .24) * (.19 * tone(205 - t * 55, t) + .12 * tone(102.5, t) + .07 * noise())),
  "c7_reinforcement.wav": render(1.6, (t) => fade(t, 1.6, .008, .28) * (.17 * tone(180 + t * 70, t) + .13 * tone(270 + t * 105, t) + .08 * noise())),
  "c7_destruction.wav": render(2.6, (t) => fade(t, 2.6, .004, .55) * ((.42 * noise() + .28 * tone(52 - t * 8, t)) * Math.exp(-t * .8) + .12 * tone(104, t))),
  "c7_evacuation.wav": render(3.4, (t) => fade(t, 3.4, .02, .5) * (.17 * tone(196 + t * 32, t) + .16 * tone(294 + t * 48, t) + .13 * tone(392 + t * 64, t) + .05 * noise())),
  "c7_frontier_music.wav": render(24, (t) => {
    const roots = [55, 65.406, 73.416, 49];
    const root = roots[Math.floor(t / 6) % roots.length];
    const pulse = Math.pow(Math.max(0, Math.sin(Math.PI * 2 * 2 * t)), 12);
    const dust = noise() * .018 * (0.4 + pulse);
    return .11 * tone(root, t) + .055 * tone(root * 1.5, t) + .045 * tone(root * 2, t)
      + .035 * tone(root * 3, t) + .045 * pulse * tone(44, t) + dust;
  }),
};

for (const [name, samples] of Object.entries(assets)) {
  await writeFile(new URL(name, output), wav(samples));
  console.log(name);
}
