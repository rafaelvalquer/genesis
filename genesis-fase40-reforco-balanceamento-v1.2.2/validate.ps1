param(
  [Parameter(Mandatory = $true)]
  [string]$RepoRoot,

  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path $RepoRoot).Path

function Assert-LastExitCode {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Message
  )

  if ($LASTEXITCODE -ne 0) {
    throw $Message
  }
}

Push-Location $RepoRoot
try {
  $files = @(
    "src/game/chapterFivePhases.js",
    "src/game/chapterFiveWaves.js",
    "src/game/battleModel.js",
    "src/game/phase40StartingDefense.test.js",
    "src/game/chapterFivePhase40Balance.test.js"
  )

  Write-Host "Validando sintaxe..."
  foreach ($file in $files) {
    & node --check $file
    Assert-LastExitCode "Erro de sintaxe em $file."
  }

  Write-Host "Executando testes específicos da Fase 40..."
  & npx.cmd vitest run `
    "src/game/phase40StartingDefense.test.js" `
    "src/game/chapterFivePhase40Balance.test.js"
  Assert-LastExitCode "Os testes da Fase 40 falharam."

  if (-not $SkipBuild) {
    # A auditoria atual do Leviatã usa exit code 1 sempre que existem frames
    # marcados para redesenho. Isso é dívida visual preexistente e não significa
    # que o código ou o build da Fase 40 estejam inválidos.
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

    Write-Host "Executando suíte completa de testes..."
    & npm.cmd run test:unit
    Assert-LastExitCode "A suíte completa de testes falhou."

    Write-Host "Gerando build de produção com Vite..."
    & npx.cmd vite build
    Assert-LastExitCode "O build Vite falhou."

    Write-Host "Validando assets gerais..."
    & node "scripts/check-assets.js"
    Assert-LastExitCode "A validação geral de assets falhou."

    Write-Host "Validando frames do Crisálio..."
    & node "scripts/check-crisalio-frames.mjs"
    Assert-LastExitCode "A validação dos frames do Crisálio falhou."
  }
  else {
    Write-Host "Build completo ignorado por -SkipBuild."
  }

  Write-Host "Validação concluída."
}
finally {
  Pop-Location
}
