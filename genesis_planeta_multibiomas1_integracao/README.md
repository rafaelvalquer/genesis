# Integração do `genesis-planeta-multibiomas1.glb`

Este pacote troca o planeta atual pelo novo GLB nas duas telas:

- **Comando Orbital**
- **Campanha**

## O que foi identificado no novo GLB

O arquivo enviado possui:

- malha principal: `Object_4`
- material principal: `Planet`
- malha de nuvens: `Object_6`
- material de nuvens: `Clouds`
- texturas PBR incorporadas
- planeta centralizado com raio aproximado de `1`
- nuvens com o mesmo raio da superfície
- sem malha própria de atmosfera
- sem luas e sem beacons

O código anterior esperava nomes como `GenesisWorld_MainPlanet` e
`GenesisWorld_Clouds`. O adaptador incluído converte essa nomenclatura em
memória, sem exigir nova exportação do GLB.

## Conteúdo do ZIP

```text
apply_changes.py
install.ps1
install.sh

payload/
  public/models/command/
    genesis-planeta-multibiomas1.glb

  src/visual/
    adaptGenesisPlanetAsset.js
    genesisPlanetAsset.js
```

O instalador também altera de forma controlada:

```text
src/visual/genesisPlanetMaterials.js
src/home/CommandGlobeScene.js
src/campaign/CampaignPlanet.jsx
```

## Aplicação automática no Windows

1. Extraia este ZIP.
2. Abra o PowerShell dentro da pasta extraída.
3. Execute:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\install.ps1 -RepoRoot "C:\caminho\para\genesis"
```

## Aplicação automática no Linux/macOS

```bash
./install.sh /caminho/para/genesis
```

## Aplicação com Python diretamente

```bash
python apply_changes.py --repo "C:\caminho\para\genesis"
```

ou:

```bash
python3 apply_changes.py --repo /caminho/para/genesis
```

## Segurança

Antes de alterar os arquivos, o script:

1. valida a estrutura do repositório;
2. valida se os trechos esperados ainda existem;
3. prepara todas as alterações em memória;
4. só depois cria os backups e grava os arquivos.

Os backups ficam em:

```text
.genesis-backups/planet1-AAAAMMDD-HHMMSS/
```

## Alterações realizadas

### `adaptGenesisPlanetAsset.js`

- encontra o planeta pelo material `Planet`;
- encontra as nuvens pelo material `Clouds`;
- renomeia as malhas para o contrato interno do Genesis;
- preserva os nomes originais em `userData`;
- expande as nuvens para `1.015`, evitando z-fighting.

### `genesisPlanetAsset.js`

Passa a carregar:

```text
/models/command/genesis-planeta-multibiomas1.glb
```

O mesmo carregador é usado pelo Comando e pela Campanha.

### `genesisPlanetMaterials.js`

- preserva os materiais PBR e as texturas incorporadas;
- não substitui o material autoral do planeta;
- mantém transparência e alpha das nuvens;
- evita `vertexColors: true` quando a nova malha não possui `COLOR_0`;
- mantém os materiais fallback para assets antigos;
- aumenta de forma controlada a opacidade das nuvens autorais.

### Comando e Campanha

O novo GLB não possui uma esfera própria de atmosfera.

Por isso, o pacote mantém a atmosfera procedural existente depois do
crossfade. O planeta procedural é escondido normalmente.

## Testes após a instalação

Execute:

```bash
npm run test:unit
npm run build
```

Depois abra o site e valide:

1. Comando Orbital mostra o novo planeta.
2. Campanha mostra o mesmo planeta.
3. A textura do planeta está visível.
4. As nuvens não piscam nem entram em conflito com a superfície.
5. Existe halo atmosférico.
6. Fases e rotas continuam alinhadas.
7. O foguete continua orbitando no Comando.
8. Drag e zoom continuam funcionando.
9. Não aparece no console:
   `Superfície GenesisWorld_MainPlanet ausente`.

Faça um recarregamento forçado:

```text
Ctrl + F5
```

## Observação de desempenho

O GLB possui aproximadamente 17 MB, principalmente por causa das texturas
incorporadas em alta resolução. A troca funciona, mas a etapa seguinte
recomendada é criar versões Medium e Low ou converter as texturas para KTX2.
