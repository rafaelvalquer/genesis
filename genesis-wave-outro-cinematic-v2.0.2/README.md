# Genesis — Final de onda cinematográfico v2.0.2

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


## Reinstalação após falhas do v2.0.0 ou v2.0.1

Se você já executou o `v2.0.0` e recebeu `Patch incompatível: snapshot público do último abate`, ou executou o `v2.0.1` e recebeu `Patch incompatível: props do WaveOutroOverlay`, **não restaure nada**.

As tentativas anteriores podem ter deixado módulos copiados e partes da integração em estados diferentes. O `v2.0.2` foi feito para continuar a partir desses estados parciais.

```powershell
.\install.ps1 -RepoRoot "C:\Projetos\Genesis" -FullValidation
```

O patcher do `v2.0.2` é idempotente e mais tolerante no `GameCanvas.jsx`: reconhece módulos já copiados, aceita CRLF ou LF, localiza `lastKill` por estrutura e normaliza qualquer uso de `WaveOutroOverlay` que renderize `snapshot.waveOutro`, independentemente da ordem das props ou quebra de linhas.

Não é necessário apagar `.genesis-backups`, os arquivos `src/game/waveOutro` nem desfazer as tentativas anteriores.

## Correção específica do `WaveOutroOverlay`

O `v2.0.1` procurava apenas a forma exata:

```jsx
<WaveOutroOverlay outro={snapshot.waveOutro} />
```

O `v2.0.2` aceita também JSX multilinha, props adicionais, props em outra ordem, integração parcial anterior e tag pareada. O patcher registra cada etapa como `aplicado`, `já presente`, `preservado` ou `ajustado por fallback`.

## Instalação

No PowerShell:

```powershell
cd "C:\Projetos\Genesis\genesis-wave-outro-cinematic-v2.0.2"

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
.genesis-backups\wave-outro-cinematic-v2.0.2\<timestamp>
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
