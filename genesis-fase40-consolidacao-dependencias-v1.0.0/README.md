# Genesis — Consolidação da Fase 40 e dependências de assets v1.0.0

Pacote preparado para o commit-base:

```text
53f6060dc42ea02d6fb6ba5b5456d6eba09e9ae4
```

## Alterações

### Dependências genéricas de tropas

Adiciona `resolvePhaseTroopAssetDependencies(phase, loadout)`, considerando:

- loadout do jogador;
- `startingTroops`;
- `requiredTroopAssetIds`;
- aliados invocados;
- tropas temporárias;
- transformações de uma tropa em outra;
- declarações agrupadas em `troopAssetDependencies`.

`resolveBattleTroopAssetIds` permanece como alias compatível.

### Contrato único da Fase 40

Cria:

```text
src/game/chapter05/phase40Scenario.js
```

O contrato centraliza:

- 15 tropas da defesa inicial;
- regras de energia, Supply, loadout, remoção e reembolso;
- dependências obrigatórias de sprites;
- sequências das seis ondas;
- intervalos entre pacotes;
- limite simultâneo de 48 inimigos;
- Leviatã e seus reforços.

### Capítulo 5

- remove as ondas legadas dos blueprints das fases 33–40;
- exporta `CHAPTER_FIVE_PHASE_BLUEPRINTS`;
- elimina comparações repetidas `phaseIndex === 7`;
- mantém compatibilidade com `createChapterFiveWaves(7)`;
- permite a nova assinatura por objeto.

## Instalação

Extraia o pacote e execute:

```powershell
cd "C:\Projetos\Genesis\genesis-fase40-consolidacao-dependencias-v1.0.0"

.\install.ps1 -RepoRoot "C:\Projetos\Genesis" -Validate
```

Para executar também toda a suíte do repositório:

```powershell
.\install.ps1 -RepoRoot "C:\Projetos\Genesis" -Validate -FullSuite
```

A validação padrão não executa auditorias artísticas nem orçamento de assets. Ela executa somente os testes relacionados à consolidação.

## Backup

Antes de alterar os arquivos, o instalador cria:

```text
C:\Projetos\Genesis\.genesis-backups\fase40-consolidacao-AAAAMMDD-HHMMSS
```

Em caso de falha, os arquivos anteriores são restaurados automaticamente.
