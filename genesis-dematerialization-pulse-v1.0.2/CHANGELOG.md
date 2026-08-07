# Changelog

## 1.0.2 — 2026-08-07
- Corrige `install.ps1 -> validate.ps1`: remove splatting de array com `@validateArgs`.
- Passa `-RepoRoot` e `-FullValidation` como parâmetros nomeados explícitos.
- Simplifica o executor de validação: cada processo nativo é chamado diretamente e seu `$LASTEXITCODE` é capturado imediatamente.
- Detecta instalações v1.0.0/v1.0.1/v1.0.2 e não reaplica o patch de gameplay.
- Preserva a correção `${Name}: OK` da v1.0.1.
- Mantém a política de nenhum rollback automático.

## 1.0.1
- Corrige ParserError do PowerShell em `validate.ps1` causado por `"$Name: OK"`.
- Usa `"${Name}: OK"`, forma válida quando `:` vem imediatamente após uma variável.
- Captura `LASTEXITCODE` por etapa para evitar resultado residual entre validações.
- Compatível com reexecução sobre a instalação v1.0.0 já aplicada.
- Mantém a política de nenhum rollback automático.

## 1.0.0 — 2026-08-07

- Pulso de Desmaterialização passa de execução total da rota para 500 HP fixos por alvo.
- Mantido gatilho automático no breach.
- Adicionada API pública `activateDematerializationPulse` usada por automático, jogador e IA.
- Adicionado controle manual por rota sobre o campo.
- Adicionado planner preventivo de colapso para simulações.
- Adicionados thresholds ao perfil e ao otimizador genético.
- Adicionadas métricas específicas do pulso.
- Adicionados testes de domínio/planner e checker estrutural.
