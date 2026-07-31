# Genesis — Efeitos próximos às trilhas e correção do foguete

Este pacote inclui o Capítulo 5 da entrega anterior e substitui os efeitos genéricos por elementos posicionados a partir das coordenadas reais das fases no planeta.

## Alterações visuais

- Capítulo 1: rochas low-poly distribuídas dos dois lados da trilha.
- Capítulo 2: cristais concentrados ao longo da trilha.
- Capítulo 3: arcos e ossada removidos; pequenas dunas acompanham a rota.
- Capítulo 4: montanhas próximas às missões e linhas de vento tangenciais.
- Capítulo 5: identidade oceânica, corrente de água, espuma e ondas próximas à rota.
- Foguete: o eixo visual do nariz agora acompanha a tangente da órbita e a parte superior permanece voltada para fora do planeta.

## Como o posicionamento funciona

`genesisRouteEffectUtils.js` lê `CAMPAIGN_PHASE_LOCATIONS`, interpola cada trecho da rota esférica e posiciona os modelos com afastamento lateral mínimo. Assim, os objetos ficam próximos da trilha sem cobrir marcadores e linhas.

## Instalação

```powershell
Set-ExecutionPolicy -Scope Process Bypass

cd C:\Projetos\Genesis\genesis_efeitos_trilha_foguete

.\install.ps1 -RepoRoot "C:\Projetos\Genesis" -Validate
```

O pacote pode ser aplicado sobre o repositório principal ou sobre as entregas anteriores. O instalador mantém o Capítulo 5, cria backup e não duplica as definições existentes.

## Teste manual

```powershell
cd C:\Projetos\Genesis
npm run dev
```

Verifique os cinco capítulos na tela Comando e na Campanha. Gire o planeta para confirmar que os modelos acompanham cada rota. Observe uma volta completa do foguete para validar nariz, topo e chama.

## Backup

```text
<repo>\.genesis-backups\route-effects-ocean-AAAAMMDD-HHMMSS\
```
