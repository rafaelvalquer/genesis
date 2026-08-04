param(
  [Parameter(Mandatory = $true)]
  [string]$RepoRoot,
  [switch]$Validate,
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$PackageRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = (Resolve-Path $RepoRoot).Path

if (-not (Test-Path (Join-Path $RepoRoot "package.json"))) {
  throw "package.json não encontrado em: $RepoRoot"
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js não encontrado no PATH."
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = Join-Path $RepoRoot ".genesis-backups\bastiao-mare-v1.1.0-$stamp"
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null

$backupFiles = @(
  "src/game/content.js",
  "src/game/battleModel.js",
  "src/game/projectileRenderer.js",
  "src/game/bastiaoMare.js",
  "src/game/bastiaoMare.test.js",
  "src/game/bastiaoMare.integration.test.js"
)
foreach ($relative in $backupFiles) {
  $source = Join-Path $RepoRoot $relative
  if (Test-Path $source) {
    $destination = Join-Path $backupRoot $relative
    New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
    Copy-Item $source $destination -Force
  }
}

Write-Host "Backup criado em: $backupRoot"
node (Join-Path $PackageRoot "apply_changes.mjs") $RepoRoot
if ($LASTEXITCODE -ne 0) { throw "Falha ao aplicar alterações." }

node (Join-Path $PackageRoot "verify_changes.mjs") $RepoRoot
if ($LASTEXITCODE -ne 0) { throw "Falha na verificação estrutural." }

if ($Validate) {
  Push-Location $RepoRoot
  try {
    npm test -- src/game/bastiaoMare.test.js src/game/bastiaoMare.integration.test.js
    if ($LASTEXITCODE -ne 0) { throw "Os testes do Bastião falharam." }
    if (-not $SkipBuild) {
      npm run build
      if ($LASTEXITCODE -ne 0) { throw "O build falhou." }
    }
  }
  finally { Pop-Location }
}

Write-Host "`nAtualização v1.1.0 concluída."
