# Detector de acordes do MPTrix na nuvem

Empacota o **BTC** (Bi-directional Transformer for Chord Recognition, ISMIR
2019 — licenca MIT) como modelo no Replicate.

## Por que

O detector local do MPTrix usa croma + casamento de gabarito. Medido contra a
cifra real de duas musicas, ele acerta ~71% de raiz+familia. A literatura mede
essa familia de metodo como a mais fraca disponivel; modelo treinado abre uma
folga grande. O BTC foi escolhido em vez do madmom (que pontua mais alto) por
um motivo concreto: **o madmom so reconhece maior e menor**, e a cifra que
interessa aqui tem setima, diminuto e meio-diminuto. O vocabulario grande do
BTC tem 170 acordes.

## Como publicar

1. Criar um repositorio no GitHub com esta pasta.
2. Em Settings > Secrets and variables > Actions, criar o segredo
   `REPLICATE_API_TOKEN` com o token do Replicate.
3. Aba Actions > "publicar detector de acordes" > Run workflow, informando o
   destino (ex.: `41r4n/mptrix-acordes`).

O modelo precisa existir antes no Replicate (criar em replicate.com/create,
como modelo **privado** — nao ha motivo pra ficar publico).

## Saida

JSON no mesmo formato que o detector local ja produz, pra que o app nao precise
saber de onde veio a cifra:

```json
{ "chords": [ { "t": 35.2, "end": 39.1, "label": "Gm7" } ],
  "duration": 260.3, "modelo": "btc-large-voca" }
```
