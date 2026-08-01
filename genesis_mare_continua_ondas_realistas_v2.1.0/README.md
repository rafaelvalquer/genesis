# Genesis — Maré contínua com ondas realistas v2.1.0

Este pacote substitui a representação em tiles quadrados por uma massa d’água contínua e animada no Capítulo 5.

## O que muda

- costa contínua da direita para a esquerda;
- fronteira específica por rota, interpolada entre as cinco linhas;
- três frequências independentes de onda;
- avanço e recuo pela posição da frente d’água;
- espuma principal e espuma secundária;
- correntes internas atravessando o território alagado;
- caustics e bolhas na qualidade alta;
- rastros em “V” atrás de inimigos na água;
- ondulações ao redor de tropas submersas;
- zona intermaré seca sem moldura retangular completa;
- aviso de futura costa durante avanço ou recuo;
- redução automática dos efeitos em qualidade média, baixa ou modo de estresse.

## O que não muda

- Supply;
- probabilidades de avanço e recuo;
- células consideradas alagadas;
- bônus e penalidades;
- dano da pressão;
- minas e Reatores;
- composição das ondas;
- posicionamento de tropas.

## Instalação no Windows

Extraia a pasta em `C:\Projetos\Genesis` e execute:

```powershell
cd C:\Projetos\Genesis\genesis_mare_continua_ondas_realistas_v2.1.0
Set-ExecutionPolicy -Scope Process Bypass
.\install.ps1 -RepoRoot "C:\Projetos\Genesis"
```

Para executar também o Vite build:

```powershell
.\install.ps1 -RepoRoot "C:\Projetos\Genesis" -Validate
```

Depois:

```powershell
cd C:\Projetos\Genesis
npm run dev
```

## Backup

O instalador cria um backup em:

```text
C:\Projetos\Genesis\.genesis-backups\chapter-05-continuous-tide-AAAAMMDD-HHMMSS
```

## Arquivos alterados

- `src/game/tideRenderer.js`
- `src/game/tideCycle.js`, somente quando a correção da água na coluna de spawn ainda não estiver instalada
- cópia do renderer no payload do instalador anterior, quando essa pasta existir
