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
  getTideEnemySpeedFactor,
  getTideSnapshot,
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
      label: "Ciclo de Maré",
      description:
        "A maré pode subir a cada verificação e fortalece inimigos ainda dentro da área inundada. Se nenhuma tropa for eliminada durante a maré alta, o fenômeno pode voltar na mesma onda.",
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
    print(f"[ERRO] {message}", file=sys.stderr)
    raise SystemExit(1)


def replace_once(source: str, old: str, new: str, label: str) -> str:
    if new in source:
        return source
    if old not in source:
        fail(f"Não encontrei o marcador para {label}.")
    return source.replace(old, new, 1)


def insert_before_once(source: str, marker: str, insertion: str, label: str) -> str:
    if insertion.strip() in source:
        return source
    if marker not in source:
        fail(f"Não encontrei o marcador para {label}.")
    return source.replace(marker, insertion + "\n" + marker, 1)


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


def replace_freeze_theme(source: str) -> str:
    token = "chapter_05: freezeTheme({"
    token_index = source.find(token)
    if token_index < 0:
        fail("Não encontrei o tema chapter_05 em campaignBiomes.js.")
    start = source.rfind("\n  chapter_05:", 0, token_index + 1)
    if start < 0:
        start = source.find("  chapter_05:", 0, token_index + 1)
    else:
        start += 1
    brace = source.find("{", token_index)
    depth = 0
    quote = None
    escaped = False
    close_brace = None
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
                close_brace = index + 1
                break
    if close_brace is None:
        fail("Não encontrei o fim do tema chapter_05.")
    end = source.find("),", close_brace)
    if end < 0:
        fail("Não encontrei o fechamento freezeTheme do chapter_05.")
    end += 2
    return source[:start] + BIOME_BLOCK + source[end:]


def ensure_base_chapter(repo_root: Path) -> None:
    chapter_file = repo_root / "src/game/chapterFivePhases.js"
    content = (repo_root / "src/game/content.js").read_text(encoding="utf-8")
    biomes = (repo_root / "src/campaign/campaignBiomes.js").read_text(encoding="utf-8")
    if (
        chapter_file.exists()
        and 'id: "chapter_05"' in content
        and "chapter_05: freezeTheme({" in biomes
    ):
        return
    legacy = repo_root / "genesis_capitulo_05_nucleo_eclipse/apply_changes.py"
    if not legacy.exists():
        fail(
            "O Capítulo 5 base ainda não está instalado e o pacote "
            "genesis_capitulo_05_nucleo_eclipse não foi encontrado no repositório."
        )
    print("[INFO] Instalando a estrutura base do Capítulo 5 existente...")
    result = subprocess.run(
        [sys.executable, str(legacy), "--repo-root", str(repo_root)],
        cwd=repo_root,
        check=False,
    )
    if result.returncode != 0:
        fail("A instalação da estrutura base do Capítulo 5 falhou.")


def patch_content(source: str) -> str:
    source = replace_object_containing(source, 'id: "chapter_05"', CHAPTER_BLOCK)
    pattern = re.compile(
        r"export const CHAPTER_LOADOUT_LIMITS\s*=\s*Object\.freeze\(\{(?P<body>[^}]*)\}\);"
    )
    match = pattern.search(source)
    if not match:
        fail("Não encontrei CHAPTER_LOADOUT_LIMITS em content.js.")
    body = match.group("body")
    if not re.search(r"(?:^|,)\s*5\s*:", body):
        updated = body.rstrip()
        if updated and not updated.endswith(","):
            updated += ","
        updated += " 5: 8"
        source = source[:match.start()] + (
            f"export const CHAPTER_LOADOUT_LIMITS = Object.freeze({{{updated}}});"
        ) + source[match.end():]
    return source


def patch_battle_model(source: str) -> str:
    source = insert_before_once(
        source,
        'import { chapterFourAlphaMultipliers } from "./chapterFourEnemies.js";',
        TIDE_IMPORT,
        "import da maré",
    )
    source = replace_once(
        source,
        "    windCurrent: createWindCurrentState(),\n",
        "    windCurrent: createWindCurrentState(),\n    tideCycle: createTideCycleState(),\n",
        "estado da maré",
    )
    source = replace_once(
        source,
        "  resetWindCurrentForWave(session, hazard);\n",
        "  resetWindCurrentForWave(session, hazard);\n  resetTideCycleForWave(session, hazard);\n",
        "reinício da maré por onda",
    )
    source = replace_once(
        source,
        "  recordTroopLoss(session, troop, reason);\n",
        "  recordTroopLoss(session, troop, reason);\n  recordTideTroopElimination(session, troop, reason);\n",
        "registro de eliminação durante maré",
    )
    source = replace_once(
        source,
        "  const swarmSpeed = getSilicaDiggerSwarmSpeedFactor(session, enemy);\n  enemy.x -= enemy.speed * swarmSpeed * session.modifiers.enemySpeed\n",
        "  const swarmSpeed = getSilicaDiggerSwarmSpeedFactor(session, enemy);\n  const tideSpeed = getTideEnemySpeedFactor(session, enemy);\n  enemy.x -= enemy.speed * swarmSpeed * tideSpeed * session.modifiers.enemySpeed\n",
        "bônus de velocidade da maré",
    )
    source = replace_once(
        source,
        "  updateEnergyPickups(session, dt, events);\n  updateWindCurrent(session, events, {\n",
        "  updateEnergyPickups(session, dt, events);\n  updateTideCycle(session, events);\n  updateWindCurrent(session, events, {\n",
        "atualização da maré",
    )
    if "endTideCycle(session, events, true);" not in source:
        source = source.replace(
            "      endWindCurrent(session, events, true);\n",
            "      endWindCurrent(session, events, true);\n      endTideCycle(session, events, true);\n",
        )
    source = replace_once(
        source,
        "    dematerializationPulses: session.dematerializationPulses.map((pulse) => ({ ...pulse })),\n",
        "    tideCycle: getTideSnapshot(session),\n    dematerializationPulses: session.dematerializationPulses.map((pulse) => ({ ...pulse })),\n",
        "snapshot da maré",
    )
    return source


def patch_game_canvas(source: str) -> str:
    source = replace_once(
        source,
        'import { drawWindEffects } from "./windCurrentRenderer.js";\n',
        'import { drawWindEffects } from "./windCurrentRenderer.js";\nimport { drawTideOverlay, drawTideUnderlay } from "./tideRenderer.js";\n',
        "import do renderer da maré",
    )
    source = replace_once(
        source,
        "        if (events.some((event) => event.type === \"windCurrentEnded\")) {\n          audioRef.current.windActiveLoop?.pause();\n        }\n",
        "        if (events.some((event) => event.type === \"windCurrentEnded\")) {\n          audioRef.current.windActiveLoop?.pause();\n        }\n        if (events.some((event) => event.type === \"tideWarning\")) play(\"alert\", 0.52);\n        if (events.some((event) => event.type === \"tideHighStarted\")) play(\"melee\", 0.38);\n        if (events.some((event) => event.type === \"tideLowStarted\")) play(\"deploy\", 0.24);\n",
        "áudio da maré",
    )
    source = replace_once(
        source,
        "  effectCtx.translate(0, VIEWPORT.fieldOffsetY);\n  drawDecals(effectCtx, runtime, settings);\n",
        "  effectCtx.translate(0, VIEWPORT.fieldOffsetY);\n  drawTideUnderlay(effectCtx, session, now, settings, adaptive);\n  drawDecals(effectCtx, runtime, settings);\n",
        "camada inferior da maré",
    )
    source = replace_once(
        source,
        "  overlayCtx.translate(0, VIEWPORT.fieldOffsetY);\n  drawWindEffects(overlayCtx, runtime, now, settings, assets.effects?.windCurrent);\n",
        "  overlayCtx.translate(0, VIEWPORT.fieldOffsetY);\n  drawTideOverlay(overlayCtx, session, now, settings, adaptive);\n  drawWindEffects(overlayCtx, runtime, now, settings, assets.effects?.windCurrent);\n",
        "camada frontal da maré",
    )
    tide_banner = '''  const tide = snapshot.tideCycle;
  const tideColumns = tide?.floodedFromCol != null
    ? `${tide.floodedFromCol + 1}–${FIELD.enemyEntryCol + 1}`
    : "—";
  const tideBanner = tide?.state === "warning"
    ? `MARÉ SUBINDO · COLUNAS ${tideColumns} · ${(tide.remainingMs / 1000).toFixed(1)}s`
    : tide?.state === "rising"
      ? `ÁGUA AVANÇANDO · COLUNAS ${tideColumns} · ${(tide.remainingMs / 1000).toFixed(1)}s`
      : tide?.state === "high"
        ? `MARÉ ALTA · HOSTIS NA ÁGUA ACELERADOS · ${(tide.remainingMs / 1000).toFixed(1)}s`
        : tide?.state === "receding"
          ? `MARÉ RECUANDO · ${(tide.remainingMs / 1000).toFixed(1)}s`
          : null;
'''
    if "const tideBanner" not in source:
        marker = "  const sandstormBanner = snapshot.sandstorm?.state === \"warning\"\n"
        if marker not in source:
            fail("Não encontrei o banner da tempestade em GameCanvas.jsx.")
        source = source.replace(marker, tide_banner + marker, 1)
    source = source.replace(
        "            : windBanner || sandstormBanner || defaultContainmentSummary;",
        "            : tideBanner || windBanner || sandstormBanner || defaultContainmentSummary;",
        1,
    )
    return source


def patch_mission_panel(source: str) -> str:
    return replace_once(
        source,
        '  if (phase.environmentHazard?.id === "wind_current") return "Correntes de Vento";\n',
        '  if (phase.environmentHazard?.id === "wind_current") return "Correntes de Vento";\n  if (phase.environmentHazard?.id === "tide_cycle") return "Ciclo de Maré";\n',
        "descrição da mecânica de maré",
    )


def patch_biome_test(source: str) -> str:
    pattern = re.compile(
        r'  it\("define o Eclipse em magenta e ciano", \(\) => \{.*?\n  \}\);',
        re.S,
    )
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
        if not repo_root.is_dir():
            fail(f"Repositório não encontrado: {repo_root}")
        missing = [
            relative for relative in REQUIRED_PROJECT_PATHS
            if not (repo_root / relative).exists()
        ]
        if missing:
            fail(
                "RepoRoot não parece ser a raiz do Genesis. Ausentes: "
                + ", ".join(missing)
            )
        return repo_root

    candidates = []
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
        "Não encontrei automaticamente a raiz do Genesis. "
        "Pastas verificadas:\n" + checked +
        "\nInforme --repo-root, por exemplo: "
        '--repo-root "C:\\Projetos\\Genesis"'
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Instala o Capítulo 5 Abismo de Nereida e a mecânica de maré.",
    )
    parser.add_argument(
        "--repo-root",
        required=False,
        help=(
            "Pasta raiz do repositório Genesis. Quando omitida, o instalador "
            "procura na pasta pai do pacote e em uma subpasta chamada genesis."
        ),
    )
    parser.add_argument("--validate", action="store_true", help="Executa testes específicos e o build do Vite.")
    args = parser.parse_args()

    package_root = Path(__file__).resolve().parent
    payload_root = package_root / "payload"
    repo_root = resolve_repo_root(package_root, args.repo_root)
    missing_payload = [relative for relative in PAYLOAD_FILES if not (payload_root / relative).exists()]
    if missing_payload:
        fail("Arquivos ausentes no pacote: " + ", ".join(missing_payload))

    ensure_base_chapter(repo_root)

    timestamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_root = repo_root / ".genesis-backups" / f"chapter-05-nereida-{timestamp}"
    copied: list[str] = []
    backed_up: list[str] = []

    for relative in (*PATCHED_FILES, *PAYLOAD_FILES):
        if backup_file(repo_root / relative, backup_root / relative):
            backed_up.append(relative)

    for relative in PAYLOAD_FILES:
        source = payload_root / relative
        destination = repo_root / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
        copied.append(relative)
        print(f"[OK] {relative}")

    patchers = {
        "src/game/content.js": patch_content,
        "src/game/battleModel.js": patch_battle_model,
        "src/game/GameCanvas.jsx": patch_game_canvas,
        "src/campaign/MissionPanel.jsx": patch_mission_panel,
        "src/campaign/campaignBiomes.js": replace_freeze_theme,
        "src/campaign/campaignBiomes.test.js": patch_biome_test,
    }
    for relative, patcher in patchers.items():
        path = repo_root / relative
        if not path.exists() and relative.endswith(".test.js"):
            continue
        original = path.read_text(encoding="utf-8")
        updated = patcher(original)
        path.write_text(updated, encoding="utf-8", newline="\n")
        copied.append(relative)
        print(f"[OK] {relative} [patch]")

    backup_root.mkdir(parents=True, exist_ok=True)
    (backup_root / "install-manifest.json").write_text(
        json.dumps(
            {
                "installedAt": dt.datetime.now().isoformat(),
                "repoRoot": str(repo_root),
                "backupRoot": str(backup_root),
                "copied": copied,
                "backedUp": backed_up,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    print()
    print("[SUCESSO] Capítulo 5 convertido para Abismo de Nereida.")
    print("[INFO] Oito missões usam imagens próprias e inimigos já existentes.")
    print("[INFO] Todas as missões começam com Supply 40/40 e possuem seis ondas.")
    print("[INFO] A maré pode se repetir na onda somente quando não elimina tropas.")
    print(f"[INFO] Backup disponível em: {backup_root}")

    if args.validate:
        npx = "npx.cmd" if sys.platform.startswith("win") else "npx"
        run([
            npx, "vitest", "run",
            "src/game/tideCycle.test.js",
            "src/game/chapterFiveContent.test.js",
            "src/campaign/campaignBiomes.test.js",
        ], repo_root)
        run([npx, "vite", "build"], repo_root)
        print("[SUCESSO] Testes específicos e Vite build concluídos.")


if __name__ == "__main__":
    main()
