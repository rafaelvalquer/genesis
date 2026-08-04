param(
  [Parameter(Mandatory = $true)]
  [string]$RepoRoot,

  [switch]$FullSuite
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path $RepoRoot).Path

function Assert-LastExitCode {
  param([Parameter(Mandatory = $true)][string]$Message)
  if ($LASTEXITCODE -ne 0) {
    throw $Message
  }
}

Push-Location $RepoRoot
try {
  Write-Host "Validando sintaxe..."
  $files = @(
    "src/game/assetCatalog.js",
    "src/game/chapter05/phase40Scenario.js",
    "src/game/chapterFivePhases.js",
    "src/game/chapterFiveWaves.js",
    "src/game/missionProvidedAssets.test.js",
    "src/game/chapterFivePhase40Balance.test.js",
    "src/game/phase40Scenario.test.js"
  )

  foreach ($file in $files) {
    & node --check $file
    Assert-LastExitCode "Erro de sintaxe em $file."
  }

  Write-Host "Executando testes relacionados..."
  & npx.cmd vitest run `
    "src/game/missionProvidedAssets.test.js" `
    "src/game/phase40Scenario.test.js" `
    "src/game/phase40StartingDefense.test.js" `
    "src/game/chapterFivePhase40Balance.test.js" `
    "src/game/chapterFiveContent.test.js"
  Assert-LastExitCode "Os testes da consolidação da Fase 40 falharam."

  if ($FullSuite) {
    Write-Host "Executando suíte completa..."
    & npm.cmd run test:unit
    Assert-LastExitCode "A suíte completa do repositório falhou."
  }

  Write-Host "Validação concluída."
}
finally {
  Pop-Location
}
