# Genesis — Coordenador de transições e Campanha → Loadout v1.0.0

Pacote preparado para o commit:

```text
844426bcc180ec0de2d21bc3ca5296f8cbd0aead
```

## Escopo implementado

Esta entrega cobre a primeira etapa do plano de navegação:

1. coordenador global de transições;
2. transição cinematográfica da Campanha para o Loadout;
3. preload do módulo do Loadout e do ambiente Three.js;
4. overlay orbital persistente entre as rotas;
5. sincronização da retirada do overlay com a prontidão do palco;
6. proteção contra clique duplo, timeout e `reduceMotion`.

A transição Comando → Campanha e os indicadores de progresso real ficam para
as próximas etapas.

## Fluxo implementado

```text
CampaignPage
→ jogador seleciona uma missão
→ LoadoutPage, Three.js e arena são pré-carregados
→ jogador clica em PREPARAR OPERAÇÃO
→ interface da Campanha desaparece
→ planeta gira até a missão selecionada
→ câmera aproxima o ponto da missão
→ máscara orbital cobre a tela
→ navegação para /jogar/:phaseId
→ Loadout monta por trás da máscara
→ TroopStage sinaliza que o palco terminou de inicializar
→ máscara dissolve
→ painéis e plataforma entram suavemente
```

## Coordenador

Novos arquivos:

```text
src/routing/RouteTransitionProvider.jsx
src/routing/RouteTransitionLayer.jsx
src/routing/routeTransitionMachine.js
src/routing/routeModules.js
src/routing/route-transitions.css
```

Estados:

```text
idle
exiting
covering
navigating
waiting
entering
error
```

O coordenador:

- bloqueia uma segunda transição enquanto outra está ativa;
- compartilha payload visual entre origem e destino;
- inicia preload em paralelo com a animação de saída;
- possui timeout de segurança;
- mantém a máscara fora da árvore da rota;
- respeita a preferência de redução de movimento;
- permite que a página de destino determine quando a máscara pode sair.

## Animação da Campanha

Novo arquivo:

```text
src/campaign/campaignDepartureTransition.js
```

A timeline GSAP:

- encerra a animação automática da câmera;
- cancela uma timeline de transição anterior;
- destaca o marcador selecionado;
- recolhe cabeçalho, trilho e painel da missão;
- gira o planeta para as coordenadas da missão;
- reduz a distância da câmera para uma faixa segura;
- intensifica a atmosfera;
- retira rotas e movimento procedural durante a aproximação.

## Preload

`LoadoutPage` passa a usar um carregador retryable compartilhado:

```javascript
const LoadoutPicker = lazy(loadLoadoutModule);
```

A Campanha pré-carrega:

```text
LoadoutPage
TroopStage
TroopStageScene
Three.js
imagem da arena selecionada
```

O preload ocorre ao selecionar a missão e é reutilizado quando a rota é aberta.

## Prontidão do destino

`TroopStage` recebe:

```javascript
onStageReady
```

O evento é emitido tanto quando o runtime WebGL é criado quanto quando o
fallback é necessário. Assim, a máscara nunca depende exclusivamente do WebGL.

Também existe um timeout de segurança no coordenador para impedir uma tela
coberta indefinidamente.

## Instalação

Extraia o ZIP em uma pasta nova:

```powershell
cd "C:\Projetos\Genesis\genesis-campaign-loadout-route-transitions-v1.0.0"

.\install.ps1 `
  -RepoRoot "C:\Projetos\Genesis" `
  -Validate
```

Sem gerar o build:

```powershell
.\install.ps1 `
  -RepoRoot "C:\Projetos\Genesis" `
  -Validate `
  -SkipBuild
```

Executando toda a suíte:

```powershell
.\install.ps1 `
  -RepoRoot "C:\Projetos\Genesis" `
  -Validate `
  -FullSuite
```

Aplicação deliberada em outro commit:

```powershell
.\install.ps1 `
  -RepoRoot "C:\Projetos\Genesis" `
  -Validate `
  -AllowDifferentCommit
```

## Backup e rollback

O instalador cria backup em:

```text
.genesis-backups/campaign-loadout-transition-AAAAMMDD-HHMMSS
```

Qualquer falha de aplicação, contrato, teste ou build restaura os arquivos
anteriores.

## Novo comando

```text
npm run verify:route-transitions
```

O comando também é incorporado ao `npm run ci`.

## Arquivos modificados

```text
package.json
src/App.jsx
src/campaign/CampaignPage.jsx
src/campaign/MissionPanel.jsx
src/loadout/LoadoutPage.jsx
src/loadout/TroopStage.jsx
```

## Arquivos adicionados

```text
src/routing/RouteTransitionProvider.jsx
src/routing/RouteTransitionLayer.jsx
src/routing/routeTransitionMachine.js
src/routing/routeModules.js
src/routing/route-transitions.css
src/campaign/campaignDepartureTransition.js

src/routing/routeTransitionMachine.test.js
src/campaign/campaignDepartureTransition.test.js
src/routing/routeTransitionContract.test.js

scripts/check-route-transition-contract.mjs
```
