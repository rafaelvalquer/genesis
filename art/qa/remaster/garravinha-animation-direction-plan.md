# Plano de direção — Garravinha

## Objetivo

Criar uma folha de sprites independente para cada animação do Garravinha. Cada quadro deve permanecer inteiro dentro da própria célula, sem pedaços de quadros vizinhos, grade, cenário ou marca d'água.

## Regras visuais fixas

- Criatura teal orgânica, carapaça e pinças laranja bioluminescentes, detalhes ciano e contorno escuro.
- Perfil 3/4 voltado para a direita, silhueta agressiva e perigosa.
- Mesmas proporções, escala, iluminação, ponto de apoio e tamanho de margem em todos os quadros.
- Fundo realmente transparente em RGBA; nenhuma grade xadrez desenhada na imagem.
- Uma imagem independente por animação, em 8 células quadradas de 512×512.
- Nenhuma parte do personagem ultrapassa a célula; deixar margem de segurança de pelo menos 32 px.
- A faixa de segurança de 32 px deve permanecer 100% transparente em todas as células.
- Se um quadro tocar a borda, apresentar fragmento desconectado ou invadir a célula vizinha, a folha inteira deve ser rejeitada e regenerada; não mascarar um quadro cortado.

## Sequências

| Animação | Quadros | Direção de movimento |
| --- | ---: | --- |
| `idle` | 8 | Respiração curta, olhos e cauda com microvariações; postura estável. |
| `walking` | 8 | Passada predatória em ciclo, alternando pernas e pinças sem mudar a escala. |
| `attack` | 8 | Preparação, compressão, avanço, abertura das pinças, impacto e recuperação. |
| `latchPrep` | 6 | Abaixar o corpo, recolher pernas e apontar a cauda para o salto. |
| `latchLeap` | 6 | Impulso, suspensão no ar e aproximação com as pinças à frente. |
| `latched` | 8 | Corpo preso, tensão muscular e pequenas contrações, sem deslocamento lateral. |
| `death` | 8 | Perda de força, tombamento progressivo e repouso final. |

## Processo de integração

1. Gerar cada sequência separadamente, nunca em um atlas com várias linhas.
2. No prompt de geração, exigir células isoladas, margem interna de 32 px, fundo RGBA real e a regra: “se qualquer parte tocar a borda, regenerar a folha”.
3. Validar automaticamente cada célula antes do recorte:
   - confirmar dimensões e alpha real;
   - rejeitar qualquer pixel opaco na faixa de 32 px da borda;
   - rejeitar componentes desconectados da silhueta principal;
   - rejeitar pixels que apareçam fora da célula ou no espaço entre células;
   - comparar a caixa ocupada e a âncora com os demais quadros.
4. Fazer uma inspeção visual em fundo claro e escuro. O resultado deve mostrar somente um Garravinha completo por célula, sem cauda, pinça, perna ou pedaço de outro quadro nas bordas.
5. Somente após a aprovação, recortar as células para PNG RGBA 512×512, preservando a âncora inferior.
6. Substituir somente os frames do estado correspondente em `src/game/assets/enemy/garravinha/`.
7. Executar a auditoria de assets e os testes do Capítulo 7.

## Critérios de rejeição e regeneração

A folha não deve ser aplicada ao jogo se qualquer um destes critérios ocorrer:

- o fundo for branco, xadrez, grade ou qualquer matte incorporado;
- existir alpha opaco na margem de segurança;
- houver uma silhueta secundária, fragmento ou pixel colorido sem conexão com o Garravinha;
- a criatura estiver cortada, mesmo que apenas parcialmente;
- a escala, a base dos pés ou a direção visual variar sem estar previsto na sequência.

O filtro de componentes conectados é apenas uma verificação. Ele não deve ser usado para esconder um quadro cortado: se remover qualquer parte relevante da criatura, a folha deve ser regenerada.
