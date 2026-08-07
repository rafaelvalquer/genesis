[CmdletBinding()]
param(
  [string]$RepoRoot = (Get-Location).Path,
  [switch]$Full
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path $RepoRoot).Path

function Invoke-Step([string]$Label, [scriptblock]$Command) {
  Write-Host ""
  Write-Host "== $Label ==" -ForegroundColor Cyan
  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "$Label retornou código $LASTEXITCODE."
  }
}

Push-Location $RepoRoot
try {
  Invoke-Step "Contrato da integração" {
    node .\scripts\check-wave-outro-cinematic-contract.mjs $RepoRoot
  }

  Invoke-Step "Sintaxe dos módulos JS" {
    node --check .\src\game\waveOutro\waveOutroProfiles.js
    if ($LASTEXITCODE -ne 0) { throw "waveOutroProfiles.js inválido." }
    node --check .\src\game\waveOutro\waveOutroCamera.js
    if ($LASTEXITCODE -ne 0) { throw "waveOutroCamera.js inválido." }
    node --check .\src\game\waveOutro\waveOutroAudio.js
  }

  Invoke-Step "Testes específicos do final da onda" {
    npm.cmd exec vitest -- run src/game/waveOutro src/game/GameCanvas.test.jsx src/game/battleModel.test.js
  }

  if ($Full) {
    Invoke-Step "Contrato do simulador" {
      npm.cmd run verify:simulation
    }
    Invoke-Step "Testes unitários do jogo" {
      npm.cmd run test:unit
    }
    Invoke-Step "Testes do simulador" {
      npm.cmd run test:simulation
    }
    Invoke-Step "Build de produção" {
      npm.cmd run build
    }
  }

  Write-Host ""
  Write-Host "Validação concluída com sucesso." -ForegroundColor Green
}
finally {
  Pop-Location
}
