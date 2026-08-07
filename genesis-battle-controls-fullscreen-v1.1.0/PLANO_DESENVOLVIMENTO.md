# Plano de desenvolvimento — Controles de pausa e tela cheia

## Objetivo

Melhorar a leitura e o uso dos controles da top bar sem alterar o motor de batalha.

## Escopo funcional

1. Trocar o caractere romano `Ⅱ` por duas barras SVG independentes.
2. Exibir um triângulo SVG quando a batalha estiver pausada.
3. Adicionar um botão de tela cheia na top bar.
4. Usar a Fullscreen API sobre o elemento `.battle-shell`.
5. Adicionar a hotkey `F` para alternar tela cheia.
6. Preservar `Espaço` como pause/continuar.
7. Permitir `Esc` para sair do fullscreen sem cancelar simultaneamente a ferramenta ativa.
8. Sair do fullscreen antes de navegar para fora da batalha.

## Arquitetura

- `BattleControlIcons.jsx`: ícones vetoriais independentes da fonte.
- `useBattleFullscreen.js`: encapsula suporte, entrada, saída, eventos e fallback WebKit.
- `battleHotkeys.js`: adiciona somente a ação `toggleFullscreen` para a tecla `F`.
- `GameCanvas.jsx`: integra o hook e os botões, sem tocar em `stepBattle` ou na sessão.
- `styles.css`: aplica alinhamento dos ícones e regras do elemento em fullscreen.

## Compatibilidade

O pacote é cumulativo com `genesis-battle-hotkeys-v1.0.0`. Ele pode ser aplicado tanto após a instalação anterior quanto diretamente sobre a base indicada no manifesto.

Nenhuma alteração é feita em:

- `battleModel.js`;
- lógica de pausa do loop;
- velocidade de simulação;
- posicionamento de tropas;
- inimigos;
- ondas;
- energia e supply;
- áudio;
- salvamento da campanha.

## Critérios de aceite

- o caractere `Ⅱ` não aparece mais no botão;
- o ícone de pausa possui exatamente duas barras;
- o botão muda para play quando pausado;
- a barra de espaço continua funcionando;
- o botão de fullscreen entra e sai corretamente;
- `F` alterna fullscreen;
- `Esc` sai do fullscreen sem cancelar a ferramenta no mesmo evento;
- o botão acompanha saídas externas por `Esc`;
- sair da batalha encerra fullscreen;
- testes específicos e build passam.
