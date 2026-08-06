# Implementação técnica

## Máquina de estados

A implementação preserva os estados atuais e acrescenta somente `laneRelocation`.

### Mudança de rota

```text
submergedPatrol
  → dive
  → laneRelocation
  → submergedPatrol
```

Durante `laneRelocation`:

- `row` permanece na origem até o deslocamento terminar;
- `y` é interpolado com smoothstep;
- `rasgamarTargetRow` reserva o destino;
- a Enguia permanece submersa e inalvejável;
- ao concluir, o índice de batalha é reconstruído.

### Ataque à base

A funcionalidade reutiliza a sequência visual já existente:

```text
rangedPositioning
  → rangedEmerge
  → rangedCharge
  → rangedAttack
  → surfaceRecovery
  → dive
```

O campo `rasgamarBaseAssault` diferencia o disparo contra a base do disparo normal contra uma tropa.

## Seleção de rota

A lógica foi isolada em `enguiaRasgamarTactics.js`.

Ordem de decisão:

1. excluir a rota atual;
2. excluir rotas sem tropas;
3. considerar apenas rotas alagadas fornecidas pelo motor;
4. priorizar rotas sem Enguia nem reserva;
5. ordenar por quantidade de tropas;
6. desempatar por valor estratégico;
7. desempatar por alvos prioritários;
8. desempatar pela menor distância;
9. desempatar pelo menor número da rota.

## Concorrência entre Enguias

`getRasgamarOccupiedRows()` considera:

- a rota atual de cada Enguia;
- `rasgamarTargetRow` de Enguias em deslocamento.

Isso evita que várias Enguias escolham a mesma rota no mesmo ciclo quando há alternativas.

## Ataque à base

O ataque:

- não elimina a própria Enguia;
- aplica `baseAttackDamage` repetidamente;
- respeita `currentWaveBaseDamageFactor`;
- respeita `enemyDamageMultiplier` no laboratório;
- consome cargas de escudo;
- respeita base invulnerável;
- gera evento genérico `breach` para o feedback já existente;
- gera `rasgamarBaseAttack` para telemetria específica.

A derrota continua sendo concluída pelo fluxo existente de `stepBattle` quando a integridade chega a zero.

## Parâmetros adicionados

```javascript
laneRetargetDiveMs: 480,
laneRelocationBaseMs: 450,
laneRelocationPerRowMs: 220,
laneRelocationCooldownMs: 1200,
baseAttackDamage: 4,
baseAttackCooldownMs: 2200,
```

## Compatibilidade

A implementação não altera:

- emboscada em tropas alagadas;
- enrolamento e pulsos elétricos;
- lentidão depois do enrolamento;
- disparo contra tropas não alagadas;
- fuga da maré;
- exposição periódica;
- morte submersa e morte na superfície;
- pacotes, ondas ou quantidade de Enguias;
- lógica geral de encerramento da batalha.
