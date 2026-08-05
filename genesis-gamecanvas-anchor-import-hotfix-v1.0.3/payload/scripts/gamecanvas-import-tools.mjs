export function findNamedImport(source, moduleSpecifier) {
  const importStartPattern = /^import\b/gm;
  let match;

  while ((match = importStartPattern.exec(source))) {
    const statementStart = match.index;
    const statementEnd = source.indexOf(";", statementStart);

    if (statementEnd < 0) {
      throw new Error(
        `Import sem ponto e vírgula iniciado no índice ${statementStart}.`,
      );
    }

    const statement = source.slice(statementStart, statementEnd + 1);
    const fromMatch = /\bfrom\s*["']([^"']+)["']\s*;?$/.exec(
      statement.trim(),
    );

    if (!fromMatch || fromMatch[1] !== moduleSpecifier) continue;

    const namedMatch = /^import\s*\{([\s\S]*?)\}\s*from\s*["'][^"']+["']\s*;?$/
      .exec(statement.trim());

    if (!namedMatch) {
      throw new Error(
        `O import de ${moduleSpecifier} não é um import nomeado suportado.`,
      );
    }

    return {
      start: statementStart,
      end: statementEnd + 1,
      statement,
      symbols: namedMatch[1]
        .split(",")
        .map((symbol) => symbol.trim())
        .filter(Boolean),
    };
  }

  return null;
}

export function formatNamedImport(moduleSpecifier, symbols) {
  const uniqueSymbols = [...new Set(symbols)];

  return [
    "import {",
    ...uniqueSymbols.map((symbol) => `  ${symbol},`),
    `} from "${moduleSpecifier}";`,
  ].join("\n");
}

export function replaceNamedImport(
  source,
  moduleSpecifier,
  transformSymbols,
) {
  const importDeclaration = findNamedImport(source, moduleSpecifier);

  if (!importDeclaration) {
    throw new Error(`Import não encontrado: ${moduleSpecifier}`);
  }

  const transformed = transformSymbols([
    ...importDeclaration.symbols,
  ]);

  const replacement = formatNamedImport(
    moduleSpecifier,
    transformed,
  );

  return (
    source.slice(0, importDeclaration.start)
    + replacement
    + source.slice(importDeclaration.end)
  );
}
