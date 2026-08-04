# Genesis — estabilidade, assets e sistema de chefes v1.0.1

Pacote preparado para a linha de base:

```text
58b78b97b23c09a9ee94731c414cda7f8253ceda
```

## Conteúdo

- separa `npm run build` das auditorias e do orçamento de assets;
- adiciona comandos independentes de CI, release, auditoria e verificações;
- corrige mojibake em código e documentação;
- adiciona `.editorconfig`, `.gitattributes` e `verify:encoding`;
- torna dependências inválidas bloqueantes em desenvolvimento e testes;
- mantém aviso não bloqueante em produção;
- generaliza dependências de inimigos e efeitos;
- carrega assets com concorrência controlada de quatro tarefas;
- valida frames reais da defesa inicial da Fase 40;
- elimina a duplicidade lógica dos assets obrigatórios da Fase 40;
- rejeita configurações contraditórias e índices fora de 0–7;
- define limite explícito cinco para Bastião, Fuzileiro e Médica na missão;
- congela os blueprints do Capítulo 5;
- extrai o sistema de encontro com chefe para `systems/bossEncounterSystem.js`;
- adiciona testes de entrada, reserva, reforços, limites e conclusão do Leviatã.

## Scripts após a instalação

```text
npm run build              somente Vite
npm run test               suíte Vitest
npm run verify:encoding    codificação de código e documentação
npm run verify:assets      orçamento e integridade dos assets
npm run verify:crisalio    frames do Crisálio
npm run audit:leviathan    auditoria artística do Leviatã
npm run ci                 encoding + testes + build
npm run release:check      CI + assets + Crisálio
```

A auditoria do Leviatã permanece separada porque há pendências artísticas conhecidas.


## Correção da v1.0.2

A versão 1.0.1 procurava qualquer ocorrência isolada das letras `Ã` e `Â`.
Essa regra era incorreta porque ambas são caracteres válidos em português:

```text
OPERAÇÃO
IDENTIFICAÇÃO
PRESSÃO
LEVIATÃ
Cratera de Âmbar
```

Por isso 68 textos válidos foram classificados como codificação corrompida.

A v1.0.2 procura somente sequências conhecidas de mojibake, como:

```text
operaÃ§Ã£o
mÃ¡ximo
contÃ©m
invÃ¡lida
carapaÃ§a
â€”
Â°
ï»¿
�
```

O verificador também executa autotestes internos para garantir que textos
portugueses legítimos não sejam bloqueados novamente.


## Correção da v1.0.3

A versão 1.0.2 possuía padrões corretos, mas a instalação copiava
`scripts/check-encoding.mjs` e depois executava a rotina automática de reparo
sobre esse mesmo arquivo.

Exemplo do problema:

```text
padrão detector: Ãƒ
após o reparo:   Ã
```

O padrão reduzido para `Ã` voltava a bloquear palavras válidas como
`OPERAÇÃO`, `PRESSÃO` e `LEVIATÃ`.

A v1.0.3 aplica duas proteções:

- os padrões do verificador são armazenados como escapes Unicode, sem
  sequências literais que possam ser reparadas;
- `repairRepositoryEncoding()` ignora explicitamente
  `scripts/check-encoding.mjs`.

O verificador foi testado antes e depois da mesma rotina de reparo usada pelo
instalador.

## Instalação

```powershell
cd "C:\Projetos\Genesis\genesis-estabilidade-assets-chefes-v1.0.3"
.\install.ps1 -RepoRoot "C:\Projetos\Genesis" -Validate
```

Validação sem gerar build:

```powershell
.\install.ps1 -RepoRoot "C:\Projetos\Genesis" -Validate -SkipBuild
```

Validação incluindo toda a suíte:

```powershell
.\install.ps1 -RepoRoot "C:\Projetos\Genesis" -Validate -FullSuite
```

O instalador cria backup automático e restaura todos os arquivos em caso de falha.

## Correção da versão 1.0.1

- corrige o erro de parser do PowerShell no teste inicial da raiz do repositório;
- substitui a expressão multilinha com `-or` por variáveis booleanas e uma condição única;
- evita usar a variável automática `$args` no splatting da validação.

