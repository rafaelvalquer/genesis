param(
  [Parameter(Mandatory=$true)]
  [string]$RepoRoot,
  [switch]$FullValidation
)

$ErrorActionPreference = "Continue"
$PackageRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = (Resolve-Path $RepoRoot).Path
$failures = New-Object System.Collections.Generic.List[string]

function Invoke-NativeValidationStep {
  param(
    [Parameter(Mandatory=$true)][string]$Name,
    [Parameter(Mandatory=$true)][string]$Executable,
    [string[]]$Arguments = @()
  )

  Write-Host ""
  Write-Host "== $Name ==" -ForegroundColor Cyan

  $global:LASTEXITCODE = 0
  try {
    & $Executable @Arguments
    $exitCode = if ($null -eq $LASTEXITCODE) { 0 } else { [int]$LASTEXITCODE }
  } catch {
    $exitCode = 1
    Write-Warning "${Name}: $($_.Exception.Message)"
  }

  if ($exitCode -ne 0) {
    $failures.Add("$Name (código $exitCode)")
    Write-Warning "$Name falhou. Continuando sem restaurar arquivos."
  } else {
    Write-Host "${Name}: OK" -ForegroundColor Green
  }
}

Push-Location $RepoRoot
try {
  Invoke-NativeValidationStep `
    -Name "Contrato estrutural" `
    -Executable "node" `
    -Arguments @((Join-Path $PackageRoot "scripts\check-dematerialization-pulse-contract.mjs"), $RepoRoot)

  Invoke-NativeValidationStep `
    -Name "Testes do novo pulso" `
    -Executable "npx.cmd" `
    -Arguments @(
      "vitest", "run",
      "src/game/dematerializationPulse.test.js",
      "src/game/components/DematerializationPulseControls.test.jsx",
      "src/game/simulation/planners/DematerializationPulsePlanner.test.js"
    )

  if ($FullValidation) {
    Invoke-NativeValidationStep `
      -Name "Testes de simulação" `
      -Executable "npm.cmd" `
      -Arguments @("run", "test:simulation")

    Invoke-NativeValidationStep `
      -Name "Contrato da IA de simulação" `
      -Executable "npm.cmd" `
      -Arguments @("run", "verify:simulation")

    Invoke-NativeValidationStep `
      -Name "Suíte completa" `
      -Executable "npm.cmd" `
      -Arguments @("test")
  }

  Invoke-NativeValidationStep `
    -Name "Build Vite" `
    -Executable "npm.cmd" `
    -Arguments @("run", "build")
} finally {
  Pop-Location
}

if ($failures.Count -gt 0) {
  Write-Host ""
  Write-Host "Falhas encontradas:" -ForegroundColor Yellow
  $failures | ForEach-Object { Write-Host " - $_" }
  throw "Validação finalizada com $($failures.Count) falha(s). Nenhum rollback automático foi executado."
}

Write-Host ""
Write-Host "Todas as validações solicitadas passaram." -ForegroundColor Green
