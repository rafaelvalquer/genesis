# Diagnóstico da arquitetura anterior

A Campanha executava navegação direta:

```javascript
onPrepare={() => navigate(`/jogar/${selectedPhase.id}`)}
```

Isso desmontava imediatamente o planeta e montava o Loadout sem uma etapa
visual intermediária.

Embora `CampaignPage` já mantivesse o runtime Three.js e
`useCampaignAnimations()` já utilizasse GSAP, não existia uma API que pudesse:

- bloquear interação durante a saída;
- aguardar a câmera;
- manter uma máscara entre as duas rotas;
- iniciar preload;
- aguardar a prontidão do destino;
- aplicar timeout;
- compartilhar a paleta da missão.

O Loadout também era carregado por um `lazy(() => import())` próprio, sem
Promise compartilhada com a Campanha.

A implementação cria esse contrato sem unir os dois renderers WebGL. A
Campanha termina sua aproximação, a camada DOM cobre a tela e somente então a
rota é alterada.
