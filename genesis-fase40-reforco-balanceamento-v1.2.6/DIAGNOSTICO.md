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


## Falha adicional corrigida na v1.2.5

O Windows PowerShell 5.1 transforma linhas do `stderr` de comandos nativos em
objetos `ErrorRecord`. Com `$ErrorActionPreference = "Stop"`, a linha:

```text
Build excede o orçamento total de 82 MB: 187.8 MB.
```

era lançada como `NativeCommandError`, impedindo que o instalador verificasse se
ela correspondia a uma pendência conhecida.

A nova implementação não reduz a severidade de erros desconhecidos. Ela apenas
captura a saída nativa de forma compatível com o PowerShell 5.1 antes de aplicar
as mesmas regras de classificação.


## Causa confirmada na v1.2.6

A linha do relatório estava correta. O erro estava no código-fonte PowerShell.

No Windows PowerShell 5.1:

- UTF-8 sem BOM pode ser interpretado como a página ANSI do Windows;
- literais com acentos são corrompidos durante a leitura do script;
- o console exibia mensagens como `validaÃ§Ã£o`, confirmando o problema;
- o padrão com `orçamento` não correspondia à saída UTF-8 do Node.

O hotfix grava os scripts com BOM UTF-8 e elimina acentos dos padrões usados
para classificar mensagens externas.
