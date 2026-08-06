[CmdletBinding()]
param(
  [Parameter(Mandatory = $false)]
  [string]$RepoRoot = (Get-Location).Path,

  [string]$Manifest
)

$ErrorActionPreference = "Stop"
$PackageRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RestoreScript = Join-Path $PackageRoot "scripts\restore-patch.mjs"
$RepoRoot = [System.IO.Path]::GetFullPath($RepoRoot)
$nodeCommand = Get-Command node -ErrorAction Stop

if (!$Manifest) {
  $latestPath = Join-Path $RepoRoot ".genesis-backups\enguia-rasgamar-v1.0.0\latest.txt"
  if (!(Test-Path $latestPath)) {
    throw "Nenhum manifesto foi informado e latest.txt não foi encontrado em $latestPath"
  }
  $Manifest = (Get-Content $latestPath -Raw).Trim()
}

if (!(Test-Path $Manifest)) {
  throw "Manifesto de backup não encontrado: $Manifest"
}

& $nodeCommand.Source $RestoreScript "--manifest=$Manifest"
if ($LASTEXITCODE -ne 0) {
  throw "A restauração falhou com código $LASTEXITCODE."
}

Write-Host "A implementação foi removida e os arquivos anteriores foram restaurados."
