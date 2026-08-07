# Genesis — Hotkeys de batalha v1.0.0

Base analisada: `rafaelvalquer/genesis`, commit `0fe940304f112086c5039b69a6cc49f560bc73ab`.

O pacote adiciona atalhos de teclado à batalha sem alterar o motor, a simulação, as regras de posicionamento ou as mecânicas dos personagens.

## Funcionalidades

- `1` a `8`: seleciona a tropa na mesma posição visual do loadout;
- teclado numérico `1` a `8`: mesma função;
- pressionar novamente a tecla da tropa selecionada: volta para mão livre;
- `Espaço`: pausa ou continua a batalha;
- `R`: ativa ou desativa remoção;
- `Esc`: cancela a ferramenta atual;
- `Enter`: inicia a onda quando permitido;
- `+` e `-`: ajustam a velocidade dentro dos limites existentes;
- marcador numérico visível em cada cartão;
- ajuda rápida no trilho do loadout;
- atributos `aria-keyshortcuts` nos controles;
- hotkeys ignoradas em inputs, selects, links, botões e campos editáveis;
- repetição automática da tecla e modificadores de sistema são ignorados.

A seleção por hotkey respeita as mesmas restrições existentes de energia, supply, cooldown, limite de unidades, modo livre do laboratório e seleções posicionais.

## Instalação

Extraia o ZIP e execute:

```powershell
cd "C:\Projetos\Genesis\genesis-battle-hotkeys-v1.0.0"

.\install.ps1 `
  -RepoRoot "C:\Projetos\Genesis" `
  -Validate
```

A validação básica verifica o contrato, a sintaxe e os testes específicos. Caso falhe, os arquivos instalados são mantidos por padrão.

Validação completa:

```powershell
.\install.ps1 `
  -RepoRoot "C:\Projetos\Genesis" `
  -FullValidation
```

Para restaurar automaticamente somente quando a validação falhar:

```powershell
.\install.ps1 `
  -RepoRoot "C:\Projetos\Genesis" `
  -FullValidation `
  -RollbackOnValidationFailure
```

## Validação manual

```powershell
.\validate.ps1 `
  -RepoRoot "C:\Projetos\Genesis" `
  -Full
```

## Restauração

```powershell
.\uninstall.ps1 `
  -RepoRoot "C:\Projetos\Genesis"
```

Os backups ficam em:

```text
C:\Projetos\Genesis\.genesis-backups\battle-hotkeys-v1.0.0\
```

## Teste manual

1. Abra uma fase e entre na batalha.
2. Pressione `1`, `2`, `3` e confirme que os cartões correspondentes são selecionados.
3. Pressione novamente a mesma tecla e confirme a volta para mão livre.
4. Pressione `Espaço` e confirme que a simulação é pausada; pressione novamente para continuar.
5. Pressione `R` e confirme o modo de remoção.
6. Pressione `Esc` e confirme que a ferramenta é cancelada.
7. Durante a preparação, pressione `Enter` e confirme o início da onda.
8. Use `+` e `-` para alterar a velocidade.
9. Confirme que uma tropa sem energia, em cooldown ou no limite não é selecionada por hotkey.
10. No Campo de Provas, clique em um input e confirme que as teclas não acionam comandos globais.

## Arquivos adicionados

- `src/game/battleHotkeys.js`
- `src/game/battleHotkeys.test.js`
- `scripts/check-battle-hotkeys-contract.mjs`

## Arquivos modificados

- `src/game/GameCanvas.jsx`
- `src/styles.css`
