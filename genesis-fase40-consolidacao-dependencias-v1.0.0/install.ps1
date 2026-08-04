param(
  [Parameter(Mandatory = $true)]
  [string]$RepoRoot,

  [switch]$Validate,
  [switch]$FullSuite
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path $RepoRoot).Path
$PackageRoot = $PSScriptRoot

if (-not (Test-Path (Join-Path $RepoRoot "package.json"))) {
  throw "O caminho informado não parece ser a raiz do Genesis: $RepoRoot"
}

$relativeFiles = @(
  "src\game\assetCatalog.js",
  "src\game\chapterFivePhases.js",
  "src\game\chapterFiveWaves.js",
  "src\game\chapter05\phase40Scenario.js",
  "src\game\missionProvidedAssets.test.js",
  "src\game\chapterFivePhase40Balance.test.js",
  "src\game\phase40Scenario.test.js"
)

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = Join-Path $RepoRoot ".genesis-backups\fase40-consolidacao-$timestamp"
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null

$existingFiles = New-Object System.Collections.Generic.List[string]
foreach ($relative in $relativeFiles) {
  $source = Join-Path $RepoRoot $relative
  if (Test-Path $source) {
    $destination = Join-Path $backupRoot $relative
    New-Item -ItemType Directory -Path (Split-Path $destination) -Force | Out-Null
    Copy-Item $source $destination -Force
    $existingFiles.Add($relative)
  }
}

Write-Host "Backup criado em: $backupRoot"

try {
  & node (Join-Path $PackageRoot "apply_changes.mjs") $RepoRoot
  if ($LASTEXITCODE -ne 0) {
    throw "Falha ao aplicar as alterações."
  }

  & node (Join-Path $PackageRoot "verify_changes.mjs") $RepoRoot
  if ($LASTEXITCODE -ne 0) {
    throw "Falha na verificação das alterações."
  }

  if ($Validate) {
    $validateArgs = @{
      RepoRoot = $RepoRoot
    }
    if ($FullSuite) {
      $validateArgs.FullSuite = $true
    }
    & (Join-Path $PackageRoot "validate.ps1") @validateArgs
  }

  Write-Host ""
  Write-Host "Consolidação da Fase 40 instalada com sucesso."
}
catch {
  Write-Warning "A instalação falhou. Restaurando os arquivos anteriores."

  foreach ($relative in $relativeFiles) {
    $target = Join-Path $RepoRoot $relative
    if ($existingFiles.Contains($relative)) {
      $backup = Join-Path $backupRoot $relative
      New-Item -ItemType Directory -Path (Split-Path $target) -Force | Out-Null
      Copy-Item $backup $target -Force
    }
    elseif (Test-Path $target) {
      Remove-Item $target -Force
    }
  }

  throw
}
