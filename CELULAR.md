# MPTRIX no celular — plano

*Reescrito em 12/08/2026, depois de um dia inteiro de tentativa e erro. A
primeira versão deste arquivo desenhava o celular como um espelho do
computador; este desenha ele como um MPTRIX inteiro.*

## A decisão que muda tudo

> **Dois aplicativos completos e independentes, que trocam música quando se
> encontram na mesma rede.**

Nem o celular depende do computador, nem o contrário. Depois de uma troca, a
música está **no telefone de verdade** — o computador pode ser desligado,
vendido ou ficar em outra cidade que nada muda.

## O que se tentou primeiro, e por que não serve

Ontem eu servi uma **página** do computador para o celular. Funcionou em horas
em vez de semanas, e por isso foi uma escolha legítima para aquele dia. Mas ela
não é o destino, e o dono descobriu isso do pior jeito: indo para a igreja com
músicas que não tinham sido guardadas.

As limitações eram todas da mesma causa — é página, não app:

| limitação | causa |
|---|---|
| só funciona perto do computador | a página mora nele |
| não baixa do YouTube sozinho | navegador é proibido de falar com o YouTube |
| não instala como app | instalação exige `https`; endereço de casa não tem |
| não toca offline | *service worker* exige `https` também |
| rede pública derruba | Wi-Fi de igreja separa os aparelhos |

**As cinco somem com um app instalado.** Não são paredes do celular; são
paredes do navegador.

## O que o app faz sem depender de nada

| função | precisa de quê |
|---|---|
| baixar música | internet (qualquer app precisa) — **não** precisa de computador |
| tocar, mixer, mudo, solo | nada |
| velocidade (sem mexer no tom) | nada |
| metrônomo, repetir trecho | nada |
| letra e cifra | nada |
| **mudar o tom** | nada — no app existe motor de afinação, que o navegador não tem |
| acervo | o próprio armazenamento do telefone |
| **separar** | internet + crédito da pessoa (nuvem) |

**Separar é a única coisa com pedra**, e o dono já disse que é a menos
importante para ele. Some com isso a barreira que excluiria quem não tem
cartão: o app inteiro funciona sem separar nada.

## Onde a música fica

Numa pasta **visível** do telefone (`Música/MPTRIX`), não escondida dentro do
app. Assim qualquer tocador enxerga, e as músicas continuam sendo da pessoa
mesmo se ela desinstalar o MPTRIX. A música é dela, não do programa.

Espaço, para dar noção: uma música em MP3 tem 5 a 9 MB; cem músicas não chegam
a 1 GB. Uma música separada ocupa uns 25 MB com todas as faixas.

## A ligação entre os dois

Quando estão na mesma rede, um enxerga o outro:

- **mandar pro celular** — do computador, escolhendo o que vai
- **puxar do computador** — do celular, escolhendo o que vem

E resolve o separador de graça: separa em casa, manda as faixas para o
telefone, e ensaia com o mixer em qualquer lugar, sem nuvem e sem crédito.

Nada de servidor no meio, nada de conta: os três medos do dono (um pagando a
conta do outro, perder música, achar música alheia) não são evitados com
cuidado — **não têm onde acontecer**, porque não existe lugar comum onde dois
acervos se encontrem.

## O acervo é um só, visto de dois lugares

A lista viaja sozinha; o arquivo só vai quando a pessoa pede.

- Baixou no computador → **aparece** no celular
- Baixou no celular → **aparece** no computador
- O arquivo continua onde foi baixado, até alguém mandar levar

E a marca existe **dos dois lados**, porque é ela que evita a pergunta "será
que essa eu tenho aqui?":

| no computador | no celular |
|---|---|
| Girlfriend — *nos dois* | Girlfriend — *no celular* |
| Oceano — *só aqui* | Oceano — *só no computador* |

Cada aparelho guarda a lista do outro do último encontro. Sem isso, longe de
casa o celular mostraria só o que ele tem — e a pessoa perderia justamente a
informação de que existe mais música esperando por ela.

**A sincronização acontece quando os dois se encontram na mesma rede**, não na
hora. Quem baixa uma música na igreja só vê ela no computador ao chegar em
casa. É consequência de não existir servidor no meio, e é o preço de ninguém
pagar a conta de ninguém.

## Entrar com a própria conta

O dono levantou duas coisas que parecem diferentes e são a mesma:

1. O pai fica sem crédito e quer usar o do filho.
2. Ter o mesmo MPTRIX no celular, no computador de casa e no do trabalho.

As duas pedem **identidade**, e identidade normalmente pede servidor — que é
justamente o que este projeto não quer ter.

**A saída: o login é o do Google, e a "conta" é o Drive da própria pessoa.**

- Botão único: *Entrar com Google*. Ninguém cria conta de MPTRIX, ninguém
  inventa senha, ninguém confirma e-mail.
- No Drive da pessoa ficam a **lista do acervo** e a **chave do crédito** —
  poucos KB.
- Entrou no celular do pai: aparece o acervo e o crédito de quem entrou. Saiu:
  volta a ser o do pai.

Não existe servidor meu, não existe cadastro, e os acervos de duas pessoas
nunca se encontram: cada um está na conta de outro dono.

O preço: precisa de internet **para entrar** (depois disso, o que está baixado
toca offline), e a pessoa precisa de uma conta Google — que no Android todo
mundo já tem, porque é o que instala aplicativo.

**Emprestar crédito sem login** também é possível (a chave passa por um código
lido na tela), mas quem recebe gasta sem limite: não existe meia chave. Um teto
no aparelho de quem pegou é freio de confiança, não tranca. Entre pai e filho
basta; entre estranhos, não.

**A tela de entrar é construída cedo**, mesmo antes de estar ligada em tudo. O
dono julga o que vê, não o que lê — e "ficou burocrático?" é uma pergunta que
só se responde olhando.

## Só Android

A Apple não deixa instalar por fora da loja dela, e a loja não aceita app que
baixa do YouTube. Não é limitação técnica, é regra deles. No Android o arquivo
se instala direto, como o `.exe` no computador.

## Ordem de trabalho

Cada fase entrega algo usável, e as arriscadas vêm cedo — se for para
frustrar, que frustre na segunda semana e não na oitava.

**Fase 1 — o app toca.** Acervo local, estúdio completo (mixer, velocidade,
metrônomo, repetir, letra e cifra), lendo música que já está no telefone.
*Já serve para ensaiar.*

**Fase 2 — baixar.** Cola o link, escolhe o ato, a música cai no acervo do
telefone. Aqui o app fica independente de verdade.

**Fase 3 — mudar o tom.** A ferramenta que o navegador não permitia. É a mais
arriscada em qualidade e bateria; por isso vem antes das facilidades.

**Fase 4 — trocar com o computador.** Mandar e puxar, na mesma rede.

**Fase 5 — separar pela nuvem.** Opcional, para quem tem crédito.

## Onde eu acho que vai doer

- **Mudar o tom** no celular: ou perde qualidade, ou come bateria. Maior
  incógnita do projeto.
- **Tocar seis faixas juntas** num aparelho modesto. Ainda não medido.
- **Baixar do YouTube** depende de biblioteca que quebra quando o YouTube muda
  — o mesmo problema do `yt-dlp` no computador, e a mesma solução: atualizar.
- **Duas telas parecidas** viram dois códigos com o tempo, e aí um conserto
  precisa ser feito duas vezes.

## O que ainda falta decidir

- Qual Android (versão e memória) do dono e do pai dele?
- A tela do celular é reescrita ou reaproveitada dentro de uma casca?

## Aberto no app de computador

- A dissecação nunca rodou inteira em música de verdade.
- A conta do Replicate está suspensa por US$ 0,25.
