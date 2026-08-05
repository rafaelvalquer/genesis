# Implementação técnica

## 1. Provider persistente

`RouteTransitionProvider` é instalado dentro do `BrowserRouter` e acima do
conteúdo das rotas. Isso permite usar `useNavigate()` e manter o overlay
montado durante a troca de página.

## 2. Máquina de estados

`routeTransitionMachine.js` impede que ações atrasadas de uma transição antiga
modifiquem uma transição atual. Cada execução recebe um token exclusivo.

O progresso é monotônico:

```javascript
progress: Math.max(state.progress, action.progress)
```

## 3. Preload compartilhado

`routeModules.js` usa `createRetryableLazyModule()`, já existente no projeto.

A mesma Promise atende:

```text
preload da Campanha
React.lazy do Loadout
```

Uma falha de importação continua permitindo nova tentativa porque o carregador
retryable limpa seu cache quando a Promise é rejeitada.

## 4. Saída Three.js

`campaignDepartureTransition.js` trabalha somente com o runtime já criado por
`CampaignPlanet`.

Não cria um segundo renderer e não captura o canvas.

A distância final é limitada:

```text
mínimo: 1.68
máximo: 2.24
```

Isso evita colocar a câmera dentro do planeta ou aproximá-la excessivamente em
fases com configuração de câmera incomum.

## 5. Máscara DOM

A fusão entre os ambientes é produzida por uma camada HTML/CSS fixa.

Ela utiliza:

```text
cor primária da fase
cor de destaque da fase
imagem da arena
posição projetada do marcador
```

Não é usado `canvas.toDataURL()` e não existe leitura de pixels da GPU.

## 6. Prontidão do Loadout

A saída da máscara depende de `TroopStage.onStageReady`.

O evento ocorre depois que `createTroopStageScene()` resolve, inclusive quando
o retorno é `null` e o fallback WebGL será usado.

Depois do sinal, são aguardados dois frames do navegador antes de iniciar o
fade da máscara. Isso garante que o DOM do Loadout tenha sido apresentado.

## 7. Segurança

- clique duplo bloqueado no coordenador e no botão;
- `AbortController` por transição;
- timeout da saída;
- timeout de prontidão do destino;
- timelines anteriores canceladas;
- progresso de uma transição antiga ignorado;
- fallback de navegação mesmo se a animação falhar;
- redução de movimento com fade curto.
