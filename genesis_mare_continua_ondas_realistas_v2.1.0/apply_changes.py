#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

PACKAGE_VERSION = "2.1.0"
LIVE_RENDERER = "src/game/tideRenderer.js"
LIVE_CYCLE = "src/game/tideCycle.js"
OPTIONAL_RENDERERS = (
    "genesis_capitulo_05_mare_territorial_progressiva/payload/src/game/tideRenderer.js",
)

ENTRY_HELPER = '''function isEnemyEntryWaterCell(row, col) {
  return Number.isInteger(row)
    && row >= 0
    && row < FIELD.rows
    && Number.isInteger(col)
    && col === FIELD.enemyEntryCol;
}
'''

ENTRY_STATE_BLOCK = '''  if (config && tide && isEnemyEntryWaterCell(row, col)) {
    return {
      type: TIDE_CELL_TYPES.DEEP_WATER,
      status: "deep",
      flooded: true,
      deployable: false,
      level: 0,
    };
  }

'''


def fail(message: str) -> None:
    print(f"[ERRO] {message}", file=sys.stderr)
    raise SystemExit(1)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def run(command: list[str], cwd: Path) -> None:
    print("[EXEC] " + " ".join(str(part) for part in command))
    completed = subprocess.run(command, cwd=cwd, check=False)
    if completed.returncode != 0:
        fail(f"Comando falhou com código {completed.returncode}: {' '.join(command)}")


def is_genesis_repo(path: Path) -> bool:
    required = (
        "package.json",
        "src/game/visualGeometry.js",
        "src/game/GameCanvas.jsx",
        LIVE_RENDERER,
        LIVE_CYCLE,
    )
    return path.is_dir() and all((path / relative).is_file() for relative in required)


def resolve_repo_root(package_root: Path, supplied: str | None) -> Path:
    if supplied:
        root = Path(supplied).expanduser().resolve()
        if not is_genesis_repo(root):
            fail(f"O caminho não parece ser a raiz do Genesis: {root}")
        return root

    candidates = [package_root.parent, package_root.parent / "genesis", Path.cwd()]
    for candidate in candidates:
        candidate = candidate.resolve()
        if is_genesis_repo(candidate):
            print(f"[INFO] Genesis detectado em: {candidate}")
            return candidate
    fail('Informe --repo-root, por exemplo: --repo-root "C:\\Projetos\\Genesis"')


def ensure_spawn_water(source: str) -> tuple[str, bool]:
    changed = False
    if "function isEnemyEntryWaterCell(row, col)" not in source:
        marker = "function uniqueCells"
        index = source.find(marker)
        if index < 0:
            fail("Não encontrei o marcador uniqueCells em tideCycle.js.")
        source = source[:index] + ENTRY_HELPER + "\n" + source[index:]
        changed = True

    if "config && tide && isEnemyEntryWaterCell(row, col)" not in source:
        function_index = source.find("export function getTideCellState")
        if function_index < 0:
            fail("Não encontrei getTideCellState em tideCycle.js.")
        tide_match = re.search(
            r"const\s+tide\s*=\s*session\?\.tideCycle;\s*",
            source[function_index:],
        )
        if not tide_match:
            fail("Não encontrei a inicialização da maré em getTideCellState.")
        insert_at = function_index + tide_match.end()
        source = source[:insert_at] + "\n" + ENTRY_STATE_BLOCK + source[insert_at:]
        changed = True

    if source.count("function isEnemyEntryWaterCell(row, col)") != 1:
        fail("Quantidade inválida do helper de água na entrada inimiga.")
    if source.count("config && tide && isEnemyEntryWaterCell(row, col)") != 1:
        fail("Quantidade inválida da regra aquática da entrada inimiga.")
    return source, changed


def copy_backup(source: Path, backup_root: Path, relative: str) -> None:
    destination = backup_root / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)


def create_runtime_validation(repo_root: Path, destination: Path) -> None:
    renderer_url = (repo_root / LIVE_RENDERER).resolve().as_uri()
    cycle_url = (repo_root / LIVE_CYCLE).resolve().as_uri()
    geometry_url = (repo_root / "src/game/visualGeometry.js").resolve().as_uri()
    destination.write_text(f'''import {{
  drawTideOverlay,
  drawTideUnderlay,
  getTideVisualBoundaryX,
  getTideVisualWaterlineX,
}} from {json.dumps(renderer_url)};
import {{ createTideCycleHazard, createTideCycleState }} from {json.dumps(cycle_url)};
import {{ FIELD }} from {json.dumps(geometry_url)};

const hazard = createTideCycleHazard(0, {{
  permanentWaterCells: Array.from({{ length: FIELD.rows }}, (_, row) => [row, FIELD.lastTroopCol]),
  intertidalBands: [{{
    level: 1,
    cells: Array.from({{ length: FIELD.rows }}, (_, row) => [row, FIELD.lastTroopCol - 1]),
  }}],
  initialLevel: 0,
  maximumLevel: 1,
}});
const session = {{
  phase: {{ environmentHazard: hazard }},
  tideCycle: createTideCycleState(),
  elapsed: 1000,
  waveIndex: 0,
  troops: [],
  enemies: [],
}};
session.tideCycle.initialized = true;
session.tideCycle.state = "stable";
session.tideCycle.currentLevel = 0;
session.tideCycle.targetLevel = 0;
session.tideCycle.warningCells = [];
session.tideCycle.dryingCells = [];
session.tideCycle.submergedTroopIds = [];

const boundary = getTideVisualBoundaryX(session, 2, 1000);
if (!Number.isFinite(boundary) || boundary >= FIELD.width) {{
  throw new Error(`Fronteira visual inválida: ${{boundary}}`);
}}
const wave = getTideVisualWaterlineX(session, FIELD.height / 2, 1000, {{}});
if (!Number.isFinite(wave)) throw new Error("Ondulação visual inválida.");

const gradient = {{ addColorStop() {{}} }};
const ctx = new Proxy({{}}, {{
  get(target, property) {{
    if (property in target) return target[property];
    if (property === "createLinearGradient" || property === "createRadialGradient") return () => gradient;
    return () => {{}};
  }},
  set(target, property, value) {{ target[property] = value; return true; }},
}});
drawTideUnderlay(ctx, session, 1000, {{}}, {{}});
drawTideOverlay(ctx, session, 1000, {{}}, {{}});
console.log(`[OK] Maré contínua carregada; fronteira base em ${{boundary.toFixed(1)}}px.`);
''', encoding="utf-8", newline="\n")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Instala a maré contínua com costa ondulada no Capítulo 5 do Genesis.",
    )
    parser.add_argument("--repo-root")
    parser.add_argument("--validate", action="store_true")
    args = parser.parse_args()

    package_root = Path(__file__).resolve().parent
    payload_renderer = package_root / "payload" / LIVE_RENDERER
    if not payload_renderer.is_file():
        fail(f"Payload ausente: {payload_renderer}")

    repo_root = resolve_repo_root(package_root, args.repo_root)
    timestamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    backup_root = repo_root / ".genesis-backups" / f"chapter-05-continuous-tide-{timestamp}"
    backup_root.mkdir(parents=True, exist_ok=True)

    protected_files = [
        "src/game/battleModel.js",
        "src/game/content.js",
        "src/game/chapterFivePhases.js",
    ]
    protected_before = {
        relative: sha256(repo_root / relative)
        for relative in protected_files
        if (repo_root / relative).is_file()
    }

    changed: list[str] = []

    live_renderer = repo_root / LIVE_RENDERER
    live_cycle = repo_root / LIVE_CYCLE
    copy_backup(live_renderer, backup_root, LIVE_RENDERER)
    copy_backup(live_cycle, backup_root, LIVE_CYCLE)

    cycle_source = live_cycle.read_text(encoding="utf-8")
    cycle_updated, cycle_changed = ensure_spawn_water(cycle_source)
    if cycle_changed:
        live_cycle.write_text(cycle_updated, encoding="utf-8", newline="\n")
        changed.append(LIVE_CYCLE)
        print(f"[OK] {LIVE_CYCLE} atualizado para manter água na área de spawn.")
    else:
        print(f"[OK] {LIVE_CYCLE} já possui água na área de spawn.")

    shutil.copy2(payload_renderer, live_renderer)
    changed.append(LIVE_RENDERER)
    print(f"[OK] {LIVE_RENDERER} substituído pela versão contínua.")

    for relative in OPTIONAL_RENDERERS:
        optional = repo_root / relative
        if not optional.is_file():
            continue
        copy_backup(optional, backup_root, relative)
        optional.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(payload_renderer, optional)
        changed.append(relative)
        print(f"[OK] Payload futuro atualizado: {relative}")

    game_canvas = (repo_root / "src/game/GameCanvas.jsx").read_text(encoding="utf-8")
    expected_import = 'import { drawTideOverlay, drawTideUnderlay } from "./tideRenderer.js";'
    if expected_import not in game_canvas:
        fail("GameCanvas.jsx não possui o import esperado do renderer da maré.")

    protected_after = {
        relative: sha256(repo_root / relative)
        for relative in protected_before
    }
    altered_protected = [
        relative for relative, digest in protected_before.items()
        if protected_after.get(relative) != digest
    ]
    if altered_protected:
        fail("Arquivos de gameplay foram alterados inesperadamente: " + ", ".join(altered_protected))

    node = shutil.which("node")
    if not node:
        fail("Node.js não foi encontrado. Ele é necessário para validar a instalação.")
    run([node, "--check", LIVE_RENDERER], repo_root)
    run([node, "--check", LIVE_CYCLE], repo_root)

    runtime_check = backup_root / "validate-continuous-tide.mjs"
    create_runtime_validation(repo_root, runtime_check)
    run([node, str(runtime_check)], repo_root)

    manifest = {
        "packageVersion": PACKAGE_VERSION,
        "installedAt": dt.datetime.now().isoformat(),
        "repoRoot": str(repo_root),
        "backupRoot": str(backup_root),
        "changed": changed,
        "protectedFilesUnchanged": protected_files,
        "supplyMechanicsChanged": False,
        "gameplayRulesChanged": False,
        "visualChanges": {
            "continuousWaterMass": True,
            "routeInterpolatedCoastline": True,
            "multiFrequencyWaves": True,
            "positionBasedRisingAndReceding": True,
            "layeredFoam": True,
            "internalCurrents": True,
            "caustics": True,
            "enemyWakes": True,
            "adaptiveQuality": True,
        },
    }
    (backup_root / "install-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
        newline="\n",
    )

    if args.validate:
        npx = "npx.cmd" if sys.platform.startswith("win") else "npx"
        run([npx, "vite", "build"], repo_root)
        print("[SUCESSO] Vite build concluído.")

    print()
    print("[SUCESSO] Maré contínua e ondulada instalada.")
    print("[INFO] Gameplay, Supply, probabilidades e regras territoriais foram preservados.")
    print(f"[INFO] Backup: {backup_root}")


if __name__ == "__main__":
    main()
