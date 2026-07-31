# Genesis — Sincronização de capítulos, missões e card da tela Comando

Este pacote atualiza a tela **Comando Orbital** para manter uma única seleção compartilhada entre:

- capítulo selecionado em **PROGRESSO DA CAMPANHA**;
- iluminação e tema visual do planeta;
- missões exibidas sobre o planeta;
- missão selecionada;
- toolbar orbital;
- card lateral de inteligência;
- hostis projetados;
- link de preparação do esquadrão;
- link **EXPLORAR NO MAPA**.

## Comportamento após a atualização

1. Clique em um capítulo acessível em **PROGRESSO DA CAMPANHA**.
2. O planeta recebe o bioma, as cores e as luzes desse capítulo.
3. Os marcadores passam a mostrar apenas as missões desse capítulo.
4. A missão acessível mais recente é selecionada automaticamente.
5. Clique em qualquer marcador acessível.
6. O card lateral passa a mostrar os dados, ondas, energia, integridade, mecânica e monstros dessa missão.
7. A seleção é local e não altera o progresso salvo da campanha.

O hover não troca mais silenciosamente o capítulo. A mudança principal ocorre por clique, foco e seleção explícita.

## Arquivos alterados

- `src/home/CommandPage.jsx`
- `src/home/CurrentOperation.jsx`
- `src/home/ChapterProgress.jsx`
- `src/home/ChapterProgressItem.jsx`
- `src/home/CommandPage.test.jsx`

## Arquivo criado

- `src/home/command-selection-enhancements.css`

## Instalação no Windows

Extraia o ZIP. Considerando:

```text
Pacote:
C:\Projetos\Genesis\genesis_comando_sincronizacao_capitulos_missoes

Repositório:
C:\Projetos\Genesis
```

Execute no PowerShell:

```powershell
Set-ExecutionPolicy -Scope Process Bypass

cd C:\Projetos\Genesis\genesis_comando_sincronizacao_capitulos_missoes

.\install.ps1 -RepoRoot "C:\Projetos\Genesis"
```

Para instalar e executar testes/build automaticamente:

```powershell
.\install.ps1 -RepoRoot "C:\Projetos\Genesis" -Validate
```

## Linux/macOS

```bash
cd /caminho/genesis_comando_sincronizacao_capitulos_missoes
./install.sh /caminho/para/genesis
```

Com validação:

```bash
./install.sh /caminho/para/genesis --validate
```

## Validação manual

Na raiz do Genesis:

```powershell
npm run test:unit
npm run build
npm run dev
```

Validar:

- capítulo 1 seleciona missões do capítulo 1;
- capítulo 2 seleciona missões do capítulo 2;
- capítulo 3 altera as luzes e a paleta do planeta;
- o card direito mostra a missão selecionada, não apenas a operação atual;
- os retratos e quantidades dos monstros mudam com a missão;
- o CTA aponta para `/jogar/<fase selecionada>`;
- `EXPLORAR NO MAPA` aponta para o capítulo e a fase selecionados;
- capítulos bloqueados continuam desabilitados;
- missões bloqueadas continuam sem clique;
- o novo `genesis-planeta-multibiomas1.glb` continua sendo usado normalmente.

## Backup e rollback

O instalador cria backup em:

```text
<repo>\.genesis-backups\command-sync-AAAAMMDD-HHMMSS\
```

Para rollback, copie os arquivos dessa pasta de volta para o repositório.

## Observação

Este pacote não substitui nem modifica o GLB. Ele trabalha sobre o carregamento compartilhado já existente e mantém a troca de iluminação implementada em `CommandGlobeScene.js`.
