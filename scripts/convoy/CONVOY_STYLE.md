# Semi-cartoon tático — família de veículos do Capítulo 7

Todos os veículos usam o mesmo contrato `idle/run/destroyed_transition/destroyed_loop`, canvas 1024×512 e exportação WebP RGBA. A direção visual comum é:

- silhueta robusta, lateral/3⁄4 leve e leitura clara em 224×112;
- painéis grandes, contraste de carroceria/rodas e detalhes ciano econômicos;
- rodas grandes com sulcos simples e centros estáveis para rotação local;
- alpha real fora da silhueta, sem matte, barras ou halos;
- tratamento tonal semi-cartoon comum aplicado por `build_convoy_vehicle_family.py`;
- poeira, fumaça, faíscas e glow de ameaça continuam responsabilidade do renderer.

O script é reexecutável e altera somente os assets finais, preservando nomes,
quantidades, pivôs e o catálogo existente.
