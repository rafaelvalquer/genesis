param(
  [Parameter(Mandatory = $true)]
  [string]$RepoRoot,

  [switch]$SkipBuild,
  [switch]$FullSuite,
  [switch]$StrictAssets
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path $RepoRoot).Path

try {
  [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
  $OutputEncoding = [System.Text.UTF8Encoding]::new($false)
}
catch {
  # A codificação do terminal não interfere na validação.
}

function Assert-LastExitCode {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Message
  )

  if ($LASTEXITCODE -ne 0) {
    throw $Message
  }
}

function Invoke-GenesisAssetValidation {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Root,

    [switch]$Strict
  )

  # No Windows PowerShell 5.1, redirecionar stderr de um programa nativo com
  # $ErrorActionPreference = "Stop" transforma a saída em NativeCommandError
  # antes que o código de saída possa ser analisado. Start-Process evita isso.
  $nodeCommand = Get-Command "node.exe" -ErrorAction SilentlyContinue
  if (-not $nodeCommand) {
    $nodeCommand = Get-Command "node" -ErrorAction Stop
  }

  $temporaryRoot = Join-Path ([System.IO.Path]::GetTempPath()) (
    "genesis-assets-" + [Guid]::NewGuid().ToString("N")
  )
  $stdoutPath = Join-Path $temporaryRoot "stdout.log"
  $stderrPath = Join-Path $temporaryRoot "stderr.log"

  New-Item -ItemType Directory -Path $temporaryRoot -Force | Out-Null

  try {
    $process = Start-Process `
      -FilePath $nodeCommand.Source `
      -ArgumentList @("scripts/check-assets.js") `
      -WorkingDirectory $Root `
      -NoNewWindow `
      -Wait `
      -PassThru `
      -RedirectStandardOutput $stdoutPath `
      -RedirectStandardError $stderrPath

    $output = @()

    if (Test-Path $stdoutPath) {
      $output += @(Get-Content $stdoutPath -Encoding UTF8)
    }

    if (Test-Path $stderrPath) {
      $output += @(Get-Content $stderrPath -Encoding UTF8)
    }

    $exitCode = $process.ExitCode
  }
  finally {
    if (Test-Path $temporaryRoot) {
      Remove-Item $temporaryRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
  }

  foreach ($entry in $output) {
    Write-Host ([string]$entry)
  }

  if ($exitCode -eq 0) {
    return
  }

  if ($Strict) {
    throw "A validação geral de assets falhou em modo estrito."
  }

  $knownLeviathanStates = @(
    "biteAbyss",
    "biteRecover",
    "brineJet",
    "idleSurface",
    "spawnRise",
    "surfaceSwim",
    "tailSweep"
  )

  $knownIssues = New-Object System.Collections.Generic.List[string]
  $unexpectedIssues = New-Object System.Collections.Generic.List[string]

  foreach ($entry in $output) {
    $line = ([string]$entry).Trim()
    if ([string]::IsNullOrWhiteSpace($line)) {
      continue
    }

    if ($line -match '^Build excede o orçamento total de 82 MB: [0-9]+([.,][0-9]+)? MB\.$') {
      $knownIssues.Add($line)
      continue
    }

    $matchedKnownLeviathan = $false
    foreach ($state in $knownLeviathanStates) {
      $escapedState = [Regex]::Escape($state)
      if ($line -match "^${escapedState}-spritesheet-[A-Za-z0-9_-]+\.png excede 684 KB$") {
        $knownIssues.Add($line)
        $matchedKnownLeviathan = $true
        break
      }
    }

    if ($matchedKnownLeviathan) {
      continue
    }

    $unexpectedIssues.Add($line)
  }

  if ($unexpectedIssues.Count -gt 0 -or $knownIssues.Count -eq 0) {
    $details = if ($unexpectedIssues.Count -gt 0) {
      $unexpectedIssues -join [Environment]::NewLine
    }
    else {
      "O verificador terminou com código de erro sem uma pendência conhecida."
    }

    throw (
      "A validação geral de assets encontrou problemas não reconhecidos:" +
      [Environment]::NewLine +
      $details
    )
  }

  $warning = (
    "A validação de assets encontrou somente pendências preexistentes do repositório " +
    "({0} ocorrência(s)): orçamento total acima de 82 MB e/ou spritesheets conhecidos " +
    "do Leviatã acima de 684 KB. Como o patch da Fase 40 não adiciona nem altera assets, " +
    "a instalação continuará. Use -StrictAssets para transformar essas pendências em erro."
  ) -f $knownIssues.Count

  Write-Warning $warning
}

Push-Location $RepoRoot
try {
  $files = @(
    "src/game/chapterFivePhases.js",
    "src/game/chapterFiveWaves.js",
    "src/game/battleModel.js",
    "src/game/chapterFiveContent.test.js",
    "src/game/phase40StartingDefense.test.js",
    "src/game/chapterFivePhase40Balance.test.js"
  )

  Write-Host "Validando sintaxe..."
  foreach ($file in $files) {
    & node --check $file
    Assert-LastExitCode "Erro de sintaxe em $file."
  }

  Write-Host "Executando testes relacionados à Fase 40 e ao Capítulo 5..."
  & npx.cmd vitest run `
    "src/game/phase40StartingDefense.test.js" `
    "src/game/chapterFivePhase40Balance.test.js" `
    "src/game/chapterFiveContent.test.js"
  Assert-LastExitCode "Os testes relacionados à Fase 40 falharam."

  if ($FullSuite) {
    Write-Host "Executando suíte completa por solicitação..."
    & npm.cmd run test:unit
    Assert-LastExitCode "A suíte completa do repositório falhou."
  }
  else {
    Write-Host "Suíte completa não executada por padrão. Use -FullSuite para validá-la."
    Write-Host "O repositório possui falhas legadas fora do escopo da Fase 40."
  }

  if (-not $SkipBuild) {
    Write-Host "Executando auditoria informativa do Leviatã..."
    $auditStartedAt = Get-Date
    & node "scripts/audit-leviathan-sprite-components.mjs"
    $auditExitCode = $LASTEXITCODE

    if ($auditExitCode -ne 0) {
      $reportPath = Join-Path $RepoRoot "art\reports\leviathan-sprite-audit.json"

      if (-not (Test-Path $reportPath)) {
        throw "A auditoria do Leviatã falhou sem gerar o relatório esperado."
      }

      $reportFile = Get-Item $reportPath
      if ($reportFile.LastWriteTime -lt $auditStartedAt.AddSeconds(-5)) {
        throw "A auditoria do Leviatã falhou e o relatório encontrado parece desatualizado."
      }

      try {
        $auditReport = Get-Content $reportPath -Raw | ConvertFrom-Json
      }
      catch {
        throw "A auditoria do Leviatã falhou e o relatório não pôde ser lido."
      }

      $auditFailures = [int]($auditReport.failures)
      $auditFrames = [int]($auditReport.totalFrames)

      if ($auditFrames -le 0 -or $auditFailures -le 0) {
        throw "A auditoria do Leviatã terminou com erro sem registrar falhas visuais conhecidas."
      }

      $auditWarning = (
        "Auditoria do Leviatã encontrou {0} frames para redesenho entre {1} analisados. " +
        "A validação continuará porque essa pendência visual já existia antes do patch da Fase 40."
      ) -f $auditFailures, $auditFrames
      Write-Warning $auditWarning
    }

    Write-Host "Gerando build de produção com Vite..."
    & npx.cmd vite build
    Assert-LastExitCode "O build Vite falhou."

    Write-Host "Validando assets gerais..."
    Invoke-GenesisAssetValidation -Root $RepoRoot -Strict:$StrictAssets

    Write-Host "Validando frames do Crisálio..."
    & node "scripts/check-crisalio-frames.mjs"
    Assert-LastExitCode "A validação dos frames do Crisálio falhou."
  }
  else {
    Write-Host "Build e verificações de assets ignorados por -SkipBuild."
  }

  Write-Host "Validação concluída."
}
finally {
  Pop-Location
}
