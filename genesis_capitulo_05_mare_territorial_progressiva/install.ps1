param(
  [string]$RepoRoot = "",
  [switch]$Validate
)

$ErrorActionPreference = "Stop"
$PackageRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

function Test-GenesisRepo([string]$Path) {
  if ([string]::IsNullOrWhiteSpace($Path)) { return $false }
  return (
    (Test-Path -LiteralPath (Join-Path $Path "package.json") -PathType Leaf) -and
    (Test-Path -LiteralPath (Join-Path $Path "src\game\content.js") -PathType Leaf) -and
    (Test-Path -LiteralPath (Join-Path $Path "src\game\battleModel.js") -PathType Leaf) -and
    (Test-Path -LiteralPath (Join-Path $Path "src\game\GameCanvas.jsx") -PathType Leaf)
  )
}

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
  $ParentRoot = Split-Path -Parent $PackageRoot
  $Candidates = @(
    $ParentRoot,
    (Join-Path $ParentRoot "genesis"),
    $PackageRoot
  ) | Select-Object -Unique

  $RepoRoot = $Candidates |
    Where-Object { Test-GenesisRepo $_ } |
    Select-Object -First 1

  if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    $CandidateText = ($Candidates | ForEach-Object { "  - $_" }) -join [Environment]::NewLine
    throw @"
Não encontrei automaticamente a raiz do projeto Genesis.

Pastas verificadas:
$CandidateText

Execute informando o caminho manualmente:
.\install.ps1 -RepoRoot "C:\Projetos\Genesis" -Validate
"@
  }
}

$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot -ErrorAction Stop).Path
if (-not (Test-GenesisRepo $RepoRoot)) {
  throw "O caminho '$RepoRoot' não parece ser a raiz do Genesis."
}

Write-Host "[INFO] Pacote: $PackageRoot" -ForegroundColor DarkCyan
Write-Host "[INFO] Projeto Genesis: $RepoRoot" -ForegroundColor Cyan

$Script = Join-Path $PackageRoot "apply_changes.py"
$Python = Get-Command py -ErrorAction SilentlyContinue
if ($Python) {
  $PythonArgs = @("-3", $Script, "--repo-root", $RepoRoot)
} else {
  $Python = Get-Command python -ErrorAction SilentlyContinue
  if (-not $Python) {
    throw "Python 3 não encontrado. Instale o Python 3 ou habilite o comando 'py'."
  }
  $PythonArgs = @($Script, "--repo-root", $RepoRoot)
}

if ($Validate) { $PythonArgs += "--validate" }
& $Python.Source @PythonArgs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
