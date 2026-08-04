# Diagnóstico da falha da v1.0.2

A falha ocorreu por automodificação do verificador.

A instalação fazia esta sequência:

1. copiava `scripts/check-encoding.mjs`;
2. executava `repairRepositoryEncoding()`;
3. a rotina encontrava as sequências de mojibake declaradas pelo próprio
   verificador;
4. os padrões eram convertidos para caracteres válidos;
5. o autoteste passava a interpretar palavras portuguesas como erro.

Por exemplo, o padrão que representava `Ãƒ` era convertido para apenas `Ã`.
Com isso, `OPERAÇÃO CONCLUÍDA` voltava a ser bloqueado.

A v1.0.3 codifica os padrões com escapes Unicode e exclui o arquivo do reparo.
