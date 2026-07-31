param(
    [string]$RepoRoot = "",
    [switch]$Validate,
    [switch]$SkipTestRestore
)

$ErrorActionPreference = "Stop"
$PackageRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Python = Get-Command python -ErrorAction SilentlyContinue
if (-not $Python) {
    $Python = Get-Command py -ErrorAction SilentlyContinue
}
if (-not $Python) {
    throw "Python 3 não foi encontrado no PATH."
}

$Arguments = @("$PackageRoot\apply_fix.py")
if ($RepoRoot) {
    $Arguments += @("--repo-root", $RepoRoot)
}
if ($Validate) {
    $Arguments += "--validate"
}
if ($SkipTestRestore) {
    $Arguments += "--skip-test-restore"
}

if ($Python.Name -eq "py.exe" -or $Python.Name -eq "py") {
    & $Python.Source -3 @Arguments
} else {
    & $Python.Source @Arguments
}
if ($LASTEXITCODE -ne 0) {
    throw "A instalação da correção falhou com código $LASTEXITCODE."
}
