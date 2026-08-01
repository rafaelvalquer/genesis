# Implementação técnica

## Massa contínua

O renderer calcula a primeira coluna alagada de cada rota e cria uma única curva vertical. Os valores das rotas são interpolados com `smoothstep`, evitando degraus retos entre linhas.

## Ondulação

A frente combina três sinais:

1. onda principal;
2. onda secundária mais curta e rápida;
3. swell lento de baixa frequência.

O tempo vem de `now`/`session.elapsed`, sem acumuladores globais. Pausa, velocidade da batalha e quedas de FPS não provocam descompasso.

## Transições

Em `rising` e `receding`, a posição-base é interpolada entre o nível atual e o alvo. A animação não altera a lógica territorial; ela apenas representa visualmente a transição já controlada por `tideCycle.js`.

## Camadas

- underlay: solo úmido, corpo da água, profundidade, correntes, caustics e bolhas;
- overlay: espuma da costa, rastros de inimigos, ondulações das tropas e tooltip.

## Qualidade adaptativa

- alta: amostragem de 6 px, cinco correntes, caustics, bolhas e até 18 rastros;
- média: amostragem de 10 px, três correntes, menos partículas e até 10 rastros;
- baixa/estresse: amostragem de 18 px, uma corrente e sem partículas secundárias.
