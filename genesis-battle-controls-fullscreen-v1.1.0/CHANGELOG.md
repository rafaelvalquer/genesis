# Changelog

## 1.1.0 — 2026-08-06

- substitui o numeral romano `Ⅱ` por um ícone SVG de pausa com duas barras reais;
- mantém o ícone de continuar como SVG, sem depender da fonte do sistema;
- adiciona botão de tela cheia na top bar da batalha;
- adiciona atalho `F` para entrar e sair da tela cheia;
- usa a Fullscreen API em vez de simular a tecla F11;
- sincroniza o botão com `fullscreenchange` e saída por `Esc`;
- preserva a seleção de ferramenta quando `Esc` é usado para sair da tela cheia;
- encerra a tela cheia antes de sair da batalha;
- mantém pausa, velocidade, hotkeys, ondas e lógica do motor inalteradas;
- adiciona fallback WebKit, acessibilidade, testes e contratos de integração.
