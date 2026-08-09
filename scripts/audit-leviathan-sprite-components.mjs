import { mkdir, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { LEVIATHAN_AUDIT_RULES as rules, analyzeLeviathanComponents, componentTouchesProtectedZone } from "./leviathan-sprite-components.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const allLocations = [
  { name: "source", root: join(root, "art", "source", "leviathanNereida") },
  { name: "runtime", root: join(root, "src", "game", "assets", "enemy", "leviathanNereida") },
];
const requestedLocation = process.argv.includes("--source") ? "source" : process.argv.includes("--runtime") ? "runtime" : null;
const locations = requestedLocation ? allLocations.filter((location) => location.name === requestedLocation) : allLocations;
const reports = join(root, "art", "reports");
const issueFor = (component, width, height, main) => {
  const zones = componentTouchesProtectedZone(component, width, height, rules);
  const issues = [];
  if (zones.inCorner) issues.push("CORNER_CONTAMINATION");
  if (zones.touchesMargin) issues.push("EDGE_CONTAMINATION");
  if (component.area > rules.errorComponentAreaPx) issues.push("SECONDARY_COMPONENT_TOO_LARGE");
  else if (component.area > rules.warningComponentAreaPx) issues.push("ISOLATED_PIXEL_ISLAND");
  if (component.area / main.area > rules.maximumSecondaryAreaFactor) issues.push("POSSIBLE_NEIGHBOR_FRAME_FRAGMENT");
  return issues;
};

async function auditFrame(location, state, file) {
  const path = join(location.root, state, file);
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const analysis = analyzeLeviathanComponents(data, info.width, info.height);
  const issues = [];
  if (!analysis.main) issues.push("MAIN_COMPONENT_TOO_SMALL");
  if (analysis.mainComponentRatio < .98) issues.push("MAIN_COMPONENT_TOO_SMALL");
  const components = analysis.secondary.map((component) => ({
    area: component.area, left: component.left, top: component.top, right: component.right, bottom: component.bottom,
    distanceToMainPx: component.distanceToMainPx, issues: issueFor(component, info.width, info.height, analysis.main),
  }));
  issues.push(...components.flatMap((component) => component.issues));
  const uniqueIssues = [...new Set(issues)];
  return { location: location.name, state, frame: Number(file.match(/\d+/)[0]), path: relative(root, path), width: info.width, height: info.height,
    componentCount: analysis.components.length, mainComponent: analysis.main && { area: analysis.main.area, left: analysis.main.left, top: analysis.main.top, right: analysis.main.right, bottom: analysis.main.bottom },
    mainComponentRatio: Number(analysis.mainComponentRatio.toFixed(6)), secondaryComponents: components,
    severity: uniqueIssues.some((issue) => issue === "SECONDARY_COMPONENT_TOO_LARGE" || issue === "MAIN_COMPONENT_TOO_SMALL") ? "REDRAW_REQUIRED" : uniqueIssues.length ? "WARNING" : "PASS", issues: uniqueIssues };
}

function checkerboard(width, height) { const data = Buffer.alloc(width * height * 4); for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) { const shade = (Math.floor(x / 12) + Math.floor(y / 12)) % 2 ? 54 : 72; const offset = (y * width + x) * 4; data[offset] = shade; data[offset + 1] = shade; data[offset + 2] = shade; data[offset + 3] = 255; } return data; }
async function preview(frames) {
  const width = 1024; const rowHeight = 150; const height = Math.max(1, frames.length / 8) * rowHeight;
  const composites = [];
  for (const frame of frames) { const x = (frame.frame % 8) * 128; const y = Math.floor(frames.indexOf(frame) / 8) * rowHeight; const input = await sharp(join(root, frame.path)).resize(124, 124, { fit: "contain" }).png().toBuffer(); const boxes = [frame.mainComponent, ...frame.secondaryComponents].filter(Boolean).map((box, index) => `<rect x="${x + box.left * 124 / frame.width}" y="${y + box.top * 124 / frame.height}" width="${box.width ? box.width * 124 / frame.width : (box.right - box.left + 1) * 124 / frame.width}" height="${box.height ? box.height * 124 / frame.height : (box.bottom - box.top + 1) * 124 / frame.height}" fill="none" stroke="${index ? '#ff4d4d' : '#55e68a'}" stroke-width="1"/>`).join(""); const text = `<svg width="128" height="150" xmlns="http://www.w3.org/2000/svg"><text x="3" y="139" font-size="10" fill="white">${frame.state} ${frame.frame} (${frame.componentCount})</text>${boxes}</svg>`; composites.push({ input, left: x + 2, top: y + 2 }); composites.push({ input: Buffer.from(text), left: 0, top: 0 }); }
  const suffix = requestedLocation ? `-${requestedLocation}` : "";
  await sharp(checkerboard(width, height), { raw: { width, height, channels: 4 } }).composite(composites).png().toFile(join(reports, `leviathan-sprite-audit-preview${suffix}.png`));
}

await mkdir(reports, { recursive: true });
const frames = [];
for (const location of locations) for (const state of (await readdir(location.root, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()) for (const file of (await readdir(join(location.root, state))).filter((name) => /^frame[0-7]\.png$/.test(name)).sort()) frames.push(await auditFrame(location, state, file));
const report = { rules, generatedAt: new Date().toISOString(), totalFrames: frames.length, failures: frames.filter((frame) => frame.severity === "REDRAW_REQUIRED").length, warnings: frames.filter((frame) => frame.severity === "WARNING").length, frames };
const markdown = ["# Auditoria de componentes — Leviatã de Nereida", "", `Frames: ${report.totalFrames}; redesenho necessário: ${report.failures}; avisos: ${report.warnings}.`, "", "| Local | Estado | Frame | Componentes | Situação | Problemas |", "| --- | --- | ---: | ---: | --- | --- |", ...frames.map((frame) => `| ${frame.location} | ${frame.state} | ${frame.frame} | ${frame.componentCount} | ${frame.severity} | ${frame.issues.join(", ") || "—"} |`), ""].join("\n");
const suffix = requestedLocation ? `-${requestedLocation}` : "";
await writeFile(join(reports, `leviathan-sprite-audit${suffix}.json`), `${JSON.stringify(report, null, 2)}\n`); await writeFile(join(reports, `leviathan-sprite-audit${suffix}.md`), markdown); await preview(frames);
console.log(`Auditoria Leviatã: ${report.totalFrames} frames; ${report.failures} para redesenho; ${report.warnings} avisos.`);
if (report.failures) process.exitCode = 1;
