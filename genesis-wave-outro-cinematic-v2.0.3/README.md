# Genesis — Final de onda cinematográfico v2.0.3

Pacote de implementação do plano de final de onda cinematográfico sobre a `main` do repositório `rafaelvalquer/genesis`, analisada no commit base `558980a12c07394db3a1f4fe7e17224b7c269938`.

## O que foi implementado

- perfis `standard`, `cinematic`, `missionFinale` e `bossFinale`;
- snapshot enriquecido do último golpe: tropa, arma, tipo de dano, posição e flags alpha/elite/boss;
- morte lógica preservada no instante original; a cinematografia usa apenas o snapshot visual;
- câmera extraída de `GameCanvas.jsx`, foco inteligente, easing e pullback da missão;
- slow motion por perfil sem alterar dano, RNG, ondas ou resultado lógico;
- hit-stop exclusivamente de apresentação, sem congelar `stepBattle()`;
- ducking da música antes do impacto;
- som sintético adicional de impacto e victory stinger, sem exigir novos assets;
- eventos `waveFinalFocus`, `waveFinalImpact`, `waveFinalAftermath`, `missionFinalFocus`, `missionFinalImpact` e `missionFinalAftermath`;
- impacto variado por `damageKind`;
- shockwave, flash localizado, flash global discreto na missão final, camera shake e death linger;
- letterbox apenas na última onda;
- sequência final `PERÍMETRO ASSEGURADO` → `MISSÃO CONCLUÍDA`;
- cores finais baseadas em `phase.palette.primary/accent`;
- boss final com perfil de maior intensidade;
- clique passa a acelerar o restante em 2×, sem saltar a máquina de estados;
- `reduceMotion`: sem câmera/shake/hit-stop/letterbox e apresentação encurtada;
- testes unitários e contrato estrutural específicos.


## Reinstalação após falhas do v2.0.0, v2.0.1 ou v2.0.2

Se você já executou o `v2.0.0`, `v2.0.1` ou `v2.0.2` e a instalação parou durante o patch, **não restaure nada**. O `v2.0.3` foi preparado para reparar os estados parciais deixados pelas versões anteriores.

As tentativas anteriores podem ter deixado módulos copiados, imports parciais e partes da integração em estados diferentes. O `v2.0.3` normaliza esses pontos antes de continuar.

```powershell
.\install.ps1 -RepoRoot "C:\Projetos\Genesis" -FullValidation
```

O patcher do `v2.0.3` é idempotente, aceita CRLF ou LF, localiza `lastKill` por estrutura, normaliza o JSX de `WaveOutroOverlay` e reconstrói os imports `waveOutro` de forma canônica. Ele aceita imports em uma linha, multilinha, com aspas simples ou duplas, em ordem diferente, incompletos ou duplicados.

Não é necessário apagar `.genesis-backups`, os arquivos `src/game/waveOutro` nem desfazer as tentativas anteriores.

## Correções de compatibilidade do patcher

O `v2.0.3` mantém a correção ampla do `WaveOutroOverlay` e corrige também a falha `Não foi possível inserir import antes de: import { getWaveOutroCameraTransform } ...`. Em vez de procurar um import textual específico, o patcher remove qualquer variante dos imports de câmera/áudio/renderer e insere um único bloco canônico. Reexecutar o instalador não duplica imports nem código.

## Instalação

No PowerShell:

```powershell
cd "C:\Projetos\Genesis\genesis-wave-outro-cinematic-v2.0.3"

.\install.ps1 `
  -RepoRoot "C:\Projetos\Genesis" `
  -FullValidation
```

Se seu repositório estiver em outra pasta, ajuste `-RepoRoot`.

### Sem executar validação

```powershell
.\install.ps1 -RepoRoot "C:\Projetos\Genesis"
```

## Regra importante: falha de teste NÃO restaura arquivos

Este pacote não contém `restore-patch.mjs` e não possui rollback automático.

Mesmo se ocorrer algo como:

```text
Test Files  1 failed | 5 passed
Tests       4 failed | 122 passed
```

ou se `validate.ps1` retornar código 1, o `install.ps1` captura a falha, mostra o erro e **mantém os arquivos implementados**.

Um backup é criado apenas para recuperação manual em:

```text
.genesis-backups\wave-outro-cinematic-v2.0.3\<timestamp>
```

O instalador nunca usa esse backup automaticamente.

## Validação manual

```powershell
.\validate.ps1 -RepoRoot "C:\Projetos\Genesis"
```

Validação completa:

```powershell
.\validate.ps1 -RepoRoot "C:\Projetos\Genesis" -Full
```

`validate.ps1` pode retornar falha para CI/diagnóstico. Isso também não restaura nenhum arquivo.

## Arquivos novos

```text
src/game/waveOutro/
├── waveOutroProfiles.js
├── waveOutroCamera.js
├── waveOutroAudio.js
├── waveOutroEffects.js
├── waveOutroRenderer.js
├── waveOutroProfiles.test.js
└── waveOutroCamera.test.js

scripts/check-wave-outro-contract.mjs
```

## Arquivos alterados pelo instalador

```text
src/game/battleModel.js
src/game/GameCanvas.jsx
src/game/graphicsRuntime.js
src/styles.css
```

## Teste manual recomendado

1. Finalize uma onda comum com inimigo comum.
2. Finalize uma onda intermediária com Alpha/elite/boss.
3. Finalize a última onda de uma fase normal.
4. Finalize a última onda com boss, especialmente o Leviatã.
5. Confira o ducking antes do impacto e o retorno da câmera.
6. Clique após a proteção inicial e confirme aceleração em 2×, sem pular diretamente o final.
7. Ative `reduceMotion` e confirme ausência de zoom, shake, hit-stop e letterbox.
8. Execute uma fase em 1× e 2× e confirme que o resultado de combate não muda.
