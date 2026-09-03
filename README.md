# Genesis Defense

Tower defense em React/Vite com simulação determinística, campanha por capítulos, renderização Canvas e pipelines próprios de assets.

## Requisitos

- Node.js LTS
- npm

## Executar localmente

```bash
npm ci
npm run dev
```

Build de produção:

```bash
npm run build
```

## Qualidade e testes

Gate completo usado na `main`:

```bash
npm run ci
```

Comandos úteis:

```bash
npm run test:unit
npm run test:chapter-seven
npm run test:icaro
npm run validate:game-content
npm run verify:repository-hygiene
```

## Estrutura principal

```text
src/                  aplicação e runtime do jogo
src/game/             domínio, simulação, render e UI da batalha
src/game/assets/      assets consumidos em runtime
art/                  fontes e referências artísticas versionadas
art/qa/               referências visuais permanentes de QA
docs/                 documentação técnica e de gameplay
scripts/              geração, auditoria e quality gates
reports/              relatórios controlados de simulação
artifacts/            outputs locais/CI gerados (não versionados)
```

> `artifacts/`, `.codex-tmp/` e `.genesis-backups/` são diretórios locais/gerados e não devem ser commitados.

## Assets

O runtime usa `src/game/assets/`. Fontes e materiais de produção ficam em `art/` e são transformados pelos scripts de `assets:*` quando necessário. Referências visuais permanentes de auditoria devem ficar em `art/qa/`; relatórios ou imagens temporárias devem ir para `artifacts/`.

Exemplo do pipeline do Interceptador Ícaro:

```bash
npm run assets:interceptador-icaro
npm run audit:interceptador-icaro
```

## Arquitetura da batalha

A tela de batalha é composta por fronteiras separadas:

```text
BattleScreen
├── useBattleController
├── useBattleInteractions
├── BattleCanvas
├── battleFrameSimulation
├── battleFrameProgress
├── battleStepEvents
└── battleFrameRenderer
    └── battleLayerRenderer
        └── EnvironmentRegistry
```

A `GameCanvas.jsx` existe apenas como façade de compatibilidade para consumidores antigos. Código novo deve importar `BattleScreen.jsx` ou os módulos específicos de render/input.

## Regras de contribuição

- Não colocar lógica de gameplay dentro de renderers.
- Render não deve modificar a `battle session`.
- Novos contratos de assets/visuais devem passar por `npm run validate:game-content`.
- Não versionar backups, workspaces temporários ou outputs gerados.
- Previews permanentes ficam em `art/qa/` ou `docs/images/`.
- Antes de enviar alterações, execute `npm run ci`.
