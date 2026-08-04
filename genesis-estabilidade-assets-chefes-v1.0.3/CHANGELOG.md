# Changelog

## 1.0.3

- Impedido que a rotina de reparo altere o próprio verificador de codificação.
- Padrões de mojibake convertidos para escapes Unicode no código-fonte.
- `scripts/check-encoding.mjs` excluído de `repairRepositoryEncoding()`.
- Adicionado teste do verificador após a aplicação da mesma rotina de reparo do instalador.
- Mantidas todas as melhorias das versões anteriores.

## 1.0.2

- Corrigidos falsos positivos do verificador de codificação.
- `Ã` e `Â` isolados não são mais tratados como erro.
- Mantida a detecção de sequências reais como `Ã§`, `Ã£`, `â€”`, `Â°`, `ï»¿` e `�`.
- Adicionados autotestes com textos portugueses válidos e exemplos reais de mojibake.
- Mantidas todas as melhorias funcionais da v1.0.1.

## 1.0.1

- Corrige o parser do `install.ps1` no Windows PowerShell.
- Substitui a condição multilinha problemática por validação booleana explícita.
- Renomeia o hashtable de parâmetros de `$args` para `$validateParams`.

## 1.0.0

- Pipeline de build separado.
- Verificador de codificação UTF-8.
- Dependências estritas de assets.
- Dependências genéricas de inimigos e efeitos.
- Carregamento concorrente com limite quatro.
- Testes reais de frames da Fase 40.
- Validação estrita das opções do Capítulo 5.
- Limites explícitos das tropas fornecidas.
- Blueprints congelados.
- Sistema de chefe extraído e testado.
