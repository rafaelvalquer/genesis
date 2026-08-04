param(
  [Parameter(Mandatory = $true)]
  [string]$RepoRoot,

  [switch]$Validate,
  [switch]$SkipBuild,
  [switch]$FullSuite,
  [switch]$StrictAssets
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path $RepoRoot).Path
$PackageRoot = $PSScriptRoot

if (-not (Test-Path (Join-Path $RepoRoot "package.json"))) {
  throw "O caminho informado não parece ser a raiz do Genesis: $RepoRoot"
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = Join-Path $RepoRoot ".genesis-backups\fase40-reforco-balanceamento-$timestamp"
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null

$targets = @(
  "src\game\chapterFivePhases.js",
  "src\game\chapterFiveWaves.js",
  "src\game\battleModel.js",
  "src\game\chapterFiveContent.test.js",
  "src\game\phase40StartingDefense.test.js",
  "src\game\chapterFivePhase40Balance.test.js"
)

$existed = @{}

foreach ($relative in $targets) {
  $target = Join-Path $RepoRoot $relative
  $existed[$relative] = Test-Path $target

  if ($existed[$relative]) {
    $backup = Join-Path $backupRoot $relative
    New-Item -ItemType Directory -Path (Split-Path $backup) -Force | Out-Null
    Copy-Item $target $backup -Force
  }
}

Write-Host "Backup criado em: $backupRoot"

try {
  & node (Join-Path $PackageRoot "apply_changes.mjs") $RepoRoot
  if ($LASTEXITCODE -ne 0) {
    throw "Falha ao aplicar alterações."
  }

  & node (Join-Path $PackageRoot "verify_changes.mjs") $RepoRoot
  if ($LASTEXITCODE -ne 0) {
    throw "Falha na verificação das alterações."
  }

  if ($Validate) {
    $validateArgs = @{
      RepoRoot = $RepoRoot
    }
    if ($SkipBuild) {
      $validateArgs.SkipBuild = $true
    }
    if ($FullSuite) {
      $validateArgs.FullSuite = $true
    }
    if ($StrictAssets) {
      $validateArgs.StrictAssets = $true
    }
    & (Join-Path $PackageRoot "validate.ps1") @validateArgs
  }

  Write-Host ""
  Write-Host "Reforço e balanceamento da Fase 40 aplicados com sucesso."
}
catch {
  Write-Warning "A instalação falhou. Restaurando os arquivos anteriores."

  foreach ($relative in $targets) {
    $target = Join-Path $RepoRoot $relative
    if ($existed[$relative]) {
      Copy-Item (Join-Path $backupRoot $relative) $target -Force
    }
    elseif (Test-Path $target) {
      Remove-Item $target -Force
    }
  }

  throw
}
