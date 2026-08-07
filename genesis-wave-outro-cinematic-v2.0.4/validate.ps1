[CmdletBinding()]
param(
  [string]$RepoRoot = (Get-Location).Path,
  [switch]$Full
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path $RepoRoot).Path
$Failures = @()

function Invoke-ValidationStep {
  param([string]$Label, [scriptblock]$Command)
  Write-Host ""
  Write-Host "== $Label ==" -ForegroundColor Cyan
  Push-Location $RepoRoot
  try {
    & $Command
    if ($LASTEXITCODE -ne 0) {
      $script:Failures += "$Label retornou código $LASTEXITCODE."
      Write-Host "FALHOU: $Label" -ForegroundColor Red
    } else {
      Write-Host "OK: $Label" -ForegroundColor Green
    }
  }
  catch {
    $script:Failures += "${Label}: $($_.Exception.Message)"
    Write-Host "FALHOU: $Label - $($_.Exception.Message)" -ForegroundColor Red
  }
  finally {
    Pop-Location
  }
}

Invoke-ValidationStep "Contrato estrutural do final de onda" {
  node scripts/check-wave-outro-contract.mjs .
}

Invoke-ValidationStep "Smoke de montagem da batalha" {
  node scripts/check-wave-outro-runtime.mjs .
}

Invoke-ValidationStep "Testes específicos do final da onda" {
  npm.cmd exec -- vitest run `
    src/game/waveOutro/waveOutroProfiles.test.js `
    src/game/waveOutro/waveOutroCamera.test.js
}

Invoke-ValidationStep "Build" {
  npm.cmd run build
}

if ($Full) {
  Invoke-ValidationStep "Suíte completa" {
    npm.cmd test
  }
}

if ($Failures.Count -gt 0) {
  Write-Host ""
  Write-Host "Validação concluída com $($Failures.Count) falha(s)." -ForegroundColor Yellow
  $Failures | ForEach-Object { Write-Host " - $_" -ForegroundColor Yellow }
  Write-Host "IMPORTANTE: nenhum arquivo foi restaurado." -ForegroundColor Yellow
  throw ($Failures -join " | ")
}

Write-Host ""
Write-Host "Todas as validações executadas passaram." -ForegroundColor Green
