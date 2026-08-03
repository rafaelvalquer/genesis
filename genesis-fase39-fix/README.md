# Correção Genesis — fase 39 / Interceptador Ícaro

Pacote preparado sobre o commit analisado:

- `3f3bdb8988a51fcd77e004da09cf5b8e105264b3`

## Problemas corrigidos

1. **Falha no impacto do Interceptador Ícaro**

   Em `damageEnemy`, a proteção da Carapaça de Nereida consultava `config?.boss`, mas `config` não existe nesse escopo. Quando um disparo direto à distância atingia um inimigo escoltado por uma Carapaça, a batalha podia parar com `ReferenceError: config is not defined`.

   A correção usa a configuração real do inimigo atingido:

   ```js
   ENEMIES[enemy.type]?.boss
   ```

2. **Aviso do listener passivo no mapa da campanha**

   O `onWheel` do React chamava `event.preventDefault()`, gerando:

   ```text
   Unable to preventDefault inside passive event listener invocation.
   ```

   O `preventDefault` foi removido. O mapa continua sem rolagem de página porque a tela da campanha já usa `overflow: hidden`.

3. **Teste de regressão**

   Adiciona `src/game/icaroNereidaProtection.test.js`, que reproduz um impacto do Ícaro contra um Mordelume posicionado atrás de uma Carapaça na configuração da fase 39.

## Como aplicar automaticamente

Extraia este pacote e, dentro da pasta do projeto Genesis, execute:

```bash
node /caminho/para/genesis-fase39-fix/apply-fix.mjs .
```

No Windows PowerShell, por exemplo:

```powershell
node "C:\caminho\genesis-fase39-fix\apply-fix.mjs" "C:\caminho\genesis"
```

O instalador cria um backup com o nome:

```text
.genesis-fase39-backup-<data-hora>
```

## Validar

```bash
node /caminho/para/genesis-fase39-fix/verify-fix.mjs .
npm test -- src/game/icaroNereidaProtection.test.js
npm run build
```

## Aplicação manual

Também está disponível o patch:

```text
patches/genesis-fase39-icaro.patch
```

Para aplicar em um repositório Git:

```bash
git apply /caminho/para/genesis-fase39-fix/patches/genesis-fase39-icaro.patch
```

Depois copie o teste para:

```text
src/game/icaroNereidaProtection.test.js
```
