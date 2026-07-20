import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const ART_ROOT = path.join(ROOT, "art", "spritesheets");
const DEPLOY_ROOT = path.join(ROOT, "src", "game", "assets", "enemy");
const FRAME_SIZE = 256;
const FRAME_COUNT = 8;
const GRID_COLUMNS = 4;
const GRID_ROWS = 2;
const CELL_INSET = 12;
const MAX_WIDTH = 244;
const MAX_HEIGHT = 238;
const ROOT_Y = 248;
const CENTER_X = 128;

const ENEMIES = {
  medu: ["idle", "walking", "attack"],
  neurax: ["idle", "walking", "attack"],
  oculis: ["idle", "walking", "attack"],
  crix: ["idle", "walking", "attack"],
  vexar: ["idle", "walking", "attack"],
  silex: ["idle", "walking", "attack"],
  estilha: ["idle", "walking", "attack"],
  vitrarca: ["idle", "walking", "attack"],
  obsidonte: ["idle", "walking", "attack"],
  refrator: ["idle", "walking", "attack"],
  crisalio: ["idle", "walking", "attack", "pulse"],
  silicaDigger: ["idle", "walking", "attack"],
  duneRipper: ["idle", "walking", "attack", "roar"],
  krulax: ["idle", "walking", "attack"],
  myrkon: ["idle", "walking", "attack"],
  zhyra: ["idle", "walking", "attack"],
};
const AIRBORNE_ENEMIES = new Set(["medu", "neurax", "oculis", "refrator"]);
const EXTRA_PADDED_ENEMIES = new Set([
  "medu", "neurax", "oculis", "crix", "vexar", "silex", "silicaDigger", "duneRipper",
  "krulax", "myrkon", "zhyra",
]);
const GREEN_CHROMA_ENEMIES = new Set(["zhyra"]);
const CARTOON_PALETTE_ENEMIES = new Set(["krulax", "myrkon", "zhyra", "duneRipper"]);
const LEGACY_CHROMA_ENEMIES = new Set([
  "estilha", "vitrarca", "obsidonte", "refrator", "crisalio", "silicaDigger", "duneRipper",
]);

function removeLegacyMagentaChroma(data, aggressive = false) {
  for (let offset = 0; offset < data.length; offset += 4) {
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const magentaDominance = Math.min(red, blue) - green;
    const transparentAt = aggressive ? 70 : 112;
    const transition = aggressive ? 45 : 76;
    const alpha = Math.max(
      0,
      Math.min(255, Math.round(((transparentAt - magentaDominance) / transition) * 255)),
    );
    data[offset + 3] = Math.min(data[offset + 3], alpha);
  }
}

function removeBorderChroma(data, info, greenChroma = false) {
  const visited = new Uint8Array(info.width * info.height);
  const queue = [];
  const isBackground = (pixel) => {
    const offset = pixel * 4;
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    if (greenChroma) {
      return green >= 130
        && green >= red + 38
        && green >= blue + 38;
    }
    return red >= 140 && blue >= 90
      && red + blue >= 250
      && Math.abs(red - blue) <= 120
      && Math.min(red, blue) >= green + 32;
  };
  const enqueue = (pixel) => {
    if (visited[pixel] || !isBackground(pixel)) return;
    visited[pixel] = 1;
    queue.push(pixel);
  };

  for (let x = 0; x < info.width; x += 1) {
    enqueue(x);
    enqueue((info.height - 1) * info.width + x);
  }
  for (let y = 0; y < info.height; y += 1) {
    enqueue(y * info.width);
    enqueue(y * info.width + info.width - 1);
  }

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const pixel = queue[cursor];
    const x = pixel % info.width;
    const y = Math.floor(pixel / info.width);
    for (const next of [
      x > 0 ? pixel - 1 : -1,
      x + 1 < info.width ? pixel + 1 : -1,
      y > 0 ? pixel - info.width : -1,
      y + 1 < info.height ? pixel + info.width : -1,
      x > 0 && y > 0 ? pixel - info.width - 1 : -1,
      x + 1 < info.width && y > 0 ? pixel - info.width + 1 : -1,
      x > 0 && y + 1 < info.height ? pixel + info.width - 1 : -1,
      x + 1 < info.width && y + 1 < info.height ? pixel + info.width + 1 : -1,
    ]) {
      if (next >= 0) enqueue(next);
    }
  }

  for (let pixel = 0; pixel < visited.length; pixel += 1) {
    if (!visited[pixel]) continue;
    const offset = pixel * 4;
    data[offset] = 0;
    data[offset + 1] = 0;
    data[offset + 2] = 0;
    data[offset + 3] = 0;
  }
}

function removeSmallEdgeLeaks(data, info) {
  const visited = new Uint8Array(info.width * info.height);
  const alphaThreshold = 72;
  const maxLeakWidth = Math.round(info.width * 0.16);
  const maxLeakArea = Math.round(info.width * info.height * 0.08);

  for (let start = 0; start < visited.length; start += 1) {
    if (visited[start] || data[start * 4 + 3] < alphaThreshold) continue;
    const queue = [start];
    const pixels = [];
    visited[start] = 1;
    let minX = info.width;
    let maxX = -1;
    let touchesSide = false;

    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const pixel = queue[cursor];
      const x = pixel % info.width;
      const y = Math.floor(pixel / info.width);
      pixels.push(pixel);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      touchesSide ||= x === 0 || x === info.width - 1;

      const neighbours = [
        x > 0 ? pixel - 1 : -1,
        x + 1 < info.width ? pixel + 1 : -1,
        y > 0 ? pixel - info.width : -1,
        y + 1 < info.height ? pixel + info.width : -1,
      ];
      for (const neighbour of neighbours) {
        if (
          neighbour >= 0 &&
          !visited[neighbour] &&
          data[neighbour * 4 + 3] >= alphaThreshold
        ) {
          visited[neighbour] = 1;
          queue.push(neighbour);
        }
      }
    }

    if (
      touchesSide &&
      maxX - minX + 1 <= maxLeakWidth &&
      pixels.length <= maxLeakArea
    ) {
      for (const pixel of pixels) data[pixel * 4 + 3] = 0;
    }
  }
}

function removeChromaFringe(data, info, greenChroma = false) {
  for (let pass = 0; pass < 2; pass += 1) {
    const alpha = new Uint8Array(info.width * info.height);
    for (let pixel = 0; pixel < alpha.length; pixel += 1) {
      alpha[pixel] = data[pixel * 4 + 3];
    }
    for (let pixel = 0; pixel < alpha.length; pixel += 1) {
      if (alpha[pixel] === 0) continue;
      const x = pixel % info.width;
      const y = Math.floor(pixel / info.width);
      const touchesTransparency = [
        x > 0 ? pixel - 1 : -1,
        x + 1 < info.width ? pixel + 1 : -1,
        y > 0 ? pixel - info.width : -1,
        y + 1 < info.height ? pixel + info.width : -1,
      ].some((neighbour) => neighbour >= 0 && alpha[neighbour] === 0);
      if (!touchesTransparency) continue;
      const offset = pixel * 4;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      const isChroma = greenChroma
        ? green >= 115 && green >= red + 30 && green >= blue + 30
        : red >= 120 && blue >= 75 && Math.min(red, blue) >= green + 25;
      if (isChroma) data[offset + 3] = 0;
    }
  }
}

function alphaBounds(data, info, threshold = 80) {
  let left = info.width;
  let right = -1;
  let top = info.height;
  let bottom = -1;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * 4 + 3] < threshold) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }

  if (right < left || bottom < top) throw new Error("empty sprite frame");
  return { left, right, top, bottom };
}

async function extractCell(sheet, metadata, index, enemy) {
  const column = index % GRID_COLUMNS;
  const row = Math.floor(index / GRID_COLUMNS);
  const left =
    Math.round((column * metadata.width) / GRID_COLUMNS) + CELL_INSET;
  const right =
    Math.round(((column + 1) * metadata.width) / GRID_COLUMNS) - CELL_INSET;
  const top = Math.round((row * metadata.height) / GRID_ROWS) + CELL_INSET;
  const bottom =
    Math.round(((row + 1) * metadata.height) / GRID_ROWS) - CELL_INSET;
  const { data, info } = await sheet
    .clone()
    .extract({ left, top, width: right - left, height: bottom - top })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (LEGACY_CHROMA_ENEMIES.has(enemy)) {
    removeLegacyMagentaChroma(data, enemy === "silicaDigger" || enemy === "duneRipper");
  }
  else {
    const greenChroma = GREEN_CHROMA_ENEMIES.has(enemy);
    removeBorderChroma(data, info, greenChroma);
    removeChromaFringe(data, info, greenChroma);
  }
  removeSmallEdgeLeaks(data, info);
  return sharp(data, { raw: info })
    .trim({ background: { r: 255, g: 0, b: 255, alpha: 0 } })
    .png()
    .toBuffer();
}

async function readEnemy(enemy, states) {
  const cells = new Map();
  let widest = 0;
  let tallest = 0;

  for (const state of states) {
    const source = path.join(
      ART_ROOT,
      enemy,
      `${enemy}-${state}-chroma.png`,
    );
    const sheet = sharp(source);
    const metadata = await sheet.metadata();
    const stateCells = [];

    for (let index = 0; index < FRAME_COUNT; index += 1) {
      const cell = await extractCell(sheet, metadata, index, enemy);
      const cellMetadata = await sharp(cell).metadata();
      widest = Math.max(widest, cellMetadata.width);
      tallest = Math.max(tallest, cellMetadata.height);
      stateCells.push(cell);
    }
    cells.set(state, stateCells);
  }

  return {
    cells,
    scale: Math.min(
      (EXTRA_PADDED_ENEMIES.has(enemy) ? 216 : MAX_WIDTH) / widest,
      (EXTRA_PADDED_ENEMIES.has(enemy) ? 216 : MAX_HEIGHT) / tallest,
    ),
  };
}

async function normalizeCell(cell, scale, airborne) {
  const metadata = await sharp(cell).metadata();
  const width = Math.max(1, Math.round(metadata.width * scale));
  const height = Math.max(1, Math.round(metadata.height * scale));
  const { data, info } = await sharp(cell)
    .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const bounds = alphaBounds(data, info);
  const visualCenterX = (bounds.left + bounds.right) / 2;
  const left = Math.round(CENTER_X - visualCenterX);
  const top = airborne
    ? Math.round(FRAME_SIZE / 2 - (bounds.top + bounds.bottom) / 2)
    : ROOT_Y - bounds.bottom;

  return sharp({
    create: {
      width: FRAME_SIZE,
      height: FRAME_SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: data, raw: info, left, top }])
    .png()
    .toBuffer();
}

async function cleanLowAlpha(buffer) {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let offset = 0; offset < data.length; offset += 4) {
    const pixel = offset / 4;
    const x = pixel % info.width;
    const y = Math.floor(pixel / info.width);
    const inSafetyBorder = x < 2 || y < 2
      || x >= info.width - 2 || y >= info.height - 2;
    if (data[offset + 3] > 6 && !inSafetyBorder) continue;
    data[offset] = 0;
    data[offset + 1] = 0;
    data[offset + 2] = 0;
    data[offset + 3] = 0;
  }
  return sharp(data, { raw: info }).png().toBuffer();
}

async function writeEnemy(enemy, states, cells, scale) {
  const artFramesRoot = path.join(ART_ROOT, enemy, "frames");
  let totalBytes = 0;

  for (const state of states) {
    const artStateRoot = path.join(artFramesRoot, state);
    const deployStateRoot = path.join(DEPLOY_ROOT, enemy, state);
    // Generated frame folders must be authoritative. Leaving frames from an
    // older, longer animation makes Vite import both generations.
    await fs.rm(artStateRoot, { recursive: true, force: true });
    await fs.rm(deployStateRoot, { recursive: true, force: true });
    await fs.mkdir(artStateRoot, { recursive: true });
    await fs.mkdir(deployStateRoot, { recursive: true });
    const frames = [];

    for (let index = 0; index < FRAME_COUNT; index += 1) {
      const normalized = await cleanLowAlpha(await normalizeCell(
        cells.get(state)[index],
        scale,
        AIRBORNE_ENEMIES.has(enemy),
      ));
      const encoded = await sharp(normalized)
        .png(EXTRA_PADDED_ENEMIES.has(enemy)
          ? enemy === "silicaDigger"
            ? { palette: true, colours: 48, quality: 90, compressionLevel: 9, dither: 0.45 }
            : enemy === "duneRipper"
              ? { palette: true, colours: 192, quality: 96, compressionLevel: 9, dither: 0.55 }
            : CARTOON_PALETTE_ENEMIES.has(enemy)
              ? { palette: true, colours: 96, quality: 94, compressionLevel: 9, dither: 0.7 }
            : { compressionLevel: 9 }
          : { palette: true, colours: 96, quality: 92, compressionLevel: 9 })
        .toBuffer();
      frames.push(encoded);
      totalBytes += encoded.length;
      await fs.writeFile(
        path.join(artStateRoot, `frame${index}.png`),
        encoded,
      );
      await fs.writeFile(
        path.join(deployStateRoot, `frame${index}.png`),
        encoded,
      );
    }

    await sharp({
      create: {
        width: FRAME_SIZE * GRID_COLUMNS,
        height: FRAME_SIZE * GRID_ROWS,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite(
        frames.map((input, index) => ({
          input,
          left: (index % GRID_COLUMNS) * FRAME_SIZE,
          top: Math.floor(index / GRID_COLUMNS) * FRAME_SIZE,
        })),
      )
      .png({ palette: true, colours: 96, quality: 92, compressionLevel: 9 })
      .toFile(path.join(ART_ROOT, enemy, `${enemy}-${state}.png`));
  }

  return totalBytes;
}

async function validateEnemy(enemy, states) {
  const baselines = new Map();
  let totalBytes = 0;

  for (const state of states) {
    const positions = [];
    for (let index = 0; index < FRAME_COUNT; index += 1) {
      const framePath = path.join(
        DEPLOY_ROOT,
        enemy,
        state,
        `frame${index}.png`,
      );
      const metadata = await sharp(framePath).metadata();
      if (
        metadata.width !== FRAME_SIZE ||
        metadata.height !== FRAME_SIZE ||
        !metadata.hasAlpha
      ) {
        throw new Error(`invalid frame: ${framePath}`);
      }
      const { data, info } = await sharp(framePath)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const corners = [
        0,
        info.width - 1,
        (info.height - 1) * info.width,
        info.width * info.height - 1,
      ];
      if (corners.some((pixel) => data[pixel * 4 + 3] > 1)) {
        throw new Error(`opaque corner: ${framePath}`);
      }
      const bounds = alphaBounds(data, info);
      positions.push(AIRBORNE_ENEMIES.has(enemy)
        ? (bounds.top + bounds.bottom) / 2
        : bounds.bottom);
      totalBytes += (await fs.stat(framePath)).size;
    }
    baselines.set(state, positions);
  }

  for (const [state, positions] of baselines) {
    if (Math.max(...positions) - Math.min(...positions) > 2) {
      throw new Error(
        `unstable ${enemy}/${state} anchor: ${positions.join(", ")}`,
      );
    }
  }
  return totalBytes;
}

let grandTotal = 0;
const requestedEnemy = process.argv.find((argument) => argument.startsWith("--enemy="))?.slice(8);
const selectedEnemies = Object.entries(ENEMIES)
  .filter(([enemy]) => !requestedEnemy || enemy === requestedEnemy);
if (requestedEnemy && selectedEnemies.length === 0) {
  throw new Error(`Unknown enemy: ${requestedEnemy}`);
}
for (const [enemy, states] of selectedEnemies) {
  const { cells, scale } = await readEnemy(enemy, states);
  await writeEnemy(enemy, states, cells, scale);
  const bytes = await validateEnemy(enemy, states);
  grandTotal += bytes;
  console.log(`${enemy}: ${states.length * FRAME_COUNT} frames, ${bytes} bytes`);
}
const frameTotal = selectedEnemies.map(([, states]) => states)
  .reduce((total, states) => total + states.length * FRAME_COUNT, 0);
console.log(`Cartoon enemies: ${frameTotal} frames, ${grandTotal} bytes total.`);
