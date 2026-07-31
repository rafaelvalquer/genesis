# Genesis — Identidade visual e kits 3D por capítulo

Atualização compartilhada da **Tela Comando Orbital** e da **Campanha**.

## O que foi implementado

### Correção do capítulo 3

A luz do deserto não usa mais atmosfera âmbar como preenchimento e contorno ao mesmo tempo.

Nova composição:

- sol quase neutro: `#fff4e8`;
- preenchimento azulado: `#bfe7f5`;
- contorno laranja: `#f97316`;
- atmosfera e poeira âmbar;
- interface âmbar com dados em turquesa;
- exposição reduzida para `0.98`.

Assim, o capítulo continua parecendo deserto sem aplicar um filtro amarelo sobre oceanos, continentes e demais biomas do GLB.

### Identidade de cada mundo

#### Capítulo 1 — Colmeia bioluminescente

- interface ciano e verde-petróleo;
- padrão orgânico/hexagonal;
- veios luminosos sobre o planeta;
- colmeias instanciadas;
- esporos orbitais;
- pulsação emissiva lenta.

#### Capítulo 2 — Mar de Vidro

- interface violeta e menta;
- formas facetadas;
- cristais instanciados;
- aurora prismática;
- fragmentos orbitais;
- brilho cristalino variável.

#### Capítulo 3 — Deserto de Quitina

- interface âmbar, cobre e turquesa;
- painéis com linguagem de placas;
- chifres de quitina;
- ossada colossal parcialmente exposta;
- corrente de areia;
- faixa de poeira localizada.

#### Capítulo 4 — Trono da Tempestade

- interface azul elétrico e violeta;
- linhas de vento;
- ciclone orbital;
- nuvens elétricas;
- detritos suspensos;
- relâmpagos intermitentes.

## Arquitetura

Os quatro kits são criados uma única vez em:

```text
GenesisChapterEffectsRoot
├── Chapter01_HiveEffects
├── Chapter02_GlassEffects
├── Chapter03_ChitinEffects
└── Chapter04_StormEffects
```

Ao trocar de capítulo:

- o kit anterior desaparece por crossfade;
- o novo kit aparece;
- luzes interpolam;
- exposição interpola;
- atmosfera, névoa e partículas mudam;
- interface troca de linguagem visual;
- o GLB principal não é recriado.

## Desempenho

Perfis incluídos:

| Perfil | Estruturas | Partículas | Linhas |
|---|---:|---:|---:|
| Low | 12 | 26 | 2 |
| Medium | 26 | 72 | 4 |
| High | 44 | 150 | 6 |

A implementação utiliza:

- `InstancedMesh`;
- materiais compartilhados;
- partículas agrupadas;
- ausência de sombras dinâmicas;
- geometrias simples;
- efeitos criados somente uma vez.

## Arquivos alterados

```text
src/campaign/campaignBiomes.js
src/campaign/CampaignPage.jsx
src/campaign/CampaignPlanet.jsx
src/home/CommandPage.jsx
src/home/CommandGlobeScene.js
src/visual/createGenesisPlanetLights.js
```

## Arquivos novos

```text
src/visual/applyGenesisWorldTheme.js
src/visual/createGenesisChapterEffects.js
src/visual/genesis-world-themes.css

src/visual/effects/genesisEffectUtils.js
src/visual/effects/createHivePlanetEffects.js
src/visual/effects/createGlassPlanetEffects.js
src/visual/effects/createChitinPlanetEffects.js
src/visual/effects/createStormPlanetEffects.js

src/campaign/campaignBiomes.test.js
src/visual/createGenesisPlanetLights.test.js
src/visual/createGenesisChapterEffects.test.js
```

## Instalação no Windows

Exemplo:

```text
Pacote:
C:\Projetos\Genesis\genesis_identidade_visual_mundos_capitulos

Repositório:
C:\Projetos\Genesis
```

Execute:

```powershell
Set-ExecutionPolicy -Scope Process Bypass

cd C:\Projetos\Genesis\genesis_identidade_visual_mundos_capitulos

.\install.ps1 -RepoRoot "C:\Projetos\Genesis" -Validate
```

## Validação executada

```powershell
npx vitest run src/campaign/campaignBiomes.test.js src/visual/createGenesisPlanetLights.test.js src/visual/createGenesisChapterEffects.test.js src/home/CommandPage.test.jsx

npx vite build
```

O instalador não executa toda a suíte de batalha, que já apresentou falhas independentes das telas de campanha.

## Teste manual

```powershell
cd C:\Projetos\Genesis
npm run dev
```

### Comando Orbital

1. selecione cada capítulo em `PROGRESSO DA CAMPANHA`;
2. verifique a troca gradual das luzes;
3. confirme que o capítulo 3 mantém as cores naturais do planeta;
4. observe veios, cristais, ossada/dunas e tempestade;
5. teste rotação e zoom;
6. troque rapidamente entre capítulos para validar o crossfade.

### Campanha

1. abra cada capítulo pelo trilho lateral;
2. confira a mesma identidade da tela Comando;
3. valide marcadores e rotas;
4. confira os efeitos em qualidade High, Medium e Low;
5. ative `Reduzir movimento` e confirme a redução das animações.

## Backup

O instalador cria:

```text
<repo>\.genesis-backups\world-themes-AAAAMMDD-HHMMSS\
```

Para rollback, restaure os arquivos dessa pasta.
