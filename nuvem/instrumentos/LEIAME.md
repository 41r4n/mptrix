# Extrator de instrumentos do MPTRIX

Roda o especialista BS-RoFormer do catálogo de 53 instrumentos (MVSep Mega) em
GPU, pra o MPTRIX não precisar gastar 47 minutos de processador por instrumento.

Os pesos NÃO ficam na imagem: são 77MB por instrumento e são 53 deles. O
contêiner baixa sob demanda do HuggingFace e guarda em `/tmp` — contêiner
quente reaproveita.

O código de inferência é o Music-Source-Separation-Training do ZFTurbo,
travado no commit `83d495d` — o mesmo que roda na máquina do usuário. Aqui a
única diferença é não passar `--force_cpu`.

Publicar: aba Actions -> "publicar extrator de instrumentos" -> Run workflow.
Precisa do segredo `REPLICATE_API_TOKEN` no repositório.
