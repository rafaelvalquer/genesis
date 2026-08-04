param(
  [Parameter(Mandatory = $true)]
  [string]$RepoRoot,
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$PackageRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = (Resolve-Path $RepoRoot).Path
node (Join-Path $PackageRoot "verify_changes.mjs") $RepoRoot
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Push-Location $RepoRoot
try {
  npm test -- src/game/bastiaoMare.test.js src/game/bastiaoMare.integration.test.js
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  if (-not $SkipBuild) {
    npm run build
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  }
}
finally { Pop-Location }
