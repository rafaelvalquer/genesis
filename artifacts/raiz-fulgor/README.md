# Raiz-Fulgor — sprites e evidências

Conjunto produzido em modo **ImageGen integrado** (sem fallback de CLI), usando como
referências estritas os `frame0.png` anteriores de `idle`, `walking` e `rootedIdle`.

## Contrato

- 9 estados: `idle`, `walking`, `rooting`, `rootedIdle`, `attackCharge`,
  `attackRelease`, `unrooting`, `stunned` e `death`.
- 8 quadros distintos por estado; 72 PNGs RGBA 320×256.
- Direção à esquerda, mesma identidade orgânica violeta/ciano e linha de chão comum.
- Não existe pasta, asset ou estado visual `hit`.

## Prompts usados

Todos os prompts solicitaram grade regular 4×2, fundo `#00FF00`, anatomia e escala
estáveis, orientação à esquerda, ausência de texto/UI e fidelidade às três referências.
As variações específicas foram:

1. `idle`: respiração alerta móvel, raízes retraídas, loop.
2. `walking`: marcha orgânica alternada sem translação, loop.
3. `rooting`: transição móvel para base larga enraizada em oito etapas.
4. `rootedIdle`: condução de energia raízes→núcleo→emissor, base fixa, loop.
5. `attackCharge`: energia acumulada progressivamente, quadro 7 em tensão máxima,
   sem feixe externo.
6. `attackRelease`: clarão compacto conectado ao emissor no quadro 0 e recuperação,
   sem desenhar o feixe completo.
7. `unrooting`: retração gradual das raízes até silhueta compatível com caminhada.
8. `stunned`: oscilação e núcleo instável, sem ícones ou flash de hit, loop.
9. `death`: colapso opaco sem gore, explosão ou desaparecimento por fade.

As folhas-fonte originais estão em `artifacts/raiz-fulgor/sheets/`. O processamento
foi feito por `scripts/process-raiz-fulgor-sprites.mjs`, com o removedor oficial de
chroma key do skill ImageGen, isolamento do maior componente, escala global e
âncora terrestre compartilhada.

## Evidências

- `raiz-fulgor-processed-overview.png`: os 72 quadros processados.
- `raiz-fulgor-before-after.png`: comparação do asset anterior com o novo conjunto.
- Um GIF por estado e sequências compostas de enraizamento, ataque e desenraizamento.
- Demos de origem do feixe, cadeia/paralisia e morte enraizada sem teleporte.
