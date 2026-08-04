# Changelog

## 1.0.0 — 2026-08-03

### Adicionado

- Fuzileiro Voltaico com ID `fuzileiroVoltaico`.
- Máquina de estados `idle`, `attack` e preparação/liberação de ataque.
- Retarget no instante da descarga.
- Dano elétrico principal e propagação não recursiva.
- Multiplicadores independentes para alvos secos e alagados.
- Implantação anfíbia em zona intermaré e água profunda.
- Imunidade à pressão e à penalidade de cadência da maré.
- Raios elétricos segmentados e impactos aquáticos.
- Testes unitários e de integração.
- Instalador PowerShell, backup e verificador estrutural.

### Temporário

- `spriteKey: "guarda"` até a entrega dos sprites definitivos do personagem.

- Adicionado fallback de assets para reutilizar temporariamente os frames da Guarda no estado `death`.
- Refinada a implantação anfíbia: água profunda e alagamento são permitidos, mas a célula em secagem continua bloqueada.
