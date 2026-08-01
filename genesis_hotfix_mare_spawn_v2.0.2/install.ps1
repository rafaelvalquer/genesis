param(
  [string]$RepoRoot = "C:\Projetos\Genesis",
  [switch]$Validate
)

$ErrorActionPreference = "Stop"
$PackageRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Installer = Join-Path $PackageRoot "apply_hotfix.py"

if (-not (Test-Path $Installer)) {
  throw "Arquivo apply_hotfix.py não encontrado em $PackageRoot"
}

$PythonCommand = $null
$PythonPrefix = @()
if (Get-Command py -ErrorAction SilentlyContinue) {
  $PythonCommand = "py"
  $PythonPrefix = @("-3")
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
  $PythonCommand = "python"
} else {
  throw "Python 3 não foi encontrado no PATH."
}

$Arguments = @($PythonPrefix) + @($Installer, "--repo-root", $RepoRoot)
if ($Validate) {
  $Arguments += "--validate"
}

Write-Host "[INFO] Aplicando correção da água na área de spawn..." -ForegroundColor Cyan
& $PythonCommand @Arguments
if ($LASTEXITCODE -ne 0) {
  throw "O instalador terminou com código $LASTEXITCODE."
}
