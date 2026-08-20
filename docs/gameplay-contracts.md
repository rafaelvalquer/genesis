# Contratos de gameplay

Este documento registra comportamentos de produção cobertos pelo gate `test:gameplay-contracts`.

- **Crisálio:** cada rota tem seu próprio pulso de escudo; a renovação só afeta aliados na mesma rota.
- **Rainha Operária:** a guarda só é criada com pelo menos três tropas avançadas vivas na mesma rota; tropas de trás ou de outras rotas não contam.
- **Corrente de Vento:** vento favorável desloca apenas inimigos. Vento lateral move tropas para a rota adjacente, em cadeia, e estruturas bloqueiam a passagem. Ejeção é recuperação emergencial: a tropa permanece viva, perde 25% da vida, mantém suprimentos e retorna após 8 s; 10% de integridade é inclusivo.
- **Cuspidor de Brasa:** reposiciona antes de voltar a atacar.
- **Derivante:** só pode reposicionar para uma rota adjacente.
- **Raiz-Fulgor:** perde o enraizamento quando não há alvo após a graça; um alvo que retorna durante o desenraizamento cancela a transição.
- **Rasga-Céus:** o golpe acontece no tempo original e uma única vez.
- **Salamandra Cinérea:** a primeira carga ocorre após 1.500 ms do surgimento.
- **Leviatã Nereida:** reforços são disparados uma única vez em cada limiar de vida configurado.
- **Impacto concussivo:** a distância base da onda é 35 unidades.

