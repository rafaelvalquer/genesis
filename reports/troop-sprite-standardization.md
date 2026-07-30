# Auditoria e padronização dos sprites de tropas

Relatório gerado por `scripts/audit-troop-sprites.py` a partir dos PNGs consumidos pelo jogo.

## Padrão proposto

- PNG RGBA, 8 bits por canal e sem paleta indexada.
- Ocupação vertical desejada entre 80% e 90%, medida pela caixa visível do alfa.
- Fonte com densidade mínima equivalente a 2,16× a altura máxima de exibição.
- Ponto de apoio estável; variação de base recomendada de no máximo 1% da altura do canvas.
- Centro de massa sem deslocamento involuntário; movimentos de ataque deliberados são avaliados visualmente.
- Contornos limpos, sombras suaves, volumes legíveis e detalhes maiores que 3 px.
- Sem cenário, texto, sombra de chão ou projétil completo incorporado.

## Inventário e classificação

| Tropa | Frames | Canvas / modo | Ocupação vertical | Base máx. | Classificação |
|---|---:|---|---:|---:|---|
| `artilheiraMorteiro` | 16 | 576x384; RGBA | 85.8%–85.8% | 0.3% | precisa de refinamento visual |
| `bombardeiro` | 16 | 384x384; RGBA | 85.0%–85.2% | 0.3% | precisa apenas de reexportação |
| `cacador` | 16 | 560x560; RGBA | 79.3%–79.8% | 0.0% | não precisa de alteração |
| `cacadorLeviatas` | 32 | 512x512; P | 90.6%–90.6% | 0.0% | precisa apenas de reexportação |
| `colono` | 12 | 560x560; RGBA, P | 70.9%–80.0% | 11.2% | precisa de correção de alinhamento |
| `colossoImpacto` | 24 | 512x512; RGBA | 83.3%–86.9% | 0.2% | precisa de refinamento visual |
| `demolidora` | 25 | 384x384; RGBA | 58.6%–87.6% | 0.3% | precisa apenas de reexportação |
| `droneSentinela` | 24 | 512x384; RGBA | 57.6%–67.6% | 4.9% | precisa de correção de alinhamento |
| `executorArco` | 40 | 512x512; RGBA | 74.4%–85.1% | 0.4% | precisa de refinamento visual |
| `guarda` | 62 | 560x560; RGBA | 74.3%–74.3% | 0.5% | não precisa de alteração |
| `incinerador` | 16 | 384x384; RGBA | 76.7%–84.9% | 0.0% | precisa apenas de reexportação |
| `interceptadorIcaro` | 48 | 384x384; RGBA | 82.9%–85.2% | 0.0% | precisa apenas de reexportação |
| `krio` | 16 | 384x384; RGBA | 84.9%–85.0% | 0.0% | precisa apenas de reexportação |
| `lumiUrsa7` | 40 | 512x512; RGBA | 66.6%–88.6% | 0.0% | precisa de revisão de animação |
| `marine` | 76 | 560x560; RGBA | 76.6%–77.5% | 0.2% | não precisa de alteração |
| `medicaNanites` | 32 | 384x384; RGBA | 82.3%–82.3% | 0.3% | não precisa de alteração |
| `muralhaReforcada` | 3 | 560x560; RGBA | 82.0%–82.0% | 0.0% | não precisa de alteração |
| `ranger` | 16 | 560x560; RGBA | 79.5%–80.2% | 0.0% | não precisa de alteração |
| `reator` | 16 | 384x384; RGBA | 84.9%–84.9% | 0.0% | precisa apenas de reexportação |
| `sniper` | 73 | 560x560; RGBA | 74.3%–76.2% | 0.2% | não precisa de alteração |

## Resultado do lote priorizado

- **Vórtice / Executor de Arco:** refinamento visual reexportado dos masters em 512×512 RGBA; cinco estados com oito frames.
- **Colosso de Impacto:** refinamento visual reexportado dos masters em 512×512 RGBA; três estados com oito frames.
- **Artilheira de Morteiro:** refinamento visual reexportado em 576×384 RGBA para preservar a silhueta horizontal.
- **Reator, Interceptador Ícaro, Demolidora, Incinerador, Krio e Bombardeiro:** remasters reexportados em 384×384 RGBA, preservando estados, contagem e nomes.

Os masters existentes em `art/spritesheets/` e `art/sprites/` foram mantidos como fonte de verdade. Os scripts de processamento agora reproduzem as novas dimensões e o formato RGBA.

## Próximas prioridades

1. Reexportar as tropas ainda indexadas (`cacadorLeviatas`, `lumiUrsa7`, `medicaNanites`) a partir de seus masters, sem alterar desenho.
2. Refinar `droneSentinela`, cujo canvas 256×192 fica abaixo do padrão de densidade.
3. Corrigir o único frame indexado de `colono` e uniformizar o modo com os demais frames.
4. Revisar visualmente estados com grande variação de silhueta antes de interpretar variação de centro como erro; ataques e mortes podem deslocar a caixa visível de forma intencional.
5. Manter pontos de disparo e impacto como metadados/configuração do jogo; a auditoria de pixels não consegue distingui-los com segurança de brilhos decorativos.

## Critérios de aceite automatizados

- Contagem de frames e nomes preservados.
- Dimensão e modo de cor conferidos por arquivo.
- Alfa presente, cantos transparentes e sprite não vazio.
- Ocupação, base, centroide e escala medidos por estado.
- Testes de assets e build executados após qualquer reexportação.
