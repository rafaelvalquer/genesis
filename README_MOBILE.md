# Genesis Defense Mobile — Android Studio

Esta variante mantém o gameplay do Genesis em React/Vite/Canvas e usa Capacitor apenas como shell Android. O domínio de batalha, ondas, tropas, inimigos, chefes e campanha continua compartilhado com a versão web.

## O que foi adaptado

- Build Android com `base: "./"` para funcionar offline dentro do APK.
- Projeto Capacitor com `appId` `com.luminor.genesisdefense`.
- Batalha em landscape.
- Android immersive mode (status/navigation bars ocultas durante o jogo).
- Android Back pausa/continua a batalha; fora da batalha volta na navegação e confirma saída na raiz.
- Ao minimizar/trocar de aplicativo a batalha é pausada automaticamente.
- Canvas usando Pointer Events para mouse, touch e stylus.
- `touch-action: none` no campo para impedir scroll/zoom acidental durante a batalha.
- HUD touch em overlay: status no topo e loadout em dock inferior horizontal.
- Botões com área de toque ampliada.
- Botão de mão livre convertido visualmente em cancelar no mobile.
- Feedback háptico leve via `navigator.vibrate` quando disponível.
- Safe areas para notch, câmera e barra gestual.
- Menus ajustados para landscape/coarse pointer.
- APK debug incluído na pasta `APK/` do pacote gerado pelo CI mobile.

## Abrir no Android Studio

1. Extraia o ZIP.
2. Abra o Android Studio.
3. Clique em **Open**.
4. Selecione a pasta `android/` dentro de `genesis-mobile-androidstudio`.
5. Aguarde o Gradle Sync.
6. Conecte um celular com depuração USB ou abra um emulador.
7. Clique em **Run ▶**.

O projeto Android já contém os assets web sincronizados em `android/app/src/main/assets/public`.

## Rodar a partir do código React

Requisitos:

- Node.js 20+ (recomendado 24, igual ao CI do Genesis).
- Android Studio com SDK Android instalado.
- JDK 21.

Instalação:

```bash
npm install
```

Build Android + sincronização:

```bash
npm run mobile:sync
```

Abrir Android Studio:

```bash
npm run mobile:open
```

Rodar em aparelho/emulador:

```bash
npm run mobile:run
```

Gerar APK debug no Windows:

```bash
npm run mobile:apk:win
```

Saída:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

No Linux/macOS:

```bash
npm run mobile:apk:unix
```

## Build web

A versão web continua independente:

```bash
npm run build:web
```

Ela mantém a base `/genesis/` para GitHub Pages. O build Android usa `./`.

## Arquitetura mobile

```text
src/
├── game/                 gameplay original
├── mobile/
│   └── mobile.css        apresentação touch/landscape
└── platform/
    ├── platform.js       detecção native/touch/Android
    ├── bootstrap.js      métricas de viewport e bootstrap
    └── haptics.js        feedback tátil

capacitor.config.js
scripts/
├── configure-mobile-package.mjs
└── prepare-android-project.mjs
android/                  projeto Android Studio gerado/sincronizado
APK/
└── app-debug.apk         APK pronto para instalação direta
```

## Regras importantes

- Não altere `VIEWPORT`, `CELL` ou `FIELD` para adaptar resolução. O Canvas deve apenas escalar visualmente.
- Não duplique `battleModel` para mobile.
- Não coloque dependência de internet no gameplay.
- Após alterar React/CSS/assets, rode `npm run mobile:sync` antes de compilar no Android Studio.
- Keystore de release não deve ser versionada. O pacote fornecido gera APK debug; para Google Play, configure signing e gere AAB release.

## Google Play / AAB

Para publicação, configure uma keystore segura no Android Studio e gere um **Android App Bundle (AAB)**. O APK debug desta entrega é destinado a instalação e testes internos.
