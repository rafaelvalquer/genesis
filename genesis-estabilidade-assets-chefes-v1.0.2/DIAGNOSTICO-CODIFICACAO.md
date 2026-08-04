# Diagnóstico da falha de codificação

A falha não indicava 68 textos corrompidos.

O verificador anterior usava o padrão:

```javascript
new RegExp(["\\u00C3", "\\u00C2", "\\uFFFD"].join("|"), "u")
```

Isso equivale a procurar qualquer letra `Ã`, qualquer letra `Â` ou `�`.

Em português, `Ã` e `Â` são válidos. Por isso palavras como `OPERAÇÃO`,
`PRESSÃO`, `LEVIATÃ` e `Âmbar` eram falsos positivos.

O verificador novo procura sequências completas produzidas pela interpretação
incorreta de UTF-8, preservando os caracteres portugueses válidos.
