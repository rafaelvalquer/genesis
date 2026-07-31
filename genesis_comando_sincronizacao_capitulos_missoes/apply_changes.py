#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import json
import shutil
import subprocess
import sys
from pathlib import Path


REQUIRED_PROJECT_PATHS = (
    "package.json",
    "src/home/CommandPage.jsx",
    "src/home/CurrentOperation.jsx",
    "src/home/ChapterProgress.jsx",
    "src/home/ChapterProgressItem.jsx",
)

PAYLOAD_FILES = (
    "src/home/CommandPage.jsx",
    "src/home/CurrentOperation.jsx",
    "src/home/ChapterProgress.jsx",
    "src/home/ChapterProgressItem.jsx",
    "src/home/command-selection-enhancements.css",
    "src/home/CommandPage.test.jsx",
)


def fail(message: str) -> None:
    print(f"[ERRO] {message}", file=sys.stderr)
    raise SystemExit(1)


def run(command: list[str], cwd: Path) -> None:
    print(f"[EXEC] {' '.join(command)}")
    completed = subprocess.run(command, cwd=cwd, check=False)
    if completed.returncode != 0:
        fail(f"Comando terminou com código {completed.returncode}: {' '.join(command)}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Instala a sincronização de capítulos, planeta, missões e card lateral da tela Comando.",
    )
    parser.add_argument(
        "--repo-root",
        required=True,
        help="Pasta raiz do repositório Genesis.",
    )
    parser.add_argument(
        "--validate",
        action="store_true",
        help="Executa npm run test:unit e npm run build após copiar os arquivos.",
    )
    args = parser.parse_args()

    package_root = Path(__file__).resolve().parent
    payload_root = package_root / "payload"
    repo_root = Path(args.repo_root).expanduser().resolve()

    if not repo_root.is_dir():
        fail(f"Repositório não encontrado: {repo_root}")

    missing = [
        relative
        for relative in REQUIRED_PROJECT_PATHS
        if not (repo_root / relative).exists()
    ]
    if missing:
        fail(
            "RepoRoot não parece ser a raiz do Genesis. "
            f"Arquivos ausentes: {', '.join(missing)}"
        )

    timestamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_root = (
        repo_root
        / ".genesis-backups"
        / f"command-sync-{timestamp}"
    )

    print(f"[INFO] Repositório: {repo_root}")
    print(f"[INFO] Backup: {backup_root}")

    copied = []
    backed_up = []

    for relative in PAYLOAD_FILES:
        source = payload_root / relative
        destination = repo_root / relative

        if not source.exists():
            fail(f"Arquivo ausente no pacote: {source}")

        if destination.exists():
            backup = backup_root / relative
            backup.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(destination, backup)
            backed_up.append(relative)

        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
        copied.append(relative)
        print(f"[OK] {relative}")

    manifest = {
        "installedAt": dt.datetime.now().isoformat(),
        "repoRoot": str(repo_root),
        "backupRoot": str(backup_root),
        "copied": copied,
        "backedUp": backed_up,
    }
    backup_root.mkdir(parents=True, exist_ok=True)
    (backup_root / "install-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print()
    print("[SUCESSO] Atualização instalada.")
    print("[INFO] O planeta, as luzes, os marcadores e o card lateral agora usam a mesma seleção.")
    print(f"[INFO] Para rollback, restaure os arquivos de: {backup_root}")

    if args.validate:
        npm = "npm.cmd" if sys.platform.startswith("win") else "npm"
        run([npm, "run", "test:unit"], repo_root)
        run([npm, "run", "build"], repo_root)
        print("[SUCESSO] Testes e build concluídos.")


if __name__ == "__main__":
    main()
