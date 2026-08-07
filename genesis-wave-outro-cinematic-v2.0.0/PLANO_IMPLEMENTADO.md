# Plano implementado — Final de onda cinematográfico

## Arquitetura

| Responsabilidade | Implementação |
|---|---|
| Perfis e timings | `src/game/waveOutro/waveOutroProfiles.js` |
| Câmera, foco e easing | `src/game/waveOutro/waveOutroCamera.js` |
| Ducking e sons cinematográficos | `src/game/waveOutro/waveOutroAudio.js` |
| Impacto, intensidade e damage kind | `src/game/waveOutro/waveOutroEffects.js` |
| Modelo visual do overlay | `src/game/waveOutro/waveOutroRenderer.js` |
| Integração lógica | patch em `src/game/battleModel.js` |
| Integração de apresentação | patch em `src/game/GameCanvas.jsx` |
| Death linger/luz/shake | patch em `src/game/graphicsRuntime.js` |
| Letterbox/flash/shockwave | patch em `src/styles.css` |

## Requisitos atendidos

1. **Combate inalterado:** a morte continua ocorrendo em `damageEnemy`; `lastKill` recebe somente metadados visuais.
2. **Snapshot rico:** `sourceTroopId`, `sourceTroopType`, `impactX/Y`, `weapon`, `damageKind`, `eventType`, `boss`, `elite`, `alpha`.
3. **Perfis:** standard, cinematic, missionFinale, bossFinale.
4. **Câmera:** foco limitado ao campo, `easeOutCubic`, `smoothStep`, zoom específico e pullback final.
5. **Slow motion:** curvas por perfil; `reduceMotion` retorna fator 1.
6. **Hit stop:** somente o `presentScene()` repete o frame; `stepBattle()` não é congelado.
7. **Áudio:** ducking começa antes do impacto; tema chega a zero antes do banner final.
8. **Impacto:** eventos próprios, intensidade dinâmica e visual por tipo de dano.
9. **Graphics runtime:** aproveita camera shake, luzes e `runtime.deaths` existentes.
10. **Death linger:** 900 ms comum, 1300 ms final, 1600 ms boss finale.
11. **Última onda:** letterbox, impacto ampliado, silêncio, câmera abre, `PERÍMETRO ASSEGURADO`, `MISSÃO CONCLUÍDA`.
12. **Identidade da fase:** CSS usa `phase.palette.primary` e `phase.palette.accent`.
13. **Clique:** após 600 ms ou 1500 ms, aumenta `playbackRate` para 2×; não salta os estados.
14. **reduceMotion:** remove câmera, shake, hit-stop, letterbox/flash e acelera a duração visual em 35%.
15. **Validação:** testes específicos + contrato estrutural + build; suíte completa opcional.
16. **Falha de teste:** nenhuma validação chama restore e o instalador não desfaz arquivos.

## Estado lógico preservado

A máquina continua utilizando:

```text
finalKill
→ cleanup
→ waveCompleteBanner
→ decisionIntro | victoryIntro
→ completed
```

Os tempos são calculados pelo perfil, mas a transição lógica e a chamada final de vitória continuam no mesmo fluxo existente.
