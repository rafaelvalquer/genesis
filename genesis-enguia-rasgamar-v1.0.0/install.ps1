[CmdletBinding()]
param(
  [Parameter(Mandatory = $false)]
  [string]$RepoRoot = (Get-Location).Path,

  [switch]$Validate,
  [switch]$CampaignSmoke,
  [switch]$Force,
  [switch]$KeepOnValidationFailure
)

$ErrorActionPreference = "Stop"
$PackageRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$PatchScript = Join-Path $PackageRoot "scripts\apply-patch.mjs"
$RestoreScript = Join-Path $PackageRoot "scripts\restore-patch.mjs"
$ValidateScript = Join-Path $PackageRoot "validate.ps1"
$RepoRoot = [System.IO.Path]::GetFullPath($RepoRoot)

if (!(Test-Path $PatchScript)) {
  throw "Script de instalação não encontrado: $PatchScript"
}

$nodeCommand = Get-Command node -ErrorAction Stop
$patchArgs = @(
  $PatchScript,
  "--repo-root=$RepoRoot"
)
if ($Force) {
  $patchArgs += "--force"
}

Write-Host "Aplicando a nova mecânica da Enguia Rasgamar em: $RepoRoot"
$patchOutput = & $nodeCommand.Source @patchArgs 2>&1
$patchExitCode = $LASTEXITCODE
$patchOutput | ForEach-Object { Write-Host $_ }

if ($patchExitCode -ne 0) {
  throw "A instalação falhou com código $patchExitCode. O instalador executou rollback automático."
}

$manifestLine = $patchOutput |
  Where-Object { "$_" -like "BACKUP_MANIFEST=*" } |
  Select-Object -Last 1
$manifestPath = if ($manifestLine) {
  ("$manifestLine").Substring("BACKUP_MANIFEST=".Length)
} else {
  $null
}

if ($Validate -or $CampaignSmoke) {
  try {
    $validationArgs = @(
      "-NoProfile",
      "-ExecutionPolicy", "Bypass",
      "-File", $ValidateScript,
      "-RepoRoot", $RepoRoot,
      "-Full"
    )
    if ($CampaignSmoke) {
      $validationArgs += "-CampaignSmoke"
    }

    & powershell.exe @validationArgs
    if ($LASTEXITCODE -ne 0) {
      throw "Validação retornou código $LASTEXITCODE."
    }
  }
  catch {
    if (!$KeepOnValidationFailure -and $manifestPath -and (Test-Path $manifestPath)) {
      Write-Warning "A validação falhou. Restaurando automaticamente o estado anterior."
      & $nodeCommand.Source $RestoreScript "--manifest=$manifestPath"
    }
    throw
  }
}

Write-Host ""
Write-Host "Instalação concluída."
if ($manifestPath) {
  Write-Host "Manifesto de backup: $manifestPath"
}
Write-Host "Use .\validate.ps1 -RepoRoot `"$RepoRoot`" -Full para validar novamente."
