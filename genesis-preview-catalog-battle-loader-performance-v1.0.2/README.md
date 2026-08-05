# Genesis — Hotfix do GameCanvas v1.0.2

Pacote incremental preparado para o commit:

```text
9e647adfcfa73a27141f7d2c10661dc3dcfa7c08
```

## Falha corrigida

Ao iniciar a batalha, o navegador apresentava:

```text
ReferenceError: getAnchoredSpriteRect is not defined
```

`drawTroopEntity()` usa `getAnchoredSpriteRect()` para calcular o retângulo do
sprite antes de desenhar o halo de tropas comuns, Drone Sentinela e Operador
Jano. A função continua exportada por `visualGeometry.js`, mas deixou de ser
importada por `GameCanvas.jsx` durante a extração de `battleSceneRenderer.js`.

## Alteração

O hotfix adiciona novamente:

```javascript
import {
  getAnchoredSpriteRect,
  ...
} from "./visualGeometry.js";
```

Nenhuma fórmula gráfica, escala, âncora, cache ou comportamento de batalha foi
alterado.

## Proteção contra regressão

Foi criado:

```text
scripts/check-gamecanvas-render-dependencies.mjs
```

Comando:

```text
npm run verify:gamecanvas-render-dependencies
```

Também foi adicionado:

```text
src/game/GameCanvasRenderDependencies.test.js
```

O teste verifica que:

- `GameCanvas.jsx` usa `getAnchoredSpriteRect`;
- o símbolo é importado de `visualGeometry.js`;
- `visualGeometry.js` continua exportando a função;
- o cálculo retorna dimensões finitas.

## Instalação

```powershell
cd "C:\Projetos\Genesis\genesis-preview-catalog-battle-loader-performance-v1.0.2"

.\install.ps1 `
  -RepoRoot "C:\Projetos\Genesis" `
  -Validate
```

Sem build:

```powershell
.\install.ps1 `
  -RepoRoot "C:\Projetos\Genesis" `
  -Validate `
  -SkipBuild
```

Em outro commit:

```powershell
.\install.ps1 `
  -RepoRoot "C:\Projetos\Genesis" `
  -Validate `
  -AllowDifferentCommit
```

## Backup e rollback

O backup é criado em:

```text
.genesis-backups/gamecanvas-anchor-AAAAMMDD-HHMMSS
```

Qualquer falha restaura os arquivos anteriores.
