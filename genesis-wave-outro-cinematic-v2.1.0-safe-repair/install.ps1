[CmdletBinding()]
param(
  [string]$RepoRoot = (Get-Location).Path,
  [switch]$Validate,
  [switch]$FullValidation
)
$ErrorActionPreference = "Stop"
$PackageRoot = $PSScriptRoot
$RepoRoot = (Resolve-Path $RepoRoot).Path
$Version = "wave-outro-cinematic-v2.1.0-safe-repair"
$BackupBase = Join-Path $RepoRoot ".genesis-backups\$Version"
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupDir = Join-Path $BackupBase $Timestamp
$Targets = @(
  "src/game/battleModel.js",
  "src/game/GameCanvas.jsx",
  "src/game/graphicsRuntime.js",
  "src/styles.css"
)
if (-not (Test-Path (Join-Path $RepoRoot "src/game/GameCanvas.jsx"))) { throw "GameCanvas.jsx não encontrado em $RepoRoot." }
if (-not (Test-Path (Join-Path $RepoRoot "src/game/battleModel.js"))) { throw "battleModel.js não encontrado em $RepoRoot." }
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
foreach ($relative in $Targets) {
  $source = Join-Path $RepoRoot $relative
  if (Test-Path $source) {
    $destination = Join-Path $BackupDir $relative
    New-Item -ItemType Directory -Force -Path (Split-Path $destination -Parent) | Out-Null
    Copy-Item $source $destination -Force
  }
}
& node (Join-Path $PackageRoot "scripts\apply-repair.mjs") $RepoRoot
if ($LASTEXITCODE -ne 0) { throw "Reparo retornou código $LASTEXITCODE. Nenhum restore automático foi executado." }
$ViteCache = Join-Path $RepoRoot "node_modules\.vite"
if (Test-Path $ViteCache) {
  Remove-Item $ViteCache -Recurse -Force -ErrorAction SilentlyContinue
  Write-Host "Cache do Vite removido para evitar módulos antigos do HMR." -ForegroundColor DarkGray
}
Write-Host ""
Write-Host "Reparo seguro instalado." -ForegroundColor Green
Write-Host "Backup manual: $BackupDir"
Write-Host "As versões experimentais v2.0.x foram removidas do caminho crítico da batalha." -ForegroundColor Yellow
if ($Validate -or $FullValidation) {
  try { & (Join-Path $PackageRoot "validate.ps1") -RepoRoot $RepoRoot -Full:$FullValidation }
  catch {
    Write-Host ""
    Write-Host "A validação encontrou falhas: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "As alterações permanecem instaladas; nenhum restore foi executado." -ForegroundColor Yellow
  }
}
