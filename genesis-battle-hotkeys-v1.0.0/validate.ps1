[CmdletBinding()]
param(
  [string]$RepoRoot = (Get-Location).Path,
  [switch]$Full
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path $RepoRoot).Path

function Invoke-NativeStep {
  param(
    [string]$Label,
    [string]$Command,
    [string[]]$Arguments
  )
  Write-Host ""
  Write-Host "== $Label ==" -ForegroundColor Cyan
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Label retornou código $LASTEXITCODE."
  }
}

$npm = if (Get-Command npm.cmd -ErrorAction SilentlyContinue) { "npm.cmd" } else { "npm" }

Push-Location $RepoRoot
try {
  Invoke-NativeStep "Sintaxe do módulo de hotkeys" "node" @("--check", "src/game/battleHotkeys.js")
  Invoke-NativeStep "Contrato da integração" "node" @("scripts/check-battle-hotkeys-contract.mjs", $RepoRoot)
  Invoke-NativeStep "Testes das hotkeys" $npm @("exec", "--", "vitest", "run", "src/game/battleHotkeys.test.js")

  if ($Full) {
    Invoke-NativeStep "Testes unitários do jogo" $npm @("run", "test:unit")
    Invoke-NativeStep "Build de produção" $npm @("run", "build")
  }

  Write-Host ""
  Write-Host "Validação concluída com sucesso." -ForegroundColor Green
}
finally {
  Pop-Location
}
