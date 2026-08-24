#!/usr/bin/env python3
"""Compatibility entry point for the canonical Saltador Alado asset pipeline."""
from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    subprocess.run(
        ["node", str(ROOT / "scripts" / "process-saltador-alado-sprites.mjs")],
        cwd=ROOT,
        check=True,
    )


if __name__ == "__main__":
    main()
