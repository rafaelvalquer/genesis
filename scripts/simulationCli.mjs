import fs from "node:fs";
import path from "node:path";

export function parseArgs(
  argv = process.argv.slice(2),
) {
  const args = {};

  argv.forEach((argument) => {
    if (!argument.startsWith("--")) {
      return;
    }

    const value = argument.slice(2);
    const separator = value.indexOf("=");

    if (separator < 0) {
      args[value] = true;
      return;
    }

    const key = value.slice(0, separator);
    const raw = value.slice(separator + 1);

    args[key] = raw;
  });

  return args;
}

export function parseCsv(
  value,
  fallback = [],
) {
  if (
    value == null
    || value === ""
  ) {
    return [...fallback];
  }

  return String(value)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function parseNumberList(
  value,
  fallback = [],
) {
  return parseCsv(
    value,
    fallback,
  ).map(Number).filter(Number.isFinite);
}

export function parsePositiveInteger(
  value,
  fallback,
) {
  const parsed = Number(value);

  return (
    Number.isInteger(parsed)
    && parsed > 0
      ? parsed
      : fallback
  );
}

export function parseBoolean(
  value,
  fallback = false,
) {
  if (value == null) return fallback;
  if (value === true) return true;

  const normalized = String(value)
    .trim()
    .toLowerCase();

  if (
    ["1", "true", "yes", "sim"].includes(
      normalized,
    )
  ) {
    return true;
  }

  if (
    ["0", "false", "no", "nao", "não"].includes(
      normalized,
    )
  ) {
    return false;
  }

  return fallback;
}

export function resolveOutputDirectory(
  value,
  cwd = process.cwd(),
) {
  return path.resolve(
    cwd,
    value || "reports",
  );
}

export function ensureDirectory(
  directory,
) {
  fs.mkdirSync(
    directory,
    { recursive: true },
  );

  return directory;
}

export function readJsonFile(
  filePath,
  fallback = null,
) {
  if (!filePath) return fallback;

  const absolute = path.resolve(filePath);

  if (!fs.existsSync(absolute)) {
    return fallback;
  }

  return JSON.parse(
    fs.readFileSync(
      absolute,
      "utf8",
    ),
  );
}

export function writeTextFile(
  filePath,
  content,
) {
  ensureDirectory(
    path.dirname(filePath),
  );

  fs.writeFileSync(
    filePath,
    content,
    "utf8",
  );
}

export function formatPercentage(
  ratio,
) {
  return `${(
    Number(ratio || 0) * 100
  ).toFixed(1)}%`;
}

export function formatElapsed(
  milliseconds,
) {
  const seconds = Math.round(
    Number(milliseconds || 0) / 1000,
  );

  return `${Math.floor(seconds / 60)}:${String(
    seconds % 60,
  ).padStart(2, "0")}`;
}
