# Bastião de Maré — pacote de implementação

Versão corrigida **1.0.1**, compatível com o repositório `rafaelvalquer/genesis` no commit-base analisado `7466334ba55ccd6301a237a45f05dd1a7b39af43` ou posterior que preserve os mesmos pontos de integração.

## Correção da versão 1.0.1

A versão 1.0.0 procurava a regra da doutrina de linha de frente em `content.js`, embora essa regra esteja em `battleModel.js`. Isso causava o erro:

```text
content.js/doutrina de linha de frente: esperado 1 marcador, encontrado 0.
```

A busca incorreta foi removida. A inclusão do Bastião na doutrina continua sendo aplicada no local correto, em `battleModel.js`.

## O que é instalado

- tropa `bastiaoMare` com HP 110, custo 28 e limite de três unidades;
- implantação em solo, zona alagada e água profunda;
- imunidade à pressão e à penalidade de cadência da maré;
- redução de 15% do dano recebido quando alagado;
- golpe de escudo corpo a corpo com dano 3;
- carga por dano real: 18 em solo ou 14 na água;
- bola amarela coletável igual à do Capítulo 2;
- limite de cinco bolas por unidade em dez segundos;
- dano ambiental de colisão do vento não alimenta o gerador;
- ancoragem contra o empurrão de formação do Gorjal quando alagado;
- estados visuais `idle`, `attack` e `death`;
- imagem anexada processada e instalada como `frame0.png` provisório nos três estados;
- testes unitários e de integração.

## Instalação

Extraia a pasta e execute no PowerShell:

```powershell
cd "C:\Projetos\Genesis\genesis-bastiao-mare-v1.0.1"
.\install.ps1 -RepoRoot "C:\Projetos\Genesis" -Validate
```

Para instalar e rodar somente os testes específicos:

```powershell
.\install.ps1 -RepoRoot "C:\Projetos\Genesis" -Validate -SkipBuild
```

O instalador cria um backup em:

```text
C:\Projetos\Genesis\.genesis-backups\bastiao-mare-AAAAMMDD-HHMMSS
```

## Após a falha da versão 1.0.0

Não é necessário restaurar o backup para esse erro específico. A falha ocorreu antes da gravação de `content.js`. Basta usar esta versão corrigida.

## Sprites provisórios

```text
src/game/assets/troop/bastiaoMare/
├── idle/frame0.png
├── attack/frame0.png
└── death/frame0.png
```

## Validação manual

```powershell
.\validate.ps1 -RepoRoot "C:\Projetos\Genesis"
```
