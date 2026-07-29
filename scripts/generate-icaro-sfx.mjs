import fs from "node:fs/promises";
import path from "node:path";

const sampleRate = 22050;
const output = path.resolve("src/game/assets/sfx");

function wav(samples) {
  const dataBytes = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataBytes, 40);
  samples.forEach((sample, index) =>
    buffer.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(sample * 32767))), 44 + index * 2));
  return buffer;
}

function synth(duration, voice) {
  const length = Math.round(sampleRate * duration);
  return Array.from({ length }, (_, index) => {
    const time = index / sampleRate;
    const progress = index / length;
    const envelope = Math.sin(Math.PI * Math.min(1, progress * 5))
      * Math.max(0, 1 - progress) ** 1.6;
    return voice(time, progress) * envelope * 0.72;
  });
}

const sounds = {
  icaro_burst_shot: synth(0.09, (time, progress) =>
    Math.sin(2 * Math.PI * (620 - progress * 260) * time) + Math.sin(2 * Math.PI * 95 * time) * 0.35),
  icaro_interception_lock: synth(0.32, (time, progress) =>
    Math.sin(2 * Math.PI * (390 + progress * 760) * time) * 0.62 + Math.sin(2 * Math.PI * 78 * time) * 0.22),
  icaro_interception_fire: synth(0.18, (time, progress) =>
    Math.sin(2 * Math.PI * (290 - progress * 120) * time) * 0.55 + Math.sin(2 * Math.PI * 880 * time) * 0.4),
  icaro_death: synth(0.4, (time, progress) =>
    Math.sin(2 * Math.PI * (180 - progress * 120) * time) * 0.7 + Math.sin(2 * Math.PI * 47 * time) * 0.3),
};

await fs.mkdir(output, { recursive: true });
await Promise.all(Object.entries(sounds).map(([name, samples]) =>
  fs.writeFile(path.join(output, `${name}.wav`), wav(samples))));
console.log("Áudios do Interceptador Ícaro gerados.");
