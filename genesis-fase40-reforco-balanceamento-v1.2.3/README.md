# Fase 40 — Reforço e balanceamento v1.2.3

Pacote corretivo para a defesa inicial e o balanceamento da Fase 40.

## Diagnóstico dos novos erros

Os testes específicos da Fase 40 passaram. A restauração ocorreu porque o instalador
executou toda a suíte do repositório, que atualmente possui dezenas de falhas legadas
fora desta alteração, como testes que ainda esperam 32 fases, quatro capítulos e
comportamentos antigos de vento, Rainha Operária, Crisálio e iluminação.

Duas incompatibilidades relacionadas ao patch também foram corrigidas:

- o primeiro intervalo entre pacotes foi reduzido de 9,5 para 9 segundos;
- o limite simultâneo foi restaurado para 48, evitando bloquear a entrada do Leviatã.

A quantidade total permanece reduzida para 45, 54, 66, 86, 103 e 86 inimigos, e a
terceira coluna de Médicas de Nanites continua disponível gratuitamente.

## Validação da v1.2.3

Por padrão, `-Validate` executa:

- testes da defesa inicial;
- testes do balanceamento da Fase 40;
- testes gerais do conteúdo do Capítulo 5;
- auditoria informativa do Leviatã;
- compilação de produção do Vite;
- verificações gerais de assets e do Crisálio.

A suíte completa não é mais usada como condição automática para restaurar o patch,
pois contém falhas anteriores e não relacionadas. Para executá-la explicitamente,
use `-FullSuite`.

## Instalação

```powershell
cd "C:\Projetos\Genesis\genesis-fase40-reforco-balanceamento-v1.2.3"

.\install.ps1 -RepoRoot "C:\Projetos\Genesis" -Validate
```

Validação estrita de todo o repositório:

```powershell
.\install.ps1 -RepoRoot "C:\Projetos\Genesis" -Validate -FullSuite
```

Instalação rápida, sem build:

```powershell
.\install.ps1 -RepoRoot "C:\Projetos\Genesis" -Validate -SkipBuild
```

O instalador cria um backup automático e restaura os arquivos se os testes da Fase 40,
a compilação ou as verificações de assets falharem.
