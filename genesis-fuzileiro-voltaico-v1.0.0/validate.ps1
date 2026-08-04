param(
    [string]$RepoRoot = "",
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$PackageRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    $RepoRoot = Split-Path -Parent $PackageRoot
}

& (Join-Path $PackageRoot "install.ps1") -RepoRoot $RepoRoot -Validate -NoBackup -SkipBuild:$SkipBuild
