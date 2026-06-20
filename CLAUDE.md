@AGENTS.md

# Design Guidelines

## Responsividade
- Sempre usar unidades relativas (rem, %, vw/vh) — nunca px fixo para larguras de containers
- Mobile-first: escrever CSS para mobile primeiro, depois media queries para telas maiores
- Breakpoints padrão: 640px (sm), 768px (md), 1024px (lg), 1280px (xl)
- Botões: min-height 44px (touch target), padding relativo, nunca largura fixa em px
- Testar overflow: usar flex-wrap, min-width: 0 em containers flex, text-overflow: ellipsis
- Nunca usar width fixo em px em elementos de texto/botão — usar max-width + flex/grid

## Componentes
- Botões sempre com white-space: nowrap OU permitir quebra controlada
- Usar Flexbox/Grid em vez de posicionamento absoluto sempre que possível
- Testar em 320px, 768px e 1440px de largura mentalmente antes de finalizar