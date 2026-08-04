# Fase 40 — Reforço e balanceamento v1.2.0

Pacote para o repositório `rafaelvalquer/genesis`, preparado sobre o commit-base analisado:

```text
9f41528369a3275218f23e39e2606378cd289d07
```

O instalador é compatível tanto com o repositório que já recebeu os pacotes anteriores da
Fase 40 quanto com a estrutura-base que ainda não possui a defesa inicial.

## Nova defesa inicial

A Fase 40 passa a iniciar com 15 tropas bônus:

| Coluna | Tropas | Função |
|---:|---|---|
| 6 | 5 Bastiões de Maré | Linha de frente e geração de energia |
| 5 | 5 Fuzileiros Voltaicos | Dano elétrico contra grupos |
| 3 | 5 Médicas de Nanites | Sustentação e cura das duas linhas avançadas |

A coluna 3 foi escolhida para manter as Médicas fora da área que fica alagada quando a
maré alcança o nível 2.

As quinze tropas:

- aparecem mesmo sem terem sido escolhidas no loadout;
- não consomem energia;
- não consomem Supply;
- não iniciam recarga de implantação;
- não geram reembolso;
- não podem ser removidas manualmente;
- recebem dano, cura e efeitos normalmente;
- contam no limite de implantação de cada tipo;
- liberam uma vaga quando morrem;
- podem ser repostas normalmente apenas quando o jogador tiver a tropa no loadout.

A energia inicial permanece em 900 e o Supply inicial permanece em 40.

## Novo balanceamento das ondas

| Onda | Balanceamento anterior | Novo total |
|---:|---:|---:|
| 1 | 66 | 45 |
| 2 | 86 | 54 |
| 3 | 106 | 66 |
| 4 | 103 | 86 |
| 5 | 123 | 103 |
| 6 | 95 | 86 |

A primeira onda agora começa com pacotes menores e cresce gradualmente, em vez de abrir
diretamente com uma sequência formada apenas por pacotes pesados.

Outras mudanças:

- limite simultâneo reduzido de 42 para 36 inimigos vivos;
- intervalo da primeira onda aumentado para 9,5 segundos entre pacotes;
- intervalos das ondas seguintes também foram suavizados;
- o Leviatã de Nereida e os reforços do chefe foram preservados.

## Instalação

Extraia o pacote dentro de `C:\Projetos\Genesis` e execute:

```powershell
cd "C:\Projetos\Genesis\genesis-fase40-reforco-balanceamento-v1.2.0"

.\install.ps1 -RepoRoot "C:\Projetos\Genesis" -Validate
```

Para executar somente os testes específicos, sem o build completo:

```powershell
.\install.ps1 -RepoRoot "C:\Projetos\Genesis" -Validate -SkipBuild
```

O backup automático será criado em:

```text
C:\Projetos\Genesis\.genesis-backups\fase40-reforco-balanceamento-AAAAMMDD-HHMMSS
```

## Arquivos alterados

```text
src/game/chapterFivePhases.js
src/game/chapterFiveWaves.js
src/game/battleModel.js
src/game/phase40StartingDefense.test.js
src/game/chapterFivePhase40Balance.test.js
```

A alteração em `battleModel.js` somente é aplicada quando o suporte genérico a tropas
fornecidas pela missão ainda não estiver instalado.
