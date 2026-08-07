[CmdletBinding()]
param(
  [string]$RepoRoot = (Get-Location).Path,
  [string]$BackupDir = ""
)

$ErrorActionPreference = "Stop"
$PackageRoot = $PSScriptRoot
$RepoRoot = (Resolve-Path $RepoRoot).Path
$BackupBase = Join-Path $RepoRoot ".genesis-backups\wave-outro-cinematic-v1.0.0"

if (-not $BackupDir) {
  $latestPath = Join-Path $BackupBase "latest.txt"
  if (-not (Test-Path $latestPath)) {
    throw "Nenhum backup do pacote foi encontrado em $BackupBase."
  }
  $BackupDir = (Get-Content $latestPath -Raw).Trim()
}

& node (Join-Path $PackageRoot "scripts\restore-patch.mjs") $RepoRoot $BackupDir
if ($LASTEXITCODE -ne 0) {
  throw "Restauração retornou código $LASTEXITCODE."
}
Write-Host "Backup restaurado: $BackupDir" -ForegroundColor Green
