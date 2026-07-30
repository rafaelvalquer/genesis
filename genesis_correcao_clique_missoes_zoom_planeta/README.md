# Genesis — Correção do clique das missões e zoom orbital

Pacote incremental para a tela **Comando Orbital**.

## Problema corrigido

O palco orbital executava `setPointerCapture()` quando o usuário pressionava um marcador. Como o evento do botão subia até o palco, a captura era transferida para o planeta e o clique não chegava corretamente à missão.

Isso era mais perceptível em capítulos concluídos porque a seleção inicial permanecia sempre na última missão acessível.

A correção:

- interrompe `pointerdown`, `pointermove`, `pointerup`, `pointercancel` e `click` no marcador;
- impede o palco de iniciar arraste sobre qualquer elemento interativo;
- mantém missões concluídas selecionáveis;
- mantém somente missões bloqueadas desabilitadas.

## Zoom adicionado

A visualização orbital agora aceita:

- roda do mouse;
- scroll vertical do trackpad;
- gesto de pinça em telas touch;
- botão `+`;
- botão `−`;
- botão percentual para restaurar;
- tecla `+` para aproximar;
- tecla `-` para afastar;
- tecla `0` para restaurar.

O zoom possui limites para evitar entrar dentro do planeta ou afastar demais.

## Arquivos alterados

- `src/home/CommandGlobe.jsx`
- `src/home/CommandPhaseMarker.jsx`

## Arquivos criados

- `src/home/commandGlobeZoom.js`
- `src/home/command-globe-interactions.css`
- `src/home/CommandPhaseMarker.test.jsx`
- `src/home/commandGlobeZoom.test.js`

## Instalação no Windows

Extraia o ZIP. Exemplo:

```text
Pacote:
C:\Projetos\Genesis\genesis_correcao_clique_missoes_zoom_planeta

Repositório:
C:\Projetos\Genesis
```

Execute:

```powershell
Set-ExecutionPolicy -Scope Process Bypass

cd C:\Projetos\Genesis\genesis_correcao_clique_missoes_zoom_planeta

.\install.ps1 -RepoRoot "C:\Projetos\Genesis" -Validate
```

O `-Validate` executa somente:

```powershell
npx vitest run src/home/CommandPage.test.jsx src/home/CommandPhaseMarker.test.jsx src/home/commandGlobeZoom.test.js
npx vite build
```

Ele não executa novamente toda a suíte de batalha que apresentou falhas independentes desta tela.

## Teste manual

```powershell
cd C:\Projetos\Genesis
npm run dev
```

Na tela Comando:

1. selecione um capítulo já concluído;
2. clique em uma missão antiga diretamente no planeta;
3. confirme que o card direito muda para essa missão;
4. confirme que os monstros, ondas, energia e CTA também mudam;
5. teste roda do mouse e trackpad;
6. teste os botões `+`, percentual e `−`;
7. em celular/tablet, teste a pinça com dois dedos;
8. pressione `0` com o mapa focado para restaurar o zoom.

## Backup

O instalador cria:

```text
<repo>\.genesis-backups\command-marker-zoom-AAAAMMDD-HHMMSS\
```
