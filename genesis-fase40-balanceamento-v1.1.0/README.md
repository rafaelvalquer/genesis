# Fase 40 — Balanceamento de inimigos v1.1.0

Pacote incremental para o repositório `rafaelvalquer/genesis`.

Commit-base analisado:

```text
9f41528369a3275218f23e39e2606378cd289d07
```

A atualização é compatível com a defesa inicial da Fase 40 já instalada. Ela altera apenas
a geração das ondas do Capítulo 5 e adiciona um teste específico de balanceamento.

## Alterações

A Fase 40 mantém:

- cinco Bastiões de Maré na coluna 6;
- cinco Fuzileiros Voltaicos na coluna 5;
- energia inicial de 900;
- Supply inicial de 40;
- chefe Leviatã de Nereida na última onda.

A quantidade de inimigos foi reduzida desta forma:

| Onda | Antes | Depois | Redução |
|---:|---:|---:|---:|
| 1 | 106 | 66 | 37,7% |
| 2 | 123 | 86 | 30,1% |
| 3 | 143 | 106 | 25,9% |
| 4 | 123 | 103 | 16,3% |
| 5 | 143 | 123 | 14,0% |
| 6 | 95 | 95 | sem alteração |

A primeira onda também passa a usar intervalo de 8 segundos entre os pacotes, em vez de
6,5 segundos. O limite simultâneo da Fase 40 passa de 48 para 42 inimigos vivos.

A onda final e os reforços do chefe não foram reduzidos.

## Instalação

Extraia este pacote dentro de `C:\Projetos\Genesis` e execute:

```powershell
cd "C:\Projetos\Genesis\genesis-fase40-balanceamento-v1.1.0"

.\install.ps1 -RepoRoot "C:\Projetos\Genesis" -Validate
```

Para instalar e executar somente o teste específico, sem o build completo:

```powershell
.\install.ps1 -RepoRoot "C:\Projetos\Genesis" -Validate -SkipBuild
```

O instalador cria um backup em:

```text
C:\Projetos\Genesis\.genesis-backups\fase40-balanceamento-AAAAMMDD-HHMMSS
```

## Arquivos alterados

```text
src/game/chapterFiveWaves.js
```

## Arquivo adicionado

```text
src/game/chapterFivePhase40Balance.test.js
```

## Reaplicação

O instalador é idempotente. Executá-lo novamente não duplica configurações nem testes.
