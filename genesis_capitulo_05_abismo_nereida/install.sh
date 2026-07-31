#!/usr/bin/env bash
set -euo pipefail
if [[ $# -lt 1 ]]; then
  echo "Uso: ./install.sh /caminho/para/genesis [--validate]" >&2
  exit 1
fi
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$1"
shift
python3 "$SCRIPT_DIR/apply_changes.py" --repo-root "$REPO_ROOT" "$@"
