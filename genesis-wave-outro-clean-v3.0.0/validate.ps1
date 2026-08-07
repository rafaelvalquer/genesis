[CmdletBinding()]
param(
  [string]$RepoRoot = (Get-Location).Path,
  [switch]$Full
)

$ErrorActionPreference = "Stop"
$PackageRoot = $PSScriptRoot
$RepoRoot = (Resolve-Path $RepoRoot).Path
$failures = @()

function Run-Step([string]$Label, [scriptblock]$Action) {
  Write-Host "`n== $Label =="
  & $Action
  if ($LASTEXITCODE -ne 0) {
    $script:failures += "$Label (código $LASTEXITCODE)"
  }
}

Run-Step "Contrato estrutural" {
  node (Join-Path $PackageRoot "scripts\check-architecture.mjs") $RepoRoot
}

Push-Location $RepoRoot
try {
  Run-Step "Testes direcionados de waveOutro" {
    npm.cmd test -- `
      src/game/waveOutro/waveOutroProfiles.test.js `
      src/game/waveOutro/waveOutroCamera.test.js `
      src/game/waveOutro/waveOutroAudio.test.js `
      src/game/waveOutro/WaveOutroCinematicOverlay.test.jsx
  }

  Run-Step "Build Vite" {
    npm.cmd run build
  }

  if ($Full) {
    Run-Step "Suite completa" {
      npm.cmd test
    }
  }
} finally {
  Pop-Location
}

if ($failures.Count -gt 0) {
  throw ("Falhas de validação: " + ($failures -join "; "))
}

Write-Host "`nValidação concluída sem falhas."
