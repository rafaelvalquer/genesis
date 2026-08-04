param(
    [string]$RepoRoot = "",
    [switch]$Validate,
    [switch]$NoBackup,
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$PackageRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

function Test-GenesisRoot([string]$Path) {
    return (Test-Path (Join-Path $Path "package.json")) `
        -and (Test-Path (Join-Path $Path "src\game\content.js")) `
        -and (Test-Path (Join-Path $Path "src\game\battleModel.js"))
}

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    $Candidates = @(
        (Get-Location).Path,
        (Split-Path -Parent $PackageRoot),
        $PackageRoot
    ) | Select-Object -Unique

    foreach ($Candidate in $Candidates) {
        if (Test-GenesisRoot $Candidate) {
            $RepoRoot = $Candidate
            break
        }
    }
}

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    throw "Informe -RepoRoot com a raiz do Genesis. Exemplo: .\install.ps1 -RepoRoot 'C:\Projetos\Genesis'"
}

$RepoRoot = [System.IO.Path]::GetFullPath($RepoRoot)
if (-not (Test-GenesisRoot $RepoRoot)) {
    throw "RepoRoot inválido: $RepoRoot. A pasta deve conter package.json e src\game."
}

$Node = Get-Command node -ErrorAction SilentlyContinue
if (-not $Node) {
    throw "Node.js não encontrado no PATH."
}

$ApplyArgs = @((Join-Path $PackageRoot "apply_changes.mjs"), "--repo-root", $RepoRoot)
if ($NoBackup) {
    $ApplyArgs += "--no-backup"
}

Write-Host "Aplicando Fuzileiro Voltaico em: $RepoRoot" -ForegroundColor Cyan
& $Node.Source @ApplyArgs
if ($LASTEXITCODE -ne 0) {
    throw "Falha ao aplicar a implementação."
}

& $Node.Source (Join-Path $PackageRoot "verify_changes.mjs") --repo-root $RepoRoot
if ($LASTEXITCODE -ne 0) {
    throw "Falha na verificação estrutural."
}

if ($Validate) {
    Push-Location $RepoRoot
    try {
        Write-Host "Executando testes focados..." -ForegroundColor Cyan
        npm test -- src/game/fuzileiroVoltaico.test.js src/game/fuzileiroVoltaico.integration.test.js
        if ($LASTEXITCODE -ne 0) {
            throw "Os testes focados falharam."
        }

        if (-not $SkipBuild) {
            Write-Host "Executando build completo..." -ForegroundColor Cyan
            npm run build
            if ($LASTEXITCODE -ne 0) {
                throw "O build completo falhou."
            }
        }
    }
    finally {
        Pop-Location
    }
}

Write-Host "Fuzileiro Voltaico instalado com sucesso." -ForegroundColor Green
