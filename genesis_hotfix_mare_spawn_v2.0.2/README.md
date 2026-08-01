# Genesis — Hotfix da maré na área de spawn v2.0.2

## Correção

A água profunda anteriormente era renderizada e consultada somente entre `firstTroopCol` e `lastTroopCol`. A coluna `enemyEntryCol`, onde os inimigos entram no campo, permanecia visualmente seca e não concedia o bônus de velocidade da maré.

Este hotfix:

- estende a água profunda até a coluna de entrada inimiga;
- cobre todo o canto direito visível do campo;
- considera o inimigo em `FIELD.spawnX` como estando dentro da água;
- aplica o bônus de velocidade desde o spawn, antes de o inimigo entrar na área de tropas;
- remove a falsa linha de costa entre a última célula de tropas e a entrada inimiga;
- mantém a borda direita aberta visualmente, indicando que o oceano continua fora da tela;
- não altera Supply, custos, regeneração, ondas ou regras de posicionamento.

## Instalação no Windows

```powershell
cd C:\Projetos\Genesis\genesis_hotfix_mare_spawn_v2.0.2
Set-ExecutionPolicy -Scope Process Bypass
.\install.ps1 -RepoRoot "C:\Projetos\Genesis"
```

Para também executar o Vite build:

```powershell
.\install.ps1 -RepoRoot "C:\Projetos\Genesis" -Validate
```

Depois:

```powershell
cd C:\Projetos\Genesis
npm run dev
```

## Backup

O instalador cria uma cópia dos arquivos alterados em:

```text
C:\Projetos\Genesis\.genesis-backups\chapter-05-spawn-water-AAAAMMDD-HHMMSS
```

## Arquivos alterados

- `src/game/tideCycle.js`
- `src/game/tideRenderer.js`

Quando o pacote original da maré ainda estiver dentro do repositório, suas cópias em `payload/` também serão corrigidas para que uma reinstalação futura não reverta o ajuste.
