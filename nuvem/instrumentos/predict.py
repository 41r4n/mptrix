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
        if r.returncode != 0:
            raise RuntimeError((r.stderr or r.stdout or "")[-2000:])

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
