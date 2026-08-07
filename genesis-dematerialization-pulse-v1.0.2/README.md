# Genesis — Pulso de Desmaterialização Tático v1.0.2

Implementação baseada na `main` do repositório `rafaelvalquer/genesis`, commit-base `ea680da7fb3aea143ec19b8842d5d362ec86c0f7` (`genesis_0.3_CameraFinalV2`).

## O que muda

- Mantém o disparo automático do canhão quando um inimigo alcança a barreira.
- Permite disparar manualmente qualquer canhão `ready` durante a onda.
- O pulso deixa de eliminar toda a rota e passa a retirar **500 HP de cada inimigo válido da rota**.
- Inimigos que sobrevivem continuam normalmente em combate.
- Cada canhão continua sendo de uso único por batalha/fase (`ready -> charging -> spent`).
- O carregamento existente de 2 segundos é preservado.
- Adiciona controles HTML sobre os canhões com estados `DISPARAR`, `CARREGANDO` e `DESCARREGADO`.
- Impede disparo manual em rota sem inimigos válidos.
- Integra a nova ação à IA de simulação/testes de fase.
- A IA avalia risco da rota, tropas críticas, frontline, proximidade da base, bosses/Alpha e dano útil do pulso.
- Adiciona parâmetros do pulso ao genoma do `PolicyOptimizer`.
- Adiciona métricas de ativação, dano, kills e dano por rota.

## Arquitetura

```text
battleModel.js
   │
   ├── automático na barreira
   ├── API pública para player/IA
   │
   ▼
dematerializationPulse.js
   ├── configuração (500 HP)
   ├── estado ready/charging/spent
   ├── validação e ativação
   └── estimativas compartilhadas com IA

GameCanvas.jsx
   └── DematerializationPulseControls.jsx

simulation/
   ├── observation/createBattleObservation.js
   ├── planners/DematerializationPulsePlanner.js
   ├── ai/StrategicAgent.js
   ├── engine/simulationActions.js
   ├── strategies/strategyProfiles.js
   ├── optimization/PolicyOptimizer.js
   └── metrics/SimulationMetrics.js
```

## Instalação

Feche `npm run dev`, extraia o ZIP e execute:

```powershell
cd "C:\Projetos\Genesis\genesis-dematerialization-pulse-v1.0.2"
.\install.ps1 -RepoRoot "C:\Projetos\Genesis" -FullValidation
```

O instalador cria backup dos arquivos que serão alterados, mas **não executa rollback automático** se uma validação falhar.

## Validação

Sem `-FullValidation`:
- contrato estrutural;
- testes novos do domínio e planner;
- build.

Com `-FullValidation` também executa:
- `npm run test:simulation`;
- `npm run verify:simulation`;
- `npm test`;
- `npm run build`.

## Correção v1.0.2

Esta versão corrige a chamada do `install.ps1` para o `validate.ps1`. A v1.0.1 usava splatting de um array (`@validateArgs`), que envia os valores como argumentos posicionais e fazia `C:\Projetos\Genesis` chegar sem associação ao parâmetro `-RepoRoot`.

A v1.0.2 chama o validador com parâmetros nomeados explicitamente:

```powershell
& $validator -RepoRoot $RepoRoot -FullValidation
```

Quando `-FullValidation` não é solicitado:

```powershell
& $validator -RepoRoot $RepoRoot
```

Pode ser executada diretamente sobre uma instalação v1.0.0/v1.0.1 já aplicada; não restaure os arquivos. A política de **nenhum rollback automático** permanece.
