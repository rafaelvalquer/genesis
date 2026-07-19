import sharp from "sharp";

const input = process.argv[2] || "tmp/medicaNanites/medica-sheet-chroma.png";
const states = ["idle", "heal", "attack", "cooldown"];
const image = sharp(input);
const metadata = await image.metadata();
const cellWidth = Math.floor(metadata.width / 2);
const cellHeight = Math.floor(metadata.height / 2);

for (let index = 0; index < states.length; index += 1) {
  const left = (index % 2) * cellWidth;
  const top = Math.floor(index / 2) * cellHeight;
  const { data, info } = await image
    .clone()
    .extract({ left, top, width: cellWidth, height: cellHeight })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let offset = 0; offset < data.length; offset += 4) {
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const magentaDominance = Math.min(red, blue) - green;
    const alpha = Math.max(0, Math.min(255, Math.round((145 - magentaDominance) / 55 * 255)));
    data[offset + 3] = Math.min(data[offset + 3], alpha);
  }

  await sharp(data, { raw: info })
    .trim({ background: { r: 255, g: 0, b: 255, alpha: 0 } })
    .resize(226, 226, { fit: "inside", withoutEnlargement: true })
    .extend({
      top: 15,
      bottom: 15,
      left: 15,
      right: 15,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .resize(256, 256, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ palette: true, colours: 128, quality: 90, compressionLevel: 9 })
    .toFile(`src/game/assets/troop/medicaNanites/${states[index]}/frame0.png`);
}
