import { mkdir, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { LEVIATHAN_AUDIT_RULES as rules, analyzeLeviathanComponents, componentTouchesProtectedZone } from "./leviathan-sprite-components.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = join(root, "art", "source", "leviathanNereida");
const destinationRoot = join(root, "art", "repair-preview", "leviathanNereida");
const decisions = [];
const isSafeIsland = (component, main, width, height) => {
  const zones = componentTouchesProtectedZone(component, width, height, rules);
  return component.area <= rules.warningComponentAreaPx
    && component.distanceToMainPx >= 12
    && (zones.inCorner || zones.touchesMargin)
    && component.area / main.area <= rules.maximumSecondaryAreaFactor;
};
for (const state of (await readdir(sourceRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name)) {
  const destination = join(destinationRoot, state); await mkdir(destination, { recursive: true });
  for (const file of (await readdir(join(sourceRoot, state))).filter((name) => /^frame[0-7]\.png$/.test(name))) {
    const input = join(sourceRoot, state, file); const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const analysis = analyzeLeviathanComponents(data, info.width, info.height); const removable = analysis.secondary.filter((component) => isSafeIsland(component, analysis.main, info.width, info.height));
    const blocked = analysis.secondary.filter((component) => !removable.includes(component));
    const output = Buffer.from(data);
    for (const component of removable) for (const pixel of component.pixels) output.fill(0, pixel * 4, pixel * 4 + 4);
    await sharp(output, { raw: info }).png().toFile(join(destination, file));
    decisions.push({ path: relative(root, input), state, frame: Number(file.match(/\d+/)[0]), removedComponents: removable.map((component) => ({ area: component.area, distanceToMainPx: component.distanceToMainPx })), status: blocked.some((component) => component.area > rules.warningComponentAreaPx || component.distanceToMainPx < 12) ? "REDRAW_REQUIRED" : removable.length ? "CLEANED_PREVIEW" : "UNCHANGED" });
  }
}
await mkdir(join(root, "art", "reports"), { recursive: true });
await writeFile(join(root, "art", "reports", "leviathan-sprite-repair-preview.json"), `${JSON.stringify({ rules, decisions }, null, 2)}\n`);
console.log(`Prévia de limpeza criada em art/repair-preview/leviathanNereida (${decisions.filter((item) => item.removedComponents.length).length} quadros alterados; nenhum original foi substituído).`);
