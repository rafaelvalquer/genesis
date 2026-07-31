# Genesis — Corpo inteiro no palco de seleção de tropas

Atualização incremental da tela de seleção de tropas.

## Problema corrigido

O palco aplicava `object-fit: contain`, mas depois ampliava novamente a imagem com `transform: scale(...)`. Algumas unidades também possuíam escala acima de `1` e offsets grandes.

Isso fazia pernas, armas, drones auxiliares e partes laterais ultrapassarem a área visível.

## Nova solução

Cada tropa passa pelo seguinte processo:

1. carrega o primeiro frame da animação;
2. lê o canal alpha da imagem;
3. encontra o retângulo real ocupado pelo personagem;
4. calcula a escala necessária para encaixar esse retângulo no palco;
5. mantém margem segura nas quatro bordas;
6. reutiliza o mesmo enquadramento em todos os frames da animação;
7. recalcula somente quando o palco muda de tamanho.

A medição ignora áreas transparentes. Portanto, sprites 320×256, 384×384 e 512×512 podem ocupar o palco de forma consistente.

## Resultado esperado

- cabeça inteira visível;
- pés e pernas inteiros;
- armas laterais sem corte;
- personagens largos enquadrados;
- drones e unidades flutuantes centralizados;
- muralha e reator inteiros;
- nenhuma pulsação de escala ao trocar frames;
- funcionamento em desktop e mobile;
- suporte a redução de movimento.

## Arquivos alterados

- `src/loadout/loadoutVisualCatalog.js`
- `src/loadout/AnimatedTroopPreview.jsx`
- `src/loadout/useTroopPreviewFrames.js`
- `src/loadout/TroopStage.jsx`

## Arquivos criados

- `src/loadout/troopPreviewFit.js`
- `src/loadout/loadout-full-body-preview.css`
- `src/loadout/troopPreviewFit.test.js`

## Instalação no Windows

Extraia o ZIP. Exemplo:

```text
Pacote:
C:\Projetos\Genesis\genesis_loadout_corpo_inteiro_todas_tropas

Repositório:
C:\Projetos\Genesis
```

Execute:

```powershell
Set-ExecutionPolicy -Scope Process Bypass

cd C:\Projetos\Genesis\genesis_loadout_corpo_inteiro_todas_tropas

.\install.ps1 -RepoRoot "C:\Projetos\Genesis" -Validate
```

O `-Validate` executa somente:

```powershell
npx vitest run src/loadout/troopPreviewFit.test.js src/loadout/previewFrames.test.js src/loadout/LoadoutPage.test.jsx
npx vite build
```

Ele não executa toda a suíte de batalha que já possui falhas independentes da interface.

## Teste manual

```powershell
cd C:\Projetos\Genesis
npm run dev
```

Abra uma missão e entre na seleção de tropas. Percorra todas as tropas usando:

- mouse;
- teclado com setas;
- hover;
- foco.

Verifique especialmente:

- Demolidora de Minas;
- Artilheira de Morteiro;
- Colosso de Impacto;
- Lumi e URSA-7;
- Médica de Nanites;
- Drone Sentinela;
- Muralha;
- Reator.

## Ajustes manuais opcionais

As correções específicas ficam em:

```text
src/loadout/loadoutVisualCatalog.js
```

Exemplo:

```js
demolidora: {
  stageScale: .86,
  stageOffsetX: 8,
  stageOffsetY: 0,
}
```

- `stageScale`: entre `.55` e `1`;
- `stageOffsetX`: deslocamento horizontal em pixels;
- `stageOffsetY`: deslocamento vertical em pixels.

A escala nunca ultrapassa o encaixe calculado, evitando corte mesmo com configuração incorreta.

## Backup

O instalador cria:

```text
<repo>\.genesis-backups\loadout-full-body-AAAAMMDD-HHMMSS\
```
