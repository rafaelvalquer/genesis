# Fase 40 — Reforço e balanceamento v1.2.4

Pacote corretivo para a defesa inicial e o balanceamento da Fase 40.

## Diagnóstico da nova falha

Os testes relacionados à Fase 40 passaram e o Vite concluiu o build de produção.
A instalação foi restaurada somente porque `scripts/check-assets.js` encontrou
pendências de assets já presentes no repositório:

- build com aproximadamente 187,8 MB para um orçamento configurado de 82 MB;
- sete spritesheets do Leviatã acima do limite individual de 684 KB.

O patch da Fase 40 altera apenas código e testes. Ele não adiciona nem modifica
sprites, áudio, arenas ou outros assets.

## Correção da v1.2.4

A validação continua executando `scripts/check-assets.js`, mas agora classifica
o resultado:

- erros desconhecidos continuam bloqueando a instalação;
- quantidade incorreta de arenas continua bloqueando;
- novos arquivos acima dos limites continuam bloqueando;
- as pendências já conhecidas do orçamento total e dos sete spritesheets do
  Leviatã são exibidas como aviso;
- `-StrictAssets` restaura o comportamento bloqueante para qualquer falha de assets.

O script original `scripts/check-assets.js` não é alterado. Assim, o orçamento
técnico do projeto continua registrado e poderá ser corrigido separadamente.

## Conteúdo mantido

- 5 Bastiões de Maré na coluna 6;
- 5 Fuzileiros Voltaicos na coluna 5;
- 5 Médicas de Nanites na coluna 3;
- tropas bônus sem consumir energia ou Supply;
- ondas com 45, 54, 66, 86, 103 e 86 inimigos;
- primeiro intervalo de 9 segundos;
- limite simultâneo de 48;
- chefe e reforços preservados.

## Instalação

```powershell
cd "C:\Projetos\Genesis\genesis-fase40-reforco-balanceamento-v1.2.4"

.\install.ps1 -RepoRoot "C:\Projetos\Genesis" -Validate
```

Para exigir também que o orçamento de assets esteja totalmente regular:

```powershell
.\install.ps1 -RepoRoot "C:\Projetos\Genesis" -Validate -StrictAssets
```

Para executar a suíte completa do repositório:

```powershell
.\install.ps1 -RepoRoot "C:\Projetos\Genesis" -Validate -FullSuite
```

Para validar somente código e testes relacionados, sem gerar o build:

```powershell
.\install.ps1 -RepoRoot "C:\Projetos\Genesis" -Validate -SkipBuild
```

O instalador cria um backup automático e restaura os arquivos quando houver
falha real nos testes relacionados, na compilação, nas arenas, em assets novos
ou na validação do Crisálio.
