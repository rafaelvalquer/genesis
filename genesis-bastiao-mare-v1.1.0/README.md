# Bastião de Maré v1.1.0 — Sobrecarga Capacitiva

Pacote incremental para o repositório `rafaelvalquer/genesis`, preparado sobre o commit-base analisado:

```text
a7f2d3fd6a9f6e526ff3ec9b1820193bd145684f
```

Esta atualização requer que o Bastião de Maré v1.0 já esteja instalado no projeto.

## Melhorias instaladas

- limite de implantação alterado de três para cinco Bastiões;
- cada bola amarela criada libera uma Sobrecarga Capacitiva;
- dano elétrico em área de 5;
- raio de 1,25 células, calculado com as proporções horizontal e vertical da grade;
- até seis inimigos por pulso;
- chefes e variantes Alpha recebem 50% do dano;
- Enguia Rasgamar completamente submersa não é atingida;
- dano indireto, sem paralisia, condutividade ou knockback;
- uma sobrecarga por bola efetivamente criada;
- múltiplas bolas no mesmo impacto produzem pulsos separados por 70 ms no visual;
- efeito com anel ciano, clarão no núcleo, arcos em volta da tropa, raios até os alvos e faíscas;
- integração com qualidade adaptativa e `reduceMotion`;
- manutenção do limite individual de cinco bolas em dez segundos;
- testes unitários e de integração atualizados.

## Instalação

Extraia a pasta e execute no PowerShell:

```powershell
cd "C:\Projetos\Genesis\genesis-bastiao-mare-v1.1.0"
.\install.ps1 -RepoRoot "C:\Projetos\Genesis" -Validate
```

Para executar os testes específicos sem o build completo:

```powershell
.\install.ps1 -RepoRoot "C:\Projetos\Genesis" -Validate -SkipBuild
```

## Backup

O instalador cria automaticamente:

```text
C:\Projetos\Genesis\.genesis-backups\bastiao-mare-v1.1.0-AAAAMMDD-HHMMSS
```

## Validação posterior

```powershell
.\validate.ps1 -RepoRoot "C:\Projetos\Genesis"
```

## Arquivos alterados

```text
src/game/content.js
src/game/battleModel.js
src/game/projectileRenderer.js
src/game/bastiaoMare.js
src/game/bastiaoMare.test.js
src/game/bastiaoMare.integration.test.js
```

Os sprites existentes do Bastião não são substituídos por esta atualização.
