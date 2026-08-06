[CmdletBinding()]
param(
  [Parameter(Mandatory = $false)]
  [string]$RepoRoot = (Get-Location).Path,

  [switch]$Full,
  [switch]$CampaignSmoke
)

$ErrorActionPreference = "Stop"
$RepoRoot = [System.IO.Path]::GetFullPath($RepoRoot)
$nodeCommand = Get-Command node -ErrorAction Stop

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Label,

    [Parameter(Mandatory = $true)]
    [scriptblock]$Command
  )

  Write-Host ""
  Write-Host "== $Label =="
  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "$Label falhou com código $LASTEXITCODE."
  }
}

if (!(Test-Path (Join-Path $RepoRoot "package.json"))) {
  throw "package.json não encontrado em $RepoRoot"
}

Push-Location $RepoRoot
try {
  $syntaxFiles = @(
    "src\game\battleModel.js",
    "src\game\content.js",
    "src\game\enemyTargeting.js",
    "src\game\visualGeometry.js",
    "src\game\enemies\chapter05\enguiaRasgamar.js",
    "src\game\enemies\chapter05\enguiaRasgamarTactics.js",
    "scripts\check-rasgamar-relocation-contract.mjs"
  )

  foreach ($file in $syntaxFiles) {
    Invoke-Checked "Sintaxe: $file" {
      & $nodeCommand.Source --check $file
    }
  }

  Invoke-Checked "Contrato da mecânica" {
    & $nodeCommand.Source ".\scripts\check-rasgamar-relocation-contract.mjs" $RepoRoot
  }

  $vitestPath = Join-Path $RepoRoot "node_modules\vitest\vitest.mjs"
  if (!(Test-Path $vitestPath)) {
    throw "Dependências não instaladas. Execute npm.cmd install antes da validação."
  }

  Invoke-Checked "Testes unitários da Enguia Rasgamar" {
    & $nodeCommand.Source $vitestPath run "src/game/enemies/chapter05/enguiaRasgamarTactics.test.js"
  }

  if ($Full) {
    $npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if (!$npmCommand) {
      $npmCommand = Get-Command npm -ErrorAction Stop
    }

    Invoke-Checked "Testes unitários do jogo" {
      & $npmCommand.Source run test:unit
    }

    Invoke-Checked "Build de produção" {
      & $npmCommand.Source run build
    }
  }

  if ($CampaignSmoke) {
    $outDir = "reports\rasgamar-relocation-smoke"
    Invoke-Checked "Simulação focada nas fases da Enguia" {
      & $nodeCommand.Source ".\scripts\simulate-campaign.mjs" `
        "--phases=fase_33,fase_34,fase_35,fase_36,fase_37,fase_38,fase_39,fase_40" `
        "--strategies=balanced" `
        "--seeds=1001" `
        "--workers=4" `
        "--action-log-limit=2000" `
        "--max-duration-ms=3600000" `
        "--out-dir=$outDir"
    }
  }

  Write-Host ""
  Write-Host "Validação concluída com sucesso."
}
finally {
  Pop-Location
}
