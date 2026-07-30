param(
  [string]$RepoRoot = "."
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

if (Get-Command py -ErrorAction SilentlyContinue) {
  & py -3 "$scriptDir\apply_changes.py" --repo "$RepoRoot"
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
  & python "$scriptDir\apply_changes.py" --repo "$RepoRoot"
} else {
  throw "Python 3 não foi encontrado. Instale o Python ou execute as alterações manualmente pelo README."
}
