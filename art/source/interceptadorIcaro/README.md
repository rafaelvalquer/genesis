# Interceptador Ícaro — fonte de rig

Este diretório documenta a fonte de produção do Ícaro. O pipeline lê os 64 PNGs individuais de `art/sprites/interceptadorIcaro/` e publica os arquivos de runtime em `src/game/assets/troop/interceptadorIcaro/`.

## Fonte aprovada

- `master-reference.png`: imagem aprovada recebida para o personagem.
- `master-1536.png`: referência ampliada, usada como canvas de reconstrução no Krita.
- `icaro-rig.json`: contrato de camadas, ossos, constraints e pontos de exportação para Spine.
- `export-manifest.json`: único local de verdade para root, canvas e muzzle de cada frame.

## Fluxo obrigatório

1. Reconstruir a arte em camadas no Krita usando `master-1536.png` como guia visual.
2. Importar as camadas no Spine e implementar o rig definido em `icaro-rig.json`.
3. Exportar cada animação em PNG RGBA de 384×384, sem crop, escala automática ou deslocamento do root.
4. Registrar as coordenadas em pixels do osso `muzzle` no manifesto e executar `npm run assets:interceptador-icaro`.
5. Copiar os valores normalizados do manifesto para `frameMuzzles` em `src/game/content.js` e executar os testes de assets/geometria.

## Contrato do pipeline

- Fonte: `art/sprites/interceptadorIcaro/`
- Publicação: `npm run assets:interceptador-icaro`
- Runtime: `src/game/assets/troop/interceptadorIcaro/`
- Auditoria isolada: `npm run audit:interceptador-icaro`
- Validação rígida de canvas já preparado pelo rig: `npm run assets:interceptador-icaro:strict`

O pipeline oficial exige os oito diretórios (`idle`, `attackBurst`, `interceptionLock`, `interceptionFire`, `interceptionFireUp`, `interceptionFireDown`, `paralyzed` e `death`) com exatamente `frame0.png` a `frame7.png` em cada um, totalizando 64 frames.

`death/frame0.png` deve ser byte a byte igual a `idle/frame0.png`.
