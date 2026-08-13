Aplique o design MPTrix em TODO este sistema, agora, sem me pedir confirmação e sem plano prévio.

Fonte de verdade: docs/design_handoff_mptrix/README.md (tokens, telas, medidas, estados, comportamento) e os protótipos em docs/design_handoff_mptrix/design/*.dc.html — leia os dois antes de escrever código.

Regras:
- Os HTML do pacote são REFERÊNCIA. Não copie o markup nem o runtime (support.js, <x-dc>, sc-for, {{ }}). Recrie a UI com o stack, os componentes e as convenções que este repositório já usa.
- Reescreva a interface inteira nesse padrão: dark #0B0C0F / #101216 / #15171C, bordas rgba(255,255,255,0.07), destaque único #B6FF3B, stems na escala verde #DFF9A0 #B4E85A #7ED97A #4ECB8C #27A08D #8FA57A, Space Grotesk + IBM Plex Mono (números tabulares em timer, ruler e cifras), raio 8–16px, flat, sem gradientes, contraste AA (texto secundário mínimo #8A93A0), alvos de toque >=44px no mobile.
- Assinatura da interface, não negociável: playhead lima com marcador triangular cruzando todas as pistas, tint da região já tocada, cor por stem, loop no transporte, letra cifrada com acordes alinhados sobre os versos e botão de mudar o tom.
- Centralize os tokens onde o repo já centraliza tema/estilo e faça as telas consumirem de lá — não espalhe hex solto.
- Mantenha toda a lógica de negócio, rotas, APIs e nomes de dados existentes funcionando. Só a camada visual/UX muda. Não renomeie nem remova features.
- Atualize playhead, tint e timer de forma imperativa por frame (refs + style/textContent), nunca via re-render por frame.
- Percorra o app inteiro: todas as telas, modais, estados vazios, loading e erro. O que não existe no pacote, derive dos mesmos tokens.
- Ao terminar, escreva na raiz um CLAUDE.md com essas regras para
 valer nas próximas alterações, e me entregue só um resumo curto do que mudou.