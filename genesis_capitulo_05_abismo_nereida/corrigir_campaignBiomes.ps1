param(
  [string]$RepoRoot = ""
)

$ErrorActionPreference = "Stop"
$PackageRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Script = Join-Path $PackageRoot "repair_campaign_biomes.py"

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
  $RepoRoot = Split-Path -Parent $PackageRoot
}

Write-Host "[INFO] Corrigindo campaignBiomes.js em: $RepoRoot" -ForegroundColor Cyan

$Python = Get-Command py -ErrorAction SilentlyContinue
if ($Python) {
  & $Python.Source -3 $Script --repo-root $RepoRoot
} else {
  $Python = Get-Command python -ErrorAction SilentlyContinue
  if (-not $Python) {
    throw "Python 3 não encontrado. Instale o Python 3 ou habilite o comando 'py'."
  }
  & $Python.Source $Script --repo-root $RepoRoot
}

if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "[SUCESSO] Correção aplicada. Execute npm run dev novamente." -ForegroundColor Green
