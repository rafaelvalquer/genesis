# Mecânica — Maré Territorial Progressiva

## Estados territoriais

### Terra firme
- Permite implantação.
- Não concede bônus aos inimigos.
- Nunca é alterada pela maré.

### Zona intermaré
- Seca: permite implantação e exibe borda ciano, umidade, poças e símbolo de onda.
- Aviso: pisca e indica a direção da água.
- Alagada: bloqueia novas implantações, mantém tropas existentes submersas e acelera inimigos.
- Secando: não está mais alagada, mas permanece bloqueada por 800 ms.

### Água profunda
- Começa alagada.
- Nunca permite implantação.
- Sempre concede bônus aquático aos inimigos.

## Progressão territorial

A cada avaliação, o sistema calcula:

- população viva, contando drones empilhados individualmente;
- perdas reais ocorridas nos últimos 18 segundos;
- nível territorial atual;
- onda atual;
- tempo sem alteração da maré.

Mais tropas aumentam a chance de avanço. Perdas recentes reduzem o avanço e aumentam o recuo. Remoções manuais não são consideradas perdas.

Perdas críticas de 30% ou mais zeram a chance de avanço e aplicam pelo menos 65% de chance emergencial de recuo, desde que o nível atual possa recuar.

A maré muda somente um nível por vez e nunca deixa menos de 15 células seguras.

## Persistência

O nível territorial permanece entre ondas. Quando uma onda termina com pelo menos 25% de perda em relação ao pico populacional da onda, o início da próxima onda pode conceder um nível de recuo, respeitando o mínimo configurado.

## Efeitos de combate

### Inimigos na água
- recebem bônus de velocidade;
- nas fases finais, parte da lentidão aplicada é neutralizada.

### Tropas submersas
- permanecem no campo;
- continuam bloqueando inimigos;
- recebem redução da velocidade de ataque;
- após dois segundos, recebem um pulso de pressão distribuído por cinco segundos;
- o dano total do pulso é limitado pela missão e não continua indefinidamente.

### Reatores
- fases 33–36: continuam gerando energia normalmente;
- fases 37–40: ficam pausados enquanto submersos.

### Minas
- fases 33–35: continuam funcionando;
- fases 36–40: ficam temporariamente desativadas quando alagadas.

## Progressão das missões

| Fase | Água profunda | Níveis | Inicial | Avanço máx. | Recuo máx. | Velocidade inimiga | Pressão máxima | Ataque submerso |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 33 | coluna 9 | 1 | 0 | 45% | 55% | +15% | 0% | -5% |
| 34 | coluna 9 | 2 | 0 | 50% | 50% | +16% | 8% | -10% |
| 35 | colunas 8–9 | 2 | 1 | 55% | 48% | +18% | 10% | -10% |
| 36 | colunas 8–9 | 2 | 0 | 58% | 44% | +20% | 12% | -15% |
| 37 | colunas 7–9 | 2 | 1 | 62% | 40% | +22% | 15% | -15% |
| 38 | colunas 7–9 | 3 | 1 | 66% | 36% | +24% | 18% | -20% |
| 39 | colunas 6–9 | 2 | 1 | 70% | 32% | +27% | 22% | -25% |
| 40 | colunas 6–9 | 2 | 1 | 75% | 28% | +30% | 28% | -30% |

## Supply

Nenhuma regra foi alterada. O instalador compara o bloco de regeneração antes e depois do patch e cancela a instalação se detectar qualquer mudança.
