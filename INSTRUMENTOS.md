# 🎛️ Cardápio de instrumentos do MPTRIX

Mapa oficial do que o Estúdio identifica e separa, e como. Atualizado em 2026-07-17.

## Como funciona

1. **Análise (olheiro):** ao abrir uma música, o app separa pedacinhos de amostra (~2-3 min)
   e uma IA escuta os stems pra catalogar o que existe — com confiança e momento onde toca.
2. **Catálogo:** a tela mostra a banda base que a música realmente tem + os extras
   detectados, cada um com tempo estimado de extração.
3. **Extração:** só o que você marcar é extraído. Instrumento não marcado permanece
   dentro da faixa "Outros".

Filosofia: **onde o ouvido da IA é firme, aponta fino; onde é delicado, fala em naipe.**
Confiança calibrada vale mais que chute confiante.

## 🎯 Identificados e extraídos individualmente

Sons de "impressão digital" forte — cada um com seu cartão no catálogo e sua faixa no player.

| Instrumento | Notas |
|---|---|
| 🎤 Voz | banda base |
| 🥁 Bateria | banda base |
| 🎸 Baixo | banda base |
| 🎸 Guitarra elétrica | sai do mesmo passo que o teclado (o tempo conta uma vez) |
| 🎹 Piano/Teclado | inclui piano elétrico e teclados em geral |
| 🎸 Violão | separado da guitarra elétrica (especialista próprio) |
| 🪈 Flauta | especialista próprio |
| 🎷 Sax | especialista próprio |
| 🪗 Acordeon | especialista próprio |
| 🎵 Gaita | especialista próprio |
| 🪕 Banjo | especialista próprio |
| 🎸 Bandolim | especialista próprio |

## 👥 Identificados e extraídos por grupo (naipe)

Sons que se misturam entre si — tocam em seção e saem numa faixa única do naipe.

| Grupo | Quem entra |
|---|---|
| 🎺 Metais | trompete, trombone, trompa, tuba |
| 🎻 Cordas | violino, viola, cello, naipe de cordas, orquestra |
| ⛪ Órgão | órgão de igreja, Hammond, órgão eletrônico |

## 🎼 A faixa "Outros"

Tudo que não foi reconhecido ou não foi extraído: synths, efeitos, percussões menores,
instrumentos exóticos. Numa música minimalista (ex.: só voz + teclado), o "Outros" é
essencialmente o próprio instrumento acompanhador.

## ⚠️ Limitações conhecidas (honestidade acima de tudo)

- **Dois instrumentos iguais não se separam entre si** (duas guitarras, dois violinos) —
  fronteira da tecnologia atual, ninguém faz ainda.
- **Teclado imitando outro instrumento** (pad de cordas, brass de synth) é detectado pelo
  **som que faz**, não pelo instrumento físico — um pad de cordas conta como "Cordas".
- **Instrumento muito discreto ou aparição curtinha** pode escapar da detecção.
- Tempos de extração são estimativas medidas nesta máquina (~10 min por minuto de música
  pros especialistas raros; guitarra+teclado ~1,2× a duração da música).

## 🚪 Fora do cardápio por enquanto (porta aberta)

Os especialistas já existem na comunidade — é plugar quando houver demanda:

- Clarinete, oboé, fagote (individuais de sopro)
- Harpa, sinos, marimba, glockenspiel
- **Bateria por peças** (bumbo / caixa / tons / pratos — "DrumSep")
- Voz principal × vocais de apoio
