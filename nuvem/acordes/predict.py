# Detector de acordes do MPTrix na nuvem — BTC (ISMIR 2019), vocabulário grande.
#
# Devolve a cifra em JSON, no MESMO formato que o detector local já produz
# ({t, end, label}), pra que o app não precise saber de onde veio. Isso importa:
# quem não tiver chave continua usando o detector local sem nenhuma diferença
# no resto do programa.
#
# O laço de inferência abaixo é o do test.py do repositório original, mantido
# fiel de propósito — mexer nele seria inventar em cima de um modelo treinado.
import json
import os
import subprocess
import sys
import tempfile

import numpy as np
import torch
from cog import BasePredictor, Input, Path

sys.path.insert(0, "/btc")


class Predictor(BasePredictor):
    def setup(self):
        """Carrega o modelo uma vez, quando o contêiner sobe."""
        from btc_model import BTC_model
        from utils.hparams import HParams
        from utils.mir_eval_modules import idx2voca_chord

        os.chdir("/btc")
        self.config = HParams.load("run_config.yaml")
        self.config.feature["large_voca"] = True
        self.config.model["num_chords"] = 170
        self.idx_to_chord = idx2voca_chord()

        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = BTC_model(config=self.config.model).to(self.device)
        ckpt = torch.load("/btc/test/btc_model_large_voca.pt", map_location=self.device)
        self.mean = ckpt["mean"]
        self.std = ckpt["std"]
        self.model.load_state_dict(ckpt["model"])
        self.model.eval()

    def predict(
        self,
        audio: Path = Input(description="Arquivo de áudio da música"),
        min_dur: float = Input(
            description="Acorde mais curto que isso é ruído e some (segundos)",
            default=0.35, ge=0.0, le=3.0,
        ),
    ) -> str:
        from utils.mir_eval_modules import audio_file_to_features

        # o BTC espera algo que o librosa leia bem; flac/mp3/m4a viram wav antes
        with tempfile.TemporaryDirectory() as tmp:
            wav = os.path.join(tmp, "entrada.wav")
            subprocess.run(
                ["ffmpeg", "-y", "-v", "error", "-i", str(audio),
                 "-ac", "1", "-ar", "22050", wav],
                check=True,
            )
            feature, feature_per_second, song_length_second = audio_file_to_features(wav, self.config)

        feature = feature.T
        feature = (feature - self.mean) / self.std
        time_unit = feature_per_second
        n_timestep = self.config.model["timestep"]

        num_pad = n_timestep - (feature.shape[0] % n_timestep)
        feature = np.pad(feature, ((0, num_pad), (0, 0)), mode="constant", constant_values=0)
        num_instance = feature.shape[0] // n_timestep

        start_time = 0.0
        prev_chord = None
        cru = []
        with torch.no_grad():
            feat = torch.tensor(feature, dtype=torch.float32).unsqueeze(0).to(self.device)
            for t in range(num_instance):
                saida, _ = self.model.self_attn_layers(feat[:, n_timestep * t:n_timestep * (t + 1), :])
                pred, _ = self.model.output_layer(saida)
                pred = pred.squeeze()
                for i in range(n_timestep):
                    if t == 0 and i == 0:
                        prev_chord = pred[i].item()
                        continue
                    agora = time_unit * (n_timestep * t + i)
                    if pred[i].item() != prev_chord:
                        cru.append((start_time, agora, self.idx_to_chord[prev_chord]))
                        start_time = agora
                        prev_chord = pred[i].item()
                    if t == num_instance - 1 and i + num_pad == n_timestep:
                        if start_time != agora:
                            cru.append((start_time, agora, self.idx_to_chord[prev_chord]))
                        break

        return json.dumps({
            "chords": arrumar(cru, min_dur),
            "duration": round(song_length_second, 2),
            "modelo": "btc-large-voca",
        })


# "C:min7" (jeito do mir_eval) -> "Cm7" (jeito de quem lê cifra).
# O MPTrix mostra cifra pra músico, não anotação de artigo.
SUFIXO = {
    "maj": "", "min": "m", "dim": "°", "aug": "+",
    "maj7": "7M", "min7": "m7", "7": "7", "dim7": "°7", "hdim7": "m7(b5)",
    "minmaj7": "m(7M)", "maj6": "6", "min6": "m6",
    "sus2": "sus2", "sus4": "sus4", "9": "9", "maj9": "7M(9)", "min9": "m9",
}


def cifrar(rot):
    if not rot or rot in ("N", "X"):
        return None
    raiz, _, qual = rot.partition(":")
    raiz = raiz.replace("b", "b")
    if not qual:
        return raiz
    base, _, inv = qual.partition("/")
    suf = SUFIXO.get(base, base)
    return f"{raiz}{suf}" + (f"/{inv}" if inv and not inv.isdigit() else "")


def arrumar(cru, min_dur):
    """Tira silêncio, junta acorde repetido e descarta lampejo curto demais."""
    out = []
    for ini, fim, rot in cru:
        nome = cifrar(rot)
        if nome is None:
            continue
        if out and out[-1]["label"] == nome and ini - out[-1]["end"] < 0.05:
            out[-1]["end"] = round(fim, 2)
            continue
        out.append({"t": round(ini, 2), "end": round(fim, 2), "label": nome})
    return [c for c in out if c["end"] - c["t"] >= min_dur]
