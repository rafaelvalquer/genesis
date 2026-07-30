#!/usr/bin/env bash
set -euo pipefail

PACKAGE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ $# -lt 1 ]]; then
  echo "Uso: ./install.sh /caminho/para/genesis [--validate]" >&2
  exit 1
fi

REPO_ROOT="$1"
shift

ARGS=("$PACKAGE_ROOT/apply_changes.py" "--repo-root" "$REPO_ROOT")

if [[ "${1:-}" == "--validate" ]]; then
  ARGS+=("--validate")
fi

python3 "${ARGS[@]}"
