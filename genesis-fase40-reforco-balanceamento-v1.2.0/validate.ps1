param(
  [Parameter(Mandatory = $true)]
  [string]$RepoRoot,

  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path $RepoRoot).Path

Push-Location $RepoRoot
try {
  $files = @(
    "src/game/chapterFivePhases.js",
    "src/game/chapterFiveWaves.js",
    "src/game/battleModel.js",
    "src/game/phase40StartingDefense.test.js",
    "src/game/chapterFivePhase40Balance.test.js"
  )

  Write-Host "Validando sintaxe..."
  foreach ($file in $files) {
    & node --check $file
    if ($LASTEXITCODE -ne 0) {
      throw "Erro de sintaxe em $file."
    }
  }

  Write-Host "Executando testes específicos da Fase 40..."
  & npx.cmd vitest run `
    "src/game/phase40StartingDefense.test.js" `
    "src/game/chapterFivePhase40Balance.test.js"

  if ($LASTEXITCODE -ne 0) {
    throw "Os testes da Fase 40 falharam."
  }

  if (-not $SkipBuild) {
    Write-Host "Executando build completo..."
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) {
      throw "O build completo falhou."
    }
  }
  else {
    Write-Host "Build completo ignorado por -SkipBuild."
  }

  Write-Host "Validação concluída."
}
finally {
  Pop-Location
}
