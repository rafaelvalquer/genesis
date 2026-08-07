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
$Version = "battle-hotkeys-v1.0.0"
$BackupBase = Join-Path $RepoRoot ".genesis-backups\$Version"
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupDir = Join-Path $BackupBase $Timestamp
$ManifestPath = Join-Path $BackupDir "manifest.json"

$Targets = @(
  "src/game/GameCanvas.jsx",
  "src/styles.css",
  "src/game/battleHotkeys.js",
  "src/game/battleHotkeys.test.js",
  "scripts/check-battle-hotkeys-contract.mjs"
)

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

foreach ($relative in @(
  "src/game/battleHotkeys.js",
  "src/game/battleHotkeys.test.js",
  "scripts/check-battle-hotkeys-contract.mjs"
)) {
  $source = Join-Path $PackageRoot "payload\$relative"
  $destination = Join-Path $RepoRoot $relative
  New-Item -ItemType Directory -Force -Path (Split-Path $destination -Parent) | Out-Null
  Copy-Item $source $destination -Force
}

& node (Join-Path $PackageRoot "scripts\apply-patch.mjs") $RepoRoot
if ($LASTEXITCODE -ne 0) {
  throw "Aplicação do patch retornou código $LASTEXITCODE."
}

Write-Host ""
Write-Host "Instalação concluída." -ForegroundColor Green
Write-Host "Backup: $BackupDir"

if ($Validate -or $FullValidation) {
  try {
    & (Join-Path $PackageRoot "validate.ps1") -RepoRoot $RepoRoot -Full:$FullValidation
  }
  catch {
    Write-Host ""
    Write-Host "A validação falhou: $($_.Exception.Message)" -ForegroundColor Red
    if ($RollbackOnValidationFailure) {
      & (Join-Path $PackageRoot "uninstall.ps1") -RepoRoot $RepoRoot -BackupDir $BackupDir
      Write-Host "Os arquivos anteriores foram restaurados." -ForegroundColor Yellow
    }
    else {
      Write-Host "Os arquivos instalados foram mantidos para inspeção." -ForegroundColor Yellow
      Write-Host "Use uninstall.ps1 para restaurar o backup quando necessário."
    }
    throw
  }
}
