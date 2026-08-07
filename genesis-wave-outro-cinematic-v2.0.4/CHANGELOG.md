# Changelog

## 2.0.4 — 2026-08-07

- corrige a falha `Não foi possível inserir import antes de: import { getWaveOutroCameraTransform } ...`;
- remove a dependência de formato textual específico para imports do `GameCanvas.jsx`;
- normaliza imports de câmera, áudio e renderer em um bloco canônico;
- aceita imports em uma linha, multilinha, aspas simples/duplas, ordem diferente, parciais ou duplicados;
- aplica a mesma normalização aos imports de profiles/effects em `battleModel.js`;
- preserva os demais imports existentes;
- mantém idempotência em reinstalações e compatibilidade com estados parciais das versões 2.0.0, 2.0.1 e 2.0.2;
- mantém a política de nunca restaurar arquivos automaticamente.

## 2.0.2 — 2026-08-07

- corrige `Patch incompatível: props do WaveOutroOverlay`;
- substitui a correspondência exata do JSX por detecção estrutural ampla;
- aceita `WaveOutroOverlay` em uma linha, multilinha, com props adicionais ou em ordem diferente;
- reconhece instalações parciais deixadas por `v2.0.0` e `v2.0.1`;
- mantém idempotência em reexecuções;
- adiciona relatório de patch do `GameCanvas` com status por etapa;
- mantém a política de nunca restaurar arquivos automaticamente.

## 2.0.1 — 2026-08-07

- implementa o plano de final de onda cinematográfico;
- separa profiles, câmera, áudio, efeitos e renderer;
- preserva a morte e o resultado lógico do combate;
- adiciona quatro perfis de intensidade, incluindo boss finale;
- adiciona eventos de foco, impacto e aftermath;
- adiciona ducking pré-impacto e victory stinger;
- adiciona shockwave, flash, shake, death linger e letterbox;
- adiciona vitória em dois estágios;
- substitui skip por aceleração 2× protegida;
- preserva `reduceMotion` e reduz a duração da apresentação nesse modo;
- adiciona testes e contrato estrutural;
- remove qualquer dependência de `restore-patch.mjs`;
- instalação nunca restaura arquivos automaticamente quando validações falham.

## 2.0.4 — correção de crash ao montar a batalha

- remove a cinematografia do caminho crítico de montagem do `GameCanvas`;
- o `WaveOutroOverlay` agora só executa em `finalKill`, `cleanup`, `waveCompleteBanner`, `decisionIntro` ou `victoryIntro`;
- o overlay passa a receber `sessionRef.current.waveOutro`, preservando metadados completos sem ampliar o snapshot público;
- restaura um snapshot público conservador para `waveOutro`;
- adiciona isolamento defensivo: falha de apresentação cinematográfica retorna `null` e não derruba a batalha;
- adiciona smoke check específico para montagem/runtime;
- continua sem qualquer rollback automático.
