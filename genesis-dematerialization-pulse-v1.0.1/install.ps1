param(
  [Parameter(Mandatory=$true)]
  [string]$RepoRoot,
  [switch]$FullValidation
)

$ErrorActionPreference = "Stop"
$PackageRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = (Resolve-Path $RepoRoot).Path
$Version = "dematerialization-pulse-v1.0.1"
$ExpectedCommit = "ea680da7fb3aea143ec19b8842d5d362ec86c0f7"

if (-not (Test-Path (Join-Path $RepoRoot "package.json"))) {
  throw "RepoRoot inválido: package.json não encontrado em $RepoRoot"
}
if (-not (Test-Path (Join-Path $RepoRoot "src\game\battleModel.js"))) {
  throw "RepoRoot inválido: src\game\battleModel.js não encontrado."
}

Write-Host "== Genesis · Pulso de Desmaterialização Tático v1.0.1 ==" -ForegroundColor Cyan
Write-Host "Repo: $RepoRoot"

try {
  $currentCommit = (& git -C $RepoRoot rev-parse HEAD 2>$null).Trim()
  if ($currentCommit) {
    Write-Host "Commit atual: $currentCommit"
    if ($currentCommit -ne $ExpectedCommit) {
      Write-Warning "O pacote foi desenvolvido sobre $ExpectedCommit. O patch é estrutural e tentará continuar sobre o commit atual."
    }
  }
} catch {
  Write-Warning "Não foi possível identificar o commit atual; continuando com validação estrutural."
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = Join-Path $RepoRoot ".genesis-backups\$Version\$timestamp"
$filesToBackup = @(
  "src\game\battleModel.js",
  "src\game\GameCanvas.jsx",
  "src\game\graphicsRuntime.js",
  "src\game\simulation\observation\createBattleObservation.js",
  "src\game\simulation\ai\StrategicAgent.js",
  "src\game\simulation\engine\simulationActions.js",
  "src\game\simulation\strategies\strategyProfiles.js",
  "src\game\simulation\optimization\PolicyOptimizer.js",
  "src\game\simulation\metrics\SimulationMetrics.js",
  "src\game\dematerializationPulse.js",
  "src\game\dematerializationPulse.test.js",
  "src\game\components\DematerializationPulseControls.jsx",
  "src\game\components\dematerializationPulseControls.css",
  "src\game\components\DematerializationPulseControls.test.jsx",
  "src\game\simulation\planners\DematerializationPulsePlanner.js",
  "src\game\simulation\planners\DematerializationPulsePlanner.test.js"
)

foreach ($relative in $filesToBackup) {
  $source = Join-Path $RepoRoot $relative
  if (Test-Path $source) {
    $destination = Join-Path $backupRoot $relative
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
    Copy-Item -Force $source $destination
  }
}
Write-Host "Backup manual: $backupRoot" -ForegroundColor DarkGray

$battleModelPath = Join-Path $RepoRoot "src\game\battleModel.js"
$gameCanvasPath = Join-Path $RepoRoot "src\game\GameCanvas.jsx"
$domainPath = Join-Path $RepoRoot "src\game\dematerializationPulse.js"
$alreadyInstalled = (Test-Path $domainPath) `
  -and (Select-String -Path $battleModelPath -Pattern "export function activateDematerializationPulse" -SimpleMatch -Quiet) `
  -and (Select-String -Path $gameCanvasPath -Pattern "<DematerializationPulseControls" -SimpleMatch -Quiet)

if ($alreadyInstalled) {
  Write-Host "Implementação v1.0.0/v1.0.1 já detectada. Patch de gameplay não será reaplicado." -ForegroundColor DarkGray
} else {
  $payloadRoot = Join-Path $PackageRoot "payload"
  Get-ChildItem -Path $payloadRoot -Recurse -File | ForEach-Object {
    $relative = $_.FullName.Substring($payloadRoot.Length).TrimStart('\','/')
    $destination = Join-Path $RepoRoot $relative
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
    Copy-Item -Force $_.FullName $destination
  }
  Write-Host "Arquivos novos copiados." -ForegroundColor Green

  & node (Join-Path $PackageRoot "scripts\apply-patch.mjs") $RepoRoot
  if ($LASTEXITCODE -ne 0) {
    throw "Aplicação do patch retornou código $LASTEXITCODE. Os arquivos já copiados NÃO serão restaurados automaticamente."
  }
}

$validateArgs = @("-RepoRoot", $RepoRoot)
if ($FullValidation) { $validateArgs += "-FullValidation" }
try {
  & (Join-Path $PackageRoot "validate.ps1") @validateArgs
} catch {
  Write-Host "" 
  Write-Warning "A validação encontrou falhas. A implementação permanece instalada; nenhum rollback automático foi executado."
  throw
}

Write-Host "" 
Write-Host "Instalação concluída. Reinicie o Vite antes de testar." -ForegroundColor Green
