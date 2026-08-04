param(
  [Parameter(Mandatory = $true)]
  [string]$RepoRoot,

  [switch]$Validate,
  [switch]$SkipBuild,
  [switch]$FullSuite
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path $RepoRoot).Path
$PackageRoot = $PSScriptRoot

$hasPackageJson = Test-Path (Join-Path $RepoRoot "package.json")
$hasContent = Test-Path (Join-Path $RepoRoot "src\game\content.js")
$hasBattleModel = Test-Path (Join-Path $RepoRoot "src\game\battleModel.js")

if (-not ($hasPackageJson -and $hasContent -and $hasBattleModel)) {
  throw "O caminho informado não parece ser a raiz do Genesis: $RepoRoot"
}

$relativeFiles = @(
  "package.json",
  ".editorconfig",
  ".gitattributes",
  "scripts\check-encoding.mjs",
  "src\game\assetCatalog.js",
  "src\game\content.js",
  "src\game\battleModel.js",
  "src\game\chapterFivePhases.js",
  "src\game\chapterFiveWaves.js",
  "src\game\chapter05\phase40Scenario.js",
  "src\game\systems\bossEncounterSystem.js",
  "src\game\missionProvidedAssets.test.js",
  "src\game\phase40AssetLoading.test.js",
  "src\game\assetCatalogConcurrency.test.js",
  "src\game\phase40StartingDefense.test.js",
  "src\game\chapterFivePhase40Balance.test.js",
  "src\game\phase40Scenario.test.js",
  "src\game\systems\bossEncounterSystem.test.js",
  "src\game\phase40BossEncounter.test.js"
)

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = Join-Path $RepoRoot ".genesis-backups\estabilidade-assets-chefes-$timestamp"
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
$existing = New-Object 'System.Collections.Generic.HashSet[string]'

foreach ($relative in $relativeFiles) {
  $source = Join-Path $RepoRoot $relative
  if (Test-Path $source) {
    $destination = Join-Path $backupRoot $relative
    New-Item -ItemType Directory -Path (Split-Path $destination) -Force | Out-Null
    Copy-Item $source $destination -Force
    [void]$existing.Add($relative)
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
    throw "Falha na verificação estrutural."
  }

  if ($Validate) {
    $validateParams = @{ RepoRoot = $RepoRoot }
    if ($SkipBuild) {
      $validateParams.SkipBuild = $true
    }
    if ($FullSuite) {
      $validateParams.FullSuite = $true
    }
    & (Join-Path $PackageRoot "validate.ps1") @validateParams
  }

  Write-Host ""
  Write-Host "Melhorias de estabilidade, assets e chefes instaladas com sucesso."
  Write-Host "Build normal: npm run build"
  Write-Host "CI local: npm run ci"
  Write-Host "Auditoria do Leviatã: npm run audit:leviathan"
  Write-Host "Validação de release: npm run release:check"
}
catch {
  Write-Warning "A instalação falhou. Restaurando os arquivos anteriores."
  foreach ($relative in $relativeFiles) {
    $target = Join-Path $RepoRoot $relative
    if ($existing.Contains($relative)) {
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
