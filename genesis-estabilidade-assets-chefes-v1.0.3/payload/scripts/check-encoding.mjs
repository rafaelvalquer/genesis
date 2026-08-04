#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.argv[2] || process.cwd());

// Os padrões ficam codificados com escapes Unicode.
// Isso impede que a rotina de reparo altere o próprio verificador.
const mojibakeFragments = Object.freeze([
  "\u00C3\u00A1", "\u00C3\u00A2", "\u00C3\u00A3", "\u00C3\u00A4",
  "\u00C3\u00A9", "\u00C3\u00AA", "\u00C3\u00A8", "\u00C3\u00AD",
  "\u00C3\u00B3", "\u00C3\u00B4", "\u00C3\u00B5", "\u00C3\u00B6",
  "\u00C3\u00BA", "\u00C3\u00BC", "\u00C3\u00A7", "\u00C3\u0081",
  "\u00C3\u201A", "\u00C3\u0192", "\u00C3\u2030", "\u00C3\u0160",
  "\u00C3\u008D", "\u00C3\u201C", "\u00C3\u201D", "\u00C3\u2022",
  "\u00C3\u0161", "\u00C3\u2021", "\u00E2\u20AC\u201C", "\u00E2\u20AC\u201D",
  "\u00E2\u20AC\u0153", "\u00E2\u20AC\u009D", "\u00E2\u20AC\u2122", "\u00E2\u20AC\u00A6",
  "\u00E2\u2020\u2019", "\u00E2\u20AC\u00A2", "\u00E2\u201E\u00A2", "\u00C2\u00BA",
  "\u00C2\u00AA", "\u00C2\u00B0", "\u00C2\u00A0", "\u00EF\u00BB\u00BF",
  "\u00F0\u0178", "\uFFFD",
]);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Não procure apenas as letras Ã ou Â. Ambas são válidas em português.
const badPattern = new RegExp(
  mojibakeFragments.map(escapeRegExp).join("|"),
  "u",
);

const validEncodingExamples = Object.freeze([
  "OPERA\u00C7\u00C3O CONCLU\u00CDDA", "IDENTIFICA\u00C7\u00C3O CONFIRMADA", "PRESS\u00C3O ALTA", "LEVIAT\u00C3 DE NEREIDA",
  "Cratera de \u00C2mbar", "MEC\u00C2NICA AMBIENTAL", "PR\u00C9-VISUALIZA\u00C7\u00C3O",
]);

const corruptedEncodingExamples = Object.freeze([
  "opera\u00C3\u00A7\u00C3\u00A3o", "m\u00C3\u00A1ximo", "cont\u00C3\u00A9m", "inv\u00C3\u00A1lida",
  "carapa\u00C3\u00A7a", "travess\u00C3\u00A3o \u00E2\u20AC\u201D quebrado", "temperatura 30\u00C2\u00B0", "\u00EF\u00BB\u00BFarquivo",
  "texto \uFFFD inv\u00E1lido",
]);

for (const example of validEncodingExamples) {
  if (badPattern.test(example)) {
    throw new Error(
      `Falha interna do verificador: texto UTF-8 válido foi classificado como corrompido: ${example}`,
    );
  }
}

for (const example of corruptedEncodingExamples) {
  if (!badPattern.test(example)) {
    throw new Error(
      `Falha interna do verificador: mojibake conhecido não foi detectado: ${example}`,
    );
  }
}

const extensions = new Set([
  ".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx",
  ".json", ".md", ".html", ".css", ".scss", ".ps1",
  ".py", ".txt", ".yml", ".yaml",
]);

const ignoredDirectories = new Set([
  ".git", ".genesis-backups", "node_modules", "dist", ".vite",
  "coverage", "art", "assets",
]);

const rootFiles = [
  ".editorconfig", ".gitattributes", "README.md", "CHANGELOG.md",
];

const scanRoots = ["src", "scripts", "tools", "docs"];

function collectFiles(directory, destination) {
  if (!fs.existsSync(directory)) return;

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        collectFiles(fullPath, destination);
      }
      continue;
    }

    if (extensions.has(path.extname(entry.name).toLowerCase())) {
      destination.push(fullPath);
    }
  }
}

const files = [];

for (const relativeRoot of scanRoots) {
  collectFiles(path.join(repoRoot, relativeRoot), files);
}

for (const relativePath of rootFiles) {
  const fullPath = path.join(repoRoot, relativePath);
  if (fs.existsSync(fullPath)) files.push(fullPath);
}

const findings = [];

for (const filePath of files) {
  const source = fs.readFileSync(filePath, "utf8");

  source.split(/\r?\n/).forEach((line, index) => {
    const match = badPattern.exec(line);
    if (!match) return;

    findings.push({
      file: path.relative(repoRoot, filePath).replaceAll(path.sep, "/"),
      line: index + 1,
      column: match.index + 1,
      fragment: match[0],
      excerpt: line.trim().slice(0, 180),
    });
  });
}

if (findings.length) {
  console.error(
    `Foram encontrados ${findings.length} indício(s) reais de codificação corrompida:`,
  );

  findings.forEach((finding) => {
    console.error(
      `- ${finding.file}:${finding.line}:${finding.column}`
      + ` [${JSON.stringify(finding.fragment)}] ${finding.excerpt}`,
    );
  });

  process.exitCode = 1;
} else {
  console.log(
    `Codificação UTF-8 validada em ${files.length} arquivo(s) de código e documentação.`,
  );
}
