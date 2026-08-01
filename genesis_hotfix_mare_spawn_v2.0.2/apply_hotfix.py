#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

PACKAGE_VERSION = "2.0.2"
LIVE_FILES = (
    "src/game/tideCycle.js",
    "src/game/tideRenderer.js",
)
OPTIONAL_PAYLOAD_FILES = (
    "genesis_capitulo_05_mare_territorial_progressiva/payload/src/game/tideCycle.js",
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


def is_genesis_repo(path: Path) -> bool:
    return path.is_dir() and all((path / relative).is_file() for relative in (
        "package.json",
        "src/game/visualGeometry.js",
        *LIVE_FILES,
    ))


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


def patch_tide_cycle(source: str) -> str:
    if "function isEnemyEntryWaterCell(row, col)" not in source:
        marker = "function uniqueCells(cells = []) {"
        index = source.find(marker)
        if index < 0:
            fail("Não encontrei o marcador uniqueCells em tideCycle.js.")
        source = source[:index] + ENTRY_HELPER + "\n" + source[index:]

    if "config && tide && isEnemyEntryWaterCell(row, col)" not in source:
        marker = "  const tide = session?.tideCycle;\n"
        function_index = source.find("export function getTideCellState(session, row, col) {")
        if function_index < 0:
            fail("Não encontrei getTideCellState em tideCycle.js.")
        marker_index = source.find(marker, function_index)
        if marker_index < 0:
            fail("Não encontrei a inicialização da maré em getTideCellState.")
        insert_at = marker_index + len(marker)
        source = source[:insert_at] + ENTRY_STATE_BLOCK + source[insert_at:]

    if source.count("function isEnemyEntryWaterCell(row, col)") != 1:
        fail("A correção produziu uma quantidade inválida do helper da entrada inimiga.")
    if source.count("config && tide && isEnemyEntryWaterCell(row, col)") != 1:
        fail("A correção produziu uma quantidade inválida do estado aquático da entrada.")
    return source


def patch_tide_renderer(source: str) -> str:
    old_definition = '''function forEachDeployableCell(callback) {
  for (let row = 0; row < FIELD.rows; row += 1) {
    for (let col = FIELD.firstTroopCol; col <= FIELD.lastTroopCol; col += 1) {
      callback(row, col);
    }
  }
}'''
    new_definition = '''function forEachTideCell(callback) {
  for (let row = 0; row < FIELD.rows; row += 1) {
    // A água também cobre a coluna de entrada, onde os inimigos aparecem.
    for (let col = FIELD.firstTroopCol; col <= FIELD.enemyEntryCol; col += 1) {
      callback(row, col);
    }
  }
}'''

    if old_definition in source:
        source = source.replace(old_definition, new_definition, 1)
    elif "function forEachTideCell(callback)" not in source:
        fail("Não encontrei o iterador das células em tideRenderer.js.")

    source = source.replace("forEachDeployableCell(", "forEachTideCell(")

    old_inside = "      && neighbor.col >= FIELD.firstTroopCol && neighbor.col <= FIELD.lastTroopCol;"
    new_inside = "      && neighbor.col >= FIELD.firstTroopCol && neighbor.col <= FIELD.enemyEntryCol;"
    if old_inside in source:
        source = source.replace(old_inside, new_inside, 1)
    elif new_inside not in source:
        fail("Não encontrei o limite dos vizinhos aquáticos em tideRenderer.js.")

    edge_guard = '    if (neighbor.side === "right" && col === FIELD.enemyEntryCol) continue;\n'
    loop_marker = "  for (const neighbor of neighbors) {\n"
    if edge_guard not in source:
        foam_index = source.find("function drawCoastFoam(")
        if foam_index < 0:
            fail("Não encontrei drawCoastFoam em tideRenderer.js.")
        loop_index = source.find(loop_marker, foam_index)
        if loop_index < 0:
            fail("Não encontrei o loop de espuma em tideRenderer.js.")
        insert_at = loop_index + len(loop_marker)
        source = source[:insert_at] + edge_guard + source[insert_at:]

    if "forEachDeployableCell(" in source:
        fail("O renderer ainda possui o iterador antigo limitado às células de tropas.")
    if "col <= FIELD.enemyEntryCol" not in source:
        fail("O renderer não foi estendido até a entrada inimiga.")
    return source


def patch_file(path: Path, patcher) -> bool:
    original = path.read_text(encoding="utf-8")
    updated = patcher(original)
    if updated == original:
        print(f"[OK] {path} já estava corrigido.")
        return False
    path.write_text(updated, encoding="utf-8", newline="\n")
    print(f"[OK] {path} corrigido.")
    return True


def run(command: list[str], cwd: Path) -> None:
    print("[EXEC] " + " ".join(str(part) for part in command))
    result = subprocess.run(command, cwd=cwd, check=False)
    if result.returncode != 0:
        fail(f"Comando falhou com código {result.returncode}: {' '.join(command)}")


def create_runtime_validation(repo_root: Path, destination: Path) -> None:
    tide_url = (repo_root / "src/game/tideCycle.js").resolve().as_uri()
    geometry_url = (repo_root / "src/game/visualGeometry.js").resolve().as_uri()
    destination.write_text(f'''import {{
  TIDE_CELL_TYPES,
  createTideCycleHazard,
  createTideCycleState,
  getTideCellState,
  getTideEnemySpeedFactor,
}} from {json.dumps(tide_url)};
import {{ FIELD }} from {json.dumps(geometry_url)};

const hazard = createTideCycleHazard(0, {{ enemySpeedFactor: 1.15 }});
const session = {{
  phase: {{ environmentHazard: hazard }},
  tideCycle: createTideCycleState(),
  troops: [],
  elapsed: 0,
  waveIndex: 0,
}};
const entry = getTideCellState(session, 2, FIELD.enemyEntryCol);
if (entry.type !== TIDE_CELL_TYPES.DEEP_WATER || !entry.flooded || entry.deployable) {{
  throw new Error(`Entrada inimiga não está em água profunda: ${{JSON.stringify(entry)}}`);
}}
const enemy = {{ row: 2, x: FIELD.spawnX, dead: false }};
const factor = getTideEnemySpeedFactor(session, enemy);
if (!(factor > 1)) throw new Error(`Inimigo no spawn não recebeu velocidade aquática: ${{factor}}`);
console.log(`[OK] Spawn aquático ativo na coluna ${{FIELD.enemyEntryCol}}; velocidade x${{factor.toFixed(2)}}.`);
''', encoding="utf-8", newline="\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Estende a maré do Capítulo 5 até a área de spawn inimiga.")
    parser.add_argument("--repo-root")
    parser.add_argument("--validate", action="store_true")
    args = parser.parse_args()

    package_root = Path(__file__).resolve().parent
    repo_root = resolve_repo_root(package_root, args.repo_root)
    timestamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_root = repo_root / ".genesis-backups" / f"chapter-05-spawn-water-{timestamp}"
    backup_root.mkdir(parents=True, exist_ok=True)

    targets: list[tuple[str, object]] = [
        (LIVE_FILES[0], patch_tide_cycle),
        (LIVE_FILES[1], patch_tide_renderer),
    ]
    for relative in OPTIONAL_PAYLOAD_FILES:
        path = repo_root / relative
        if path.is_file():
            targets.append((relative, patch_tide_cycle if relative.endswith("tideCycle.js") else patch_tide_renderer))

    changed: list[str] = []
    hashes_before: dict[str, str] = {}
    for relative, _ in targets:
        path = repo_root / relative
        if not path.is_file():
            fail(f"Arquivo obrigatório ausente: {path}")
        hashes_before[relative] = sha256(path)
        destination = backup_root / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, destination)

    battle_model = repo_root / "src/game/battleModel.js"
    battle_hash_before = sha256(battle_model) if battle_model.is_file() else None

    for relative, patcher in targets:
        if patch_file(repo_root / relative, patcher):
            changed.append(relative)

    battle_hash_after = sha256(battle_model) if battle_model.is_file() else None
    if battle_hash_before != battle_hash_after:
        fail("battleModel.js foi alterado inesperadamente; o hotfix foi interrompido.")

    node = shutil.which("node")
    if not node:
        fail("Node.js não foi encontrado. Ele é necessário para validar a correção.")

    for relative in LIVE_FILES:
        run([node, "--check", relative], repo_root)

    runtime_check = backup_root / "validate-spawn-water.mjs"
    create_runtime_validation(repo_root, runtime_check)
    run([node, str(runtime_check)], repo_root)

    manifest = {
        "packageVersion": PACKAGE_VERSION,
        "installedAt": dt.datetime.now().isoformat(),
        "repoRoot": str(repo_root),
        "backupRoot": str(backup_root),
        "changed": changed,
        "filesChecked": [relative for relative, _ in targets],
        "battleModelChanged": False,
        "supplyMechanicsChanged": False,
        "behavior": {
            "enemyEntryColumnFlooded": True,
            "spawnReceivesTideSpeedBonus": True,
            "deploymentRulesChanged": False,
        },
    }
    (backup_root / "hotfix-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
        newline="\n",
    )

    print()
    print("[SUCESSO] A maré agora cobre toda a entrada do lado direito.")
    print("[INFO] Inimigos recebem o bônus aquático desde o spawn, inclusive fora da área visível.")
    print("[INFO] A última célula de tropas continua em água profunda conforme a missão.")
    print("[INFO] Supply, combate e posicionamento fora das áreas aquáticas não foram alterados.")
    print(f"[INFO] Backup: {backup_root}")

    if args.validate:
        npx = "npx.cmd" if sys.platform.startswith("win") else "npx"
        run([npx, "vite", "build"], repo_root)
        print("[SUCESSO] Vite build concluído.")


if __name__ == "__main__":
    main()
