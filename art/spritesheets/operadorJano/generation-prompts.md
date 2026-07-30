# Prompts de geração — Operador Jano

Modo usado: ferramenta integrada de geração de imagens, com a arte enviada pelo usuário como referência principal e uma prancha dos sprites existentes como referência de acabamento e escala.

## Restrições compartilhadas

- Sprite sheet 4 × 2, exatamente oito frames em ordem de leitura.
- Ilustração 2D tática sci-fi pintada à mão, contornos escuros nítidos e leitura em escala pequena.
- Identidade, roupa, arma, materiais, paleta, câmera e escala consistentes entre frames.
- Fundo uniforme `#ff00ff`, sem gradiente, textura, sombra, chão, texto, grade, bordas ou marca d'água.
- Um único sujeito completo e sem cortes por célula, com padding e sem sobreposição.
- Personagem e drone gerados em camadas independentes.

## Camada do personagem

Invariantes: homem musculoso de meia-idade, moicano grisalho, barba grisalha curta, visor tático âmbar, tatuagens/cicatrizes faciais, jaqueta tática preta com gola e detalhes amarelos, luzes ciano, calça cargo preta, joelheiras, botas pesadas e o mesmo rifle futurista de precisão. Orientação em três quartos voltada para a direita.

- `idle`: postura neutra; respiração; observação à frente; ajuste do rifle; retorno ao centro; movimento discreto do casaco; pulso do visor/comunicador; fechamento do loop. Dois pés plantados.
- `attackFront`: ergue o rifle; apoia no ombro; ajusta a mira; prepara o gatilho; dispara no frame 4; recuo máximo; recuperação; abaixa parcialmente. Apenas o frame 4 contém flash ciano.
- `syncShot`: ativa comunicador; inicia sincronização; mira holográfica compacta; trava alvos; energia percorre o rifle; dispara no frame 5; recuo; retorno. Apenas o frame 5 contém flash.
- `death`: recebe impacto; perde equilíbrio; rifle escapa; joelho cede; corpo desce; queda lateral; posição quase final; repouso. Sem sangue ou gore; queda ao redor do root inicial.

## Camada do drone Íris

Invariantes: drone ocular esférico compacto em gunmetal escuro, lente/núcleo central ciano, anéis mecânicos concêntricos, aletas laterais, pequenas antenas e sensores/arma traseiros.

- `droneIdle`: flutuação vertical leve; varredura da lente; ajuste discreto das aletas; pulso do núcleo; loop contínuo.
- `droneAttackRear`: gira para a esquerda/retaguarda; trava alvo; carrega núcleo; dispara pulso ciano no frame 3; recuo; estabilização; retorno à guarda.
- `droneDisabled`: luz falha; inclinação; pequena perda de altitude; núcleo quase apaga; faíscas elétricas compactas; giro irregular; pulso fraco; retorno ao loop. Continua flutuando.
- `droneRecover`: começa apagado; luz interna pisca; propulsores reiniciam; recupera altura; lente abre; varredura ciano; sensor/arma reativa; retorna ao idle.
