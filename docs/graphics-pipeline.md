# Pipeline gráfico

O campo continua usando coordenadas lógicas de 1100 × 680. Nenhuma regra, colisão,
posição de entidade ou conversão de ponteiro depende da resolução física.

## Camadas

1. `arenaLayer`: arena, grade, contenção traseira e elementos estáticos.
2. `effectLayer`: decals, defesas, minas, projéteis e efeitos que ficam atrás das entidades.
3. `entityLayer`: tropas, inimigos, cadáveres, barras e efeitos presos às entidades.
4. `overlayEffectLayer`: efeitos que precisam permanecer à frente das entidades, inclusive
   partículas, luzes, foreground e contenção frontal.
5. `emissiveLayer`: passe reduzido usado exclusivamente pelo bloom.
6. `finalCanvas`: composição, câmera, zoom, tremor e modo de cor.

`entityLayer` usa `min(devicePixelRatio, limiteDaQualidade)` — 1 em baixa, 1,5 em
média e 2 em alta. Arena e efeitos usam resolução lógica ou 0,75× em baixa; emissive
usa 0,25×, 0,375× ou 0,5×. Todos os canvases são criados uma vez por montagem e
reutilizados a cada frame.

Antes de limpar uma camada, o contexto volta à transformação identidade. Depois da
limpeza em pixels físicos, sua escala lógica é restaurada. Na apresentação, cada
camada é desenhada para um destino lógico de 1100 × 680; assim, o backing store HiDPI
da entidade não recebe uma segunda escala.

As métricas `arenaMs`, `effectMs`, `entityMs`, `emissiveMs`, `drawMs` e `presentMs`
são médias móveis e aparecem no painel de métricas gráficas.
