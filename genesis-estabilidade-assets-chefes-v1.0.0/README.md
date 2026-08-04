# Genesis — estabilidade, assets e sistema de chefes v1.0.0

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

## Instalação

```powershell
cd "C:\Projetos\Genesis\genesis-estabilidade-assets-chefes-v1.0.0"
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
