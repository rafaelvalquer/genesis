param(
  [Parameter(Mandatory=$true)]
  [string]$RepoRoot,
  [switch]$FullValidation
)

$ErrorActionPreference = "Continue"
$PackageRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = (Resolve-Path $RepoRoot).Path
$failures = New-Object System.Collections.Generic.List[string]

function Invoke-ValidationStep {
  param([string]$Name, [scriptblock]$Command)
  Write-Host "" 
  Write-Host "== $Name ==" -ForegroundColor Cyan
  & $Command
  if ($LASTEXITCODE -ne 0) {
    $failures.Add("$Name (código $LASTEXITCODE)")
    Write-Warning "$Name falhou. Continuando sem restaurar arquivos."
  } else {
    Write-Host "$Name: OK" -ForegroundColor Green
  }
}

Push-Location $RepoRoot
try {
  Invoke-ValidationStep "Contrato estrutural" {
    node (Join-Path $PackageRoot "scripts\check-dematerialization-pulse-contract.mjs") $RepoRoot
  }
  Invoke-ValidationStep "Testes do novo pulso" {
    & npx.cmd vitest run src/game/dematerializationPulse.test.js src/game/components/DematerializationPulseControls.test.jsx src/game/simulation/planners/DematerializationPulsePlanner.test.js
  }

  if ($FullValidation) {
    Invoke-ValidationStep "Testes de simulação" { & npm.cmd run test:simulation }
    Invoke-ValidationStep "Contrato da IA de simulação" { & npm.cmd run verify:simulation }
    Invoke-ValidationStep "Suíte completa" { & npm.cmd test }
  }

  Invoke-ValidationStep "Build Vite" { & npm.cmd run build }
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
