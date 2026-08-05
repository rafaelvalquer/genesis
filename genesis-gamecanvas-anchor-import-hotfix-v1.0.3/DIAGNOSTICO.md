# Diagnóstico técnico

## Estado encontrado

`GameCanvas.jsx` importa `getAnchoredSpriteRect` de `react`, enquanto o bloco de
`./visualGeometry.js` não contém a função.

A função continua definida e exportada corretamente em `visualGeometry.js`.

## Por que o erro mudou

Antes do primeiro hotfix:

```text
ReferenceError: getAnchoredSpriteRect is not defined
```

Depois do hotfix incorreto:

```text
TypeError: getAnchoredSpriteRect is not a function
```

A mudança indica que o identificador passou a existir, mas recebeu um valor que
não é chamável. Isso ocorreu porque ele veio do módulo errado.

## Caminho da falha

```text
loop
→ drawBattle
→ drawBattleRows
→ drawTroopEntity
→ getAnchoredSpriteRect(...)
→ TypeError
```

O caminho é acionado quando uma tropa possui imagem válida e o halo está
habilitado.
