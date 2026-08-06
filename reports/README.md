# Relatórios do simulador

Os comandos do simulador gravam seus resultados nesta pasta.

Arquivos principais:

```text
campaign-simulation.json
campaign-simulation.csv
campaign-simulation.md
simulation-failures.json
phase-strategies.json
```

Os arquivos gerados são ignorados pelo Git. Este README e `.gitkeep`
permanecem versionados.

## Fluxo recomendado

```powershell
npm run simulate:campaign:quick
npm run verify:simulation:report
```

Auditoria completa:

```powershell
npm run simulate:campaign
npm run verify:simulation:report
```

Otimização:

```powershell
npm run optimize:campaign -- --quick=true

npm run simulate:campaign -- `
  --strategy-file=reports/phase-strategies.json `
  --strategies=optimized
```
