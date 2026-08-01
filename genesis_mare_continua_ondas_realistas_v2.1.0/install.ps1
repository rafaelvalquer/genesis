param(
  [string]$RepoRoot,
  [switch]$Validate
)

$ErrorActionPreference = "Stop"
$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Installer = Join-Path $ScriptRoot "apply_changes.py"

if (-not (Test-Path $Installer)) {
  throw "Instalador não encontrado: $Installer"
}

$Python = $null
$PythonArgs = @()
if (Get-Command py -ErrorAction SilentlyContinue) {
  $Python = "py"
  $PythonArgs = @("-3")
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
  $Python = "python"
} else {
  throw "Python 3 não foi encontrado no PATH."
}

$Arguments = @($Installer)
if ($RepoRoot) {
  $Arguments += @("--repo-root", $RepoRoot)
}
if ($Validate) {
  $Arguments += "--validate"
}

& $Python @PythonArgs @Arguments
if ($LASTEXITCODE -ne 0) {
  throw "A instalação falhou com código $LASTEXITCODE."
}
