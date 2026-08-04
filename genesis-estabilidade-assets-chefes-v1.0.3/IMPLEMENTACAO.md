# Arquivos afetados

## Modificados

- `package.json`
- `src/game/assetCatalog.js`
- `src/game/content.js`
- `src/game/battleModel.js`
- `src/game/chapterFivePhases.js`
- `src/game/chapterFiveWaves.js`
- `src/game/chapter05/phase40Scenario.js`
- testes existentes da Fase 40

## Novos

- `.editorconfig`
- `.gitattributes`
- `scripts/check-encoding.mjs`
- `src/game/systems/bossEncounterSystem.js`
- testes de carregamento, concorrência e encontro com chefe

## Compatibilidade

- `resolveBattleTroopAssetIds` permanece disponível.
- `createChapterFiveWaves(phaseIndex)` permanece disponível para índices 0–7.
- aliases anteriores de scripts de assets não são removidos.
- a regra de 48 inimigos simultâneos da Fase 40 permanece inalterada.
