#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import json
import shutil
import subprocess
import sys
from pathlib import Path

PACKAGE_VERSION = "2.0.1"
LAST_GOOD_COMMIT = "d2daee81b829c8bba0c50b7c3e4b8332f61f374a"

REQUIRED_PATHS = (
    "package.json",
    "src/game/battleModel.js",
    "src/game/tideCycle.js",
    "src/game/GameCanvas.jsx",
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

CORRECT_IMPORT_HEADER = f'''import {{ DEFAULT_MAX_DEPLOYED_PER_TROOP, ENEMIES, TROOPS }} from "./content.js";
import {{ buildSpawnQueue, calculateStars, createRng, getDecisionOptions, getDecisionStage, isGroundTrapEligible }} from "./domain.js";
import {{
  adaptiveAidBlocksIntermission,
  adaptiveAidCinematicFactor,
  adaptiveAidPausesSimulation,
  calculateHardshipScore,
  capsuleReservesCell,
  clearExpiredTroopLosses,
  createAdaptiveAidState,
  evaluateAdaptiveAid,
  getEligibleAdaptiveAidOptions,
  isCapsuleClickable,
  openAdaptiveAidCapsule as openAdaptiveAidCapsuleDomain,
  pointHitsCapsule,
  recordTroopLoss,
  selectAdaptiveAidOption as selectAdaptiveAidOptionDomain,
  simulateAdaptiveAid as simulateAdaptiveAidDomain,
  updateAdaptiveAid,
  updateAdaptiveAidLifecycle,
}} from "./adaptiveAid.js";
import {{
  CELL, FIELD, VIEWPORT, getEnemyHitPoint, getEnemyMuzzleWorldPosition,
  getMuzzleWorldPosition, getRepulsorKnockbackOffset, getTroopAnimation,
}} from "./visualGeometry.js";
import {{
  forceExecutorComboStep, isExecutorArco, updateExecutorArco,
}} from "./executorArco.js";
import {{
  isIcaroAirTarget,
  selectIcaroBurstRetarget,
  updateInterceptadorIcaro,
}} from "./interceptadorIcaro.js";
import {{
  createWindCurrentState,
  endWindCurrent,
  resetWindCurrentForWave,
  updateWindCurrent,
}} from "./windCurrent.js";
{TIDE_IMPORT}
'''

SUPPLY_BLOCK = '''    session.supplyAccumulator += dt;
    while (session.supplyAccumulator >= 1000) {
      session.supplyAccumulator -= 1000;
      session.supply = Math.min(session.supplyMax, session.supply + 1);
    }'''


def fail(message: str) -> None:
    print(f"[ERRO] {message}", file=sys.stderr)
    raise SystemExit(1)


def run(command: list[str], cwd: Path, *, capture: bool = False) -> subprocess.CompletedProcess:
    print(f"[EXEC] {' '.join(command)}")
    completed = subprocess.run(
        command,
        cwd=cwd,
        check=False,
        stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.PIPE if capture else None,
    )
    if completed.returncode != 0:
        detail = ""
        if capture:
            detail = (completed.stderr or completed.stdout or b"").decode("utf-8", errors="replace").strip()
        fail(
            f"Comando falhou com código {completed.returncode}: {' '.join(command)}"
            + (f"\n{detail}" if detail else "")
        )
    return completed


def is_repo(path: Path) -> bool:
    return path.is_dir() and all((path / relative).exists() for relative in REQUIRED_PATHS)


def resolve_repo_root(package_root: Path, provided: str | None) -> Path:
    if provided:
        resolved = Path(provided).expanduser().resolve()
        if not is_repo(resolved):
            fail(f"O caminho não parece ser a raiz do Genesis: {resolved}")
        return resolved
    candidates = [package_root.parent, package_root.parent / "genesis", Path.cwd()]
    seen: set[Path] = set()
    for candidate in candidates:
        resolved = candidate.resolve()
        if resolved in seen:
            continue
        seen.add(resolved)
        if is_repo(resolved):
            print(f"[INFO] Projeto detectado: {resolved}")
            return resolved
    fail('Não encontrei a raiz do Genesis. Informe --repo-root "C:\\Projetos\\Genesis".')


def backup_file(repo_root: Path, backup_root: Path, relative: str) -> bool:
    source = repo_root / relative
    if not source.exists():
        return False
    destination = backup_root / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)
    return True


def patch_battle_model(source: str) -> str:
    source = source.lstrip("\ufeff")
    if SUPPLY_BLOCK not in source:
        fail("Não encontrei o bloco original de regeneração de Supply.")
    supply_before = SUPPLY_BLOCK

    marker = 'import { chapterFourAlphaMultipliers } from "./chapterFourEnemies.js";'
    marker_index = source.find(marker)
    if marker_index < 0:
        fail("Não encontrei o import de chapterFourEnemies.js em battleModel.js.")

    repaired = CORRECT_IMPORT_HEADER + source[marker_index:]

    required_bindings = (
        'from "./adaptiveAid.js";',
        'from "./visualGeometry.js";',
        'from "./executorArco.js";',
        'from "./interceptadorIcaro.js";',
        'from "./windCurrent.js";',
        'from "./tideCycle.js";',
    )
    missing = [binding for binding in required_bindings if binding not in repaired[:marker_index + len(CORRECT_IMPORT_HEADER) + 200]]
    if missing:
        fail("A reconstrução dos imports ficou incompleta: " + ", ".join(missing))
    if repaired.count('from "./tideCycle.js";') != 1:
        fail("battleModel.js ficou com importação duplicada de tideCycle.js.")
    if SUPPLY_BLOCK not in repaired or supply_before != SUPPLY_BLOCK:
        fail("A correção tentou alterar a mecânica de Supply; operação cancelada.")
    return repaired


def patch_gitignore(source: str) -> str:
    line = ".genesis-backups/"
    existing = {entry.strip() for entry in source.splitlines()}
    if line in existing:
        return source
    suffix = "" if source.endswith("\n") else "\n"
    return source + suffix + "\n# Backups locais dos instaladores Genesis\n.genesis-backups/\n"


def restore_deleted_tests(repo_root: Path, backup_root: Path) -> list[str]:
    git = shutil.which("git")
    if not git or not (repo_root / ".git").exists():
        print("[AVISO] Git ou histórico local indisponível; testes removidos não foram restaurados.")
        return []

    check = subprocess.run(
        [git, "cat-file", "-e", f"{LAST_GOOD_COMMIT}^{{commit}}"],
        cwd=repo_root,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if check.returncode != 0:
        print(f"[AVISO] Commit-base {LAST_GOOD_COMMIT[:8]} não está no histórico local; restauração dos testes ignorada.")
        return []

    diff = run([git, "diff", "--name-status", f"{LAST_GOOD_COMMIT}..HEAD", "--", "src"], repo_root, capture=True)
    restored: list[str] = []
    for raw_line in diff.stdout.decode("utf-8", errors="replace").splitlines():
        parts = raw_line.split("\t")
        if len(parts) < 2 or parts[0] != "D":
            continue
        relative = parts[-1].replace("\\", "/")
        if not relative.endswith((".test.js", ".test.jsx", ".test.mjs", ".test.ts", ".test.tsx")):
            continue
        destination = repo_root / relative
        if destination.exists():
            continue
        content = subprocess.run(
            [git, "show", f"{LAST_GOOD_COMMIT}:{relative}"],
            cwd=repo_root,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )
        if content.returncode != 0:
            print(f"[AVISO] Não foi possível restaurar {relative}.")
            continue
        backup_marker = backup_root / "restored-tests" / (relative.replace("/", "__") + ".marker")
        backup_marker.parent.mkdir(parents=True, exist_ok=True)
        backup_marker.write_text(f"Restaurado de {LAST_GOOD_COMMIT}\n", encoding="utf-8")
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(content.stdout)
        restored.append(relative)
        print(f"[OK] {relative} [restaurado]")
    return restored


def main() -> None:
    parser = argparse.ArgumentParser(description="Corrige a falha de entrada no Genesis após a instalação da maré territorial.")
    parser.add_argument("--repo-root", required=False)
    parser.add_argument("--validate", action="store_true")
    parser.add_argument("--skip-test-restore", action="store_true")
    args = parser.parse_args()

    package_root = Path(__file__).resolve().parent
    payload_root = package_root / "payload"
    repo_root = resolve_repo_root(package_root, args.repo_root)

    timestamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_root = repo_root / ".genesis-backups" / f"chapter-05-entry-hotfix-{timestamp}"
    backup_root.mkdir(parents=True, exist_ok=True)

    target_files = ["src/game/battleModel.js", ".gitignore", "src/game/battleModelImport.test.js"]
    previous_installer = "genesis_capitulo_05_mare_territorial_progressiva/apply_changes.py"
    if (repo_root / previous_installer).exists():
        target_files.append(previous_installer)

    backed_up = [relative for relative in target_files if backup_file(repo_root, backup_root, relative)]
    changed: list[str] = []

    battle_path = repo_root / "src/game/battleModel.js"
    original = battle_path.read_text(encoding="utf-8")
    repaired = patch_battle_model(original)
    battle_path.write_text(repaired, encoding="utf-8", newline="\n")
    changed.append("src/game/battleModel.js")
    print("[OK] src/game/battleModel.js [imports restaurados]")

    gitignore_path = repo_root / ".gitignore"
    gitignore_source = gitignore_path.read_text(encoding="utf-8") if gitignore_path.exists() else ""
    patched_gitignore = patch_gitignore(gitignore_source)
    gitignore_path.write_text(patched_gitignore, encoding="utf-8", newline="\n")
    changed.append(".gitignore")
    print("[OK] .gitignore [.genesis-backups ignorado]")

    smoke_source = payload_root / "src/game/battleModelImport.test.js"
    smoke_destination = repo_root / "src/game/battleModelImport.test.js"
    smoke_destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(smoke_source, smoke_destination)
    changed.append("src/game/battleModelImport.test.js")
    print("[OK] src/game/battleModelImport.test.js")

    fixed_installer_source = payload_root / "genesis_capitulo_05_mare_territorial_progressiva/apply_changes.py"
    fixed_installer_destination = repo_root / previous_installer
    if fixed_installer_destination.exists():
        shutil.copy2(fixed_installer_source, fixed_installer_destination)
        changed.append(previous_installer)
        print(f"[OK] {previous_installer} [regex corrigida]")

    restored_tests = [] if args.skip_test_restore else restore_deleted_tests(repo_root, backup_root)

    node = shutil.which("node")
    if node:
        run([node, "--check", "src/game/battleModel.js"], repo_root)
        run([
            node,
            "--input-type=module",
            "--eval",
            "await import('./src/game/battleModel.js'); console.log('[OK] battleModel importado com sucesso');",
        ], repo_root)
    else:
        print("[AVISO] Node.js não encontrado; validação de importação não executada.")

    manifest = {
        "packageVersion": PACKAGE_VERSION,
        "installedAt": dt.datetime.now().isoformat(),
        "repoRoot": str(repo_root),
        "backupRoot": str(backup_root),
        "rootCause": "replace_tide_import consumia todos os imports entre o primeiro import com chaves e tideCycle.js",
        "changed": changed,
        "backedUp": backed_up,
        "restoredTests": restored_tests,
        "supplyMechanicsChanged": False,
    }
    (backup_root / "hotfix-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    if args.validate:
        npx = "npx.cmd" if sys.platform.startswith("win") else "npx"
        run([
            npx, "vitest", "run",
            "src/game/battleModelImport.test.js",
            "src/game/tideCycle.test.js",
            "src/game/chapterFiveContent.test.js",
            "src/game/tideBattleIntegration.test.js",
        ], repo_root)
        run([npx, "vite", "build"], repo_root)

    print()
    print("[SUCESSO] Falha de entrada corrigida.")
    print("[INFO] Imports locais de battleModel.js restaurados.")
    print("[INFO] Instalador da maré atualizado para não apagar imports novamente.")
    print(f"[INFO] Testes restaurados do commit-base: {len(restored_tests)}")
    print("[INFO] Supply preservado sem alterações.")
    print(f"[INFO] Backup: {backup_root}")


if __name__ == "__main__":
    main()
