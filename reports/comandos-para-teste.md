# Guia de uso do Simulador Automático com IA — Genesis

## 1. Visão geral

O simulador executa as fases do Genesis sem abrir a interface gráfica do jogo.

Ele utiliza o mesmo motor lógico da batalha para:

- criar a sessão;
- montar o loadout;
- posicionar tropas;
- iniciar ondas;
- repor tropas eliminadas;
- usar habilidades especiais;
- escolher vantagens táticas;
- utilizar assistência adaptativa;
- executar as ondas até vitória, derrota, deadlock ou timeout;
- gerar relatórios em JSON, CSV e Markdown.

Os comandos devem ser executados na raiz do projeto:

```powershell
cd "C:\Projetos\Genesis"
```

---

## 2. Estratégias disponíveis

As estratégias devem ser informadas em inglês e com letras minúsculas:

```text
balanced
defensive
economic
aggressive
```

| Estratégia   | Comportamento geral                                                                    |
| ------------ | -------------------------------------------------------------------------------------- |
| `balanced`   | Equilibra ataque, defesa, suporte e economia.                                          |
| `defensive`  | Mantém maior reserva de energia, espera mais antes das ondas e prioriza sobrevivência. |
| `economic`   | Investe mais em geração de energia durante a primeira parte da fase.                   |
| `aggressive` | Prioriza dano, inicia ondas mais cedo e mantém menor reserva energética.               |

Essas estratégias são perfis iniciais. O otimizador pode alterar os parâmetros e o loadout para encontrar uma política mais eficiente para uma fase específica.

---

## 3. O que é uma seed

A seed é o número que inicializa a aleatoriedade da batalha.

Ela pode influenciar:

- ordem dos inimigos;
- distribuição dos inimigos entre as rotas;
- escolha de rotas para pacotes coordenados;
- sequências aleatórias utilizadas pelo motor.

A mesma combinação tende a produzir a mesma execução:

```text
mesma fase
+ mesma estratégia
+ mesma seed
= mesma variação da batalha
```

Exemplo:

```powershell
npm run simulate:phase -- `
  --phase=fase_10 `
  --strategy=aggressive `
  --seed=1001
```

Para comparar estratégias de forma justa, utilize sempre as mesmas seeds.

Para avaliar confiabilidade, execute várias seeds:

```powershell
--seeds=1001,1013,1031,1061,1091
```

---

# 4. Testar uma fase específica

## Aggressive

```powershell
npm run simulate:phase -- `
  --phase=fase_10 `
  --strategy=aggressive `
  --seed=1001
```

## Economic

```powershell
npm run simulate:phase -- `
  --phase=fase_10 `
  --strategy=economic `
  --seed=1001
```

## Defensive

```powershell
npm run simulate:phase -- `
  --phase=fase_10 `
  --strategy=defensive `
  --seed=1001
```

## Balanced

```powershell
npm run simulate:phase -- `
  --phase=fase_10 `
  --strategy=balanced `
  --seed=1001
```

---

# 5. Comparar estratégias com a mesma seed

Use a mesma fase e a mesma seed:

```powershell
npm run simulate:phase -- `
  --phase=fase_25 `
  --strategy=balanced `
  --seed=1001
```

```powershell
npm run simulate:phase -- `
  --phase=fase_25 `
  --strategy=defensive `
  --seed=1001
```

```powershell
npm run simulate:phase -- `
  --phase=fase_25 `
  --strategy=economic `
  --seed=1001
```

```powershell
npm run simulate:phase -- `
  --phase=fase_25 `
  --strategy=aggressive `
  --seed=1001
```

## Preservar os quatro resultados

O arquivo padrão da fase é sobrescrito a cada execução:

```text
reports/fase_25-simulation.json
reports/fase_25-simulation.csv
reports/fase_25-simulation.md
```

Utilize diretórios separados:

```powershell
npm run simulate:phase -- `
  --phase=fase_25 `
  --strategy=balanced `
  --seed=1001 `
  --out-dir=reports\fase_25\balanced
```

```powershell
npm run simulate:phase -- `
  --phase=fase_25 `
  --strategy=defensive `
  --seed=1001 `
  --out-dir=reports\fase_25\defensive
```

```powershell
npm run simulate:phase -- `
  --phase=fase_25 `
  --strategy=economic `
  --seed=1001 `
  --out-dir=reports\fase_25\economic
```

```powershell
npm run simulate:phase -- `
  --phase=fase_25 `
  --strategy=aggressive `
  --seed=1001 `
  --out-dir=reports\fase_25\aggressive
```

---

# 6. Testar uma fase com várias seeds

Uma única seed pode favorecer ou prejudicar uma estratégia.

## Aggressive

```powershell
npm run simulate:phase -- `
  --phase=fase_25 `
  --strategy=aggressive `
  --seeds=1001,1013,1031,1061,1091
```

## Economic

```powershell
npm run simulate:phase -- `
  --phase=fase_25 `
  --strategy=economic `
  --seeds=1001,1013,1031,1061,1091
```

## Defensive

```powershell
npm run simulate:phase -- `
  --phase=fase_25 `
  --strategy=defensive `
  --seeds=1001,1013,1031,1061,1091
```

## Balanced

```powershell
npm run simulate:phase -- `
  --phase=fase_25 `
  --strategy=balanced `
  --seeds=1001,1013,1031,1061,1091
```

---

# 7. Testar várias fases

## Estratégia Aggressive

```powershell
npm run simulate:campaign -- `
  --phases=fase_01,fase_02,fase_03,fase_04,fase_05 `
  --strategies=aggressive `
  --seeds=1001 `
  --workers=5
```

## Estratégia Economic

```powershell
npm run simulate:campaign -- `
  --phases=fase_01,fase_02,fase_03,fase_04,fase_05 `
  --strategies=economic `
  --seeds=1001 `
  --workers=5
```

## Estratégia Defensive

```powershell
npm run simulate:campaign -- `
  --phases=fase_01,fase_02,fase_03,fase_04,fase_05 `
  --strategies=defensive `
  --seeds=1001 `
  --workers=5
```

## Estratégia Balanced

```powershell
npm run simulate:campaign -- `
  --phases=fase_01,fase_02,fase_03,fase_04,fase_05 `
  --strategies=balanced `
  --seeds=1001 `
  --workers=5
```

---

# 8. Testar todas as fases com uma estratégia

## Todas com Aggressive

```powershell
npm run simulate:campaign -- `
  --strategies=aggressive `
  --seeds=1001 `
  --workers=11
```

## Todas com Economic

```powershell
npm run simulate:campaign -- `
  --strategies=economic `
  --seeds=1001 `
  --workers=11
```

## Todas com Defensive

```powershell
npm run simulate:campaign -- `
  --strategies=defensive `
  --seeds=1001 `
  --workers=11
```

## Todas com Balanced

```powershell
npm run simulate:campaign -- `
  --strategies=balanced `
  --seeds=1001 `
  --workers=11
```

---

# 9. Testar todas as estratégias juntas

## Uma seed

```powershell
npm run simulate:campaign -- `
  --strategies=balanced,defensive,economic,aggressive `
  --seeds=1001 `
  --workers=11
```

Quantidade de execuções:

```text
40 fases × 4 estratégias × 1 seed
= 160 partidas
```

## Três seeds

```powershell
npm run simulate:campaign -- `
  --strategies=balanced,defensive,economic,aggressive `
  --seeds=1001,1013,1031 `
  --workers=11
```

Quantidade de execuções:

```text
40 fases × 4 estratégias × 3 seeds
= 480 partidas
```

## Cinco seeds

```powershell
npm run simulate:campaign -- `
  --strategies=balanced,defensive,economic,aggressive `
  --seeds=1001,1013,1031,1061,1091 `
  --workers=11
```

Quantidade de execuções:

```text
40 fases × 4 estratégias × 5 seeds
= 800 partidas
```

---

# 10. Comparar estratégias em fases problemáticas

Para investigar fases que apresentaram deadlock ou timeout:

```powershell
npm run simulate:campaign -- `
  --phases=fase_33,fase_34,fase_37,fase_38,fase_39,fase_40 `
  --strategies=balanced,defensive,economic,aggressive `
  --seeds=1001 `
  --workers=6 `
  --action-log-limit=1000 `
  --out-dir=reports\diagnostico-fases-problematicas
```

Para uma análise mais confiável:

```powershell
npm run simulate:campaign -- `
  --phases=fase_33,fase_34,fase_37,fase_38,fase_39,fase_40 `
  --strategies=balanced,defensive,economic,aggressive `
  --seeds=1001,1013,1031 `
  --workers=11 `
  --action-log-limit=1000 `
  --out-dir=reports\diagnostico-fases-problematicas-multiseed
```

---

# 11. Registrar as ações da IA

Por padrão, a campanha rápida armazena poucas ações.

Para analisar posicionamento, reposição, habilidades e início das ondas:

```powershell
npm run simulate:campaign -- `
  --phases=fase_10 `
  --strategies=aggressive `
  --seeds=1001 `
  --workers=1 `
  --action-log-limit=2000 `
  --out-dir=reports\diagnostico-fase_10
```

## Carregar o relatório no PowerShell

```powershell
$report = Get-Content `
  ".\reports\diagnostico-fase_10\campaign-simulation.json" `
  -Raw |
  ConvertFrom-Json

$run = $report.runs[0]
```

## Ver todas as ações

```powershell
$run.actions |
  Select-Object `
    elapsed,
    type,
    troopId,
    row,
    col,
    reason,
    optionId,
    ok |
  Format-Table -AutoSize
```

## Ver somente posicionamentos e reposições

```powershell
$run.actions |
  Where-Object {
    $_.type -eq "place"
  } |
  Select-Object `
    elapsed,
    troopId,
    row,
    col,
    reason,
    ok |
  Format-Table -AutoSize
```

Possíveis motivos:

```text
strategic
emergency
replacement
```

| Motivo        | Significado                             |
| ------------- | --------------------------------------- |
| `strategic`   | Implantação planejada pela estratégia.  |
| `emergency`   | Reforço urgente de uma rota ameaçada.   |
| `replacement` | Reposição após eliminação de uma tropa. |

## Ver início das ondas

```powershell
$run.actions |
  Where-Object {
    $_.type -eq "startWave"
  } |
  Select-Object `
    elapsed,
    reason,
    ok |
  Format-Table -AutoSize
```

Possíveis motivos:

```text
readiness
preparationTimeout
```

| Motivo               | Significado                                                |
| -------------------- | ---------------------------------------------------------- |
| `readiness`          | A IA considerou a formação pronta.                         |
| `preparationTimeout` | O limite de preparação foi atingido e a onda foi iniciada. |

## Ver habilidades, decisões e assistência

```powershell
$run.actions |
  Where-Object {
    $_.type -in @(
      "activateSpecial",
      "selectDecision",
      "selectAdaptiveAid",
      "openAdaptiveAid"
    )
  } |
  Select-Object `
    elapsed,
    type,
    troopId,
    optionId,
    reason,
    ok |
  Format-Table -AutoSize
```

---

# 12. Testar sem assistência adaptativa

Para medir a capacidade da estratégia sem ajuda:

```powershell
npm run simulate:campaign -- `
  --phases=fase_01,fase_02,fase_03,fase_04,fase_05 `
  --strategies=balanced,defensive,economic,aggressive `
  --seeds=1001 `
  --no-aid=true `
  --workers=5 `
  --out-dir=reports\comparativo-sem-assistencia
```

Comparar com assistência:

```powershell
npm run simulate:campaign -- `
  --phases=fase_01,fase_02,fase_03,fase_04,fase_05 `
  --strategies=balanced,defensive,economic,aggressive `
  --seeds=1001 `
  --workers=5 `
  --out-dir=reports\comparativo-com-assistencia
```

---

# 13. Aumentar o limite de fases longas

O limite padrão é de 30 minutos simulados.

Para permitir até 60 minutos:

```powershell
npm run simulate:phase -- `
  --phase=fase_40 `
  --strategy=aggressive `
  --seed=1001 `
  --max-duration-ms=3600000
```

Comparar todos os perfis na fase 40:

```powershell
npm run simulate:campaign -- `
  --phases=fase_40 `
  --strategies=balanced,defensive,economic,aggressive `
  --seeds=1001 `
  --workers=4 `
  --max-duration-ms=3600000 `
  --action-log-limit=2000 `
  --out-dir=reports\comparativo-fase_40
```

---

# 14. Executar em modo estrito

No modo normal, deadlocks, timeouts e estados inválidos são registrados como avisos.

Para o comando retornar erro quando encontrar uma falha técnica:

```powershell
npm run simulate:campaign -- `
  --strategies=aggressive `
  --seeds=1001 `
  --strict=true
```

Validar um relatório existente em modo estrito:

```powershell
npm run verify:simulation:report:strict
```

O modo estrito é indicado para CI ou para uma campanha que já deveria estar tecnicamente estável.

---

# 15. Otimizar uma estratégia para uma fase

O otimizador ajusta:

- loadout;
- quantidade de economia;
- reserva de energia;
- prioridade ofensiva;
- prioridade defensiva;
- prioridade de suporte;
- risco necessário para reforço;
- prontidão para iniciar a onda;
- uso de habilidades.

## Começando pelo perfil Aggressive

```powershell
npm run optimize:phase -- `
  --phase=fase_25 `
  --strategy=aggressive `
  --generations=8 `
  --population=12 `
  --loadout-candidates=10 `
  --seeds=1001,1013,1031,1061 `
  --out-dir=reports\otimizacao-fase_25-aggressive
```

## Começando pelo perfil Economic

```powershell
npm run optimize:phase -- `
  --phase=fase_25 `
  --strategy=economic `
  --generations=8 `
  --population=12 `
  --loadout-candidates=10 `
  --seeds=1001,1013,1031,1061 `
  --out-dir=reports\otimizacao-fase_25-economic
```

## Busca mais extensa

```powershell
npm run optimize:phase -- `
  --phase=fase_25 `
  --strategy=balanced `
  --generations=20 `
  --population=24 `
  --loadout-candidates=16 `
  --seeds=1001,1013,1031,1061,1091,1123,1151,1181 `
  --out-dir=reports\otimizacao-fase_25-completa
```

O resultado principal será gravado em:

```text
reports\<diretorio-informado>\fase_25-optimized-strategy.json
```

---

# 16. Otimizar todas as fases

## Otimização rápida

```powershell
npm run optimize:campaign -- `
  --quick=true
```

## Otimização completa

```powershell
npm run optimize:campaign -- `
  --generations=8 `
  --population=12 `
  --loadout-candidates=10 `
  --seeds=1001,1013,1031,1061,1091
```

O resultado será gravado em:

```text
reports/phase-strategies.json
```

Executar a campanha com as estratégias otimizadas:

```powershell
npm run simulate:campaign -- `
  --strategy-file=reports\phase-strategies.json `
  --strategies=optimized `
  --seeds=1001,1013,1031,1061,1091 `
  --workers=11 `
  --out-dir=reports\campanha-otimizada
```

---

# 17. Relatórios gerados

Uma execução de campanha gera:

```text
campaign-simulation.json
campaign-simulation.csv
campaign-simulation.md
simulation-failures.json
```

Por padrão:

```text
C:\Projetos\Genesis\reports\
```

Com `--out-dir`:

```text
C:\Projetos\Genesis\<diretório informado>\
```

Exemplo:

```powershell
npm run simulate:campaign -- `
  --phases=fase_01,fase_02,fase_03,fase_04,fase_05 `
  --strategies=aggressive `
  --seeds=1001 `
  --workers=5 `
  --out-dir=reports\aggressive-fases-01-05
```

Resultado:

```text
reports\aggressive-fases-01-05\campaign-simulation.json
reports\aggressive-fases-01-05\campaign-simulation.csv
reports\aggressive-fases-01-05\campaign-simulation.md
reports\aggressive-fases-01-05\simulation-failures.json
```

## Verificar os arquivos

```powershell
Get-ChildItem `
  ".\reports\aggressive-fases-01-05"
```

## Abrir o Markdown

```powershell
Get-Content `
  ".\reports\aggressive-fases-01-05\campaign-simulation.md"
```

## Abrir o CSV no Excel

```powershell
Start-Process `
  ".\reports\aggressive-fases-01-05\campaign-simulation.csv"
```

---

# 18. Entender resultados com zero estrelas

No simulador, uma vitória recebe pelo menos uma estrela.

Portanto, `0★` normalmente indica:

```text
defeat
deadlock
timeout
invalidState
```

| Resultado      | Significado                                                                               |
| -------------- | ----------------------------------------------------------------------------------------- |
| `defeat`       | A IA jogou a fase, mas a base foi destruída.                                              |
| `deadlock`     | A simulação ficou sem progresso durante o limite configurado.                             |
| `timeout`      | A batalha não terminou antes do tempo máximo.                                             |
| `invalidState` | Foi detectado um estado inválido, como `NaN`, recurso negativo ou entidade inconsistente. |

## Listar todas as fases com zero estrelas

```powershell
$report = Get-Content `
  ".\reports\campaign-simulation.json" `
  -Raw |
  ConvertFrom-Json

$report.runs |
  Where-Object {
    $_.stars -eq 0
  } |
  Select-Object `
    phaseId,
    strategyId,
    seed,
    outcome,
    failureReason,
    timeout,
    @{
      Name = "deadlock"
      Expression = {
        [bool]$_.deadlock
      }
    },
    @{
      Name = "invalidState"
      Expression = {
        [bool]$_.invalidState
      }
    } |
  Format-Table -AutoSize
```

## Executar o diagnóstico automático

```powershell
npm run diagnose:simulation
```

---

# 19. O que fazer quando muitas fases têm zero estrelas

Não altere o balanceamento do jogo imediatamente.

Execute o processo abaixo:

```text
1. Identificar defeat, deadlock, timeout ou invalidState.
2. Reproduzir a fase usando a mesma estratégia e seed.
3. Aumentar o action-log-limit.
4. Conferir o loadout escolhido.
5. Conferir posicionamentos e reposições.
6. Conferir o momento de início das ondas.
7. Comparar as quatro estratégias.
8. Testar de três a cinco seeds.
9. Executar o otimizador.
10. Alterar a IA ou a fase somente após o diagnóstico.
```

## Reproduzir uma falha

```powershell
npm run simulate:campaign -- `
  --phases=fase_33 `
  --strategies=balanced `
  --seeds=1001 `
  --workers=1 `
  --action-log-limit=3000 `
  --out-dir=reports\diagnostico-fase_33
```

## Comparar todas as estratégias

```powershell
npm run simulate:campaign -- `
  --phases=fase_33 `
  --strategies=balanced,defensive,economic,aggressive `
  --seeds=1001,1013,1031,1061,1091 `
  --workers=8 `
  --action-log-limit=1000 `
  --out-dir=reports\comparativo-fase_33
```

---

# 20. Interpretar a taxa de vitória

Referência inicial para análise da IA:

| Taxa de vitória | Interpretação                                              |
| --------------: | ---------------------------------------------------------- |
|      80% a 100% | Estratégia confiável para as seeds testadas.               |
|       50% a 79% | Estratégia razoável, mas sensível à variação.              |
|       20% a 49% | Estratégia fraca ou fase severa.                           |
|        1% a 19% | Forte sinal de incompatibilidade entre IA, loadout e fase. |
|              0% | Investigar antes de alterar o balanceamento.               |

Esses valores são indicadores de engenharia. Eles não substituem testes humanos de diversão e dificuldade.

---

# 21. Ver os loadouts utilizados

```powershell
$report = Get-Content `
  ".\reports\campaign-simulation.json" `
  -Raw |
  ConvertFrom-Json

$report.runs |
  Sort-Object `
    phaseId,
    strategyId,
    seed |
  Select-Object `
    phaseId,
    strategyId,
    seed,
    outcome,
    stars,
    @{
      Name = "loadout"
      Expression = {
        $_.loadout -join ", "
      }
    } |
  Format-Table -AutoSize
```

## Ver somente uma fase

```powershell
$report.runs |
  Where-Object {
    $_.phaseId -eq "fase_25"
  } |
  Select-Object `
    phaseId,
    strategyId,
    seed,
    outcome,
    stars,
    @{
      Name = "loadout"
      Expression = {
        $_.loadout -join ", "
      }
    } |
  Format-Table -AutoSize
```

---

# 22. Ver a melhor estratégia por fase

O relatório pode ser agrupado por fase e estratégia:

```powershell
$report.runs |
  Group-Object `
    phaseId,
    strategyId |
  ForEach-Object {
    $runs = $_.Group
    $victories = @(
      $runs |
      Where-Object {
        $_.outcome -eq "victory"
      }
    )

    [PSCustomObject]@{
      PhaseStrategy = $_.Name
      Runs = $runs.Count
      Victories = $victories.Count
      VictoryRate = if ($runs.Count -gt 0) {
        [math]::Round(
          $victories.Count / $runs.Count * 100,
          1
        )
      } else {
        0
      }
      AverageStars = if ($victories.Count -gt 0) {
        [math]::Round(
          (
            $victories |
            Measure-Object `
              -Property stars `
              -Average
          ).Average,
          2
        )
      } else {
        0
      }
    }
  } |
  Sort-Object `
    PhaseStrategy |
  Format-Table -AutoSize
```

---

# 23. Comando recomendado para a próxima análise

Compare as quatro estratégias nas fases 1 a 10 usando três seeds:

```powershell
npm run simulate:campaign -- `
  --phases=fase_01,fase_02,fase_03,fase_04,fase_05,fase_06,fase_07,fase_08,fase_09,fase_10 `
  --strategies=balanced,defensive,economic,aggressive `
  --seeds=1001,1013,1031 `
  --workers=11 `
  --action-log-limit=300 `
  --out-dir=reports\comparativo-fases-01-10
```

Quantidade de execuções:

```text
10 fases × 4 estratégias × 3 seeds
= 120 partidas
```

Relatórios:

```text
reports\comparativo-fases-01-10\campaign-simulation.md
reports\comparativo-fases-01-10\campaign-simulation.csv
reports\comparativo-fases-01-10\campaign-simulation.json
reports\comparativo-fases-01-10\simulation-failures.json
```

---

# 24. Cuidados com os comandos no PowerShell

## Acento grave

O caractere de continuação é o acento grave:

```text
`
```

Ele deve ser o último caractere da linha.

Correto:

```powershell
npm run simulate:phase -- `
  --phase=fase_10 `
  --strategy=balanced `
  --seed=1001
```

Incorreto:

```powershell
npm run simulate:phase -- `
```

No exemplo incorreto existe um espaço depois do acento grave.

## Separador `--`

O primeiro `--` informa ao npm que os próximos parâmetros devem ser enviados para o script:

```powershell
npm run simulate:campaign -- `
```

## Workers

Os workers executam batalhas em paralelo.

Por isso, as fases podem aparecer fora de ordem no console:

```text
fase_09 pode terminar antes da fase_01
```

Isso não altera o conteúdo do relatório.

## Sobrescrita dos relatórios

Toda nova execução que usa o mesmo `--out-dir` substitui:

```text
campaign-simulation.json
campaign-simulation.csv
campaign-simulation.md
simulation-failures.json
```

Use uma pasta diferente para cada comparação importante.

---

# 25. Resumo dos principais comandos

| Objetivo             | Comando                                   |
| -------------------- | ----------------------------------------- |
| Uma fase             | `npm run simulate:phase`                  |
| Várias fases         | `npm run simulate:campaign`               |
| Campanha rápida      | `npm run simulate:campaign:quick`         |
| Otimizar uma fase    | `npm run optimize:phase`                  |
| Otimizar campanha    | `npm run optimize:campaign`               |
| Diagnosticar falhas  | `npm run diagnose:simulation`             |
| Validar relatório    | `npm run verify:simulation:report`        |
| Validar estritamente | `npm run verify:simulation:report:strict` |
| Testar contrato      | `npm run verify:simulation`               |
| Smoke test           | `npm run test:simulation:smoke`           |
