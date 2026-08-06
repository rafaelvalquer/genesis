# Genesis — Nova mecânica da Enguia Rasgamar v1.0.0

Base validada: `rafaelvalquer/genesis` no commit
`842c9baaad8c6f7f1ce8b75129e32135300aeb40`.

O pacote aplica a nova lógica sem publicar alterações no GitHub.

## Comportamento implementado

1. A Enguia mantém o comportamento atual enquanto sua rota possui tropas.
2. Quando sua rota fica sem tropas, ela procura outra rota com tropas.
3. Primeiro são consideradas rotas sem outra Enguia, inclusive sem uma Enguia já a caminho.
4. Entre as rotas elegíveis, vence a que possui mais tropas.
5. Em empate, são considerados valor estratégico das tropas, quantidade de alvos prioritários, distância e número da rota.
6. Quando todas as rotas com tropas já possuem Enguia, é escolhida a rota com mais tropas.
7. A mudança ocorre por mergulho e deslocamento submerso, mantendo a Enguia inalvejável.
8. Quando não resta nenhuma tropa no campo, a Enguia emerge e ataca a base à distância repetidamente.
9. O ataque respeita escudos, invulnerabilidade do laboratório, multiplicador da onda e derrota por integridade zero.
10. Caso uma nova tropa seja posicionada durante o assalto à base, a Enguia interrompe o ciclo após reavaliar o campo.

## Instalação

Extraia o ZIP e execute no PowerShell:

```powershell
cd "C:\Projetos\Genesis\genesis-enguia-rasgamar-v1.0.0"

.\install.ps1 `
  -RepoRoot "C:\Projetos\Genesis" `
  -Validate
```

`-Validate` executa:

- verificação sintática dos arquivos modificados;
- verificação do contrato da funcionalidade;
- testes unitários específicos da Enguia;
- testes unitários do jogo;
- build de produção.

Para também executar uma simulação rápida das fases aquáticas:

```powershell
.\install.ps1 `
  -RepoRoot "C:\Projetos\Genesis" `
  -Validate `
  -CampaignSmoke
```

Em caso de falha na validação, o instalador restaura automaticamente os arquivos anteriores. Use `-KeepOnValidationFailure` somente para depuração.

## Validação manual

```powershell
.\validate.ps1 `
  -RepoRoot "C:\Projetos\Genesis" `
  -Full
```

Com smoke test da campanha:

```powershell
.\validate.ps1 `
  -RepoRoot "C:\Projetos\Genesis" `
  -Full `
  -CampaignSmoke
```

## Desinstalação e rollback

```powershell
.\uninstall.ps1 `
  -RepoRoot "C:\Projetos\Genesis"
```

O instalador mantém os backups em:

```text
C:\Projetos\Genesis\.genesis-backups\enguia-rasgamar-v1.0.0\
```

## Testar todas as fases que possuem Enguia Rasgamar

No ambiente analisado, as fases do capítulo 5 usam pacotes que incluem a Enguia Rasgamar. Execute diretamente com Node para evitar o problema do `npm.ps1` no PowerShell 5.1:

```powershell
cd "C:\Projetos\Genesis"

node .\scripts\simulate-campaign.mjs `
  --phases="fase_33,fase_34,fase_35,fase_36,fase_37,fase_38,fase_39,fase_40" `
  --strategies="balanced,defensive,economic,aggressive" `
  --seeds="1001,1013,1031,1061,1091" `
  --workers=8 `
  --action-log-limit=5000 `
  --max-duration-ms=3600000 `
  --out-dir="reports\enguia-rasgamar-v1"
```

Quantidade esperada:

```text
8 fases × 4 estratégias × 5 seeds = 160 execuções
```

Cabeçalho esperado:

```text
Simulação da campanha: 8 fases · 4 estratégia(s) · 5 seed(s) · 160 execução(ões)
```

Alternativa com o executável correto do npm no Windows:

```powershell
npm.cmd run simulate:campaign -- `
  --phases="fase_33,fase_34,fase_35,fase_36,fase_37,fase_38,fase_39,fase_40" `
  --strategies="balanced,defensive,economic,aggressive" `
  --seeds="1001,1013,1031,1061,1091" `
  --workers=8 `
  --action-log-limit=5000 `
  --max-duration-ms=3600000 `
  --out-dir="reports\enguia-rasgamar-v1"
```

## Teste rápido de uma fase

```powershell
node .\scripts\simulate-campaign.mjs `
  --phases="fase_33" `
  --strategies="balanced" `
  --seeds="1001" `
  --workers=1 `
  --action-log-limit=5000 `
  --out-dir="reports\enguia-fase-33-smoke"
```

## Eventos adicionados

- `rasgamarRelocationStarted`
- `rasgamarRelocationCompleted`
- `rasgamarBaseAssaultStarted`
- `rasgamarBaseAttack`

Esses eventos permitem identificar no log quando a Enguia mudou de rota ou atacou a base.

## Arquivos modificados

- `src/game/battleModel.js`
- `src/game/content.js`
- `src/game/enemyTargeting.js`
- `src/game/visualGeometry.js`
- `src/game/enemies/chapter05/enguiaRasgamar.js`

## Arquivos adicionados

- `src/game/enemies/chapter05/enguiaRasgamarTactics.js`
- `src/game/enemies/chapter05/enguiaRasgamarTactics.test.js`
- `scripts/check-rasgamar-relocation-contract.mjs`
