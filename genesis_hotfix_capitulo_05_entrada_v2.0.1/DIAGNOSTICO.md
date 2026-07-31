# Diagnóstico técnico

## Causa raiz

A função antiga era baseada em uma expressão regular semelhante a:

```python
re.compile(
    r'import \{\n(?:(?!\} from "\./tideCycle\.js";).)*?\} from "\./tideCycle\.js";',
    re.S,
)
```

Como a busca começava no primeiro bloco `import {` do arquivo, ela atravessava vários imports até encontrar o fechamento associado a `tideCycle.js`.

## Sintoma

O início de `battleModel.js` passou diretamente de `domain.js` para `tideCycle.js`. Entretanto, o restante do arquivo continuou usando identificadores que deveriam ser importados dos módulos removidos.

Exemplos:

```js
const mortarTargetCounts = new Uint16Array(FIELD.cols);
```

```js
adaptiveAid: createAdaptiveAidState(!sandbox),
windCurrent: createWindCurrentState(),
```

## Correção

O hotfix reconstrói explicitamente o cabeçalho conhecido do projeto e altera o instalador para procurar o `import {` mais próximo anterior ao marcador:

```python
end_marker = '} from "./tideCycle.js";'
end = source.find(end_marker)
start = source.rfind("import {", 0, end)
```

Dessa forma, somente o import de `tideCycle.js` é substituído.

## Proteções adicionadas

- importação dinâmica real com Node.js;
- teste Vitest de importação e criação de sessão;
- preservação literal do bloco de Supply;
- backup automático;
- restauração de testes removidos pelo commit afetado;
- exclusão de `.genesis-backups/` do versionamento futuro.
