# Genesis — Luz e chão ancorados + efeito ao clicar na tropa

Atualização da tela de seleção de tropas.

## Alterações

### Efeitos próximos ao personagem

O enquadramento de corpo inteiro mede os pixels visíveis do sprite. Agora essa mesma medição também controla:

- posição horizontal da plataforma;
- posição vertical da plataforma;
- tamanho dos anéis do chão;
- início e fim do feixe de luz;
- posição da luz superior;
- largura do brilho no chão.

O ponto inferior real do sprite é tratado como a posição dos pés. Portanto, a plataforma sobe ou desce automaticamente para cada personagem.

### Interação ao clicar

Clique diretamente no corpo do personagem para executar:

- flash holográfico no sprite;
- aumento temporário da luz superior;
- onda de energia no chão;
- três pulsos concêntricos;
- pulso 3D nos anéis da plataforma.

A interação também funciona por teclado: use `Tab` até o personagem e pressione `Enter` ou `Espaço`.

Com **Reduzir movimento**, o efeito é mais curto e não usa expansão prolongada.

## Arquivos alterados

- `src/loadout/AnimatedTroopPreview.jsx`
- `src/loadout/TroopStage.jsx`
- `src/loadout/TroopStageScene.js`
- `src/loadout/loadout-full-body-preview.css`
- `src/loadout/loadoutVisualCatalog.js`
- `src/loadout/troopPreviewFit.js`
- `src/loadout/useTroopPreviewFrames.js`

## Arquivos novos

- `src/loadout/troopStageEffects.js`
- `src/loadout/loadout-stage-interactions.css`
- `src/loadout/troopStageEffects.test.js`
- `src/loadout/troopStageInteraction.test.js`

## Instalação no Windows

Extraia o ZIP. Exemplo:

```text
Pacote:
C:\Projetos\Genesis\genesis_loadout_efeitos_ancorados_e_clique

Repositório:
C:\Projetos\Genesis
```

Execute:

```powershell
Set-ExecutionPolicy -Scope Process Bypass

cd C:\Projetos\Genesis\genesis_loadout_efeitos_ancorados_e_clique

.\install.ps1 -RepoRoot "C:\Projetos\Genesis" -Validate
```

## Validação executada pelo instalador

```powershell
npx vitest run src/loadout/troopPreviewFit.test.js src/loadout/troopStageEffects.test.js src/loadout/troopStageInteraction.test.js src/loadout/previewFrames.test.js src/loadout/LoadoutPage.test.jsx

npx vite build
```

A validação não executa toda a suíte de batalha que já possui falhas independentes da interface.

## Teste manual

```powershell
cd C:\Projetos\Genesis
npm run dev
```

Na seleção de tropas:

1. percorra personagens baixos, altos, largos e flutuantes;
2. confirme que os anéis aparecem imediatamente sob os pés;
3. confirme que o feixe acompanha o centro do corpo;
4. clique no corpo do personagem;
5. verifique o flash, o pulso e a onda no chão;
6. altere para outra tropa e repita;
7. teste em resoluções diferentes;
8. teste com redução de movimento.

## Backup

O instalador cria:

```text
<repo>\.genesis-backups\loadout-anchored-effects-AAAAMMDD-HHMMSS\
```
