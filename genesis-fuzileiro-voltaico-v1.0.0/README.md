# Genesis — Fuzileiro Voltaico v1.0.0

Pacote incremental em Node.js para implementar o **Fuzileiro Voltaico** no projeto Genesis.

## O que será instalado

- Nova tropa `fuzileiroVoltaico` no catálogo.
- Uso temporário dos sprites da `guarda`.
- Somente os estados visuais `idle`, `attack` e `death`.
- Fallback temporário da animação `death` para os frames de ataque da Guarda caso a pasta de morte não exista.
- HP médio, custo e atributos definidos no plano.
- Implantação em terreno seco, zona alagada e água profunda, mantendo o bloqueio durante a secagem da zona intermaré.
- Imunidade ao dano de pressão da maré.
- Imunidade à redução de cadência quando submerso.
- Ataque com preparação e liberação durante a animação.
- Retarget automático caso o alvo morra antes da liberação.
- Raio principal no primeiro inimigo válido da rota.
- Dano principal de 100%, aumentado para 120% quando o alvo está na água.
- Propagação para até três inimigos próximos.
- Dano secundário de 20%, aumentado para 40% quando o secundário está na água.
- Propagação limitada ao alvo principal, sem cadeia recursiva.
- Raios secundários capazes de alcançar unidades próximas protegidas atrás da Carapaça.
- Nenhuma aplicação de carga elétrica, paralisia ou condutividade.
- Efeito visual segmentado com raio principal, ramificações e impactos aquáticos.
- Suporte a `reduceMotion` e ao sistema de qualidade adaptativa existente.
- Testes unitários e de integração focados.

## Instalação

Extraia o pacote. No PowerShell, dentro da pasta extraída, execute:

```powershell
.\install.ps1 -RepoRoot "C:\Projetos\Genesis"
```

A raiz indicada precisa conter:

```text
package.json
src\game\content.js
src\game\battleModel.js
```

Requisito: Node.js disponível no PATH.

O instalador cria backup em:

```text
C:\Projetos\Genesis\.genesis-backups\fuzileiro-voltaico-AAAAMMDD-HHMMSS
```

## Instalação com validação

Executa verificação estrutural, testes focados e build completo:

```powershell
.\install.ps1 -RepoRoot "C:\Projetos\Genesis" -Validate
```

Para executar apenas os testes focados, sem o build completo:

```powershell
.\install.ps1 -RepoRoot "C:\Projetos\Genesis" -Validate -SkipBuild
```

## Validação manual

```powershell
cd "C:\Projetos\Genesis"
npm test -- src/game/fuzileiroVoltaico.test.js src/game/fuzileiroVoltaico.integration.test.js
npm run build
```

## Arquivos novos

```text
src/game/fuzileiroVoltaico.js
src/game/fuzileiroVoltaico.test.js
src/game/fuzileiroVoltaico.integration.test.js
```

## Arquivos modificados automaticamente

```text
src/game/content.js
src/game/battleModel.js
src/game/tideCycle.js
src/game/projectileRenderer.js
src/game/assetCatalog.js
```

## Valores de balanceamento

| Propriedade | Valor |
|---|---:|
| Energia | 22 |
| Supply | 6 |
| HP | 30 |
| Alcance | 5,5 células |
| Dano-base | 9 |
| Cadência | 1.800 ms |
| Recarga de implantação | 6.500 ms |
| Limite implantado | 5 |
| Raio da propagação | 1,35 células |
| Máximo de secundários | 3 |
| Principal seco | 100% |
| Principal na água | 120% |
| Secundário seco | 20% |
| Secundário na água | 40% |

## Reaplicação

O instalador é idempotente. Ele pode ser executado novamente sem duplicar configuração, importações ou lógica.
