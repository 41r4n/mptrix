# MPTRIX no celular — plano

*Escrito em 12/08/2026, depois da conversa que definiu o escopo.*

## O que é

Um MPTRIX de Android que faz **tudo menos o trabalho pesado**: acervo, estúdio
completo, letra, cifra, tom, mudança de tom e de tempo, e baixar música. A
separação continua sendo feita pelo computador — o celular só pede e recebe.

**Não é um porte do app de PC.** A tela atravessa; as duas pontas (baixar e
tocar) são refeitas. É um produto novo que compartilha o rosto.

**Só Android**, e isso está fechado. A Apple não deixa instalar por fora da loja
dela, e a loja não aceita app que baixa do YouTube. Não é limitação técnica.

## A ideia em uma frase

> O celular é um MPTRIX completo de **tocar**, casado com um computador que faz
> o trabalho **pesado**.

## Por que não tem servidor

O dono levantou três medos: um usuário pagando a conta do outro, gente perdendo
música, e gente encontrando música que nunca baixou.

Os três somem **por construção** se o celular e o computador falarem direto, na
rede de casa:

| medo | por que não acontece |
|---|---|
| pagar a conta do outro | a chave do Replicate fica **só no PC**; o celular nunca segura chave |
| perder música | a música mora no PC, como já mora hoje; o celular é cópia |
| achar música alheia | não existe lugar comum onde os acervos de duas pessoas se encontrem |

Não é que a gente evite esses problemas com cuidado — é que **não há onde eles
acontecerem**. Isso vale mais que qualquer proteção escrita.

## As peças, e o que já existe

| peça | situação |
|---|---|
| **a tela do estúdio** | aproveitável: já é web. Mas veja o aviso abaixo. |
| **tocar as faixas em sincronia** | o navegador do Android faz (Web Audio) |
| **mudar tom e tempo** | **refazer**: o motor de hoje é de PC |
| **baixar do YouTube** | **refazer**: precisa de peça nativa de Android |
| **saber tom e BPM** | não precisa refazer — o PC já analisou, vem junto |
| **letra e cifra** | já são texto; viajam com a música |
| **acervo** | novo: banco local no celular + sincronização |
| **separar** | **não muda nada** — o PC continua fazendo |

**O aviso sobre a tela:** ela atravessa, mas hoje ela conversa o tempo todo com
o Electron (pedir arquivo, ler acervo, tocar áudio). Cada um desses pedidos
precisa de um tradutor do lado do Android. O desenho se aproveita; a conversa,
não.

## A ligação entre os dois

1. O computador se anuncia na rede de casa.
2. O celular acha e **pareia uma vez**, com um código curto na tela — como
   parear um fone.
3. A partir daí eles se reconhecem sozinhos, sempre na mesma rede.
4. O PC manda a lista do acervo; o celular baixa o que ainda não tem.
5. Quando o celular pede pra separar, **quem chama a nuvem é o PC**, com a
   chave dele.

## Ordem de trabalho

A regra: cada fase tem que entregar algo que já dá pra usar. Nada de esperar
semanas no escuro.

**Fase 1 — o celular toca o que o PC já separou.**
Pareia, sincroniza, e o estúdio funciona: mixer, mudo, solo, loop, letra,
cifra, tom escrito. Sem baixar, sem mudar tom. *Já resolve ensaiar sem o
computador ligado.*

**Fase 2 — mudar tom e velocidade.**
Aqui entra o motor novo. É a fase mais arriscada (veja abaixo) e é o que o
amigo do dono precisava: diminuir a velocidade do solo.

**Fase 3 — baixar música pelo celular.**
Sem depender do PC pra achar a música.

**Fase 4 — mandar separar pelo celular.**
Pede, o PC faz, volta pronta.

**Fase 5 — fora de casa (opcional).**
Alcançar o PC de longe, ou dar chave própria ao celular. Traz de volta parte do
risco que a Fase 1 elimina — decidir só quando chegar lá.

## Onde eu acho que vai doer

- **O motor de tom e tempo.** No PC ele é um programa nativo bom. No celular as
  opções são piores: ou perde qualidade, ou come bateria. Essa é a maior
  incógnita do projeto, e é por isso que ela é a Fase 2 e não a 4 — se for pra
  frustrar, que frustre cedo.
- **Tocar seis faixas juntas** num celular modesto pode falhar ou atrasar.
  Talvez precise juntar as faixas mudas antes de mandar.
- **Espaço.** Uma música separada tem umas seis faixas; algo em torno de 60 MB.
  Cinquenta músicas já são uns 3 GB no celular.
- **Roteador chato.** Alguns isolam os aparelhos entre si e o celular não
  enxerga o PC. Tem contorno, mas dá trabalho de suporte.
- **Duas telas parecidas** viram dois códigos diferentes com o tempo, e aí um
  conserto tem que ser feito duas vezes. Precisa de disciplina desde o começo.

## O que ainda falta decidir

- Qual Android? (versão e memória do aparelho do dono e do pai dele)
- Quantas músicas ele quer carregar no celular?
- A Fase 5 (fora de casa) entra ou o app é de rede doméstica?

## Antes disso, o que está aberto no app de PC

- Publicar o `0.4.1` — o instalador que está no ar tem defeito visual.
- A dissecação nunca rodou inteira em música de verdade.
- A conta do Replicate está suspensa por US$ 0,25.
