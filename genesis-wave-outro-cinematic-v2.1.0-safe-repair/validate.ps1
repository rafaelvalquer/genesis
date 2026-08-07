[CmdletBinding()]
param([string]$RepoRoot = (Get-Location).Path,[switch]$Full)
$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path $RepoRoot).Path
$Failures = @()
function Run-Step { param([string]$Label,[scriptblock]$Command)
  Write-Host ""; Write-Host "== $Label ==" -ForegroundColor Cyan; Push-Location $RepoRoot
  try { & $Command; if ($LASTEXITCODE -ne 0) { $script:Failures += "$Label retornou código $LASTEXITCODE."; Write-Host "FALHOU: $Label" -ForegroundColor Red } else { Write-Host "OK: $Label" -ForegroundColor Green } }
  catch { $script:Failures += "${Label}: $($_.Exception.Message)"; Write-Host "FALHOU: $Label - $($_.Exception.Message)" -ForegroundColor Red }
  finally { Pop-Location }
}
Run-Step "Contrato do reparo seguro" { node (Join-Path $PSScriptRoot "scripts\check-safe-repair.mjs") . }
Run-Step "Build" { npm.cmd run build }
if ($Full) { Run-Step "Suíte completa" { npm.cmd test } }
if ($Failures.Count -gt 0) { Write-Host ""; Write-Host "Validação com falhas; arquivos mantidos." -ForegroundColor Yellow; $Failures | % { Write-Host " - $_" -ForegroundColor Yellow }; throw ($Failures -join " | ") }
Write-Host ""; Write-Host "Validações executadas passaram." -ForegroundColor Green
