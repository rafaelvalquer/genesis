"""Run the convoy3d pipeline with an explicit Blender-or-fallback decision.

This never changes game code.  In CI/dev containers without Blender it invokes
the independent Pillow builder, so the asset contract remains reproducible;
on artist machines it runs the Blender scene and exports its PNGs to WebP.
"""
from __future__ import annotations
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BLENDER = shutil.which("blender") or shutil.which("blender.exe")

def main():
    if BLENDER:
        subprocess.run([BLENDER, "-b", "--python", "scripts/convoy3d/build_vehicle.py"], cwd=ROOT, check=True)
        subprocess.run([BLENDER, "-b", "tmp/convoy3d/tr7r_peregrino.blend", "--python", "scripts/convoy3d/render_vehicle.py"], cwd=ROOT, check=True)
        subprocess.run([sys.executable, "scripts/convoy3d/export_webp.py"], cwd=ROOT, check=True)
        print("convoy3d: Blender render/export completed")
    else:
        subprocess.run([sys.executable, "scripts/convoy/build_tr7r_peregrino_cartoon.py"], cwd=ROOT, check=True)
        print("convoy3d: Blender unavailable; procedural Pillow fallback completed")
    subprocess.run([sys.executable, "scripts/convoy3d/validate_frames.py"], cwd=ROOT, check=True)
    subprocess.run([sys.executable, "scripts/convoy3d/create_preview.py"], cwd=ROOT, check=True)

if __name__ == "__main__":
    main()
