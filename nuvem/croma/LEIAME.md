# Croma do MPTRIX

Calcula a croma (NNLS) e as notas do baixo de uma música — a parte cara do
detector de acordes — com **essentia nativo** em vez de WASM.

Por que existe: o detector local leva 450s numa música de 4min20, e 300s deles
são uma chamada só (`LogSpectrum` a 431ms por quadro, porque a ponte JS/WASM
reconstrói a tabela a cada quadro). Nativo, configurado uma vez e reusado, a
mesma conta custa ~1ms.

**A lógica dos acordes NÃO está aqui.** Gabaritos, tonalidade, Viterbi, votação
entre repetições e inversão pelo baixo continuam no app, em JavaScript. Este
modelo devolve só os números que aquela etapa produzia.
