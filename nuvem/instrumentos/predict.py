# -*- coding: utf-8 -*-
# Extrai UM instrumento de uma música, com o especialista BS-RoFormer do
# catálogo de 53 do MVSep. Mesmo código e mesmo commit que roda na máquina do
# usuário — a única diferença é a GPU no lugar do processador.
import os
import shutil
import subprocess
import sys
import tempfile

import requests
from cog import BasePredictor, Input, Path

MSST = "/msst"
HF = "https://huggingface.co/noblebarkrr/BS-Roformer-MVSep-Mega-53-stems/resolve/main/v1"

# Onde os pesos ficam entre uma execução e outra. Contêiner quente reaproveita:
# são 77MB por instrumento, então baixar de novo a cada música seria desperdício
# de tempo do usuário e de segundo de GPU cobrado.
CACHE = "/tmp/modelos53"

# Os 53 do catálogo. A lista existe pra recusar nome inventado ANTES de subir a
# GPU: errar aqui custa só uma mensagem, errar lá custa minutos e dinheiro.
INSTRUMENTOS = [
    "accordion", "acoustic-guitar", "banjo", "bass", "bass-guitar", "bassoon",
    "bowed_strings", "brass", "cello", "clarinet", "clavinet", "congas",
    "cymbals", "djembe", "dobro", "double-bass", "drums", "electric-guitar",
    "flute", "french-horn", "glockenspiel", "guitar", "harmonica", "harp",
    "harpsichord", "kick", "mandolin", "marimba", "oboe", "organ", "other",
    "percussion", "piano", "sax", "saxophone", "shakers", "sitar", "snare",
    "steel-guitar", "strings", "synth", "tambourine", "timpani", "toms",
    "triangle", "trombone", "trumpet", "tuba", "ukulele", "vibraphone",
    "viola", "violin", "vocals", "woodwind", "xylophone",
]


def baixar(url, destino):
    if os.path.exists(destino) and os.path.getsize(destino) > 1000:
        return destino
    tmp = destino + ".parcial"
    with requests.get(url, stream=True, timeout=180) as r:
        r.raise_for_status()
        with open(tmp, "wb") as f:
            for pedaco in r.iter_content(1 << 20):
                f.write(pedaco)
    os.replace(tmp, destino)
    return destino


def com_lote(caminho_cfg, inst, lote=None):
    """Troca só o batch_size da inferência, por TEXTO.

    O config publicado traz `batch_size: 1`, afinado pra placa pequena: o modelo
    processa UM pedaço de 10 segundos por vez, e numa música de 4 minutos são
    ~52 passadas em fila com a GPU ociosa entre elas.

    NÃO uso leitor de YAML aqui, e isso é de propósito. Tentei com yaml.safe_load
    e quebrou de verdade, em produção: os configs do catálogo guardam tipos do
    Python (`!!python/tuple`) que o leitor seguro recusa, e a extração da gaita
    morreu com "could not determine a constructor". Usar um leitor permissivo
    resolveria o erro e criaria outro risco — reescrever o arquivo inteiro pode
    mudar campo que eu nem sei que existe. Uma linha é o que precisa mudar,
    então mudo uma linha e o resto do arquivo passa intacto.
    """
    if lote is None:
        lote = 4
        try:
            import torch
            if torch.cuda.is_available():
                gb = torch.cuda.get_device_properties(0).total_memory / (1024 ** 3)
                lote = 8 if gb >= 20 else 4
        except Exception:
            lote = 4

    with open(caminho_cfg, "r") as f:
        linhas = f.readlines()

    # só o batch_size que está DENTRO de "inference:" -- o de treino, se
    # existir, não é da minha conta
    dentro = False
    mexeu = False
    for i, linha in enumerate(linhas):
        sem_recuo = linha.lstrip()
        if not linha.startswith((" ", "	")) and sem_recuo.rstrip().endswith(":"):
            dentro = sem_recuo.startswith("inference:")
            continue
        if dentro and sem_recuo.startswith("batch_size:"):
            recuo = linha[: len(linha) - len(sem_recuo)]
            linhas[i] = recuo + "batch_size: " + str(int(lote)) + "\n"
            mexeu = True
            break
    if not mexeu:
        return caminho_cfg  # sem esse campo, segue com o original

    saida = f"{CACHE}/{inst}_lote{lote}.yaml"
    with open(saida, "w") as f:
        f.writelines(linhas)
    return saida


class Predictor(BasePredictor):
    def setup(self):
        """De propósito não carrega nada.

        Se o carregamento estoura aqui, o contêiner morre e reinicia num laço:
        a execução fica "starting" pra sempre, SEM LOG NENHUM. Já perdi horas
        com isso hoje. Carregando sob demanda, qualquer erro vira erro DA
        PREDIÇÃO, com traceback visível.
        """
        os.makedirs(CACHE, exist_ok=True)

    def predict(
        self,
        audio: Path = Input(description="Áudio de onde extrair o instrumento"),
        instrumento: str = Input(
            description="Qual instrumento extrair (ex.: harmonica, dobro, organ)",
            default="harmonica",
        ),
    ) -> Path:
        inst = str(instrumento).strip().lower()
        if inst not in INSTRUMENTOS:
            raise ValueError(
                f"'{inst}' não está no catálogo. Disponíveis: {', '.join(INSTRUMENTOS)}"
            )

        ckpt = baixar(f"{HF}/bs_mega_53stem_{inst}_mvsep.ckpt", f"{CACHE}/{inst}.ckpt")
        cfg = baixar(f"{HF}/bs_mega_53stem_{inst}_mvsep_config.yaml", f"{CACHE}/{inst}.yaml")
        cfg = com_lote(cfg, inst)

        trabalho = tempfile.mkdtemp()
        entrada = os.path.join(trabalho, "entrada")
        saida = os.path.join(trabalho, "saida")
        os.makedirs(entrada)
        os.makedirs(saida)

        # o MSST lê uma PASTA; e o que chega pode ser mp3/flac/wav
        wav = os.path.join(entrada, "musica.wav")
        subprocess.run(
            ["ffmpeg", "-y", "-v", "error", "-i", str(audio), "-ac", "2", "-ar", "44100", wav],
            check=True,
        )

        # Mesmos parâmetros do app, SEM o --force_cpu: é essa linha inteira a
        # razão de existir deste modelo.
        #
        # Se o lote não couber na placa, cai pra metade e tenta de novo. Melhor
        # demorar um pouco mais do que devolver "sem memória" pra quem só queria
        # a gaita da música.
        lote_atual = None
        ultimo_erro = ""
        for tentativa in range(3):
            r = subprocess.run(
                [
                    sys.executable, os.path.join(MSST, "inference.py"),
                    "--model_type", "bs_roformer",
                    "--config_path", cfg,
                    "--start_check_point", ckpt,
                    "--input_folder", entrada,
                    "--store_dir", saida,
                ],
                cwd=MSST,
                capture_output=True,
                text=True,
            )
            if r.returncode == 0:
                break
            ultimo_erro = (r.stderr or r.stdout or "")[-2000:]
            if "out of memory" not in ultimo_erro.lower():
                raise RuntimeError(ultimo_erro)
            lote_atual = max(1, (lote_atual or 8) // 2)
            print(f"faltou memória na placa; tentando lote {lote_atual}", flush=True)
            cfg = com_lote(f"{CACHE}/{inst}.yaml", inst, lote_atual)
        else:
            raise RuntimeError(ultimo_erro)

        # O MSST escreve em subpasta com o nome da música e batiza o arquivo com
        # o nome da faixa do config, que nem sempre é igual ao id do instrumento
        achados = []
        for raiz, _, arquivos in os.walk(saida):
            for a in arquivos:
                if a.endswith((".wav", ".flac")) and "instrumental" not in a.lower():
                    achados.append(os.path.join(raiz, a))
        if not achados:
            raise RuntimeError("o especialista não produziu saída")
        achados.sort(key=os.path.getsize, reverse=True)

        final = f"/tmp/{inst}.wav"
        shutil.copyfile(achados[0], final)
        return Path(final)
