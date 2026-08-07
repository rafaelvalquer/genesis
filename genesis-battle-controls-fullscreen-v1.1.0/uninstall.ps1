[CmdletBinding()]
param(
  [string]$RepoRoot = (Get-Location).Path,
  [string]$BackupDir
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path $RepoRoot).Path
$BackupBase = Join-Path $RepoRoot ".genesis-backups\battle-controls-fullscreen-v1.1.0"

if (-not $BackupDir) {
  $latest = Join-Path $BackupBase "latest.txt"
  if (-not (Test-Path $latest)) { throw "Backup mais recente não encontrado." }
  $BackupDir = (Get-Content $latest -Raw).Trim()
}

$manifestPath = Join-Path $BackupDir "manifest.json"
if (-not (Test-Path $manifestPath)) { throw "Manifesto de backup não encontrado: $manifestPath" }
$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json

foreach ($entry in $manifest) {
  $destination = Join-Path $RepoRoot $entry.path
  $backup = Join-Path $BackupDir $entry.path
  if ($entry.existed) {
    New-Item -ItemType Directory -Force -Path (Split-Path $destination -Parent) | Out-Null
    Copy-Item $backup $destination -Force
  }
  elseif (Test-Path $destination) {
    Remove-Item $destination -Force
  }
}

Write-Host "Restauração concluída a partir de $BackupDir" -ForegroundColor Green
