[CmdletBinding()]
param(
  [string]$RepoRoot = (Get-Location).Path,
  [switch]$Validate,
  [switch]$FullValidation
)

$ErrorActionPreference = "Stop"
$PackageRoot = $PSScriptRoot
$RepoRoot = (Resolve-Path $RepoRoot).Path
$Version = "wave-outro-cinematic-v2.0.4"
$BackupBase = Join-Path $RepoRoot ".genesis-backups\$Version"
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupDir = Join-Path $BackupBase $Timestamp
$ManifestPath = Join-Path $BackupDir "manifest.json"

$Targets = @(
  "src/game/battleModel.js",
  "src/game/GameCanvas.jsx",
  "src/game/graphicsRuntime.js",
  "src/styles.css",
  "src/game/waveOutro/waveOutroProfiles.js",
  "src/game/waveOutro/waveOutroCamera.js",
  "src/game/waveOutro/waveOutroAudio.js",
  "src/game/waveOutro/waveOutroEffects.js",
  "src/game/waveOutro/waveOutroRenderer.js",
  "src/game/waveOutro/waveOutroProfiles.test.js",
  "src/game/waveOutro/waveOutroCamera.test.js",
  "scripts/check-wave-outro-contract.mjs",
  "scripts/check-wave-outro-runtime.mjs"
)

if (-not (Test-Path (Join-Path $RepoRoot "src/game/GameCanvas.jsx"))) {
  throw "GameCanvas.jsx não encontrado em $RepoRoot. Informe a raiz do Genesis."
}
if (-not (Test-Path (Join-Path $RepoRoot "src/game/battleModel.js"))) {
  throw "battleModel.js não encontrado em $RepoRoot."
}

# Backup é somente uma cópia de segurança manual. Este instalador NUNCA executa restore automático.
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
$manifest | ConvertTo-Json -Depth 4 | Set-Content -Path $ManifestPath -Encoding UTF8
New-Item -ItemType Directory -Force -Path $BackupBase | Out-Null
Set-Content -Path (Join-Path $BackupBase "latest.txt") -Value $BackupDir -Encoding UTF8

$PayloadFiles = @(
  "src/game/waveOutro/waveOutroProfiles.js",
  "src/game/waveOutro/waveOutroCamera.js",
  "src/game/waveOutro/waveOutroAudio.js",
  "src/game/waveOutro/waveOutroEffects.js",
  "src/game/waveOutro/waveOutroRenderer.js",
  "src/game/waveOutro/waveOutroProfiles.test.js",
  "src/game/waveOutro/waveOutroCamera.test.js"
)
foreach ($relative in $PayloadFiles) {
  $source = Join-Path $PackageRoot ("payload\" + $relative)
  $destination = Join-Path $RepoRoot $relative
  New-Item -ItemType Directory -Force -Path (Split-Path $destination -Parent) | Out-Null
  Copy-Item $source $destination -Force
}

$ContractSource = Join-Path $PackageRoot "scripts\check-wave-outro-contract.mjs"
$ContractDestination = Join-Path $RepoRoot "scripts\check-wave-outro-contract.mjs"
New-Item -ItemType Directory -Force -Path (Split-Path $ContractDestination -Parent) | Out-Null
Copy-Item $ContractSource $ContractDestination -Force
$RuntimeCheckSource = Join-Path $PackageRoot "scripts\check-wave-outro-runtime.mjs"
$RuntimeCheckDestination = Join-Path $RepoRoot "scripts\check-wave-outro-runtime.mjs"
Copy-Item $RuntimeCheckSource $RuntimeCheckDestination -Force

& node (Join-Path $PackageRoot "scripts\apply-patch.mjs") $RepoRoot
if ($LASTEXITCODE -ne 0) {
  throw "Aplicação do patch retornou código $LASTEXITCODE. Os arquivos já copiados NÃO serão restaurados automaticamente."
}

Write-Host ""
Write-Host "Implementação instalada." -ForegroundColor Green
Write-Host "Backup manual: $BackupDir"
Write-Host "POLÍTICA DE FALHA: nenhum teste ou validação restaura arquivos automaticamente." -ForegroundColor Yellow

if ($Validate -or $FullValidation) {
  try {
    & (Join-Path $PackageRoot "validate.ps1") -RepoRoot $RepoRoot -Full:$FullValidation
  }
  catch {
    Write-Host ""
    Write-Host "A validação encontrou falhas: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "As alterações permanecem instaladas. Nenhum restore foi executado." -ForegroundColor Yellow
    Write-Host "Corrija os testes/regressões diretamente sobre os arquivos implementados."
    # Intencionalmente não relança a exceção: a instalação continua concluída.
  }
}
