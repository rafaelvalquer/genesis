# Diagnóstico do erro de montagem

O erro informado por React aparece no ponto em que `App.jsx` monta `GameCanvas`; ele não indica, por si só, que `App.jsx` está incorreto.

As versões v2.0.x aplicavam alterações incrementais em `GameCanvas.jsx`, `battleModel.js`, `graphicsRuntime.js` e criavam módulos `src/game/waveOutro/*`. Como algumas instalações falharam no meio do patch, o projeto local pode conter uma combinação de trechos de versões diferentes.

O reparo 2.1.0 elimina essa condição:

1. remove imports dos módulos experimentais do caminho crítico;
2. normaliza a máquina lógica do `waveOutro` para a implementação estável da base;
3. remove `cinematicFreezeUntil` e os eventos experimentais do graphics runtime;
4. remove os arquivos gerados `src/game/waveOutro/*`;
5. reinstala apenas uma camada visual local no `GameCanvas`, que retorna imediatamente durante `idle`;
6. mantém o snapshot público defensivo com `Array.isArray`;
7. limpa o cache `node_modules/.vite` para não reutilizar transformações antigas.

A mensagem `Could not establish connection. Receiving end does not exist` é típica de mensageria de extensão do Chrome/Edge. Ela pode coexistir com o erro React e não é usada como causa do crash do Genesis.
