import path from "node:path";
import sharp from "sharp";

const folder = path.resolve("src/game/assets-source/enemy/colossoCaldeira/death");
for (let frame = 0; frame < 14; frame += 1) {
  const file = path.join(folder, `frame${frame}.png`);
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const visited = new Uint8Array(info.width * info.height); const queue = new Int32Array(info.width * info.height); let largest = [];
  for (let start = 0; start < visited.length; start += 1) {
    if (visited[start] || data[start * info.channels + 3] < 16) continue;
    const pixels = []; let head = 0; let tail = 0; queue[tail++] = start; visited[start] = 1;
    while (head < tail) {
      const index = queue[head++]; pixels.push(index); const x = index % info.width; const y = Math.floor(index / info.width);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx; const ny = y + dy; if (nx < 0 || ny < 0 || nx >= info.width || ny >= info.height) continue; const next = ny * info.width + nx; if (!visited[next] && data[next * info.channels + 3] >= 16) { visited[next] = 1; queue[tail++] = next; } }
    }
    if (pixels.length > largest.length) largest = pixels;
  }
  const keep = new Uint8Array(visited.length); for (const index of largest) keep[index] = 1;
  for (let index = 0; index < visited.length; index += 1) if (!keep[index]) data[index * info.channels + 3] = 0;
  await sharp(data, { raw: info }).png().toFile(file);
}
console.log("Removed detached Death-sheet components.");
