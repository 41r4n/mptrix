# -*- coding: utf-8 -*-
# Croma do MPTrix na nuvem — a parte CARA do detector de acordes, e só ela.
#
# POR QUE SÓ ISSO: medi o detector local e ele leva 450s numa música de 4min20.
# Desses, 300s são UMA chamada — o LogSpectrum do essentia.js, a 431ms por
# quadro, porque a ponte JS/WASM reconstrói a tabela de mapeamento a cada
# quadro. Nativo, a mesma conta custa cerca de 1ms.
#
# Toda a INTELIGÊNCIA do detector (gabaritos de acorde, prior de tonalidade,
# Viterbi, votação entre repetições, inversão pelo baixo) fica onde está, em
# JavaScript, no computador do usuário. Ela é rápida e foi medida com cuidado:
# 53,7% na Azul, 50,3% no Vaso. Reescrever isso em Python seria arriscar esses
# números por nada — o gargalo nunca foi ela.
#
# Este arquivo devolve exatamente o que aquela etapa produzia: os quadros de
# croma (com tempo e energia) e as notas do baixo. Mesmos parâmetros, mesma
# ordem, mesma rotação de Lá para Dó.
import json
import subprocess
import tempfile

import numpy as np
from cog import BasePredictor, Input, Path

SR = 44100
NNLS_FRAME = 16384
NNLS_HOP = 16384          # sem sobreposição, igual ao local
BASS_FRAME = 4096
BASS_HOP = int(round(SR * 0.125))


class Predictor(BasePredictor):
    def setup(self):
        # Nada de carregar aqui: erro no setup mata o contêiner em laço e a
        # execução fica "starting" pra sempre, sem log. Lição cara.
        self._pronto = False

    def _carregar(self):
        if self._pronto:
            return
        import essentia.standard as es
        # Configurados UMA vez e reusados em todos os quadros — é exatamente
        # isso que a versão WASM não deixa fazer, e é daí que vem o 400x.
        self.janela = es.Windowing(type="hann", size=NNLS_FRAME, normalized=False)
        self.espectro = es.Spectrum(size=NNLS_FRAME)
        self.logspec = es.LogSpectrum(binsPerSemitone=3, frameSize=NNLS_FRAME,
                                      rollOn=0.01, sampleRate=SR)
        self.nnls = es.NNLSChroma(chromaNormalization="none", frameSize=NNLS_FRAME,
                                  sampleRate=SR, spectralShape=0.7, spectralWhitening=1.0,
                                  tuningMode="global", useNNLS=False)
        self.yin = es.PitchYin(frameSize=BASS_FRAME, interpolate=True, maxFrequency=400,
                               minFrequency=30, sampleRate=SR, tolerance=0.15)
        self.carregar_audio = es.MonoLoader
        self._pronto = True

    def _decodificar(self, caminho):
        """Decodifica com ffmpeg, exatamente como o app faz.

        O MonoLoader do essentia junta os canais e reamostra com o codigo dele;
        o app usa ffmpeg com -ac 1 -ar 44100. Sao caminhos diferentes pro mesmo
        audio, e diferenca no sinal vira diferenca na croma. Se e pra comparar
        com o local, tem que ENTRAR igual.
        """
        with tempfile.NamedTemporaryFile(suffix=".raw", delete=False) as f:
            bruto = f.name
        subprocess.run(
            ["ffmpeg", "-y", "-v", "error", "-i", caminho, "-vn",
             "-ac", "1", "-ar", str(SR), "-f", "f32le", bruto],
            check=True,
        )
        dados = np.fromfile(bruto, dtype=np.float32)
        import os
        os.unlink(bruto)
        return dados

    def predict(
        self,
        harmonia: Path = Input(description="Mistura das faixas harmônicas (sem voz/bateria)"),
        baixo: Path = Input(description="Faixa de baixo isolada", default=None),
    ) -> str:
        self._carregar()

        harm = self._decodificar(str(harmonia))
        n = max(0, (len(harm) - NNLS_FRAME) // NNLS_HOP)

        mat = []
        locais = []
        meanT = None
        rms_quadro = np.zeros(n, dtype=np.float64)
        for i in range(n):
            ini = i * NNLS_HOP
            quadro = harm[ini:ini + NNLS_FRAME]
            # o local soma 1 de cada 8 amostras; repito o mesmo pra o valor bater
            amostras = quadro[::8]
            rms_quadro[i] = float(np.sqrt(np.mean(amostras.astype(np.float64) ** 2)))
            # ORDEM DE SAIDA: (espectro, afinacaoMEDIA, afinacaoLOCAL). Inverti
            # isso na primeira tentativa e um vetor chegou onde ia um numero --
            # a media e vetor de 3 valores, a local e UM numero por quadro.
            log, tuning_medio, tuning_local = self.logspec(self.espectro(self.janela(quadro)))
            mat.append(log)
            locais.append(tuning_local)
            meanT = tuning_medio

        quadros = []
        if n > 0:
            # O NNLSChroma devolve QUATRO saidas, nesta ordem:
            #   tunedLogfreqSpectrum, semitoneSpectrum, bassChromagram, chromagram
            # A croma e a ULTIMA. Peguei a primeira na primeira tentativa e a
            # verificacao reprovou feio: nota mais forte batia em 1% dos quadros,
            # pior que chutar. No JavaScript isso nunca apareceu porque la o
            # acesso e por nome (nn.chromagram).
            saidas = self.nnls(np.array(mat, dtype=np.float32),
                               np.array(meanT, dtype=np.float32),
                               np.array(locais, dtype=np.float32))
            chromagrama = saidas[3] if isinstance(saidas, tuple) else saidas
            for i, c in enumerate(chromagrama):
                # a croma do NNLS começa em Lá (A); o app trabalha com Dó = 0
                chroma = [0.0] * 12
                soma = 0.0
                for k in range(12):
                    chroma[(k + 9) % 12] = float(c[k])
                    soma += float(c[k])
                quadros.append({
                    "t": round((i * NNLS_HOP) / SR, 4),
                    "chroma": [round(v, 6) for v in chroma] if soma > 1e-6 else None,
                    "rms": round(float(rms_quadro[i]) if i < n else 0.0, 6),
                })

        # O baixo isolado dá a NOTA tocada (não energia por classe): é o que
        # decide inversão e desempata gêmeo enarmônico
        notas_baixo = []
        if baixo is not None:
            bx = self._decodificar(str(baixo))
            nb = max(0, (len(bx) - BASS_FRAME) // BASS_HOP)
            for i in range(nb):
                ini = i * BASS_HOP
                bq = bx[ini:ini + BASS_FRAME]
                amostras = bq[::4]
                brms = float(np.sqrt(np.mean(amostras.astype(np.float64) ** 2)))
                if brms <= 0.004:
                    continue
                altura, confianca = self.yin(bq)
                if confianca > 0.75 and altura > 0:
                    pc = int(round(12 * np.log2(altura / 440.0)) + 69) % 12
                    notas_baixo.append({"t": round(ini / SR, 4), "pc": pc})

        return json.dumps({
            "frames": quadros,
            "bassPcs": notas_baixo,
            "sr": SR,
            "hop": NNLS_HOP,
            "versao": "croma-1",
        })
