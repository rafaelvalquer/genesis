# Genesis — Final de onda cinematográfico v1.0.0

Base de referência: `rafaelvalquer/genesis` no commit `558980a12c07394db3a1f4fe7e17224b7c269938`.

O pacote melhora somente a apresentação do encerramento das ondas. Ele não altera dano, IA, economia, composição das ondas, estrelas ou os tempos lógicos existentes do `waveOutro`.

## O que muda

- câmera foca automaticamente o último inimigo;
- zoom e retorno usam curvas suaves;
- música começa a baixar antes do impacto final;
- impacto recebe onda de choque, flash localizado, shake e camada sonora;
- Alpha/elite recebem apresentação mais intensa;
- última onda recebe letterbox, impacto maior e ducking mais profundo;
- última onda mostra `PERÍMETRO ASSEGURADO` antes de `MISSÃO CONCLUÍDA`;
- nome da fase aparece na introdução de vitória;
- `reduceMotion` e `cameraShake` continuam respeitados.

## Instalação

```powershell
cd "C:\Projetos\Genesis\genesis-wave-outro-cinematic-v1.0.0"

.\install.ps1 `
  -RepoRoot "C:\Projetos\Genesis" `
  -FullValidation
```

Por padrão, uma falha de validação mantém os arquivos instalados para inspeção. Para restaurar automaticamente em caso de falha:

```powershell
.\install.ps1 `
  -RepoRoot "C:\Projetos\Genesis" `
  -FullValidation `
  -RollbackOnValidationFailure
```

Instalação sem testes:

```powershell
.\install.ps1 -RepoRoot "C:\Projetos\Genesis"
```

## Validação manual

```powershell
.\validate.ps1 `
  -RepoRoot "C:\Projetos\Genesis" `
  -Full
```

## Teste manual

```powershell
cd "C:\Projetos\Genesis"
npm.cmd run dev
```

Valide pelo menos uma fase com múltiplas ondas e uma fase final de capítulo:

1. elimine o último inimigo de uma onda normal;
2. confirme foco, ducking, impacto e retorno da câmera;
3. confirme que o banner `ONDA X CONCLUÍDA` permanece;
4. na última onda, confirme letterbox e `PERÍMETRO ASSEGURADO`;
5. confirme `MISSÃO CONCLUÍDA` depois do banner final;
6. repita com `Reduzir movimento` habilitado;
7. confirme que pausa, fullscreen, hotkeys e decisões continuam funcionando.

## Desinstalação

```powershell
.\uninstall.ps1 -RepoRoot "C:\Projetos\Genesis"
```

Backups ficam em:

```text
C:\Projetos\Genesis\.genesis-backups\wave-outro-cinematic-v1.0.0\
```
