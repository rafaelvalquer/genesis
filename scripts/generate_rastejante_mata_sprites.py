#!/usr/bin/env python3
"""Compatibility entry point for the high-resolution Rastejante pipeline."""
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]

def main() -> None:
    subprocess.run(
        ["node", "scripts/process-rastejante-mata-sprites.mjs"],
        cwd=ROOT,
        check=True,
    )

if __name__ == "__main__":
    main()
