# Changelog

## 1.0.0

- Adicionado coordenador global de transições.
- Adicionada máquina de estados com token por execução.
- Adicionado overlay orbital persistente entre rotas.
- Adicionada transição GSAP Campanha → Loadout.
- Adicionado zoom no ponto da missão selecionada.
- Adicionado preload retryable do Loadout, Three.js e arena.
- Loadout passou a compartilhar a Promise do preload com `React.lazy`.
- Adicionado sinal de prontidão do `TroopStage`.
- Adicionado timeout de segurança para o destino.
- Adicionado bloqueio contra clique duplo.
- Adicionado comportamento reduzido para `reduceMotion`.
- Adicionadas animações de entrada dos painéis e plataforma.
- Adicionado `npm run verify:route-transitions`.
- Adicionados testes de máquina, câmera e contrato estrutural.
- Mantidos backup e rollback automático.
