param(
  [Parameter(Mandatory = $true)]
  [string]$RepoRoot,

  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path $RepoRoot).Path

Push-Location $RepoRoot
try {
  Write-Host "Validando sintaxe..."
  & node --check "src/game/chapterFiveWaves.js"
  if ($LASTEXITCODE -ne 0) {
    throw "Erro de sintaxe em chapterFiveWaves.js."
  }

  & node --check "src/game/chapterFivePhase40Balance.test.js"
  if ($LASTEXITCODE -ne 0) {
    throw "Erro de sintaxe no teste de balanceamento."
  }

  Write-Host "Executando teste específico..."
  & npx.cmd vitest run "src/game/chapterFivePhase40Balance.test.js"
  if ($LASTEXITCODE -ne 0) {
    throw "O teste de balanceamento falhou."
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
