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
    "src/campaign/campaignSceneData.js",
    "src/campaign/campaignBiomes.js",
    "src/campaign/storage.js",
    "src/visual/createGenesisChapterEffects.js",
    "src/visual/genesisPlanetMaterials.js",
)

PAYLOAD_FILES = (
    "src/game/chapterFivePhases.js",
    "src/game/chapterFiveContent.test.js",
    "src/campaign/campaignSceneData.js",
    "src/campaign/campaignSceneData.test.js",
    "src/campaign/campaignBiomes.js",
    "src/campaign/campaignBiomes.test.js",
    "src/campaign/storage.js",
    "src/campaign/storage.test.js",
    "src/visual/createGenesisChapterEffects.js",
    "src/visual/createGenesisChapterEffects.test.js",
    "src/visual/createRocketOrbit.js",
    "src/visual/createRocketOrbit.test.js",
    "src/visual/effects/genesisRouteEffectUtils.js",
    "src/visual/effects/genesisRouteEffectUtils.test.js",
    "src/visual/effects/createOceanPlanetEffects.js",
    "src/visual/genesis-world-themes.css",
    "src/visual/effects/genesisEffectUtils.js",
    "src/visual/effects/createHivePlanetEffects.js",
    "src/visual/effects/createGlassPlanetEffects.js",
    "src/visual/effects/createChitinPlanetEffects.js",
    "src/visual/effects/createStormPlanetEffects.js",
)

PATCHED_FILES = (
    "src/game/content.js",
    "src/visual/genesisPlanetMaterials.js",
)

CHAPTER_FIVE_IMPORT = (
    'import { CHAPTER_FIVE_PHASES } '
    'from "./chapterFivePhases.js";'
)

CHAPTER_FIVE_BLOCK = '''  {
    id: "chapter_05",
    number: 5,
    name: "Núcleo do Eclipse",
    subtitle: "Os quatro biomas convergem sobre a fenda final",
    phaseIds: PHASES.slice(32, 40).map((entry) => entry.id),
    /*
     * Reutiliza arte existente para não aumentar o orçamento de assets.
     * O planeta, o layout e o campo procedural possuem identidade própria.
     */
    coverArenaId: "fase_32",
    palette: {
      primary: "#d946ef",
      accent: "#22d3ee",
      shadow: "#05030a",
    },
    mechanic: {
      id: "eclipse_convergence",
      label: "Convergência Hostil",
      description:
        "Cada onda combina famílias dos quatro teatros anteriores, exigindo formações versáteis.",
    },
  },'''


def fail(message: str) -> None:
    print(f"[ERRO] {message}", file=sys.stderr)
    raise SystemExit(1)


def run(command: list[str], cwd: Path) -> None:
    print(f"[EXEC] {' '.join(command)}")
    completed = subprocess.run(command, cwd=cwd, check=False)
    if completed.returncode != 0:
        fail(
            f"Comando terminou com código {completed.returncode}: "
            f"{' '.join(command)}"
        )


def insert_after_import(source: str) -> str:
    if CHAPTER_FIVE_IMPORT in source:
        return source

    marker = (
        'import { createChapterFourWaves } '
        'from "./chapterFourWaves.js";'
    )
    if marker not in source:
        fail(
            "Não encontrei o import de chapterFourWaves "
            "em src/game/content.js."
        )

    return source.replace(
        marker,
        marker + "\n" + CHAPTER_FIVE_IMPORT,
        1,
    )


def add_loadout_limit(source: str) -> str:
    pattern = re.compile(
        r"export const CHAPTER_LOADOUT_LIMITS\s*=\s*"
        r"Object\.freeze\(\{(?P<body>[^}]*)\}\);"
    )
    match = pattern.search(source)
    if not match:
        fail(
            "Não encontrei CHAPTER_LOADOUT_LIMITS "
            "em src/game/content.js."
        )

    body = match.group("body")
    if re.search(r"(?:^|,)\s*5\s*:", body):
        return source

    updated_body = body.rstrip()
    if updated_body and not updated_body.rstrip().endswith(","):
        updated_body += ","
    updated_body += " 5: 8"

    replacement = (
        "export const CHAPTER_LOADOUT_LIMITS = "
        f"Object.freeze({{{updated_body}}});"
    )

    return source[:match.start()] + replacement + source[match.end():]


def find_array_close_before(source: str, marker: str) -> int:
    marker_index = source.find(marker)
    if marker_index < 0:
        fail(f"Não encontrei o marcador: {marker.strip()}")

    close_index = source.rfind("\n];", 0, marker_index)
    if close_index < 0:
        fail(
            "Não encontrei o fechamento do array antes de "
            f"{marker.strip()}."
        )
    return close_index


def add_chapter_five_phases(source: str) -> str:
    if "...CHAPTER_FIVE_PHASES" in source:
        return source

    close_index = find_array_close_before(
        source,
        "\nexport const CHAPTERS = [",
    )

    return (
        source[:close_index]
        + "\n  ...CHAPTER_FIVE_PHASES,"
        + source[close_index:]
    )


def add_chapter_five_definition(source: str) -> str:
    if 'id: "chapter_05"' in source:
        return source

    chapters_start = source.find("\nexport const CHAPTERS = [")
    get_phase_start = source.find("\nexport const getPhase", chapters_start)
    if chapters_start < 0 or get_phase_start < 0:
        fail(
            "Não encontrei a declaração completa de CHAPTERS "
            "em src/game/content.js."
        )

    close_index = source.rfind(
        "\n];",
        chapters_start,
        get_phase_start,
    )
    if close_index < 0:
        fail(
            "Não encontrei o fechamento de CHAPTERS "
            "em src/game/content.js."
        )

    return (
        source[:close_index]
        + "\n"
        + CHAPTER_FIVE_BLOCK
        + source[close_index:]
    )


def patch_content(source: str) -> str:
    text = insert_after_import(source)
    text = add_loadout_limit(text)
    text = add_chapter_five_phases(text)
    text = add_chapter_five_definition(text)

    required_tokens = (
        CHAPTER_FIVE_IMPORT,
        "...CHAPTER_FIVE_PHASES",
        'id: "chapter_05"',
        "PHASES.slice(32, 40)",
        "5: 8",
    )
    missing = [token for token in required_tokens if token not in text]
    if missing:
        fail(
            "A atualização de content.js ficou incompleta: "
            + ", ".join(missing)
        )

    if text.count('id: "chapter_05"') != 1:
        fail("content.js ficou com chapter_05 duplicado.")

    return text


def patch_beacon_contract(source: str) -> str:
    if 'chapter_05: "Beacon_Eclipse"' in source:
        return source

    marker = '  chapter_04: "Beacon_Storm",'
    if marker not in source:
        fail(
            "Não encontrei CHAPTER_BEACON_NAMES "
            "em genesisPlanetMaterials.js."
        )

    return source.replace(
        marker,
        marker + '\n  chapter_05: "Beacon_Eclipse",',
        1,
    )


def backup_file(source: Path, destination: Path) -> bool:
    if not source.exists():
        return False
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)
    return True


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Instala o Capítulo 5, efeitos próximos às trilhas "
            "e a correção de orientação do foguete."
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
            "Executa testes específicos e o build direto "
            "do Vite após a instalação."
        ),
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

    missing_payload = [
        relative
        for relative in PAYLOAD_FILES
        if not (payload_root / relative).exists()
    ]
    if missing_payload:
        fail(
            "Arquivos ausentes no pacote: "
            + ", ".join(missing_payload)
        )

    patched_content = patch_content(
        (repo_root / "src/game/content.js").read_text(
            encoding="utf-8"
        )
    )
    patched_materials = patch_beacon_contract(
        (
            repo_root
            / "src/visual/genesisPlanetMaterials.js"
        ).read_text(encoding="utf-8")
    )

    timestamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_root = (
        repo_root
        / ".genesis-backups"
        / f"route-effects-ocean-{timestamp}"
    )

    copied: list[str] = []
    backed_up: list[str] = []

    print(f"[INFO] Repositório: {repo_root}")
    print(f"[INFO] Backup: {backup_root}")

    for relative in (*PATCHED_FILES, *PAYLOAD_FILES):
        destination = repo_root / relative
        backup = backup_root / relative
        if backup_file(destination, backup):
            backed_up.append(relative)

    for relative in PAYLOAD_FILES:
        source = payload_root / relative
        destination = repo_root / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
        copied.append(relative)
        print(f"[OK] {relative}")

    content_path = repo_root / "src/game/content.js"
    content_path.write_text(
        patched_content,
        encoding="utf-8",
        newline="\n",
    )
    copied.append("src/game/content.js")
    print("[OK] src/game/content.js [patch]")

    materials_path = (
        repo_root
        / "src/visual/genesisPlanetMaterials.js"
    )
    materials_path.write_text(
        patched_materials,
        encoding="utf-8",
        newline="\n",
    )
    copied.append("src/visual/genesisPlanetMaterials.js")
    print(
        "[OK] src/visual/genesisPlanetMaterials.js [patch]"
    )

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
    print("[SUCESSO] Capítulo 5 instalado.")
    print("[INFO] Campanha expandida para 40 fases e 5 capítulos.")
    print(
        "[INFO] Saves com vitória na fase 32 liberam "
        "automaticamente a fase 33."
    )
    print(
        "[INFO] Tema oceânico e efeitos próximos às trilhas "
        "disponíveis no Comando, Campanha e planeta 3D."
    )
    print(f"[INFO] Backup disponível em: {backup_root}")

    if args.validate:
        npx = "npx.cmd" if sys.platform.startswith("win") else "npx"

        run(
            [
                npx,
                "vitest",
                "run",
                "src/game/chapterFiveContent.test.js",
                "src/campaign/storage.test.js",
                "src/campaign/campaignBiomes.test.js",
                "src/campaign/campaignSceneData.test.js",
                "src/visual/createGenesisChapterEffects.test.js",
                "src/visual/effects/genesisRouteEffectUtils.test.js",
                "src/visual/createRocketOrbit.test.js",
                "src/visual/createGenesisPlanetLights.test.js",
                "src/home/CommandPage.test.jsx",
            ],
            repo_root,
        )
        run([npx, "vite", "build"], repo_root)

        print(
            "[SUCESSO] Testes específicos e Vite build concluídos."
        )


if __name__ == "__main__":
    main()
