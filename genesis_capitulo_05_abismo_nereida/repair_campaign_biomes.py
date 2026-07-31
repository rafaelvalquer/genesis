#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import shutil
import subprocess
from pathlib import Path

BIOME_BLOCK = '''  chapter_05: freezeTheme({
    key: "abyss",
    label: "Abismo de Nereida",
    surface: ["#03161c", "#0d4c52", "#081825"],
    atmosphere: "#22d3ee",
    accent: "#c084fc",
    light: "#cffafe",
    ambient: "#0b2835",
    fog: "#020b12",
    particle: "#5eead4",
    cameraDistance: 4.58,
    rotation: { x: -.2, y: 1.34, z: -.04 },
    detail: "Naufrágios, recifes abissais e marés bioluminescentes",
    ui: {
      primary: "#22d3ee",
      secondary: "#0e7490",
      accent: "#c084fc",
      warning: "#f59e0b",
      panel: "rgba(2, 11, 18, .94)",
      panelAlt: "rgba(6, 35, 45, .9)",
      line: "#155e75",
      grid: "#164e63",
      glow: "rgba(34, 211, 238, .28)",
      patternOpacity: .24,
      shape: "fluid",
    },
    lighting: {
      keyColor: "#cffafe",
      keyIntensity: 1.45,
      keyPosition: [3.2, 2.9, 4.1],
      fillColor: "#67e8f9",
      fillGroundColor: "#03131c",
      fillIntensity: .42,
      rimColor: "#c084fc",
      rimIntensity: .46,
      rimPosition: [-3.1, 1.05, -3.4],
      ambientColor: "#bae6fd",
      ambientIntensity: .05,
      exposure: .94,
      transitionSpeed: 5.1,
    },
    world: {
      fogColor: "#020b12",
      fogDensityCommand: .052,
      fogDensityCampaign: .064,
      atmosphereOpacityCommand: .14,
      atmosphereOpacityCampaign: .13,
      particleOpacity: .52,
      particleSize: .017,
    },
    planetEffects: {
      kit: "eclipse",
      signature: "Bruma oceânica, brilho abissal e fragmentos submersos",
      motion: .82,
    },
  }),'''


def fail(message: str) -> None:
    print(f"[ERRO] {message}")
    raise SystemExit(1)


def find_matching_brace(source: str, open_index: int) -> int:
    depth = 0
    quote = None
    escaped = False
    line_comment = False
    block_comment = False
    index = open_index
    while index < len(source):
        char = source[index]
        next_char = source[index + 1] if index + 1 < len(source) else ""
        if line_comment:
            if char == "\n":
                line_comment = False
            index += 1
            continue
        if block_comment:
            if char == "*" and next_char == "/":
                block_comment = False
                index += 2
                continue
            index += 1
            continue
        if quote:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == quote:
                quote = None
            index += 1
            continue
        if char == "/" and next_char == "/":
            line_comment = True
            index += 2
            continue
        if char == "/" and next_char == "*":
            block_comment = True
            index += 2
            continue
        if char in ('"', "'", "`"):
            quote = char
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return index
        index += 1
    fail("Não encontrei o fechamento correspondente de chaves.")


def replace_or_insert_biome_block(object_body: str) -> str:
    token = "chapter_05: freezeTheme({"
    token_index = object_body.find(token)
    if token_index < 0:
        trimmed = object_body.rstrip()
        return trimmed + ("\n\n" if trimmed else "\n") + BIOME_BLOCK.rstrip() + "\n"
    search_end = token_index + len(token)
    start = object_body.rfind("\n  chapter_05:", 0, search_end)
    if start >= 0:
        start += 1
    else:
        start = object_body.find("  chapter_05:", 0, search_end)
    if start < 0:
        fail("Não encontrei o início do tema chapter_05.")
    open_brace = object_body.find("{", token_index)
    close_brace = find_matching_brace(object_body, open_brace)
    end = close_brace + 1
    while end < len(object_body) and object_body[end] in " \t\r":
        end += 1
    if end >= len(object_body) or object_body[end] != ")":
        fail("O tema chapter_05 não possui fechamento freezeTheme válido.")
    end += 1
    while end < len(object_body) and object_body[end] in " \t\r":
        end += 1
    if end < len(object_body) and object_body[end] == ",":
        end += 1
    return object_body[:start] + BIOME_BLOCK + object_body[end:]


def canonical_footer(source: str, search_from: int) -> str:
    footer_start = source.find("export const getCampaignBiome", search_from)
    if footer_start < 0:
        return (
            "export const getCampaignBiome = (chapterId) =>\n"
            "  CAMPAIGN_BIOMES[chapterId] || CAMPAIGN_BIOMES.chapter_01;\n\n"
            "export const getGenesisWorldTheme = getCampaignBiome;"
        )
    second_export = source.find("export const getGenesisWorldTheme", footer_start)
    if second_export < 0:
        first_end = source.find(";", footer_start)
        if first_end < 0:
            fail("Não encontrei o fim de getCampaignBiome.")
        return source[footer_start:first_end + 1].strip() + \
            "\n\nexport const getGenesisWorldTheme = getCampaignBiome;"
    footer_end = source.find(";", second_export)
    if footer_end < 0:
        fail("Não encontrei o fim de getGenesisWorldTheme.")
    return source[footer_start:footer_end + 1].strip()


def repair_source(source: str) -> str:
    declaration = "export const CAMPAIGN_BIOMES = Object.freeze("
    declaration_index = source.find(declaration)
    if declaration_index < 0:
        fail("Não encontrei CAMPAIGN_BIOMES.")
    object_open = source.find("{", declaration_index + len(declaration))
    object_close = find_matching_brace(source, object_open)
    object_end = object_close + 1
    while object_end < len(source) and source[object_end] in " \t\r\n":
        object_end += 1
    if source[object_end:object_end + 2] != ");":
        fail("CAMPAIGN_BIOMES não possui fechamento Object.freeze válido.")
    object_end += 2
    updated_body = replace_or_insert_biome_block(source[object_open + 1:object_close])
    repaired = (
        source[:object_open + 1]
        + updated_body
        + source[object_close:object_end]
        + "\n\n"
        + canonical_footer(source, object_end)
        + "\n"
    )
    checks = {
        "tema chapter_05": repaired.count("chapter_05: freezeTheme({") == 1,
        "getCampaignBiome": repaired.count("export const getCampaignBiome") == 1,
        "getGenesisWorldTheme": repaired.count("export const getGenesisWorldTheme") == 1,
    }
    failed = [name for name, valid in checks.items() if not valid]
    if failed:
        fail("Validação estrutural falhou: " + ", ".join(failed))
    return repaired


def is_repo(path: Path) -> bool:
    return (
        path.is_dir()
        and (path / "package.json").is_file()
        and (path / "src/campaign/campaignBiomes.js").is_file()
    )


def resolve_repo(package_root: Path, provided: str | None) -> Path:
    if provided:
        path = Path(provided).expanduser().resolve()
        if not is_repo(path):
            fail(f"Raiz do Genesis inválida: {path}")
        return path
    for path in (package_root.parent, package_root.parent / "genesis", package_root):
        path = path.resolve()
        if is_repo(path):
            return path
    fail("Não encontrei a raiz do Genesis automaticamente.")


def run_node_check(path: Path) -> None:
    node = shutil.which("node")
    if not node:
        print("[AVISO] Node.js não encontrado; validação de sintaxe ignorada.")
        return
    result = subprocess.run([node, "--check", str(path)], check=False)
    if result.returncode != 0:
        raise SystemExit(result.returncode)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Repara campaignBiomes.js corrompido pelo instalador v1.0.1.",
    )
    parser.add_argument("--repo-root", required=False)
    args = parser.parse_args()
    package_root = Path(__file__).resolve().parent
    repo_root = resolve_repo(package_root, args.repo_root)
    path = repo_root / "src/campaign/campaignBiomes.js"
    timestamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = repo_root / ".genesis-backups" / f"campaign-biomes-hotfix-{timestamp}" / "src/campaign/campaignBiomes.js"
    backup.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, backup)
    path.write_text(repair_source(path.read_text(encoding="utf-8")), encoding="utf-8", newline="\n")
    run_node_check(path)
    print(f"[OK] campaignBiomes.js reparado: {path}")
    print(f"[INFO] Backup: {backup}")


if __name__ == "__main__":
    main()
