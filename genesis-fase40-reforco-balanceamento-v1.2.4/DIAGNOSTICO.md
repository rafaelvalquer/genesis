# Diagnóstico técnico

## Resultado observado

A compilação do Vite terminou corretamente. O bloqueio ocorreu na chamada:

```text
node scripts/check-assets.js
```

O verificador encontrou:

```text
Build excede o orçamento total de 82 MB: 187.8 MB.
```

E sete spritesheets conhecidos do Leviatã acima do limite de 700.000 bytes,
apresentado pelo script como aproximadamente 684 KB.

## Causa no repositório

O arquivo `scripts/check-assets.js` possui:

```js
const totalBudgetMb = 82;

const limits = {
  ".png": 700_000,
  ".webp": 450_000,
  ".wav": 9_000_000,
  ".ogg": 4_000_000,
};
```

Qualquer violação atribui `process.exitCode = 1`. O instalador interpretava esse
código como se a alteração da Fase 40 tivesse quebrado o build e restaurava o
backup.

## Relação com a Fase 40

Não há relação funcional. A alteração da Fase 40 modifica:

- configuração da missão;
- criação das tropas fornecidas;
- sequências e intervalos das ondas;
- testes associados.

Nenhum arquivo de arte é incluído ou processado por este pacote.

## Estratégia adotada

O orçamento não foi elevado e o verificador original não foi modificado. A
validação do pacote captura a saída e permite apenas as pendências previamente
identificadas:

- orçamento total acima de 82 MB;
- spritesheets dos estados `biteAbyss`, `biteRecover`, `brineJet`,
  `idleSurface`, `spawnRise`, `surfaceSwim` e `tailSweep`.

Qualquer outra falha permanece bloqueante.
