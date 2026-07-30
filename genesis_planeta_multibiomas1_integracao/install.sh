#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${1:-.}"

python3 "$SCRIPT_DIR/apply_changes.py" --repo "$REPO_ROOT"
