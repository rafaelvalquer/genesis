# Derivante — pacote visual e validação

## Modo de geração

- Gerador: ImageGen integrado (modo nativo).
- Fallback externo: não utilizado.
- Referência de identidade: `src/game/assets/enemy/derivante/idle/frame0.png` anterior à substituição.
- Processamento: recorte 4×2, remoção oficial de chroma key, preservação do maior componente, escala global, alinhamento pela mesma linha de solo e exportação RGBA 320×256.
- Estado visual `hit`: intencionalmente ausente.

## Prompt-base

> Use case: stylized-concept. Asset type: 2D game animation sprite sheet. Use the reference as a strict identity guide. 4 columns × 2 rows, exactly eight distinct frames. Preserve an agile organic alien quadruped predator facing left, narrow aerodynamic body, low center of gravity, long flexible legs, powerful hind legs, claws, violet/deep-blue carapace, cyan bioluminescent fins and markings, tail, dark cartoon outline and cel shading. No mechanical parts. Keep anatomy, palette, scale, camera and direction consistent. Orthographic side view. One full character per cell with generous padding. Flat #00ff00 chroma background, no gradients, texture, floor or shadows. No green in the character, UI, text or unrelated effects.

## Complementos por estado

- `idle`: respiração alerta sutil, cauda, cabeça e energia em ciclo fechado.
- `walking`: passadas predatórias alternadas e ciclo fechado.
- `attack`: antecipação, impacto no quadro 3, continuação e recuperação.
- `jumpPrepare`: agachamento progressivo até a pré-decolagem.
- `jumpTakeoff`: liberação, extensão e recolhimento, sem deslocamento vertical no quadro.
- `jumping`: recolhimento, ápice e extensão, sem arco pintado.
- `landing`: contato, compressão e recuperação.
- `windGlide`: abertura, extensão e preparação de pouso, sem deslocamento dentro da célula.
- `stunned`: oscilação corporal em ciclo, sem estrelas ou ícones.
- `death`: perda de apoio, colapso e redução do brilho, sem gore ou partículas.

## Entregáveis

- `sheets/`: dez folhas 4×2 originais produzidas pelo ImageGen.
- `derivante-<estado>.gif`: prévia individual dos dez estados.
- `derivante-full-jump-sequence.gif`: sequência completa de salto.
- `derivante-wind-sequence.gif`: sequência do vento.
- `derivante-route-interpolation.gif`: referência da interpolação entre rotas.
- `derivante-airborne-death.gif`: referência da queda ao morrer no ar.
- `derivante-before.png` e `derivante-after.png`: comparação.
- `derivante-processed-overview.png`: visão geral dos 80 quadros finais.

Os assets usados pelo jogo estão em `src/game/assets/enemy/derivante/<estado>/frame0.png` até `frame7.png`.
