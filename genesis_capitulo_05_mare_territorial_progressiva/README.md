# Genesis — Capítulo 5: Maré Territorial Progressiva

Pacote de atualização para o repositório Genesis.

## Instalação no Windows

Extraia esta pasta em:

```text
C:\Projetos\Genesis\genesis_capitulo_05_mare_territorial_progressiva
```

No PowerShell:

```powershell
cd C:\Projetos\Genesis\genesis_capitulo_05_mare_territorial_progressiva
Set-ExecutionPolicy -Scope Process Bypass
.\install.ps1 -RepoRoot "C:\Projetos\Genesis" -Validate
```

Sem testes e build:

```powershell
.\install.ps1 -RepoRoot "C:\Projetos\Genesis"
```

## O que é instalado

- Água profunda permanente, sempre bloqueada para implantação.
- Zona intermaré seca, com borda e indicador de risco.
- Zona intermaré alagada, bloqueada para novas tropas.
- Maré progressiva por níveis, baseada em população e sorte.
- Recuo favorecido por perdas reais recentes.
- Persistência do nível territorial entre ondas.
- Bônus aquático de velocidade e resistência à lentidão para inimigos.
- Tropas submersas com redução de cadência e pulso limitado de pressão.
- Minas desativadas nas fases 36–40 quando submersas.
- Reatores pausados nas fases 37–40 quando submersos.
- Progressão de dificuldade completa das fases 33–40.
- Novos testes unitários e de regressão do Supply.

## Supply

O instalador verifica o bloco original de Supply antes e depois do patch. A instalação é cancelada se esse bloco for alterado.

A mecânica permanece como no projeto:

- consumo na implantação;
- regeneração de 1 por segundo durante a onda;
- devolução na remoção manual;
- mesmo `supplyMax`, `supplyAccumulator` e vantagens táticas existentes.

## Backup

Antes de modificar o projeto, os arquivos existentes são copiados para:

```text
C:\Projetos\Genesis\.genesis-backups\chapter-05-progressive-tide-AAAAMMDD-HHMMSS
```

## Validação executada por `-Validate`

```text
vitest:
- tideCycle.test.js
- chapterFiveContent.test.js
- tideBattleIntegration.test.js
- campaignBiomes.test.js

vite build
```
