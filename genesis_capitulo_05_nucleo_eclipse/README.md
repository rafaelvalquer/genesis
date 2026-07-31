# Genesis — Capítulo 5: Núcleo do Eclipse

Atualização completa da campanha para **5 capítulos e 40 fases**.

## Conteúdo do capítulo

### Capítulo 05 — Núcleo do Eclipse

**Tema:** convergência dos quatro biomas anteriores sobre uma fenda planetária.

**Identidade visual:**

- magenta, violeta e ciano;
- iluminação física neutra e fria;
- atmosfera magenta;
- preenchimento ciano;
- cicatrizes emissivas;
- obeliscos na superfície;
- coroa orbital;
- fragmentos em órbita;
- beacon procedural do núcleo.

### Fases

| Fase | Nome |
|---|---|
| 33 | Horizonte Partido |
| 34 | Jardim do Vazio |
| 35 | Maré Invertida |
| 36 | Fenda Rubra |
| 37 | Ossuário Celeste |
| 38 | Forja Nula |
| 39 | Coração Invertido |
| 40 | Trono do Eclipse |

As ondas combinam inimigos dos capítulos 1 a 4. Não foram adicionados sprites de inimigos novos, evitando assets ausentes e mantendo o capítulo imediatamente jogável.

## Progressão e saves existentes

Antes desta atualização, a vitória na fase 32 era limitada ao índice 31 porque não havia uma fase seguinte.

A migração agora detecta fases concluídas e libera a próxima automaticamente.

Um save com:

```text
fase_32.victories > 0
unlockedPhaseIndex = 31
```

é migrado para:

```text
unlockedPhaseIndex = 32
currentPhaseId = fase_33
```

## Planeta 3D

O novo kit é adicionado em:

```text
GenesisChapterEffectsRoot
└── Chapter05_EclipseEffects
    ├── EclipseObelisks
    ├── EclipseFracture_*
    ├── EclipseCorona
    ├── EclipseOrbitalFragments
    ├── EclipseCyanFragments
    └── EclipseCoreBeacon
```

O kit usa:

- `InstancedMesh`;
- geometrias simples;
- materiais compartilhados;
- partículas agrupadas;
- ausência de sombras dinâmicas;
- crossfade com os outros capítulos.

## Interface

O capítulo aparece em:

- Progresso da Campanha no Comando;
- trilho lateral da Campanha;
- visão orbital;
- rotas e marcadores no planeta;
- card da missão;
- progresso geral;
- contagem de estrelas;
- desbloqueio de fases;
- seleção de tropas;
- carregamento da batalha.

A grade do Comando passa a comportar cinco capítulos e o trilho da Campanha recebe rolagem vertical em telas menores.

## Arte das arenas

As novas fases reutilizam artes existentes como ecos dos quatro biomas. Isso mantém o pacote leve e evita imagens ausentes.

A geometria, as cores, os efeitos ambientais e o tema procedural são exclusivos do Capítulo 5.

## Arquivos novos

```text
src/game/chapterFivePhases.js
src/game/chapterFiveContent.test.js
src/campaign/campaignSceneData.test.js
src/visual/effects/createEclipsePlanetEffects.js
```

## Arquivos atualizados ou substituídos

```text
src/game/content.js
src/campaign/campaignSceneData.js
src/campaign/campaignBiomes.js
src/campaign/storage.js
src/campaign/storage.test.js
src/campaign/campaignBiomes.test.js
src/visual/createGenesisChapterEffects.js
src/visual/createGenesisChapterEffects.test.js
src/visual/genesis-world-themes.css
src/visual/genesisPlanetMaterials.js
```

Os quatro kits 3D anteriores também estão incluídos para manter o pacote autossuficiente em relação ao sistema de temas já presente no repositório.

## Instalação no Windows

Exemplo:

```text
Pacote:
C:\Projetos\Genesis\genesis_capitulo_05_nucleo_eclipse

Repositório:
C:\Projetos\Genesis
```

Execute:

```powershell
Set-ExecutionPolicy -Scope Process Bypass

cd C:\Projetos\Genesis\genesis_capitulo_05_nucleo_eclipse

.\install.ps1 -RepoRoot "C:\Projetos\Genesis" -Validate
```

## Validação executada

```powershell
npx vitest run src/game/chapterFiveContent.test.js src/campaign/storage.test.js src/campaign/campaignBiomes.test.js src/campaign/campaignSceneData.test.js src/visual/createGenesisChapterEffects.test.js src/visual/createGenesisPlanetLights.test.js src/home/CommandPage.test.jsx

npx vite build
```

O instalador não executa toda a suíte de batalha, que anteriormente apresentou falhas independentes das telas da campanha.

## Teste manual

```powershell
cd C:\Projetos\Genesis
npm run dev
```

### Save com capítulo 4 concluído

1. Abra a tela Comando.
2. Confirme que o Capítulo 5 está acessível.
3. Selecione o Capítulo 5.
4. Confira as oito missões no planeta.
5. Clique nas missões e valide o card direito.
6. Abra a Campanha e confira o quinto item no trilho lateral.
7. Inicie a fase 33.
8. Vença a fase e confirme o desbloqueio da fase 34.

### Save sem capítulo 4 concluído

O Capítulo 5 aparece bloqueado e é liberado após a conclusão da fase 32.

### Efeitos 3D

Ao selecionar o Capítulo 5, valide:

- iluminação magenta e ciano;
- obeliscos na superfície;
- cicatrizes luminosas;
- anéis da coroa orbital;
- fragmentos em movimento;
- beacon no centro da região;
- crossfade ao alternar entre capítulos;
- redução das animações com `Reduzir movimento`.

## Backup

O instalador cria:

```text
<repo>\.genesis-backups\chapter-05-eclipse-AAAAMMDD-HHMMSS\
```
