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
  Write-Host "Validando script de dependências do GameCanvas..."
  & node --check "scripts/check-gamecanvas-render-dependencies.mjs"
  Assert-LastExitCode -Message "Erro de sintaxe no verificador do GameCanvas."

  Write-Host "Validando dependências de renderização..."
  & npm.cmd run verify:gamecanvas-render-dependencies
  Assert-LastExitCode -Message "As dependências de renderização do GameCanvas estão incompletas."

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
