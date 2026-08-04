# Fase 40 — Defesa inicial da missão

Pacote incremental preparado para o repositório `rafaelvalquer/genesis`, analisado no commit-base `9f41528369a3275218f23e39e2606378cd289d07`.

## Alterações

A fase 40 começa com uma guarnição gratuita já posicionada:

- 5 Bastiões de Maré, um por rota, na coluna 6;
- 5 Fuzileiros Voltaicos, um por rota, na coluna 5.

As tropas fornecidas pela missão:

- aparecem mesmo sem estarem selecionadas no loadout;
- não consomem a energia inicial;
- não consomem Supply;
- não iniciam recarga de implantação;
- não entram no histórico `session.deployed` do jogador;
- contam normalmente no limite máximo de unidades daquele tipo;
- recebem dano, cura e participam de todas as mecânicas normais;
- não podem ser removidas manualmente nem gerar reembolso.

Quando uma unidade bônus morrer, uma vaga de implantação é liberada. A reposição só será possível caso o jogador tenha escolhido aquela tropa no loadout e consumirá energia e Supply normalmente.

## Instalação

Extraia o pacote e execute:

```powershell
cd "C:\Projetos\Genesis\genesis-fase40-defesa-inicial-v1.0.0"
.\install.ps1 -RepoRoot "C:\Projetos\Genesis" -Validate
```

Para executar apenas o teste específico, sem o build completo:

```powershell
.\install.ps1 -RepoRoot "C:\Projetos\Genesis" -Validate -SkipBuild
```

O instalador cria um backup em:

```text
C:\Projetos\Genesis\.genesis-backups\fase40-defesa-inicial-AAAAMMDD-HHMMSS
```

## Arquivos alterados

- `src/game/chapterFivePhases.js`
- `src/game/battleModel.js`
- `src/game/phase40StartingDefense.test.js`
