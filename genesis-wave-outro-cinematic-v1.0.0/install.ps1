[CmdletBinding()]
param(
  [string]$RepoRoot = (Get-Location).Path,
  [switch]$Validate,
  [switch]$FullValidation,
  [switch]$RollbackOnValidationFailure
)

$ErrorActionPreference = "Stop"
$PackageRoot = $PSScriptRoot
$RepoRoot = (Resolve-Path $RepoRoot).Path
$Version = "wave-outro-cinematic-v1.0.0"
$BackupBase = Join-Path $RepoRoot ".genesis-backups\$Version"
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupDir = Join-Path $BackupBase $Timestamp
$ManifestPath = Join-Path $BackupDir "manifest.json"

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
  "scripts/check-wave-outro-cinematic-contract.mjs"
)

if (-not (Test-Path (Join-Path $RepoRoot "src/game/GameCanvas.jsx"))) {
  throw "GameCanvas.jsx não encontrado em $RepoRoot. Confirme a raiz do Genesis."
}
if (-not (Test-Path (Join-Path $RepoRoot "src/game/battleModel.js"))) {
  throw "battleModel.js não encontrado em $RepoRoot."
}

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
$manifest = @()
foreach ($relative in $Targets) {
  $source = Join-Path $RepoRoot $relative
  $existed = Test-Path $source
  $manifest += [pscustomobject]@{ path = $relative; existed = $existed }
  if ($existed) {
    $destination = Join-Path $BackupDir $relative
    New-Item -ItemType Directory -Force -Path (Split-Path $destination -Parent) | Out-Null
    Copy-Item $source $destination -Force
  }
}
$manifest | ConvertTo-Json | Set-Content -Path $ManifestPath -Encoding UTF8
New-Item -ItemType Directory -Force -Path $BackupBase | Out-Null
Set-Content -Path (Join-Path $BackupBase "latest.txt") -Value $BackupDir -Encoding UTF8

$PayloadFiles = @(
  "src/game/waveOutro/waveOutroProfiles.js",
  "src/game/waveOutro/waveOutroCamera.js",
  "src/game/waveOutro/waveOutroAudio.js",
  "src/game/waveOutro/WaveOutroCinematicOverlay.jsx",
  "src/game/waveOutro/waveOutroProfiles.test.js",
  "src/game/waveOutro/waveOutroCamera.test.js",
  "src/game/waveOutro/waveOutroAudio.test.js",
  "src/game/waveOutro/WaveOutroCinematicOverlay.test.jsx",
  "scripts/check-wave-outro-cinematic-contract.mjs"
)

try {
  foreach ($relative in $PayloadFiles) {
    $source = Join-Path $PackageRoot "payload\$relative"
    $destination = Join-Path $RepoRoot $relative
    New-Item -ItemType Directory -Force -Path (Split-Path $destination -Parent) | Out-Null
    Copy-Item $source $destination -Force
  }

  & node (Join-Path $PackageRoot "scripts\apply-patch.mjs") $RepoRoot
  if ($LASTEXITCODE -ne 0) {
    throw "Aplicação do patch retornou código $LASTEXITCODE."
  }
}
catch {
  Write-Host "Falha durante a aplicação. Restaurando os arquivos anteriores..." -ForegroundColor Red
  & node (Join-Path $PackageRoot "scripts\restore-patch.mjs") $RepoRoot $BackupDir
  throw
}

Write-Host ""
Write-Host "Instalação concluída." -ForegroundColor Green
Write-Host "Backup: $BackupDir"
Write-Host "A lógica de combate e os timings do waveOutro não foram alterados."

if ($Validate -or $FullValidation) {
  try {
    & (Join-Path $PackageRoot "validate.ps1") -RepoRoot $RepoRoot -Full:$FullValidation
  }
  catch {
    Write-Host ""
    Write-Host "A validação falhou: $($_.Exception.Message)" -ForegroundColor Red
    if ($RollbackOnValidationFailure) {
      & node (Join-Path $PackageRoot "scripts\restore-patch.mjs") $RepoRoot $BackupDir
      Write-Host "Os arquivos anteriores foram restaurados." -ForegroundColor Yellow
    }
    else {
      Write-Host "Os arquivos instalados foram mantidos para inspeção." -ForegroundColor Yellow
      Write-Host "Use uninstall.ps1 para restaurar o backup quando necessário."
    }
    throw
  }
}
