# Genesis — Wave Outro Clean Architecture v3.0.0

Base analisada: `rafaelvalquer/genesis` no commit `c7a3635c264367c47aa4bb5282dd65552c8e9b5b` (`genesis_0.3_CameraFinal`).

Este pacote consolida a cinematografia de final de onda em uma única arquitetura:

```text
battleModel.js
     │
     │ waveOutro
     ▼
┌─────────────────────────────┐
│ waveOutroProfiles.js        │
│ waveOutroCamera.js          │
│ waveOutroAudio.js           │
│ WaveOutroCinematicOverlay   │
└─────────────────────────────┘
     │
     ▼
GameCanvas.jsx
     ├─ consulta câmera
     ├─ consulta áudio
     ├─ dispara cue uma vez
     └─ renderiza UM overlay
```

## Correções incluídas

- remove `SAFE_WAVE_OUTRO_PROFILES` e helpers `getSafe*` do `GameCanvas.jsx`;
- remove o `WaveOutroOverlay` local e mantém apenas `WaveOutroCinematicOverlay`;
- mantém aliases de exportação apenas para compatibilidade, apontando para os módulos reais;
- câmera usa `zoom`, `focusX` e `focusY`, exatamente o contrato consumido por `presentScene()`;
- impacto usa `finalKill/cleanup + elapsedMs`; não existe dependência de `status === "impact"`;
- missão final usa `finalWave`; não existe dependência de `type === "mission_finale"`;
- `getWaveOutroCueState` tolera frame skip e o `useRef` do `GameCanvas` continua garantindo disparo único;
- ducking passa a vir exclusivamente de `waveOutroAudio.js`;
- snapshot público expõe somente `type/x/y/variant` necessários para posicionar o efeito;
- `reduceMotion` mantém mensagens/áudio e remove zoom, shockwave e letterbox;
- remove CSS `safe-wave-*` duplicado;
- remove `waveOutroEffects.js`, `waveOutroRenderer.js` e o contrato antigo caso ainda existam localmente;
- não altera dano, IA, spawn, economia, composição das ondas ou os timings lógicos 600/400/2000/1100 ms.

## Instalação

Encerre o `npm run dev`, extraia este ZIP e execute:

```powershell
cd "C:\Projetos\Genesis\genesis-wave-outro-clean-v3.0.0"
.\install.ps1 -RepoRoot "C:\Projetos\Genesis" -FullValidation
```

O instalador cria backup apenas para recuperação manual. Ele **não faz rollback automático** se testes ou build falharem.

Depois:

```powershell
cd "C:\Projetos\Genesis"
npm run dev
```

## Arquivos efetivamente necessários

O pacote contém somente:

- quatro módulos de runtime em `payload/src/game/waveOutro/`;
- quatro testes direcionados;
- um instalador;
- um validador;
- um script de aplicação estrutural;
- um checker estrutural.

Os arquivos grandes/pacotes históricos existentes na raiz do seu repositório não são tocados automaticamente, pois não fazem parte do runtime desta correção.
