#!/usr/bin/env node
import fs from "node:fs";

const packagePath = "package.json";
const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const scripts = packageJson.scripts ||= {};

scripts["verify:repository-hygiene"] = "node scripts/verify-repository-hygiene.mjs";
scripts["validate:game-content"] = "node scripts/validate-game-content.mjs";
scripts["validate:game-content:report"] = "node scripts/validate-game-content.mjs --report";
scripts["ci:fast"] = "npm run verify:encoding && npm run verify:repository-hygiene && npm run validate:game-content && npm run verify:no-gameplay-skips && npm run verify:gamecanvas-render-dependencies && npm run verify:battle-loading && npm run verify:play-route && npm run test:icaro && npm run test:unit && npm run test:chapter-seven && npm run audit:chapter-seven && npm run build";

const originalCi = scripts.ci || "";
if (!originalCi.includes("verify:repository-hygiene")) {
  scripts.ci = originalCi.replace(
    "npm run verify:encoding && npm run verify:no-gameplay-skips",
    "npm run verify:encoding && npm run verify:repository-hygiene && npm run validate:game-content && npm run verify:no-gameplay-skips",
  );
}

fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

const readmePath = "README.md";
if (fs.existsSync(readmePath)) {
  const readme = fs.readFileSync(readmePath, "utf8").replace("a rtifacts/", "artifacts/");
  fs.writeFileSync(readmePath, readme);
}

console.log("Quality gates e documentação atualizados.");
