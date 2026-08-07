# Genesis — Controles de batalha e tela cheia v1.1.0

Pacote cumulativo para o Genesis. Mantém as hotkeys anteriores e acrescenta:

- pausa com duas barras SVG reais;
- play em SVG quando pausado;
- botão de tela cheia na top bar;
- hotkey `F`;
- saída por `Esc` sincronizada com a interface;
- fallback WebKit;
- testes e contratos.

A Fullscreen API é utilizada porque páginas web não podem reproduzir diretamente o comportamento da tecla F11 do navegador.

## Instalação mantendo os arquivos em caso de falha

```powershell
cd "C:\Projetos\Genesis\genesis-battle-controls-fullscreen-v1.1.0"

.\install.ps1 `
  -RepoRoot "C:\Projetos\Genesis" `
  -FullValidation
```

O instalador mantém os arquivos instalados caso a validação falhe. Para restaurar automaticamente, acrescente `-RollbackOnValidationFailure`.

## Instalação sem validação

```powershell
.\install.ps1 `
  -RepoRoot "C:\Projetos\Genesis"
```

## Validação manual

```powershell
.\validate.ps1 `
  -RepoRoot "C:\Projetos\Genesis" `
  -Full
```

## Execução do jogo

```powershell
cd "C:\Projetos\Genesis"
npm.cmd run dev
```

## Teste manual

1. Entre em uma batalha.
2. Confirme que o botão de pausa exibe duas barras, não `Ⅱ`.
3. Pressione `Espaço` e confirme a troca para o ícone de play.
4. Clique no botão de tela cheia.
5. Confirme que toda a interface de batalha ocupa a tela.
6. Pressione `Esc` e confirme que a tela cheia termina.
7. Pressione `F` para entrar e sair novamente.
8. Confirme que pausa, velocidade, seleção de tropas, remoção e início da onda continuam funcionando.
9. Entre em tela cheia e clique em `Sair`; a campanha deve abrir fora do fullscreen.

## Desinstalação

```powershell
.\uninstall.ps1 `
  -RepoRoot "C:\Projetos\Genesis"
```

Backups ficam em:

```text
C:\Projetos\Genesis\.genesis-backups\battle-controls-fullscreen-v1.1.0\
```
