import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const sourceRoot = "C:/Users/Z565244/.codex/generated_images/01a020a5-3b73-7200-98db-c03fca21834f";
const bossAttackSheet = new URL(
  "../tools/source-art/marechalForja-attack-sheet.png",
  import.meta.url,
);
const bossOnly = process.argv.includes("--boss-only");
const enemies = {
  legionaroFerrugem: "exec-14b868ff-4ca4-45f5-a3d3-7dbc739864fb.png",
  saqueadorEscoria: "exec-33c8317b-0889-4cc7-a9b8-0be302c45ded.png",
  couracadoHematita: "exec-1e9fc90e-1fe5-4226-9c3b-c1f66fb0f04f.png",
  cacadorComboio: "exec-c6b0e810-d693-4377-95e6-90971aba87ea.png",
  sabotadorOxido: "exec-8001a71b-cb19-4bd5-82af-010abcc76534.png",
  atiradorRavina: "exec-e7682061-ed13-4fa1-9b5f-4046562c22c6.png",
  marechalForja: "exec-59c8d5ad-1466-4848-85cf-bdaac3653d75.png",
};

async function screenToAlpha(path) {
  const image = sharp(path).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  for (let index = 0; index < data.length; index += 4) {
    const max = Math.max(data[index], data[index + 1], data[index + 2]);
    const alpha = Math.max(0, Math.min(255, Math.round((max - 4) * 2.2)));
    data[index + 3] = Math.min(data[index + 3], alpha);
  }
  return sharp(data, { raw: info }).png().toBuffer();
}

async function sourceCutout(path) {
  return screenToAlpha(path);
}

async function frame(source, state, index, boss = false) {
  const phase = index / 8 * Math.PI * 2;
  const bob = state === "idle" ? Math.round(Math.sin(phase) * 2)
    : state === "walking" ? Math.round(Math.sin(phase * 2) * 6) : Math.round(Math.sin(phase) * 3);
  const lunge = state === "attack" ? Math.round((1 - Math.cos(phase)) * -8) : 0;
  const angle = state === "walking" ? Math.sin(phase) * 1.4 : state === "attack" ? Math.sin(phase) * .7 : 0;
  const width = boss ? 384 : 340;
  const height = boss ? 456 : 418;
  const sprite = await sharp(source).trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(width + (state === "attack" ? Math.round((1 - Math.cos(phase)) * 8) : 0), height, {
      fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .rotate(angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  return sharp({ create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: sprite, gravity: "south", left: Math.max(0, Math.round((512 - width) / 2 + lunge)), top: Math.max(0, 512 - height + bob - 12) }])
    .png({ compressionLevel: 9, palette: true, quality: 92 }).toBuffer();
}

async function bossAttackFrame(index) {
  const sheet = sharp(fileURLToPath(bossAttackSheet)).ensureAlpha();
  const { width, height } = await sheet.metadata();
  const column = index % 4;
  const row = Math.floor(index / 4);
  const left = Math.round(column * width / 4);
  const top = row === 0
    ? 0
    : Math.round(height / 2) + 55;
  const right = Math.round((column + 1) * width / 4);
  const bottom = Math.round((row + 1) * height / 2);
  const cell = await sheet
    .extract({
      left,
      top,
      width: right - left,
      height: bottom - top,
    })
    .png()
    .toBuffer();
  const sprite = await sharp(cell)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(440, 456, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{
      input: sprite,
      gravity: "south",
      left: 36,
      top: 88,
    }])
    .png({ compressionLevel: 9, palette: true, quality: 92 })
    .toBuffer();
}

const conceptDirectory = new URL("../src/game/assets/enemy/concepts/", import.meta.url);
await mkdir(conceptDirectory, { recursive: true });
const entries = bossOnly
  ? [["marechalForja", enemies.marechalForja]]
  : Object.entries(enemies);

for (const [id, filename] of entries) {
  const path = `${sourceRoot}/${filename}`;
  const cutout = await sourceCutout(path);
  await sharp(path).resize(640, 640, { fit: "contain", background: "#050708" }).webp({ quality: 88 }).toFile(fileURLToPath(new URL(`${id}.webp`, conceptDirectory)));
  for (const state of ["idle", "walking", "attack"]) {
    const directory = new URL(`../src/game/assets/enemy/${id}/${state}/`, import.meta.url);
    await mkdir(directory, { recursive: true });
    for (let index = 0; index < 8; index += 1) {
      const generatedFrame = (
        id === "marechalForja" && state === "attack"
          ? await bossAttackFrame(index)
          : await frame(cutout, state, index, id === "marechalForja")
      );
      await sharp(generatedFrame).toFile(fileURLToPath(new URL(`frame${index}.png`, directory)));
    }
  }
  console.log(id);
}

if (!bossOnly) {
const convoySource = `${sourceRoot}/exec-e6ca3f29-57c7-41b8-8c1d-abed9c455fe9.png`;
const { data, info } = await sharp(convoySource).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
for (let index = 0; index < data.length; index += 4) {
  const min = Math.min(data[index], data[index + 1], data[index + 2]);
  data[index + 3] = Math.max(0, Math.min(255, Math.round((238 - min) * 7)));
}
const convoyDirectory = new URL("../src/game/assets/chapter07/", import.meta.url);
await mkdir(convoyDirectory, { recursive: true });
await sharp(data, { raw: info }).trim({ background: { r: 255, g: 255, b: 255, alpha: 0 } })
  .resize(720, 300, { fit: "contain" }).png({ compressionLevel: 9 }).toFile(fileURLToPath(new URL("convoy.png", convoyDirectory)));
console.log("convoy");
}
