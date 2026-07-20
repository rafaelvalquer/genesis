# Rainha Operária — conjunto de prompts cartoon

Modo: ImageGen integrado. As folhas foram geradas novamente usando o novo
`worker-queen-idle-chroma.png` como referência fixa de identidade. Os frames
locais de Lumi/URSA-7 e Colosso de Impacto foram usados somente como referência
de linguagem visual.

## Prompt compartilhado da Rainha

Folha de sprites 2D de produção com exatamente oito quadros em grade 4×2,
ordenados cronologicamente, sobre fundo cromático uniforme `#00ff00`. Rainha
alienígena completamente orgânica voltada para a esquerda, com abdômen redondo
dominante, uma grande janela âmbar translúcida mostrando apenas quatro a seis
ovos grandes, cabeça pequena, mandíbulas curtas e patas legíveis. Quitina em
areia, coral e âmbar, com pequenos olhos ciano.

Estilo cartoon limpo e robusto como Lumi/URSA-7 e Colosso: contorno escuro
grosso, formas grandes, somente dois ou três tons de cel shading por material,
poucas linhas internas e leitura clara na escala do jogo. Mesma anatomia,
proporção, direção, centro e baseline em todos os quadros. Evitar microtextura,
placas minúsculas, veias densas, rachaduras decorativas, excesso de olhos,
realismo de horror, detalhes ruidosos, texto, sombra e elementos tecnológicos.

Variações de ação: `spawn`, `walking`, `idle`, `webAttack`, `eggLay`,
`meleeAttack`, `hit`, `stunned` e `death`, seguindo os movimentos descritos na
especificação da unidade. A teia e os ovos são elementos secundários e nunca
alteram a escala corporal da Rainha.

## Prompt compartilhado do ovo

Folha 4×2 no mesmo fundo cromático e estilo cartoon. Ovo orgânico compacto com
silhueta oval larga, três ou quatro grandes faixas de quitina areia/coral, uma
grande membrana âmbar exibindo um único embrião simplificado e raízes curtas na
base. Contorno grosso, formas arredondadas, dois ou três tons e nenhum detalhe
fino.

Variações: `idle` pulsa suavemente; `hatch` cria poucas rachaduras largas e
mostra o Escavador emergindo; `destroy` quebra a casca em poucas partes grandes,
apaga a luz e não mostra criatura.

As folhas cromáticas são convertidas em 96 PNGs RGBA 256×256 por
`scripts/process-worker-queen-sheets.mjs`, com remoção do fundo, normalização de
escala, ancoragem e validação do baseline.
