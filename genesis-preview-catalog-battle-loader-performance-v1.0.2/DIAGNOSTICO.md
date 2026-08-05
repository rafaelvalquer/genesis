# Diagnóstico

`getAnchoredSpriteRect` permanece exportada em:

```text
src/game/visualGeometry.js
```

O `GameCanvas.jsx` usa a função em três caminhos de renderização:

- halo do Drone Sentinela;
- halo das tropas comuns;
- halo do drone do Operador Jano.

Durante a refatoração do catálogo e dos renderizadores, o import da função foi
removido do bloco de `visualGeometry.js`, embora os três usos diretos tenham
permanecido. JavaScript aceita o arquivo no build, pois uma referência global
não declarada é um erro de runtime, e não necessariamente um erro de parsing.

O erro surge somente quando `drawTroopEntity()` tenta desenhar uma imagem com
halo habilitado.
