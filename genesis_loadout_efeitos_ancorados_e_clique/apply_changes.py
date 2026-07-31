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
    "src/loadout/LoadoutPage.jsx",
    "src/loadout/TroopStage.jsx",
    "src/loadout/TroopStageScene.js",
    "src/loadout/AnimatedTroopPreview.jsx",
)

PAYLOAD_FILES = (
    "src/loadout/loadoutVisualCatalog.js",
    "src/loadout/troopPreviewFit.js",
    "src/loadout/useTroopPreviewFrames.js",
    "src/loadout/troopStageEffects.js",
    "src/loadout/AnimatedTroopPreview.jsx",
    "src/loadout/TroopStage.jsx",
    "src/loadout/TroopStageScene.js",
    "src/loadout/loadout-full-body-preview.css",
    "src/loadout/loadout-stage-interactions.css",
    "src/loadout/troopStageEffects.test.js",
    "src/loadout/troopStageInteraction.test.js",
)


def fail(message: str) -> None:
    print(f"[ERRO] {message}", file=sys.stderr)
    raise SystemExit(1)


def run(command: list[str], cwd: Path) -> None:
    print(f"[EXEC] {' '.join(command)}")
    completed = subprocess.run(
        command,
        cwd=cwd,
        check=False,
    )
    if completed.returncode != 0:
        fail(
            f"Comando terminou com código "
            f"{completed.returncode}: "
            f"{' '.join(command)}"
        )


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Ancora a luz e o piso nos pés do personagem "
            "e adiciona interação ao clique."
        ),
    )
    parser.add_argument(
        "--repo-root",
        required=True,
        help="Pasta raiz do repositório Genesis.",
    )
    parser.add_argument(
        "--validate",
        action="store_true",
        help=(
            "Executa somente os testes do loadout "
            "e o Vite build."
        ),
    )
    args = parser.parse_args()

    package_root = Path(__file__).resolve().parent
    payload_root = package_root / "payload"
    repo_root = Path(
        args.repo_root,
    ).expanduser().resolve()

    if not repo_root.is_dir():
        fail(
            f"Repositório não encontrado: "
            f"{repo_root}"
        )

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

    timestamp = dt.datetime.now().strftime(
        "%Y%m%d-%H%M%S",
    )
    backup_root = (
        repo_root
        / ".genesis-backups"
        / f"loadout-anchored-effects-{timestamp}"
    )

    copied = []
    backed_up = []

    print(f"[INFO] Repositório: {repo_root}")
    print(f"[INFO] Backup: {backup_root}")

    for relative in PAYLOAD_FILES:
        source = payload_root / relative
        destination = repo_root / relative

        if not source.exists():
            fail(
                f"Arquivo ausente no pacote: "
                f"{source}"
            )

        if destination.exists():
            backup = backup_root / relative
            backup.parent.mkdir(
                parents=True,
                exist_ok=True,
            )
            shutil.copy2(destination, backup)
            backed_up.append(relative)

        destination.parent.mkdir(
            parents=True,
            exist_ok=True,
        )
        shutil.copy2(source, destination)
        copied.append(relative)
        print(f"[OK] {relative}")

    backup_root.mkdir(
        parents=True,
        exist_ok=True,
    )
    (backup_root / "install-manifest.json").write_text(
        json.dumps(
            {
                "installedAt": (
                    dt.datetime.now().isoformat()
                ),
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
    print("[SUCESSO] Efeitos ancorados instalados.")
    print(
        "[INFO] A plataforma e a luz agora "
        "acompanham cabeça, largura e pés do sprite."
    )
    print(
        "[INFO] Clique no personagem para ativar "
        "pulso holográfico e onda de energia."
    )
    print(
        f"[INFO] Backup disponível em: "
        f"{backup_root}"
    )

    if args.validate:
        npx = (
            "npx.cmd"
            if sys.platform.startswith("win")
            else "npx"
        )

        run(
            [
                npx,
                "vitest",
                "run",
                "src/loadout/troopPreviewFit.test.js",
                "src/loadout/troopStageEffects.test.js",
                "src/loadout/troopStageInteraction.test.js",
                "src/loadout/previewFrames.test.js",
                "src/loadout/LoadoutPage.test.jsx",
            ],
            repo_root,
        )
        run(
            [npx, "vite", "build"],
            repo_root,
        )
        print(
            "[SUCESSO] Testes específicos "
            "e Vite build concluídos."
        )


if __name__ == "__main__":
    main()
