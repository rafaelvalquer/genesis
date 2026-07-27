# Gorjal — conjunto final de sprites

## Modo de geração

Foi usado o gerador de imagens integrado (`imagegen`) em nove folhas 4×2, uma por
estado. As folhas foram recortadas, tiveram o fundo cromático removido, foram
limitadas ao maior componente conectado e receberam escala e linha de chão
compartilhadas. Não foi necessário usar o fallback.

## Prompt base

> Create a clean 4×2 animation sprite sheet with exactly eight distinct frames of
> the same Gorjal character. Gorjal is a massive organic cartoon fantasy
> quadruped, low and heavy like a rhinoceros, facing left, with dark purple skin,
> irregular charcoal stone armor plates, a large forward horn, short thick legs,
> and restrained cyan bioluminescent cracks. Preserve the exact identity,
> proportions, palette, left-facing direction, camera, scale, and ground contact
> in every frame. Orthographic side view, readable game silhouette, polished
> hand-painted 2D game art, no text, no labels, no UI, no weapons, no additional
> creatures, no cropped anatomy, no cast shadow. Solid chroma-green background,
> uniform cell spacing, one complete character per cell.

## Complementos por estado

- `idle`: subtle breathing and weight shift; seamless loop; feet remain planted.
- `walking`: slow, weighty leftward walk cycle; alternating grounded steps;
  seamless loop without changing position inside the cell.
- `attack`: one deliberate horn/head strike; frames 0–3 wind up, frame 4 is the
  clearest contact pose, frames 5–7 return smoothly near the idle pose.
- `chargePrep`: crouch progressively lower, brace all four legs, lower the horn
  and compress the body forward; frame 7 connects directly to charge.
- `charge`: fast grounded leftward charge loop, horn forward, body low, heavy
  gallop and controlled cyan energy; seamless loop.
- `chargeImpact`: single heavy collision, strongest compression at the beginning,
  then recoil and loss of momentum; frame 7 connects directly to recover.
- `recover`: exhausted post-impact recovery, regain footing and lift the head
  gradually; frame 7 connects directly to walking.
- `stunned`: visibly dazed and unstable without sparks, stars, vapor, or detached
  effects; small head sway and buckling legs; seamless loop.
- `death`: one non-looping collapse with no gore and no detached effects; lose
  support progressively and finish fully motionless on the ground.

## Saídas

- Sprites de runtime: `src/game/assets/enemy/gorjal/<estado>/frame0.png` até
  `frame7.png`.
- Folhas originais: `artifacts/gorjal/sheets/`.
- GIFs de cada estado: `artifacts/gorjal/gorjal-<estado>.gif`.
- Transição completa de carga: `artifacts/gorjal/gorjal-full-charge-sequence.gif`.
- Transição de ataque: `artifacts/gorjal/gorjal-idle-attack-idle.gif`.
- Comparação: `artifacts/gorjal/gorjal-before-after.png`.
- Visão geral processada: `artifacts/gorjal/gorjal-processed-overview.png`.
