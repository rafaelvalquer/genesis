param(
  [Parameter(Mandatory = $true)]
  [string]$RepoRoot,

  [switch]$Validate,
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path $RepoRoot).Path
$PackageRoot = $PSScriptRoot

if (-not (Test-Path (Join-Path $RepoRoot "package.json"))) {
  throw "O caminho informado não parece ser a raiz do Genesis: $RepoRoot"
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = Join-Path $RepoRoot ".genesis-backups\fase40-balanceamento-$timestamp"
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null

$wavesRelative = "src\game\chapterFiveWaves.js"
$testRelative = "src\game\chapterFivePhase40Balance.test.js"
$wavesPath = Join-Path $RepoRoot $wavesRelative
$testPath = Join-Path $RepoRoot $testRelative

$wavesBackup = Join-Path $backupRoot $wavesRelative
New-Item -ItemType Directory -Path (Split-Path $wavesBackup) -Force | Out-Null
Copy-Item $wavesPath $wavesBackup -Force

$testExisted = Test-Path $testPath
if ($testExisted) {
  $testBackup = Join-Path $backupRoot $testRelative
  New-Item -ItemType Directory -Path (Split-Path $testBackup) -Force | Out-Null
  Copy-Item $testPath $testBackup -Force
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
    & (Join-Path $PackageRoot "validate.ps1") @validateArgs
  }

  Write-Host ""
  Write-Host "Fase 40 balanceada com sucesso."
}
catch {
  Write-Warning "A instalação falhou. Restaurando os arquivos anteriores."

  Copy-Item $wavesBackup $wavesPath -Force

  if ($testExisted) {
    Copy-Item (Join-Path $backupRoot $testRelative) $testPath -Force
  }
  elseif (Test-Path $testPath) {
    Remove-Item $testPath -Force
  }

  throw
}
