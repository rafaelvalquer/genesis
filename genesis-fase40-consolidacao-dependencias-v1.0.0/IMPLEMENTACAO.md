# Arquivos modificados

## Existentes

- `src/game/assetCatalog.js`
- `src/game/chapterFivePhases.js`
- `src/game/chapterFiveWaves.js`
- `src/game/missionProvidedAssets.test.js`
- `src/game/chapterFivePhase40Balance.test.js`

## Novos

- `src/game/chapter05/phase40Scenario.js`
- `src/game/phase40Scenario.test.js`

## Compatibilidade

- `resolveBattleTroopAssetIds` continua disponível.
- `createChapterFiveWaves(phaseIndex)` continua funcionando.
- O `battleModel.js` não recebe dependência direta da Fase 40; ele continua
  consumindo genericamente `startingTroops` e `startingTroopRules`.
