# Changelog

## 1.2.5

- Corrigido `NativeCommandError` do Windows PowerShell 5.1 ao capturar `stderr`.
- `check-assets.js` agora é executado com `Start-Process`.
- Saídas padrão e de erro são capturadas em arquivos temporários UTF-8.
- A classificação entre pendências conhecidas e erros novos foi preservada.
- O aviso de chunks do Vite continua não bloqueante.

## 1.2.4

- Diagnosticada a falha de orçamento de assets após o build Vite bem-sucedido.
- Mantido o verificador original de assets sem alterar seus limites.
- Pendências conhecidas do tamanho total e dos spritesheets do Leviatã passam a ser informativas.
- Erros novos ou desconhecidos de assets continuam bloqueando e restaurando o backup.
- Adicionada a opção `-StrictAssets`.
- Melhorada a codificação UTF-8 da saída do PowerShell.

## 1.2.3

- Corrigido o primeiro intervalo da Fase 40 para 9 segundos.
- Limite simultâneo restaurado para 48.
- Suíte completa tornada opcional.
