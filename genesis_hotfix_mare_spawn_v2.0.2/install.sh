#!/usr/bin/env bash
set -euo pipefail
PACKAGE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
python3 "$PACKAGE_ROOT/apply_hotfix.py" "$@"
