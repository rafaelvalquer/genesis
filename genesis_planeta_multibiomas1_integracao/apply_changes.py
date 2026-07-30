#!/usr/bin/env python3
from __future__ import annotations

import argparse
from datetime import datetime
from pathlib import Path
import shutil
import sys


PACKAGE_ROOT = Path(__file__).resolve().parent
PAYLOAD_ROOT = PACKAGE_ROOT / "payload"


def require_repo_root(path: Path) -> Path:
    path = path.resolve()
    required = [
        path / "package.json",
        path / "src",
        path / "public",
    ]
    missing = [str(item) for item in required if not item.exists()]
    if missing:
        raise RuntimeError(
            "O caminho informado não parece ser a raiz do projeto Genesis.\n"
            + "Itens ausentes:\n- "
            + "\n- ".join(missing)
        )
    return path


def replace_once(content: str, old: str, new: str, label: str) -> tuple[str, bool]:
    if new in content:
        return content, False
    if old not in content:
        raise RuntimeError(
            f"Não foi possível aplicar a alteração '{label}'. "
            "O arquivo do repositório está diferente da versão analisada."
        )
    return content.replace(old, new, 1), True


def prepare_materials_patch(content: str) -> tuple[str, bool]:
    changed = False

    old_helpers = '''function preserveTextureSlots(source, target) {
  TEXTURE_KEYS.forEach((key) => {
    if (source?.[key]?.isTexture) target[key] = source[key];
  });
}
'''

    new_helpers = '''function preserveTextureSlots(source, target) {
  TEXTURE_KEYS.forEach((key) => {
    if (source?.[key]?.isTexture) target[key] = source[key];
  });
}

function hasAuthoredPbrMaterial(material) {
  if (!material) return false;
  return Boolean(
    material.map
    || material.normalMap
    || material.roughnessMap
    || material.metalnessMap
    || material.emissiveMap
    || material.aoMap
  );
}

function prepareAuthoredMaterial(THREE, object, material) {
  const name = object.name || "";
  const vertexColors = Boolean(object.geometry.getAttribute("color"));

  material.vertexColors = vertexColors;
  material.flatShading = false;
  material.dithering = true;
  material.toneMapped = true;

  if (name.includes("Clouds")) {
    material.transparent = true;
    material.depthWrite = false;
    material.depthTest = true;
    material.side = THREE.DoubleSide;
    material.userData.genesisAuthoredClouds = true;
  }

  if (name.includes("MainPlanet")) {
    material.userData.genesisAuthoredPlanet = true;
  }

  material.userData.genesisBaseOpacity = Number.isFinite(material.opacity)
    ? material.opacity
    : 1;
  material.needsUpdate = true;

  return material;
}
'''

    content, did_change = replace_once(
        content,
        old_helpers,
        new_helpers,
        "adicionar suporte a materiais PBR autorais",
    )
    changed |= did_change

    old_function = '''function materialForPart(THREE, object) {
  const name = object.name || "";
  const original = Array.isArray(object.material) ? object.material[0] : object.material;
  const vertexColors = Boolean(object.geometry.getAttribute("color"));
  let material;
  if (name.includes("MainPlanet")) {
    material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: .82,
      metalness: .02,
      emissive: 0x000000,
      emissiveIntensity: 0,
      flatShading: false,
      dithering: true,
    });
  } else if (name.includes("Atmosphere")) {
    material = new THREE.MeshBasicMaterial({
      color: 0xffffff, vertexColors, transparent: true, opacity: .12,
      side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
    });
  } else if (name.includes("Clouds")) {
    material = new THREE.MeshBasicMaterial({
      color: 0xffffff, vertexColors, transparent: true, opacity: .25, depthWrite: false,
    });
  } else {
    const properties = name.includes("IceSpikes")
      ? { roughness: .65, metalness: .04 }
      : name.includes("CrystalSpires")
        ? { roughness: .34, metalness: .14 }
        : name.includes("SwampPods")
          ? { roughness: .88, metalness: 0 }
          : { roughness: .72, metalness: .04 };
    material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors,
      ...properties,
      emissive: 0x000000,
      emissiveIntensity: 0,
      flatShading: false,
    });
  }
  preserveTextureSlots(original, material);
  original?.dispose();
  material.userData.genesisBaseOpacity = material.opacity;
  return material;
}
'''

    new_function = '''function materialForPart(THREE, object) {
  const name = object.name || "";
  const original = Array.isArray(object.material) ? object.material[0] : object.material;
  const vertexColors = Boolean(object.geometry.getAttribute("color"));

  if (
    hasAuthoredPbrMaterial(original)
    && (
      name.includes("MainPlanet")
      || name.includes("Clouds")
      || name.includes("Atmosphere")
    )
  ) {
    return prepareAuthoredMaterial(THREE, object, original);
  }

  let material;
  if (name.includes("MainPlanet")) {
    material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors,
      roughness: .82,
      metalness: .02,
      emissive: 0x000000,
      emissiveIntensity: 0,
      flatShading: false,
      dithering: true,
    });
  } else if (name.includes("Atmosphere")) {
    material = new THREE.MeshBasicMaterial({
      color: 0xffffff, vertexColors, transparent: true, opacity: .12,
      side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
    });
  } else if (name.includes("Clouds")) {
    material = new THREE.MeshBasicMaterial({
      color: 0xffffff, vertexColors, transparent: true, opacity: .25,
      depthWrite: false, side: THREE.DoubleSide,
    });
  } else {
    const properties = name.includes("IceSpikes")
      ? { roughness: .65, metalness: .04 }
      : name.includes("CrystalSpires")
        ? { roughness: .34, metalness: .14 }
        : name.includes("SwampPods")
          ? { roughness: .88, metalness: 0 }
          : { roughness: .72, metalness: .04 };
    material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors,
      ...properties,
      emissive: 0x000000,
      emissiveIntensity: 0,
      flatShading: false,
    });
  }

  preserveTextureSlots(original, material);
  original?.dispose();
  material.userData.genesisBaseOpacity = material.opacity;
  return material;
}
'''

    content, did_change = replace_once(
        content,
        old_function,
        new_function,
        "preservar os materiais e texturas PBR do novo planeta",
    )
    changed |= did_change

    old_cloud_quality = '''  if (parts.clouds) {
    parts.clouds.visible = presentation.cloudsOpacity > 0;
    parts.clouds.material.userData.genesisBaseOpacity = presentation.cloudsOpacity;
  }
'''

    new_cloud_quality = '''  if (parts.clouds) {
    const authoredClouds = Boolean(parts.clouds.material.userData.genesisAuthoredClouds);
    const cloudsOpacity = authoredClouds
      ? Math.min(1, presentation.cloudsOpacity * 2.8)
      : presentation.cloudsOpacity;

    parts.clouds.visible = cloudsOpacity > 0;
    parts.clouds.material.userData.genesisBaseOpacity = cloudsOpacity;
  }
'''

    content, did_change = replace_once(
        content,
        old_cloud_quality,
        new_cloud_quality,
        "ajustar a opacidade da camada de nuvens autoral",
    )
    changed |= did_change

    return content, changed


def patch_command_scene(content: str) -> tuple[str, bool]:
    old = '''      proceduralMaterial.opacity = 1 - runtime.glbFade;
      proceduralAtmosphere.material.opacity = .15 * (1 - runtime.glbFade);
      setGenesisPlanetOpacity(runtime.planetParts, runtime.glbFade);
      if (runtime.glbFade === 1) {
        proceduralPlanet.visible = false;
        proceduralAtmosphere.visible = false;
      }
'''

    new = '''      const hasAuthoredAtmosphere = Boolean(runtime.planetParts?.atmosphere);
      proceduralMaterial.opacity = 1 - runtime.glbFade;
      proceduralAtmosphere.material.opacity = hasAuthoredAtmosphere
        ? .15 * (1 - runtime.glbFade)
        : .15;
      setGenesisPlanetOpacity(runtime.planetParts, runtime.glbFade);
      if (runtime.glbFade === 1) {
        proceduralPlanet.visible = false;
        proceduralAtmosphere.visible = !hasAuthoredAtmosphere;
      }
'''

    return replace_once(
        content,
        old,
        new,
        "preservar atmosfera procedural no Comando quando o GLB não possui atmosfera",
    )


def patch_campaign_scene(content: str) -> tuple[str, bool]:
    old = '''            planet.material.opacity = 1 - runtime.glbFade;
            atmosphere.material.opacity = .14 * (1 - runtime.glbFade);
            detailMesh.material.opacity = 1 - runtime.glbFade;
            detailMesh.visible = runtime.glbFade < 1;
            setGenesisPlanetOpacity(runtime.planetParts, runtime.glbFade);
            if (runtime.glbFade === 1) {
              planet.visible = false;
              atmosphere.visible = false;
              detailMesh.visible = false;
            }
'''

    new = '''            const hasAuthoredAtmosphere = Boolean(runtime.planetParts?.atmosphere);
            planet.material.opacity = 1 - runtime.glbFade;
            atmosphere.material.opacity = hasAuthoredAtmosphere
              ? .14 * (1 - runtime.glbFade)
              : .14;
            detailMesh.material.opacity = 1 - runtime.glbFade;
            detailMesh.visible = runtime.glbFade < 1;
            setGenesisPlanetOpacity(runtime.planetParts, runtime.glbFade);
            if (runtime.glbFade === 1) {
              planet.visible = false;
              atmosphere.visible = !hasAuthoredAtmosphere;
              detailMesh.visible = false;
            }
'''

    return replace_once(
        content,
        old,
        new,
        "preservar atmosfera procedural na Campanha quando o GLB não possui atmosfera",
    )


def copy_payload_file(repo: Path, relative: str, backup_root: Path) -> None:
    source = PAYLOAD_ROOT / relative
    target = repo / relative
    if not source.exists():
        raise RuntimeError(f"Arquivo de payload ausente: {source}")

    if target.exists():
        backup = backup_root / relative
        backup.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(target, backup)

    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Integra o genesis-planeta-multibiomas1.glb no projeto Genesis.",
    )
    parser.add_argument(
        "--repo",
        default=".",
        help="Caminho para a raiz do repositório Genesis. Padrão: diretório atual.",
    )
    args = parser.parse_args()

    repo = require_repo_root(Path(args.repo))

    files_to_patch = {
        "src/visual/genesisPlanetMaterials.js": prepare_materials_patch,
        "src/home/CommandGlobeScene.js": patch_command_scene,
        "src/campaign/CampaignPlanet.jsx": patch_campaign_scene,
    }

    prepared = {}
    change_report = []

    # Valida todas as alterações antes de escrever qualquer arquivo.
    for relative, patcher in files_to_patch.items():
        target = repo / relative
        if not target.exists():
            raise RuntimeError(f"Arquivo esperado não encontrado: {target}")
        original = target.read_text(encoding="utf-8")
        updated, changed = patcher(original)
        prepared[relative] = updated
        change_report.append((relative, changed))

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_root = repo / ".genesis-backups" / f"planet1-{timestamp}"

    # Backups dos arquivos que serão alterados.
    for relative in files_to_patch:
        source = repo / relative
        backup = backup_root / relative
        backup.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, backup)

    # Copia os arquivos novos/substitutos.
    for relative in [
        "src/visual/adaptGenesisPlanetAsset.js",
        "src/visual/genesisPlanetAsset.js",
        "public/models/command/genesis-planeta-multibiomas1.glb",
    ]:
        copy_payload_file(repo, relative, backup_root)

    # Grava as alterações validadas.
    for relative, updated in prepared.items():
        (repo / relative).write_text(updated, encoding="utf-8", newline="\n")

    print("")
    print("Integração concluída.")
    print(f"Backup criado em: {backup_root}")
    print("")
    print("Arquivos:")
    for relative, changed in change_report:
        print(f"- {'alterado' if changed else 'já estava atualizado'}: {relative}")
    print("- instalado: src/visual/adaptGenesisPlanetAsset.js")
    print("- substituído: src/visual/genesisPlanetAsset.js")
    print("- instalado: public/models/command/genesis-planeta-multibiomas1.glb")
    print("")
    print("Próximos comandos:")
    print("  npm run test:unit")
    print("  npm run build")
    print("")
    print("Durante o teste, faça recarregamento forçado do navegador (Ctrl+F5).")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"\nERRO: {error}\n", file=sys.stderr)
        raise SystemExit(1)
