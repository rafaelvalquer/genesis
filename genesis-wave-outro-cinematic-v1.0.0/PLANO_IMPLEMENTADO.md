# Final de onda cinematográfico — implementação

## Objetivo

Melhorar o encerramento de cada onda sem alterar dano, IA, economia, composição de ondas ou condições de vitória.

## Fluxo normal

1. Último inimigo é eliminado pelo motor normalmente.
2. A câmera reutiliza `waveOutro.lastKill` para enquadrar a posição do inimigo já morto.
3. A música começa a reduzir antes do impacto cinematográfico.
4. O impacto ganha onda de choque, flash localizado, camera shake e camada sonora curta.
5. O enquadramento retorna suavemente durante `cleanup`.
6. O banner original `ONDA X CONCLUÍDA` permanece.
7. A vantagem tática continua surgindo no mesmo momento do sistema atual.

## Última onda

1. O foco usa zoom maior.
2. Barras cinematográficas entram durante o encerramento.
3. O ducking de música é mais profundo.
4. O impacto visual e o shake são mais fortes.
5. O banner intermediário passa a exibir `PERÍMETRO ASSEGURADO`.
6. O estágio seguinte continua exibindo `MISSÃO CONCLUÍDA` e passa a incluir o nome da fase.
7. A vitória continua sendo finalizada pelo mesmo `advanceWaveOutro` do motor.

## Segurança

A implementação não altera:

- `stepBattle`;
- dano de tropas ou inimigos;
- HP;
- energia ou supply;
- spawn;
- pacotes e ondas;
- lógica da Enguia Rasgamar;
- Leviatã;
- decisões táticas;
- assistência adaptativa;
- cálculo de estrelas;
- duração lógica do `waveOutro`.

A única alteração em `battleModel.js` é aditiva: o snapshot de `lastKill` passa a expor tipo e coordenadas do inimigo já armazenado internamente, permitindo posicionar o efeito visual.

## Compatibilidade

O antigo `getWaveOutroCameraTransform()` permanece no arquivo e continua com o comportamento anterior para não quebrar testes ou imports existentes. A apresentação real passa a usar `getCinematicWaveOutroCameraTransform()`.

## Critérios de aceite

- último inimigo permanece sendo eliminado no mesmo frame lógico;
- final de onda normal mantém os mesmos estados e tempos;
- final da missão mantém os mesmos 4100 ms lógicos;
- `reduceMotion` remove zoom/impactos animados;
- `cameraShake=false` impede o tremor gerado pelo impacto;
- simulador headless não precisa conhecer os novos efeitos;
- testes anteriores de `battleModel` continuam válidos;
- build Vite deve concluir sem erros.
