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
    "src/campaign/campaignBiomes.js",
    "src/campaign/CampaignPage.jsx",
    "src/campaign/CampaignPlanet.jsx",
    "src/home/CommandPage.jsx",
    "src/home/CommandGlobeScene.js",
    "src/visual/createGenesisPlanetLights.js",
)

PAYLOAD_FILES = (
    "src/campaign/campaignBiomes.js",
    "src/campaign/CampaignPage.jsx",
    "src/campaign/CampaignPlanet.jsx",
    "src/campaign/campaignBiomes.test.js",
    "src/home/CommandPage.jsx",
    "src/home/CommandGlobeScene.js",
    "src/visual/createGenesisPlanetLights.js",
    "src/visual/createGenesisChapterEffects.js",
    "src/visual/applyGenesisWorldTheme.js",
    "src/visual/genesis-world-themes.css",
    "src/visual/createGenesisPlanetLights.test.js",
    "src/visual/createGenesisChapterEffects.test.js",
    "src/visual/effects/genesisEffectUtils.js",
    "src/visual/effects/createHivePlanetEffects.js",
    "src/visual/effects/createGlassPlanetEffects.js",
    "src/visual/effects/createChitinPlanetEffects.js",
    "src/visual/effects/createStormPlanetEffects.js",
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
            "Instala identidades visuais, iluminação "
            "e kits 3D temáticos dos capítulos Genesis."
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
            "Executa somente testes relacionados ao planeta "
            "e o build direto do Vite."
        ),
    )
    args = parser.parse_args()

    package_root = Path(__file__).resolve().parent
    payload_root = package_root / "payload"
    repo_root = Path(
        args.repo_root,
    ).expanduser().resolve()

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

    timestamp = dt.datetime.now().strftime(
        "%Y%m%d-%H%M%S",
    )
    backup_root = (
        repo_root
        / ".genesis-backups"
        / f"world-themes-{timestamp}"
    )

    copied = []
    backed_up = []

    print(f"[INFO] Repositório: {repo_root}")
    print(f"[INFO] Backup: {backup_root}")

    for relative in PAYLOAD_FILES:
        source = payload_root / relative
        destination = repo_root / relative

        if not source.exists():
            fail(f"Arquivo ausente no pacote: {source}")

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
    print("[SUCESSO] Identidade visual dos capítulos instalada.")
    print(
        "[INFO] Capítulo 3 usa luz neutra com "
        "contorno âmbar e preenchimento azulado."
    )
    print(
        "[INFO] Os quatro kits 3D são criados uma vez "
        "e alternados por crossfade."
    )
    print(f"[INFO] Backup disponível em: {backup_root}")

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
                "src/campaign/campaignBiomes.test.js",
                "src/visual/createGenesisPlanetLights.test.js",
                "src/visual/createGenesisChapterEffects.test.js",
                "src/home/CommandPage.test.jsx",
            ],
            repo_root,
        )
        run([npx, "vite", "build"], repo_root)
        print(
            "[SUCESSO] Testes específicos "
            "e Vite build concluídos."
        )


if __name__ == "__main__":
    main()
