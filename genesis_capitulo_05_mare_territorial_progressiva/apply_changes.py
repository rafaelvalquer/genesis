#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

PACKAGE_VERSION = "2.0.0"

REQUIRED_PROJECT_PATHS = (
    "package.json",
    "src/game/content.js",
    "src/game/battleModel.js",
    "src/game/GameCanvas.jsx",
    "src/campaign/MissionPanel.jsx",
    "src/campaign/campaignBiomes.js",
)

PAYLOAD_FILES = (
    "src/game/tideCycle.js",
    "src/game/tideRenderer.js",
    "src/game/tideCycle.test.js",
    "src/game/chapterFivePhases.js",
    "src/game/chapterFiveContent.test.js",
    "src/game/tideBattleIntegration.test.js",
    "src/game/assets/arenas/chapter_05.webp",
    "src/game/assets/arenas/fase_33.webp",
    "src/game/assets/arenas/fase_34.webp",
    "src/game/assets/arenas/fase_35.webp",
    "src/game/assets/arenas/fase_36.webp",
    "src/game/assets/arenas/fase_37.webp",
    "src/game/assets/arenas/fase_38.webp",
    "src/game/assets/arenas/fase_39.webp",
    "src/game/assets/arenas/fase_40.webp",
)

PATCHED_FILES = (
    "src/game/content.js",
    "src/game/battleModel.js",
    "src/game/GameCanvas.jsx",
    "src/campaign/MissionPanel.jsx",
    "src/campaign/campaignBiomes.js",
    "src/campaign/campaignBiomes.test.js",
)

TIDE_IMPORT = '''import {
  createTideCycleState,
  endTideCycle,
  getTideAdjustedEnemySlowFactor,
  getTideEnemySpeedFactor,
  getTidePlacementBlockReason,
  getTideSnapshot,
  getTideTroopAttackSpeedFactor,
  isTideMineDisabled,
  isTideReactorPaused,
  recordTideTroopElimination,
  resetTideCycleForWave,
  updateTideCycle,
} from "./tideCycle.js";'''

CHAPTER_BLOCK = '''  {
    id: "chapter_05",
    number: 5,
    name: "Abismo de Nereida",
    subtitle: "A maré conquista o campo antes do exército",
    phaseIds: PHASES.slice(32, 40).map((entry) => entry.id),
    coverArenaId: "chapter_05",
    palette: {
      primary: "#22d3ee",
      accent: "#c084fc",
      shadow: "#020b12",
    },
    mechanic: {
      id: "tide_cycle",
      label: "Maré Territorial Progressiva",
      description:
        "Água profunda ocupa parte do campo permanentemente. Faixas intermaré avançam quando a defesa cresce e podem recuar após perdas reais, alterando posições disponíveis e acelerando hostis dentro da água.",
    },
  },'''

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
    detail: "Naufrágios, recifes abissais e marés territoriais bioluminescentes",
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

NEW_TIDE_BANNER = '''  const tide = snapshot.tideCycle;
  const tidePressureLabel = tide?.pressureScore >= .7
    ? "PRESSÃO ALTA"
    : tide?.pressureScore >= .35
      ? "PRESSÃO MODERADA"
      : "PRESSÃO BAIXA";
  const tideBanner = tide?.state === "warningAdvance"
    ? `A MARÉ ESTÁ AVANÇANDO · NÍVEL ${tide.currentLevel}→${tide.targetLevel} · ${(tide.remainingMs / 1000).toFixed(1)}s`
    : tide?.state === "rising"
      ? `ÁGUA AVANÇANDO · ${tide.warningCells.length} CÉLULAS EM RISCO · ${(tide.remainingMs / 1000).toFixed(1)}s`
      : tide?.state === "warningRetreat"
        ? `A MARÉ ESTÁ PERDENDO FORÇA · ${(tide.remainingMs / 1000).toFixed(1)}s`
        : tide?.state === "receding"
          ? `A MARÉ ESTÁ RECUANDO · NOVAS POSIÇÕES SERÃO LIBERADAS · ${(tide.remainingMs / 1000).toFixed(1)}s`
          : tide?.state === "drying"
            ? `ZONA INTERMARÉ SECANDO · ${(tide.remainingMs / 1000).toFixed(1)}s`
            : tide?.enabled
              ? `MARÉ NÍVEL ${tide.currentLevel}/${tide.maximumLevel} · ${tidePressureLabel} · ${tide.safeCells} CÉLULAS SEGURAS`
              : null;
'''


def fail(message: str) -> None:
    print(f"[ERRO] {message}", file=sys.stderr)
    raise SystemExit(1)


def replace_once(source: str, old: str, new: str, label: str) -> str:
    if new in source:
        return source
    if old not in source:
        fail(f"Não encontrei o marcador para {label}.")
    return source.replace(old, new, 1)


def insert_after_once(source: str, marker: str, insertion: str, label: str) -> str:
    if insertion.strip() in source:
        return source
    if marker not in source:
        fail(f"Não encontrei o marcador para {label}.")
    return source.replace(marker, marker + insertion, 1)


def replace_object_containing(source: str, token: str, replacement: str) -> str:
    token_index = source.find(token)
    if token_index < 0:
        fail(f"Não encontrei o bloco contendo {token}.")
    start = source.rfind("\n  {", 0, token_index)
    if start < 0:
        fail(f"Não encontrei o início do objeto contendo {token}.")
    start += 1
    brace = source.find("{", start)
    depth = 0
    quote = None
    escaped = False
    end = None
    for index in range(brace, len(source)):
        char = source[index]
        if quote:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == quote:
                quote = None
            continue
        if char in ('"', "'", "`"):
            quote = char
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                end = index + 1
                break
    if end is None:
        fail(f"Não encontrei o fim do objeto contendo {token}.")
    while end < len(source) and source[end] in " \t":
        end += 1
    if end < len(source) and source[end] == ",":
        end += 1
    return source[:start] + replacement + source[end:]


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
        return object_body.rstrip() + "\n\n" + BIOME_BLOCK.rstrip() + "\n"
    start = object_body.rfind("\n  chapter_05:", 0, token_index + len(token))
    start = start + 1 if start >= 0 else object_body.find("  chapter_05:")
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


def repair_campaign_biomes_source(source: str) -> str:
    declaration = "export const CAMPAIGN_BIOMES = Object.freeze("
    declaration_index = source.find(declaration)
    if declaration_index < 0:
        fail("Não encontrei CAMPAIGN_BIOMES em campaignBiomes.js.")
    object_open = source.find("{", declaration_index + len(declaration))
    object_close = find_matching_brace(source, object_open)
    object_end = object_close + 1
    while object_end < len(source) and source[object_end] in " \t\r\n":
        object_end += 1
    if source[object_end:object_end + 2] != ");":
        fail("CAMPAIGN_BIOMES não possui fechamento Object.freeze válido.")
    object_end += 2
    body = replace_or_insert_biome_block(source[object_open + 1:object_close])
    footer = (
        "export const getCampaignBiome = (chapterId) =>\n"
        "  CAMPAIGN_BIOMES[chapterId] || CAMPAIGN_BIOMES.chapter_01;\n\n"
        "export const getGenesisWorldTheme = getCampaignBiome;\n"
    )
    repaired = source[:object_open + 1] + body + source[object_close:object_end] + "\n\n" + footer
    if repaired.count("chapter_05: freezeTheme({") != 1:
        fail("A correção do bioma não produziu exatamente um chapter_05.")
    return repaired


def patch_content(source: str) -> str:
    source = replace_object_containing(source, 'id: "chapter_05"', CHAPTER_BLOCK)
    pattern = re.compile(r"export const CHAPTER_LOADOUT_LIMITS\s*=\s*Object\.freeze\(\{(?P<body>[^}]*)\}\);")
    match = pattern.search(source)
    if not match:
        fail("Não encontrei CHAPTER_LOADOUT_LIMITS em content.js.")
    body = match.group("body")
    if not re.search(r"(?:^|,)\s*5\s*:", body):
        updated = body.rstrip()
        if updated and not updated.endswith(","):
            updated += ","
        updated += " 5: 8"
        source = source[:match.start()] + f"export const CHAPTER_LOADOUT_LIMITS = Object.freeze({{{updated}}});" + source[match.end():]
    return source


def replace_tide_import(source: str) -> str:
    pattern = re.compile(r'import \{\n(?:(?!\} from "\./tideCycle\.js";).)*?\} from "\./tideCycle\.js";', re.S)
    if pattern.search(source):
        return pattern.sub(TIDE_IMPORT, source, count=1)
    marker = 'import { chapterFourAlphaMultipliers } from "./chapterFourEnemies.js";'
    if marker not in source:
        fail("Não encontrei o ponto de importação da maré em battleModel.js.")
    return source.replace(marker, TIDE_IMPORT + "\n" + marker, 1)


def supply_logic(source: str) -> str:
    pattern = re.compile(
        r"    session\.supplyAccumulator \+= dt;\n"
        r"    while \(session\.supplyAccumulator >= 1000\) \{\n"
        r"      session\.supplyAccumulator -= 1000;\n"
        r"      session\.supply = Math\.min\(session\.supplyMax, session\.supply \+ 1\);\n"
        r"    \}",
    )
    match = pattern.search(source)
    if not match:
        fail("Não encontrei o bloco original de regeneração de Supply.")
    return match.group(0)


def patch_battle_model(source: str) -> str:
    supply_before = supply_logic(source)
    source = replace_tide_import(source)

    if "tideCycle: createTideCycleState()," not in source:
        source = replace_once(
            source,
            "    windCurrent: createWindCurrentState(),\n",
            "    windCurrent: createWindCurrentState(),\n    tideCycle: createTideCycleState(),\n",
            "estado territorial da maré",
        )
    if "resetTideCycleForWave(session, hazard);" not in source:
        source = replace_once(
            source,
            "  resetWindCurrentForWave(session, hazard);\n",
            "  resetWindCurrentForWave(session, hazard);\n  resetTideCycleForWave(session, hazard);\n",
            "reinício da maré por onda",
        )
    if "recordTideTroopElimination(session, troop, reason);" not in source:
        source = replace_once(
            source,
            "  recordTroopLoss(session, troop, reason);\n",
            "  recordTroopLoss(session, troop, reason);\n  recordTideTroopElimination(session, troop, reason);\n",
            "registro de perdas reais da maré",
        )

    placement_line = "  if (row < 0 || row >= FIELD.rows || col < 0 || col >= FIELD.cols - 1) return \"Posição fora da zona de combate.\";\n"
    placement_patch = (
        placement_line
        + "  const tidePlacementReason = getTidePlacementBlockReason(session, row, col);\n"
        + "  if (tidePlacementReason) return tidePlacementReason;\n"
    )
    if "const tidePlacementReason = getTidePlacementBlockReason" not in source:
        source = replace_once(source, placement_line, placement_patch, "bloqueio de implantação em água")

    troop_marker = "    sandBuriedStartedAt: 0, sandBuriedUntil: 0, sandAttackSpeedFactor: 1,\n"
    troop_patch = troop_marker + (
        "    submerged: false, submergedStartedAt: -Infinity,\n"
        "    tidePressureDamageApplied: 0, tidePressureInundationId: null,\n"
        "    tidePressureLastEventAt: -Infinity,\n"
    )
    if "tidePressureDamageApplied" not in source:
        source = replace_once(source, troop_marker, troop_patch, "estado submerso das tropas")

    old_factor = "  setTroopAttackSpeedFactor(troop, Math.min(parasiteFactor, webFactor, sandFactor), session.elapsed);"
    new_factor = (
        "  const tideFactor = getTideTroopAttackSpeedFactor(session, troop);\n"
        "  setTroopAttackSpeedFactor(\n"
        "    troop,\n"
        "    Math.min(parasiteFactor, webFactor, sandFactor, tideFactor),\n"
        "    session.elapsed,\n"
        "  );"
    )
    if "const tideFactor = getTideTroopAttackSpeedFactor" not in source:
        source = replace_once(source, old_factor, new_factor, "penalidade de ataque submerso")

    old_move = (
        "function moveEnemy(session, enemy, dt, events) {\n"
        "  enemy.moving = true;\n"
        "  const slow = session.elapsed < enemy.slowUntil ? enemy.slowFactor : 1;\n"
        "  const swarmSpeed = getSilicaDiggerSwarmSpeedFactor(session, enemy);\n"
        "  const tideSpeed = getTideEnemySpeedFactor(session, enemy);\n"
    )
    new_move = (
        "function moveEnemy(session, enemy, dt, events) {\n"
        "  enemy.moving = true;\n"
        "  const baseSlow = session.elapsed < enemy.slowUntil ? enemy.slowFactor : 1;\n"
        "  const slow = getTideAdjustedEnemySlowFactor(session, enemy, baseSlow);\n"
        "  const swarmSpeed = getSilicaDiggerSwarmSpeedFactor(session, enemy);\n"
        "  const tideSpeed = getTideEnemySpeedFactor(session, enemy);\n"
    )
    if "const slow = getTideAdjustedEnemySlowFactor" not in source:
        source = replace_once(source, old_move, new_move, "resistência aquática à lentidão")

    if "isTideReactorPaused(session, troop)" not in source:
        source = replace_once(
            source,
            '    if (config.attack === "energy") {\n',
            '    if (config.attack === "energy") {\n      if (isTideReactorPaused(session, troop)) continue;\n',
            "pausa de Reatores submersos",
        )

    if "getTidePlacementBlockReason(session, row, col)" not in source.split("function mineCellIsFree", 1)[1]:
        source = replace_once(
            source,
            "function mineCellIsFree(session, row, col) {\n",
            "function mineCellIsFree(session, row, col) {\n  if (getTidePlacementBlockReason(session, row, col)) return false;\n",
            "bloqueio de minas em células aquáticas",
        )

    update_mine_marker = "  for (const mine of session.mines) {\n    if (!mine.active) continue;\n"
    update_mine_patch = update_mine_marker + "    if (isTideMineDisabled(session, mine)) continue;\n"
    if "if (isTideMineDisabled(session, mine)) continue;" not in source:
        source = replace_once(source, update_mine_marker, update_mine_patch, "desativação de minas submersas")

    source = source.replace(
        "  updateTideCycle(session, events);",
        "  updateTideCycle(session, events, { eliminateTroop });",
        1,
    )

    if "endTideCycle(session, events, true);" not in source:
        source = source.replace(
            "      endWindCurrent(session, events, true);\n",
            "      endWindCurrent(session, events, true);\n      endTideCycle(session, events, true);\n",
        )
    if "tideCycle: getTideSnapshot(session)," not in source:
        source = replace_once(
            source,
            "    dematerializationPulses: session.dematerializationPulses.map((pulse) => ({ ...pulse })),\n",
            "    tideCycle: getTideSnapshot(session),\n    dematerializationPulses: session.dematerializationPulses.map((pulse) => ({ ...pulse })),\n",
            "snapshot da maré",
        )

    supply_after = supply_logic(source)
    if supply_before != supply_after:
        fail("A instalação tentou alterar a mecânica de Supply; operação cancelada.")
    return source


def patch_game_canvas(source: str) -> str:
    if 'import { drawTideOverlay, drawTideUnderlay } from "./tideRenderer.js";' not in source:
        source = replace_once(
            source,
            'import { drawWindEffects } from "./windCurrentRenderer.js";\n',
            'import { drawWindEffects } from "./windCurrentRenderer.js";\nimport { drawTideOverlay, drawTideUnderlay } from "./tideRenderer.js";\n',
            "import do renderer territorial",
        )
    if "drawTideUnderlay(effectCtx, session, now, settings, adaptive);" not in source:
        source = replace_once(
            source,
            "  effectCtx.translate(0, VIEWPORT.fieldOffsetY);\n  drawDecals(effectCtx, runtime, settings);\n",
            "  effectCtx.translate(0, VIEWPORT.fieldOffsetY);\n  drawTideUnderlay(effectCtx, session, now, settings, adaptive);\n  drawDecals(effectCtx, runtime, settings);\n",
            "camada inferior da maré",
        )
    if "drawTideOverlay(overlayCtx, session, now, settings, adaptive, hoveredCell);" not in source:
        if "drawTideOverlay(overlayCtx, session, now, settings, adaptive);" in source:
            source = source.replace(
                "drawTideOverlay(overlayCtx, session, now, settings, adaptive);",
                "drawTideOverlay(overlayCtx, session, now, settings, adaptive, hoveredCell);",
                1,
            )
        else:
            source = replace_once(
                source,
                "  overlayCtx.translate(0, VIEWPORT.fieldOffsetY);\n  drawWindEffects(overlayCtx, runtime, now, settings, assets.effects?.windCurrent);\n",
                "  overlayCtx.translate(0, VIEWPORT.fieldOffsetY);\n  drawTideOverlay(overlayCtx, session, now, settings, adaptive, hoveredCell);\n  drawWindEffects(overlayCtx, runtime, now, settings, assets.effects?.windCurrent);\n",
                "camada frontal da maré",
            )

    banner_pattern = re.compile(
        r"  const tide = snapshot\.tideCycle;\n"
        r"  const tideColumns = .*?\n"
        r"          : null;\n",
        re.S,
    )
    if banner_pattern.search(source):
        source = banner_pattern.sub(NEW_TIDE_BANNER, source, count=1)
    elif "const tidePressureLabel" not in source:
        marker = '  const sandstormBanner = snapshot.sandstorm?.state === "warning"\n'
        if marker not in source:
            fail("Não encontrei o ponto do banner da maré em GameCanvas.jsx.")
        source = source.replace(marker, NEW_TIDE_BANNER + marker, 1)

    if "tideBanner || windBanner" not in source:
        source = source.replace(
            "            : windBanner || sandstormBanner || defaultContainmentSummary;",
            "            : tideBanner || windBanner || sandstormBanner || defaultContainmentSummary;",
            1,
        )
    return source


def patch_mission_panel(source: str) -> str:
    existing = '  if (phase.environmentHazard?.id === "tide_cycle") return "Ciclo de Maré";'
    desired = '  if (phase.environmentHazard?.id === "tide_cycle") return "Maré Territorial Progressiva";'
    if existing in source:
        return source.replace(existing, desired, 1)
    if desired in source:
        return source
    marker = '  if (phase.environmentHazard?.id === "wind_current") return "Correntes de Vento";\n'
    return replace_once(source, marker, marker + desired + "\n", "descrição da maré territorial")


def patch_biome_test(source: str) -> str:
    pattern = re.compile(r'  it\("define o .*?chapter_05.*?\n  \}\);', re.S)
    replacement = '''  it("define o Abismo de Nereida em ciano e violeta", () => {
    const abyss = getCampaignBiome("chapter_05");

    expect(abyss.key).toBe("abyss");
    expect(abyss.ui.primary).toBe("#22d3ee");
    expect(abyss.ui.accent).toBe("#c084fc");
    expect(abyss.lighting.fillColor).toBe("#67e8f9");
    expect(abyss.planetEffects.kit).toBe("eclipse");
  });'''
    if pattern.search(source):
        return pattern.sub(replacement, source, count=1)
    return source


def backup_file(source: Path, destination: Path) -> bool:
    if not source.exists():
        return False
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)
    return True


def run(command: list[str], cwd: Path) -> None:
    print(f"[EXEC] {' '.join(command)}")
    completed = subprocess.run(command, cwd=cwd, check=False)
    if completed.returncode != 0:
        fail(f"Comando falhou com código {completed.returncode}: {' '.join(command)}")


def is_genesis_repo(path: Path) -> bool:
    return path.is_dir() and all((path / relative).exists() for relative in REQUIRED_PROJECT_PATHS)


def resolve_repo_root(package_root: Path, provided: str | None) -> Path:
    if provided:
        repo_root = Path(provided).expanduser().resolve()
        if not is_genesis_repo(repo_root):
            fail(f"O caminho não parece ser a raiz do Genesis: {repo_root}")
        return repo_root
    candidates: list[Path] = []
    for candidate in (package_root.parent, package_root.parent / "genesis", package_root):
        resolved = candidate.resolve()
        if resolved not in candidates:
            candidates.append(resolved)
    for candidate in candidates:
        if is_genesis_repo(candidate):
            print(f"[INFO] Projeto Genesis detectado automaticamente: {candidate}")
            return candidate
    checked = "\n".join(f"  - {candidate}" for candidate in candidates)
    fail(
        "Não encontrei automaticamente a raiz do Genesis. Pastas verificadas:\n"
        + checked
        + '\nInforme --repo-root, por exemplo: --repo-root "C:\\Projetos\\Genesis"'
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Instala a Maré Territorial Progressiva do Capítulo 5.",
    )
    parser.add_argument("--repo-root", required=False)
    parser.add_argument("--validate", action="store_true")
    args = parser.parse_args()

    package_root = Path(__file__).resolve().parent
    payload_root = package_root / "payload"
    repo_root = resolve_repo_root(package_root, args.repo_root)
    missing = [relative for relative in PAYLOAD_FILES if not (payload_root / relative).exists()]
    if missing:
        fail("Arquivos ausentes no pacote: " + ", ".join(missing))

    timestamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_root = repo_root / ".genesis-backups" / f"chapter-05-progressive-tide-{timestamp}"
    backed_up: list[str] = []
    changed: list[str] = []

    for relative in (*PATCHED_FILES, *PAYLOAD_FILES):
        if backup_file(repo_root / relative, backup_root / relative):
            backed_up.append(relative)

    for relative in PAYLOAD_FILES:
        source = payload_root / relative
        destination = repo_root / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
        changed.append(relative)
        print(f"[OK] {relative}")

    patchers = {
        "src/game/content.js": patch_content,
        "src/game/battleModel.js": patch_battle_model,
        "src/game/GameCanvas.jsx": patch_game_canvas,
        "src/campaign/MissionPanel.jsx": patch_mission_panel,
        "src/campaign/campaignBiomes.js": repair_campaign_biomes_source,
        "src/campaign/campaignBiomes.test.js": patch_biome_test,
    }
    for relative, patcher in patchers.items():
        path = repo_root / relative
        if not path.exists() and relative.endswith(".test.js"):
            continue
        original = path.read_text(encoding="utf-8")
        updated = patcher(original)
        path.write_text(updated, encoding="utf-8", newline="\n")
        changed.append(relative)
        print(f"[OK] {relative} [patch]")

    backup_root.mkdir(parents=True, exist_ok=True)
    (backup_root / "install-manifest.json").write_text(
        json.dumps(
            {
                "packageVersion": PACKAGE_VERSION,
                "installedAt": dt.datetime.now().isoformat(),
                "repoRoot": str(repo_root),
                "backupRoot": str(backup_root),
                "changed": changed,
                "backedUp": backed_up,
                "supplyMechanicsChanged": False,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    node = shutil.which("node")
    if node:
        for relative in (
            "src/game/tideCycle.js",
            "src/game/tideRenderer.js",
            "src/game/chapterFivePhases.js",
            "src/game/battleModel.js",
            "src/campaign/campaignBiomes.js",
        ):
            run([node, "--check", relative], repo_root)
    else:
        print("[AVISO] Node.js não encontrado; a validação sintática foi ignorada.")

    print()
    print("[SUCESSO] Maré Territorial Progressiva instalada.")
    print("[INFO] Supply preservado sem alterações.")
    print("[INFO] Água profunda, intermaré seca/alagada e terra firme configuradas.")
    print("[INFO] Avanço responde à população; recuo responde às perdas reais.")
    print(f"[INFO] Backup: {backup_root}")

    if args.validate:
        npx = "npx.cmd" if sys.platform.startswith("win") else "npx"
        run([
            npx, "vitest", "run",
            "src/game/tideCycle.test.js",
            "src/game/chapterFiveContent.test.js",
            "src/game/tideBattleIntegration.test.js",
            "src/campaign/campaignBiomes.test.js",
        ], repo_root)
        run([npx, "vite", "build"], repo_root)
        print("[SUCESSO] Testes e Vite build concluídos.")


if __name__ == "__main__":
    main()
