param(
  [Parameter(Mandatory = $true)]
  [string]$RepoRoot,

  [switch]$Validate,
  [switch]$FullSuite,
  [switch]$SkipBuild,
  [switch]$AllowDifferentCommit
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path -Path $RepoRoot).Path
$PackageRoot = $PSScriptRoot
$ExpectedCommit = "c7dd585eb47c2d9713c7a47b816a814c085d8ea6"

$hasPackageJson = Test-Path -Path (Join-Path -Path $RepoRoot -ChildPath "package.json")
$hasGameCanvas = Test-Path -Path (Join-Path -Path $RepoRoot -ChildPath "src\game\GameCanvas.jsx")
$hasVisualGeometry = Test-Path -Path (Join-Path -Path $RepoRoot -ChildPath "src\game\visualGeometry.js")
$validRepository = $hasPackageJson -and $hasGameCanvas -and $hasVisualGeometry

if (-not $validRepository) {
  throw "O caminho informado não parece ser a raiz do Genesis: $RepoRoot"
}

$gitDirectory = Join-Path -Path $RepoRoot -ChildPath ".git"

if (Test-Path -Path $gitDirectory) {
  $currentCommitValue = & git -C $RepoRoot rev-parse HEAD 2>$null

  if (($LASTEXITCODE -eq 0) -and $currentCommitValue) {
    $currentCommit = "$currentCommitValue".Trim()
    $commitMismatch = $currentCommit -ne $ExpectedCommit

    if ($commitMismatch -and (-not $AllowDifferentCommit)) {
      throw "Este hotfix foi preparado para o commit $ExpectedCommit, mas o repositório está em $currentCommit. Use -AllowDifferentCommit somente após revisar as diferenças."
    }
  }
}

$relativeFiles = @(
  "package.json",
  "src\game\GameCanvas.jsx",
  "scripts\gamecanvas-import-tools.mjs",
  "scripts\check-gamecanvas-render-dependencies.mjs",
  "src\game\GameCanvasRenderDependencies.test.js"
)

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = Join-Path -Path $RepoRoot -ChildPath ".genesis-backups\gamecanvas-anchor-import-$timestamp"
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null

$existingFiles = @{}

foreach ($relative in $relativeFiles) {
  $source = Join-Path -Path $RepoRoot -ChildPath $relative

  if (Test-Path -Path $source) {
    $destination = Join-Path -Path $backupRoot -ChildPath $relative
    $destinationDirectory = Split-Path -Path $destination -Parent

    New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
    Copy-Item -Path $source -Destination $destination -Force
    $existingFiles[$relative] = $true
  }
}

Write-Host "Backup criado em: $backupRoot"

try {
  $applyScript = Join-Path -Path $PackageRoot -ChildPath "apply_changes.mjs"
  & node $applyScript $RepoRoot

  if ($LASTEXITCODE -ne 0) {
    throw "Falha ao corrigir os imports do GameCanvas."
  }

  $verifyScript = Join-Path -Path $PackageRoot -ChildPath "verify_changes.mjs"
  & node $verifyScript $RepoRoot

  if ($LASTEXITCODE -ne 0) {
    throw "Falha na verificação estrutural do hotfix."
  }

  if ($Validate) {
    $validateScript = Join-Path -Path $PackageRoot -ChildPath "validate.ps1"
    $validationParameters = @{
      RepoRoot = $RepoRoot
      FullSuite = $FullSuite
      SkipBuild = $SkipBuild
    }

    & $validateScript @validationParameters
  }

  Write-Host ""
  Write-Host "Hotfix de import do GameCanvas instalado com sucesso."
}
catch {
  Write-Warning "A instalação falhou. Restaurando os arquivos anteriores."

  foreach ($relative in $relativeFiles) {
    $target = Join-Path -Path $RepoRoot -ChildPath $relative

    if ($existingFiles.ContainsKey($relative)) {
      $backup = Join-Path -Path $backupRoot -ChildPath $relative
      $targetDirectory = Split-Path -Path $target -Parent

      New-Item -ItemType Directory -Path $targetDirectory -Force | Out-Null
      Copy-Item -Path $backup -Destination $target -Force
    }
    elseif (Test-Path -Path $target) {
      Remove-Item -Path $target -Force
    }
  }

  throw
}
