import sharp from "sharp";

const root = "art/qa/remaster/garravinha-poses-v2/idle";
const frames = await Promise.all(Array.from({ length: 8 }, (_, index) => sharp(`${root}/frame${index}.png`)
  .resize(256, 256, { fit: "contain", background: { r: 8, g: 17, b: 29, alpha: 1 } })
  .png()
  .toBuffer()));

await sharp({
  create: { width: 2048, height: 256, channels: 4, background: { r: 8, g: 17, b: 29, alpha: 1 } },
})
  .composite(frames.map((input, index) => ({ input, left: index * 256, top: 0 })))
  .png()
  .toFile("art/qa/remaster/garravinha-idle-v2-preview.png");

console.log("Prévia criada: art/qa/remaster/garravinha-idle-v2-preview.png");
