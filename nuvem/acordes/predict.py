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
import yaml
from cog import BasePredictor, Input, Path

sys.path.insert(0, "/btc")

# O BTC é de 2019 e chama yaml.load(f) sem Loader. O PyYAML 6 passou a exigir
# o Loader (yaml.load sem ele executava objeto arbitrário do arquivo). Em vez de
# editar o repositório do modelo — que eu quero manter fiel ao original — devolvo
# o padrão antigo aqui, com FullLoader, que é a versão segura do comportamento.
_load_original = yaml.load
yaml.load = lambda fluxo, Loader=yaml.FullLoader, **kw: _load_original(fluxo, Loader=Loader, **kw)


class Predictor(BasePredictor):
    def setup(self):
        """NÃO carrega nada aqui de propósito.

        Se o carregamento estoura no setup, o contêiner morre e reinicia num
        laço: a execução fica "starting" pra sempre, SEM LOG NENHUM, e não há
        como saber o motivo. Foi exatamente o que aconteceu — três tentativas
        travadas e nenhuma pista.

        Carregando sob demanda, qualquer erro vira erro DA PREDIÇÃO, com a
        mensagem e o traceback visíveis. Falha barulhenta vale mais que falha
        silenciosa.
        """
        self._pronto = False

    def _carregar(self):
        if self._pronto:
            return
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
        self._pronto = True

    def _inferir(self, feature, time_unit):
        """O laço do test.py original, isolado pra eu poder rodar duas normalizações."""
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
        return cru

    def predict(
        self,
        audio: Path = Input(description="Arquivo de áudio da música"),
        min_dur: float = Input(
            description="Acorde mais curto que isso é ruído e some (segundos)",
            default=0.35, ge=0.0, le=3.0,
        ),
    ) -> str:
        self._carregar()
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

        bruto = feature.T
        time_unit = feature_per_second

        # A normalização do checkpoint pressupõe o CQT que a librosa de 2019
        # produzia. Na de hoje a feature sai com média -6,1 e desvio 3,1 onde o
        # treino tinha -2,2 e 1,7 — o modelo recebe um mundo que não conhece e
        # responde "sem acorde" na música inteira. Rodo as duas e fico com a que
        # de fato reconhece harmonia, em vez de decidir no chute.
        tentativas = {
            "checkpoint": (bruto - self.mean) / self.std,
            "propria": (bruto - bruto.mean()) / (bruto.std() + 1e-9) * self.std + self.mean,
        }
        colhido = {}
        for nome, feat_norm in tentativas.items():
            colhido[nome] = self._inferir(feat_norm, time_unit)

        # cobertura = quanto da música saiu com acorde de verdade (nem N nem X)
        def cobre(lista):
            return sum(f - i for i, f, r in lista if r not in ("N", "X"))

        normalizacao = max(colhido, key=lambda k: cobre(colhido[k]))
        cru = colhido[normalizacao]
        feature = tentativas[normalizacao]

        # Quanto cada rótulo cru ocupou, e como ficaram as features depois de
        # normalizadas. Se o modelo devolve "N" na música inteira, a causa quase
        # sempre é feature fora da distribuição de treino — e aí eu preciso ver
        # a média e o desvio de verdade, não adivinhar de longe.
        conta = {}
        for ini, fim, rot in cru:
            conta[rot] = conta.get(rot, 0.0) + (fim - ini)
        top = sorted(conta.items(), key=lambda kv: -kv[1])[:8]

        return json.dumps({
            "chords": arrumar(cru, min_dur),
            "duration": round(song_length_second, 2),
            "modelo": "btc-large-voca",
            "diagnostico": {
                "normalizacao": normalizacao,
                "cobertura": {k: round(cobre(v), 1) for k, v in colhido.items()},
                "rotulos_crus": [[r, round(s, 1)] for r, s in top],
                "trechos_crus": len(cru),
                "feat_media": round(float(feature.mean()), 3),
                "feat_desvio": round(float(feature.std()), 3),
                "feat_min": round(float(feature.min()), 2),
                "feat_max": round(float(feature.max()), 2),
                "norm_media": round(float(np.mean(self.mean)), 3),
                "norm_desvio": round(float(np.mean(self.std)), 3),
                "quadros": int(feature.shape[0]),
                "seg_por_quadro": round(float(time_unit), 4),
                "librosa": __import__("librosa").__version__,
            },
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
