# Genesis — Hotfix de import do GameCanvas v1.0.3

Pacote incremental preparado para o commit:

```text
c7dd585eb47c2d9713c7a47b816a814c085d8ea6
```

## Erro corrigido

```text
TypeError: getAnchoredSpriteRect is not a function
```

A versão anterior adicionou `getAnchoredSpriteRect` ao import de `react`:

```javascript
import {
  getAnchoredSpriteRect,
  useCallback,
  useEffect,
  ...
} from "react";
```

A função não pertence ao React. Ela é exportada por:

```text
src/game/visualGeometry.js
```

O resultado é uma referência importada com valor incompatível, que somente
falha quando `drawTroopEntity()` tenta calcular o retângulo do halo.

## Correção aplicada

```javascript
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  getAnchoredSpriteRect,
  getEnemyAnimation,
  ...
} from "./visualGeometry.js";
```

## Causa do hotfix anterior ter validado incorretamente

O aplicador e o teste anteriores usavam uma expressão regular iniciada no
primeiro `import {` do arquivo e terminada em `visualGeometry.js`. Como o padrão
aceitava qualquer conteúdo entre esses pontos, ele capturou vários imports como
se fossem uma única declaração.

Por isso:

- o aplicador inseriu o símbolo no primeiro import, o do React;
- o teste encontrou o texto dentro da captura ampla;
- a validação passou mesmo com a origem incorreta.

A versão 1.0.3 localiza cada declaração `import` individualmente, identifica o
seu `from` e altera somente a declaração do módulo exato.

## Proteções

O novo verificador confirma:

- ausência de `getAnchoredSpriteRect` no import de `react`;
- presença exatamente uma vez no import de `./visualGeometry.js`;
- exportação real como função;
- execução do cálculo com dimensões válidas.

## Instalação

```powershell
cd "C:\Projetos\Genesis\genesis-gamecanvas-anchor-import-hotfix-v1.0.3"

.\install.ps1 `
  -RepoRoot "C:\Projetos\Genesis" `
  -Validate
```

Sem gerar build:

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

## Backup

```text
.genesis-backups/gamecanvas-anchor-import-AAAAMMDD-HHMMSS
```

Qualquer falha restaura os arquivos anteriores.
