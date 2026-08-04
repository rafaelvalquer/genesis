param(
  [Parameter(Mandatory = $true)]
  [string]$RepoRoot,

  [switch]$SkipBuild,
  [switch]$FullSuite
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path $RepoRoot).Path

function Assert-ExitCode {
  param([Parameter(Mandatory = $true)][string]$Message)
  if ($LASTEXITCODE -ne 0) { throw $Message }
}

Push-Location $RepoRoot
try {
  Write-Host "Validando sintaxe dos arquivos modificados..."
  $files = @(
    "scripts/check-encoding.mjs",
    "src/game/assetCatalog.js",
    "src/game/content.js",
    "src/game/battleModel.js",
    "src/game/chapterFivePhases.js",
    "src/game/chapterFiveWaves.js",
    "src/game/chapter05/phase40Scenario.js",
    "src/game/systems/bossEncounterSystem.js",
    "src/game/missionProvidedAssets.test.js",
    "src/game/phase40AssetLoading.test.js",
    "src/game/assetCatalogConcurrency.test.js",
    "src/game/phase40StartingDefense.test.js",
    "src/game/chapterFivePhase40Balance.test.js",
    "src/game/phase40Scenario.test.js",
    "src/game/systems/bossEncounterSystem.test.js",
    "src/game/phase40BossEncounter.test.js"
  )
  foreach ($file in $files) {
    & node --check $file
    Assert-ExitCode "Erro de sintaxe em $file."
  }

  Write-Host "Validando codificação UTF-8..."
  & npm.cmd run verify:encoding
  Assert-ExitCode "A validação de codificação falhou."

  Write-Host "Executando testes relacionados..."
  & npx.cmd vitest run `
    "src/game/missionProvidedAssets.test.js" `
    "src/game/phase40AssetLoading.test.js" `
    "src/game/assetCatalogConcurrency.test.js" `
    "src/game/phase40StartingDefense.test.js" `
    "src/game/chapterFivePhase40Balance.test.js" `
    "src/game/phase40Scenario.test.js" `
    "src/game/systems/bossEncounterSystem.test.js" `
    "src/game/phase40BossEncounter.test.js" `
    "src/game/chapterFiveContent.test.js"
  Assert-ExitCode "Os testes relacionados falharam."

  if ($FullSuite) {
    Write-Host "Executando suíte completa..."
    & npm.cmd run test
    Assert-ExitCode "A suíte completa falhou."
  }

  if (-not $SkipBuild) {
    Write-Host "Gerando build Vite..."
    & npm.cmd run build
    Assert-ExitCode "O build Vite falhou."
  }

  Write-Host "Validação concluída. Auditorias de arte e orçamento de assets não foram executados."
}
finally {
  Pop-Location
}
