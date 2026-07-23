import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SAMPLE_RATE = 44100;
const outputDir = join(process.cwd(), "src", "game", "assets", "sfx");
const temporaryDir = join(process.cwd(), "tmp", "wind-sfx");

function rngFor(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ result >>> 15, result | 1);
    result ^= result + Math.imul(result ^ result >>> 7, result | 61);
    return ((result ^ result >>> 14) >>> 0) / 4294967296;
  };
}

function lowPassNoise(random, smoothing = 0.985) {
  let state = 0;
  return () => {
    state = state * smoothing + (random() * 2 - 1) * (1 - smoothing);
    return state;
  };
}

function writeWav(path, samples) {
  const buffer = Buffer.alloc(44 + samples.length * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + samples.length * 2, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((sample, index) => {
    buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample)) * 32767), 44 + index * 2);
  });
  writeFileSync(path, buffer);
}

function synthesize(duration, seed, render) {
  const count = Math.round(duration * SAMPLE_RATE);
  const random = rngFor(seed);
  const noise = lowPassNoise(random);
  return Array.from({ length: count }, (_, index) => {
    const time = index / SAMPLE_RATE;
    const progress = index / Math.max(1, count - 1);
    return render({ time, progress, random, noise });
  });
}

const sounds = {
  "wind_warning.ogg": synthesize(1.8, 1101, ({ time, progress, noise }) => {
    const envelope = Math.sin(progress * Math.PI) ** 0.75;
    const tone = Math.sin(time * Math.PI * 2 * (190 + progress * 260));
    return (noise() * 4.2 + tone * 0.18) * envelope * 0.62;
  }),
  "wind_active_loop.ogg": synthesize(4, 2202, ({ time, progress, noise }) => {
    const seamless = 0.78 + Math.sin(progress * Math.PI * 2) * 0.08;
    return (noise() * 5.4 + Math.sin(time * Math.PI * 2 * 54) * 0.025) * seamless * 0.48;
  }),
  "wind_primary_gust.ogg": synthesize(1.25, 3303, ({ time, progress, noise }) => {
    const attack = Math.min(1, progress * 14);
    const release = (1 - progress) ** 1.8;
    return (noise() * 6.8 + Math.sin(time * Math.PI * 2 * 78) * 0.13) * attack * release * 0.72;
  }),
  "wind_troop_shift.ogg": synthesize(0.72, 4404, ({ time, progress, noise }) => {
    const envelope = Math.sin(progress * Math.PI);
    return (noise() * 4.8 + Math.sin(time * Math.PI * 2 * (310 - progress * 120)) * 0.08) * envelope * 0.5;
  }),
  "wind_ejection.ogg": synthesize(1.35, 5505, ({ time, progress, noise }) => {
    const tone = Math.sin(time * Math.PI * 2 * (420 - progress * 350));
    return (noise() * 5 + tone * 0.22) * Math.sin(progress * Math.PI) * 0.58;
  }),
  "wind_recovery.ogg": synthesize(1.65, 6606, ({ time, progress, noise }) => {
    const tone = Math.sin(time * Math.PI * 2 * (110 + progress * 90));
    return (noise() * 3.2 + tone * 0.12) * (1 - progress) * 0.48;
  }),
  "thunder_distant_1.ogg": synthesize(3.6, 7707, ({ time, progress, noise }) => {
    const rumble = Math.sin(time * Math.PI * 2 * 38) * 0.22 + noise() * 7;
    const strike = Math.exp(-progress * 18);
    return rumble * (strike + (1 - progress) * 0.16) * 0.62;
  }),
  "thunder_distant_2.ogg": synthesize(4.1, 8808, ({ time, progress, noise }) => {
    const doubleStrike = Math.exp(-progress * 24) + Math.exp(-Math.max(0, progress - 0.18) * 18) * (progress > 0.18 ? 0.55 : 0);
    return (noise() * 7.5 + Math.sin(time * Math.PI * 2 * 31) * 0.2)
      * (doubleStrike + (1 - progress) * 0.12) * 0.58;
  }),
};

mkdirSync(outputDir, { recursive: true });
mkdirSync(temporaryDir, { recursive: true });
for (const [filename, samples] of Object.entries(sounds)) {
  const wavPath = join(temporaryDir, filename.replace(/\.ogg$/, ".wav"));
  const oggPath = join(outputDir, filename);
  writeWav(wavPath, samples);
  const result = spawnSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-i", wavPath,
    "-c:a", "libvorbis", "-q:a", "5", oggPath,
  ], { stdio: "inherit" });
  if (result.status !== 0) throw new Error(`ffmpeg failed for ${filename}`);
}
rmSync(temporaryDir, { recursive: true, force: true });
console.log(`Generated ${Object.keys(sounds).length} wind sound effects in ${outputDir}`);
