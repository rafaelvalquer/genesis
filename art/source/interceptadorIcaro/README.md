# Interceptador Ícaro — fonte de rig

Este diretório é a fonte de produção do Ícaro. O jogo **não** carrega arquivos daqui: ele consome os 64 PNGs publicados em `art/sprites/interceptadorIcaro/`.

## Fonte aprovada

- `master-reference.png`: imagem aprovada recebida para o personagem.
- `master-1536.png`: referência ampliada, usada como canvas de reconstrução no Krita.
- `icaro-rig.json`: contrato de camadas, ossos, constraints e pontos de exportação para Spine.
- `export-manifest.json`: único local de verdade para root, canvas e muzzle de cada frame.

## Fluxo obrigatório

1. Reconstruir a arte em camadas no Krita usando `master-1536.png` como guia visual.
2. Importar as camadas no Spine e implementar o rig definido em `icaro-rig.json`.
3. Exportar cada animação em PNG RGBA de 384×384, sem crop, escala automática ou deslocamento do root.
4. Registrar as coordenadas em pixels do osso `muzzle` no manifesto e executar `npm run assets:interceptador-icaro -- --strict-canvas`.
5. Copiar os valores normalizados do manifesto para `frameMuzzles` em `src/game/content.js` e executar os testes de assets/geometria.

`death/frame0.png` deve ser byte a byte igual a `idle/frame0.png`.
