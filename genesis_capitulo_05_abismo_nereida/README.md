# Genesis — Capítulo 5: Abismo de Nereida

Pacote de atualização para o repositório `rafaelvalquer/genesis`.

## Entrega

- converte o Capítulo 5 existente de **Núcleo do Eclipse** para **Abismo de Nereida**;
- mantém as oito missões, das fases 33 a 40;
- adiciona uma imagem WebP própria para cada missão e uma capa do capítulo;
- implementa a mecânica probabilística de maré baixa e maré alta;
- usa somente inimigos que já existem no projeto;
- configura seis ondas em todas as missões;
- configura Supply inicial e máximo em **40/40**;
- mantém o loadout do Capítulo 5 com até oito tipos de tropa;
- cria backup antes de substituir ou alterar arquivos.

## Regra da maré

Durante uma onda, a primeira verificação acontece após aproximadamente 20 segundos. Novas verificações ocorrem a cada 12 segundos enquanto o evento estiver elegível.

A chance considera a quantidade de tropas vivas:

```text
chance = chanceBase + tropasExtras × chancePorTropa
```

A maré percorre os estados:

```text
idle → warning → rising → high → receding → idle
```

Durante a maré alta:

- inimigos que ainda estejam nas colunas inundadas recebem bônus de velocidade;
- tropas não são empurradas ou movidas;
- a água não causa dano direto;
- a maré registra eliminações reais de tropas;
- remoções manuais não são consideradas eliminações.

Ao final da maré alta:

- se nenhuma tropa tiver sido eliminada, uma nova maré poderá acontecer na mesma onda;
- se uma ou mais tropas tiverem sido eliminadas, as verificações são encerradas até a próxima onda.

## Instalação no Windows

Para o pacote localizado em:

```text
C:\Projetos\Genesis\genesis_capitulo_05_abismo_nereida
```

Abra o PowerShell nessa pasta e execute:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\install.ps1 -Validate
```

O instalador procura automaticamente o projeto primeiro em:

```text
C:\Projetos\Genesis
```

e, como alternativa, em:

```text
C:\Projetos\Genesis\genesis
```

Sem executar testes e build:

```powershell
.\install.ps1
```

Também continua possível informar a raiz manualmente:

```powershell
.\install.ps1 -RepoRoot "C:\Projetos\Genesis" -Validate
```

## Instalação no Linux/macOS

```bash
chmod +x install.sh
./install.sh /caminho/para/genesis --validate
```

## Dependência da estrutura existente

O pacote detecta se a estrutura base do Capítulo 5 já está instalada. Caso ainda não esteja, ele executa automaticamente:

```text
genesis_capitulo_05_nucleo_eclipse/apply_changes.py
```

Esse diretório já está presente no repositório informado. Depois disso, o conteúdo é convertido para o bioma aquático.

## Arquivos principais

```text
src/game/tideCycle.js
src/game/tideRenderer.js
src/game/chapterFivePhases.js
src/game/tideCycle.test.js
src/game/chapterFiveContent.test.js
src/game/assets/arenas/chapter_05.webp
src/game/assets/arenas/fase_33.webp ... fase_40.webp
```

Também são aplicadas alterações controladas em:

```text
src/game/content.js
src/game/battleModel.js
src/game/GameCanvas.jsx
src/campaign/MissionPanel.jsx
src/campaign/campaignBiomes.js
src/campaign/campaignBiomes.test.js
```

## Validação executada pelo instalador

Com `--validate` ou `-Validate`:

```text
npx vitest run src/game/tideCycle.test.js src/game/chapterFiveContent.test.js src/campaign/campaignBiomes.test.js
npx vite build
```

## Backup

O instalador cria uma cópia dos arquivos afetados em:

```text
<repo>/.genesis-backups/chapter-05-nereida-AAAAMMDD-HHMMSS/
```
