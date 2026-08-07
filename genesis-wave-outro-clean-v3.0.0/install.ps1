[CmdletBinding()]
param(
  [string]$RepoRoot = (Get-Location).Path,
  [switch]$FullValidation
)

$ErrorActionPreference = "Stop"
$PackageRoot = $PSScriptRoot
$RepoRoot = (Resolve-Path $RepoRoot).Path
$Version = "wave-outro-clean-v3.0.0"
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupDir = Join-Path $RepoRoot ".genesis-backups\$Version\$Timestamp"

$Required = @(
  "src/game/GameCanvas.jsx",
  "src/game/battleModel.js",
  "src/styles.css"
)
foreach ($relative in $Required) {
  if (-not (Test-Path (Join-Path $RepoRoot $relative))) {
    throw "Arquivo obrigatório não encontrado: $relative"
  }
}

$Targets = @(
  "src/game/GameCanvas.jsx",
  "src/game/battleModel.js",
  "src/styles.css",
  "src/game/waveOutro/waveOutroProfiles.js",
  "src/game/waveOutro/waveOutroCamera.js",
  "src/game/waveOutro/waveOutroAudio.js",
  "src/game/waveOutro/WaveOutroCinematicOverlay.jsx",
  "src/game/waveOutro/waveOutroProfiles.test.js",
  "src/game/waveOutro/waveOutroCamera.test.js",
  "src/game/waveOutro/waveOutroAudio.test.js",
  "src/game/waveOutro/WaveOutroCinematicOverlay.test.jsx",
  "src/game/waveOutro/waveOutroEffects.js",
  "src/game/waveOutro/waveOutroRenderer.js",
  "scripts/check-wave-outro-cinematic-contract.mjs"
)

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
$manifest = @()
foreach ($relative in $Targets) {
  $source = Join-Path $RepoRoot $relative
  $exists = Test-Path $source
  $manifest += [pscustomobject]@{ path = $relative; existed = $exists }
  if ($exists) {
    $destination = Join-Path $BackupDir $relative
    New-Item -ItemType Directory -Force -Path (Split-Path $destination -Parent) | Out-Null
    Copy-Item -Force $source $destination
  }
}
$manifest | ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 (Join-Path $BackupDir "manifest.json")
Write-Host "Backup manual criado em: $BackupDir"

$PayloadFiles = @(
  "src/game/waveOutro/waveOutroProfiles.js",
  "src/game/waveOutro/waveOutroCamera.js",
  "src/game/waveOutro/waveOutroAudio.js",
  "src/game/waveOutro/WaveOutroCinematicOverlay.jsx",
  "src/game/waveOutro/waveOutroProfiles.test.js",
  "src/game/waveOutro/waveOutroCamera.test.js",
  "src/game/waveOutro/waveOutroAudio.test.js",
  "src/game/waveOutro/WaveOutroCinematicOverlay.test.jsx"
)
foreach ($relative in $PayloadFiles) {
  $source = Join-Path $PackageRoot (Join-Path "payload" $relative)
  $destination = Join-Path $RepoRoot $relative
  New-Item -ItemType Directory -Force -Path (Split-Path $destination -Parent) | Out-Null
  Copy-Item -Force $source $destination
}

node (Join-Path $PackageRoot "scripts\apply-clean-architecture.mjs") $RepoRoot
if ($LASTEXITCODE -ne 0) {
  throw "Aplicação da arquitetura retornou código $LASTEXITCODE. Nenhum rollback automático foi executado."
}

node (Join-Path $PackageRoot "scripts\check-architecture.mjs") $RepoRoot
if ($LASTEXITCODE -ne 0) {
  throw "Contrato estrutural falhou. Nenhum rollback automático foi executado."
}

Write-Host "Arquitetura waveOutro v3.0.0 instalada."

if ($FullValidation) {
  try {
    & (Join-Path $PackageRoot "validate.ps1") -RepoRoot $RepoRoot -Full
  } catch {
    Write-Warning $_
    Write-Warning "A validação encontrou falhas, mas as alterações permanecem instaladas. Nenhum rollback foi executado."
  }
}
