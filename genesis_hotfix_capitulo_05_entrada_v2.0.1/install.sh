#!/usr/bin/env sh
set -eu
PACKAGE_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
python3 "$PACKAGE_ROOT/apply_fix.py" "$@"
