# Genesis — Final de onda cinematográfico v2.1.0 SAFE REPAIR

Esta versão foi criada para corrigir instalações acumuladas das versões v2.0.0 até v2.0.4 que podem deixar `GameCanvas.jsx`, `battleModel.js` e `graphicsRuntime.js` em estados intermediários.

## O que muda

- normaliza o motor de `waveOutro` para o fluxo estável existente no Genesis;
- remove imports e dependências experimentais `src/game/waveOutro/*` do caminho crítico da batalha;
- remove o hit-stop experimental de `graphicsRuntime`;
- mantém a cinematografia no `GameCanvas` e CSS, onde ela só é usada quando o encerramento de onda está ativo;
- mantém foco/zoom no último inimigo, perfis normal/cinemático/final/boss, letterbox, flash/shockwave, identidade visual da fase, ducking de áudio e vitória em dois estágios;
- não cria `AudioContext` durante a montagem;
- não altera `createBattleSession`, criação de React hooks ou estrutura do `App.jsx`;
- não restaura automaticamente arquivos em caso de falha de validação.

## Instalação

Feche o servidor Vite antes de instalar.

```powershell
cd "C:\Projetos\Genesis\genesis-wave-outro-cinematic-v2.1.0-safe-repair"
.\install.ps1 -RepoRoot "C:\Projetos\Genesis" -FullValidation
```

Depois:

```powershell
cd "C:\Projetos\Genesis"
npm run dev
```

O instalador remove `node_modules/.vite`. Depois faça um hard reload no navegador (`Ctrl+F5`).

## Observação sobre o erro `Could not establish connection`

Essa mensagem é típica de mensageria de extensão do Chrome/Edge e não é gerada pelo Genesis. O reparo foca o erro React que desmonta a batalha.
