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
  Write-Host "Validando sintaxe dos módulos de transição..."

  $javascriptFiles = @(
    "src/routing/routeTransitionMachine.js",
    "src/routing/routeModules.js",
    "src/campaign/campaignDepartureTransition.js",
    "scripts/check-route-transition-contract.mjs"
  )

  foreach ($file in $javascriptFiles) {
    & node --check $file
    Assert-LastExitCode -Message "Erro de sintaxe em $file."
  }

  Write-Host "Validando o contrato da transição..."
  & npm.cmd run verify:route-transitions
  Assert-LastExitCode -Message "O contrato da transição está inválido."

  Write-Host "Executando testes de regressão..."

  $testFiles = @(
    "src/routing/routeTransitionMachine.test.js",
    "src/campaign/campaignDepartureTransition.test.js",
    "src/routing/routeTransitionContract.test.js",
    "src/routing/retryableLazyModule.test.js",
    "src/routing/playRouteSuspenseContract.test.js"
  )

  & npx.cmd vitest run $testFiles
  Assert-LastExitCode -Message "Os testes das transições falharam."

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
