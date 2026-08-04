param(
  [Parameter(Mandatory = $true)]
  [string]$RepoRoot,
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path $RepoRoot).Path
Push-Location $RepoRoot
try {
  npm test -- src/game/phase40StartingDefense.test.js
  if ($LASTEXITCODE -ne 0) { throw "Os testes da fase 40 falharam." }
  if (-not $SkipBuild) {
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "O build falhou." }
  }
}
finally { Pop-Location }
