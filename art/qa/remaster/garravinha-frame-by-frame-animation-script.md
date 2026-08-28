# Roteiro quadro a quadro — Garravinha

## Base visual obrigatória

Usar as imagens em `garravinha-separated-seeds/` como referência direta de anatomia, paleta e enquadramento: corpo orgânico teal, carapaça e pinças laranja bioluminescentes, detalhes ciano, contorno escuro e perfil 3/4 voltado para a direita.

Cada quadro será gerado como **uma imagem isolada**. Não usar folhas de sprites como fonte ou destino de geração. Todo PNG deve ter fundo RGBA realmente transparente, margem livre de pelo menos 64 px e exatamente um Garravinha inteiro.

## Continuidade comum

- Canvas final: 512×512; criatura centralizada e sem cortes.
- A base dos pés fica no mesmo nível nos estados no chão; no salto, a deslocação vertical é intencional.
- Manter tamanho, direção, cores e iluminação. Alterar somente a postura exigida pelo quadro.
- Ao gerar cada quadro, informar o quadro anterior e o seguinte como referência visual para preservar continuidade.
- Reprovar qualquer geração com fundo, sombra solta, objetos extras, fragmentos, anatomia duplicada ou parte que toque a margem.

## Idle — 8 quadros

| Quadro | Ação |
| ---: | --- |
| 0 | Postura neutra, pinças semiabertas, cauda curvada. |
| 1 | Peito expande discretamente; olho ganha brilho mínimo. |
| 2 | Corpo sobe 2 px; pinça frontal abre um pouco. |
| 3 | Pico da respiração; cauda eleva a ponta. |
| 4 | Retorno ao neutro; pinça fecha parcialmente. |
| 5 | Corpo desce 2 px; ombros relaxam. |
| 6 | Cauda oscila para trás; olho reduz o brilho. |
| 7 | Retorno exato à postura do quadro 0. |

## Walking — 8 quadros

| Quadro | Ação |
| ---: | --- |
| 0 | Contato: pata dianteira direita toca o solo; traseira esquerda apoia. |
| 1 | Peso transfere para frente; quadril avança levemente. |
| 2 | Passagem: patas se aproximam sob o corpo; tronco baixo. |
| 3 | Impulso: pata traseira direita estende para trás. |
| 4 | Contato oposto: pata dianteira esquerda toca o solo. |
| 5 | Peso transfere para a esquerda; pinças oscilam à frente. |
| 6 | Passagem oposta; cauda acompanha o giro do quadril. |
| 7 | Impulso oposto; prepara retorno ao quadro 0. |

## Attack — 8 quadros

| Quadro | Ação |
| ---: | --- |
| 0 | Guarda neutra. |
| 1 | Cabeça baixa e pinças recolhem. |
| 2 | Corpo comprime; patas traseiras carregam força. |
| 3 | Início do avanço: tronco inclina e cauda contrabalança. |
| 4 | Pico: corpo avança; duas pinças totalmente abertas. |
| 5 | Impacto: pinças fecham para a frente e mandíbula abre. |
| 6 | Recuo curto; patas absorvem o impacto. |
| 7 | Recuperação para a guarda. |

## Latch Prep — 6 quadros

| Quadro | Ação |
| ---: | --- |
| 0 | Postura de caminhada interrompida. |
| 1 | Cabeça abaixa; pinças apontam para o alvo. |
| 2 | Corpo desce; joelhos dobram. |
| 3 | Traseira comprime mais; cauda recua. |
| 4 | Ponto de máxima tensão: patas traseiras compactas. |
| 5 | Última preparação: peito avança, garras prontas para soltar. |

## Latch Leap — 6 quadros

| Quadro | Ação |
| ---: | --- |
| 0 | Saída do solo: patas traseiras ainda estendendo. |
| 1 | Ascensão: corpo alonga; pés deixam o chão. |
| 2 | Meio da subida: pinças à frente, cauda para trás. |
| 3 | Ápice: corpo totalmente estendido e horizontal. |
| 4 | Descida: pinças fecham um pouco para agarrar. |
| 5 | Pré-contato: patas recolhidas; corpo inclina ao alvo. |

## Latched — 8 quadros

| Quadro | Ação |
| ---: | --- |
| 0 | Pinças e patas presos; corpo compacto. |
| 1 | Contração do tronco para puxar. |
| 2 | Pinça direita aperta; cauda estabiliza. |
| 3 | Pico da puxada; mandíbula abre. |
| 4 | Relaxamento parcial; corpo retorna. |
| 5 | Nova contração menor; pinça esquerda aperta. |
| 6 | Cabeça vibra/rosna; brilho do olho aumenta. |
| 7 | Retorno ao quadro 0. |

## Death — 8 quadros

| Quadro | Ação |
| ---: | --- |
| 0 | Dano recebido: corpo ainda em pé, cabeça recua. |
| 1 | Perde equilíbrio; pinças abrem sem força. |
| 2 | Pernas cedem; carapaça inclina para a direita. |
| 3 | Joelho toca o chão; cauda cai. |
| 4 | Tronco tomba de lado. |
| 5 | Corpo já no chão, pequena quicada. |
| 6 | Cauda e pinças relaxam até parar. |
| 7 | Pose final imóvel. |

## Fluxo de produção

1. Gerar um PNG para o quadro descrito, usando a seed do estado e o quadro anterior como referências.
2. Validar visualmente e por script: RGBA, 512×512, margem livre e uma única silhueta.
3. Salvar como `src/game/assets/enemy/garravinha/<estado>/frame<N>.png` somente após aprovação.
4. Montar uma prévia temporária apenas para revisão; os PNGs individuais continuam sendo a fonte de verdade.
