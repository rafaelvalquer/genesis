param(
  [Parameter(Mandatory = $true)]
  [string]$RepoRoot,

  [switch]$FullSuite,
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path -Path $RepoRoot).Path

function Assert-LastExitCode {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Message
  )

  if ($LASTEXITCODE -ne 0) {
    throw $Message
  }
}

Push-Location -Path $RepoRoot

try {
  Write-Host "Validando sintaxe dos verificadores..."

  $javascriptFiles = @(
    "scripts/gamecanvas-import-tools.mjs",
    "scripts/check-gamecanvas-render-dependencies.mjs"
  )

  foreach ($file in $javascriptFiles) {
    & node --check $file
    Assert-LastExitCode -Message "Erro de sintaxe em $file."
  }

  Write-Host "Validando a origem e a execução de getAnchoredSpriteRect..."
  & npm.cmd run verify:gamecanvas-render-dependencies
  Assert-LastExitCode -Message "As dependências de renderização do GameCanvas estão incorretas."

  Write-Host "Executando teste de regressão..."
  & npx.cmd vitest run "src/game/GameCanvasRenderDependencies.test.js"
  Assert-LastExitCode -Message "O teste de regressão do GameCanvas falhou."

  if ($FullSuite) {
    Write-Host "Executando toda a suíte..."
    & npm.cmd test
    Assert-LastExitCode -Message "A suíte completa falhou."
  }

  if (-not $SkipBuild) {
    Write-Host "Gerando build Vite..."
    & npm.cmd run build
    Assert-LastExitCode -Message "O build Vite falhou."
  }

  Write-Host "Validação concluída."
}
finally {
  Pop-Location
}
