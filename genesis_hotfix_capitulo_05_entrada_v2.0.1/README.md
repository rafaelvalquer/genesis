# Genesis — Hotfix de entrada do Capítulo 5

Versão: **2.0.1**

## Problema corrigido

O instalador da Maré Territorial Progressiva usava uma expressão regular ampla para substituir o import de `tideCycle.js`. Ela começava no primeiro `import {` de `battleModel.js` e consumia todos os imports intermediários.

Como consequência, foram removidas as importações locais de:

- `adaptiveAid.js`;
- `visualGeometry.js`;
- `executorArco.js`;
- `interceptadorIcaro.js`;
- `windCurrent.js`.

O arquivo ainda tentava usar símbolos como `FIELD`, `createAdaptiveAidState` e `createWindCurrentState`, causando falha durante a importação do módulo ao entrar na batalha.

## O que o hotfix faz

1. Reconstrói o cabeçalho de imports de `src/game/battleModel.js`.
2. Mantém a integração nova de `tideCycle.js`.
3. Corrige `genesis_capitulo_05_mare_territorial_progressiva/apply_changes.py` para o erro não acontecer novamente.
4. Adiciona um teste de fumaça que importa `battleModel.js` e cria uma sessão.
5. Adiciona `.genesis-backups/` ao `.gitignore`.
6. Restaura, quando o histórico Git estiver disponível, os arquivos de teste removidos no commit posterior a `d2daee81`.
7. Verifica a importação real de `battleModel.js` com Node.js.
8. Confirma que o bloco de Supply permanece intacto.

## Instalação no Windows

Extraia esta pasta dentro ou fora do repositório e execute:

```powershell
cd C:\caminho\genesis_hotfix_capitulo_05_entrada_v2.0.1
Set-ExecutionPolicy -Scope Process Bypass
.\install.ps1 -RepoRoot "C:\Projetos\Genesis" -Validate
```

Sem executar Vitest e Vite build:

```powershell
.\install.ps1 -RepoRoot "C:\Projetos\Genesis"
```

Para não restaurar os testes removidos:

```powershell
.\install.ps1 -RepoRoot "C:\Projetos\Genesis" -SkipTestRestore
```

## Instalação em Linux/macOS

```bash
./install.sh --repo-root /caminho/Genesis --validate
```

## Backup

Os arquivos alterados são copiados para:

```text
.genesis-backups/chapter-05-entry-hotfix-AAAAMMDD-HHMMSS/
```

## Arquivos alterados

- `src/game/battleModel.js`
- `src/game/battleModelImport.test.js`
- `.gitignore`
- `genesis_capitulo_05_mare_territorial_progressiva/apply_changes.py`, quando existir
- testes anteriormente excluídos, quando recuperáveis pelo histórico Git

## Supply

A correção não modifica:

- regeneração de Supply;
- consumo de Supply;
- devolução na remoção;
- `supplyMax`;
- `supplyAccumulator`.
