param(
  [Parameter(Mandatory = $true)]
  [string]$RepoRoot,

  [switch]$Validate
)

$ErrorActionPreference = "Stop"
$PackageRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Installer = Join-Path $PackageRoot "apply_changes.py"

if (-not (Test-Path $Installer)) {
  throw "Instalador Python não encontrado: $Installer"
}

if (Get-Command py -ErrorAction SilentlyContinue) {
  $PythonCommand = @("py", "-3")
}
elseif (Get-Command python -ErrorAction SilentlyContinue) {
  $PythonCommand = @("python")
}
else {
  throw "Python 3 não encontrado."
}

$Arguments = @(
  $Installer,
  "--repo-root",
  $RepoRoot
)

if ($Validate) {
  $Arguments += "--validate"
}

if ($PythonCommand.Count -eq 2) {
  & $PythonCommand[0] $PythonCommand[1] @Arguments
}
else {
  & $PythonCommand[0] @Arguments
}

if ($LASTEXITCODE -ne 0) {
  throw "A instalação terminou com código $LASTEXITCODE."
}
