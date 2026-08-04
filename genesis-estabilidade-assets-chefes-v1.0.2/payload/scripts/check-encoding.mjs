#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.argv[2] || process.cwd());

const mojibakeFragments = Object.freeze([
  // UTF-8 C3 interpretado como Windows-1252/Latin-1.
  "Ã¡", "Ã¢", "Ã£", "Ã¤", "Ã©", "Ãª", "Ã¨", "Ã­",
  "Ã³", "Ã´", "Ãµ", "Ã¶", "Ãº", "Ã¼", "Ã§",
  "Ã", "Ã‚", "Ãƒ", "Ã‰", "ÃŠ", "Ã", "Ã“", "Ã”",
  "Ã•", "Ãš", "Ã‡",

  // Pontuação e símbolos UTF-8 interpretados como Windows-1252.
  "â€“", "â€”", "â€œ", "â€", "â€™", "â€¦",
  "â†’", "â€¢", "â„¢",
  "Âº", "Âª", "Â°", "Â ",

  // BOM e emojis interpretados incorretamente.
  "ï»¿", "ðŸ",

  // Caractere Unicode de substituição.
  "�",
]);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Não procure apenas "Ã" ou "Â": ambos são letras portuguesas válidas.
// Exemplos legítimos: OPERAÇÃO, IDENTIFICAÇÃO e Cratera de Âmbar.
const badPattern = new RegExp(
  mojibakeFragments.map(escapeRegExp).join("|"),
  "u",
);

const validEncodingExamples = Object.freeze([
  "OPERAÇÃO CONCLUÍDA",
  "IDENTIFICAÇÃO CONFIRMADA",
  "PRESSÃO ALTA",
  "LEVIATÃ DE NEREIDA",
  "Cratera de Âmbar",
  "MECÂNICA AMBIENTAL",
  "PRÉ-VISUALIZAÇÃO",
]);

const corruptedEncodingExamples = Object.freeze([
  "operaÃ§Ã£o",
  "mÃ¡ximo",
  "contÃ©m",
  "invÃ¡lida",
  "carapaÃ§a",
  "travessÃ£o â€” quebrado",
  "temperatura 30Â°",
  "ï»¿arquivo",
  "texto � inválido",
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
