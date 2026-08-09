// Detecta tom e BPM de um arquivo de áudio. Roda como processo Node separado
// (ELECTRON_RUN_AS_NODE) pra não travar a interface do app.
// Uso: analyze.cjs <ffmpegPath> <inputFile>
// Saída: uma linha JSON no stdout.
'use strict'

const { spawnSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const ffmpegPath = process.argv[2]
const inputFile = process.argv[3]

if (!ffmpegPath || !inputFile || !fs.existsSync(inputFile)) {
  console.error('uso: analyze.cjs <ffmpeg> <arquivo>')
  process.exit(1)
}

const tmpPcm = path.join(os.tmpdir(), `mptrix-analyze-${process.pid}.pcm`)

try {
  const dec = spawnSync(ffmpegPath, ['-y', '-loglevel', 'error', '-i', inputFile, '-vn', '-ac', '1', '-ar', '44100', '-f', 'f32le', tmpPcm], {
    windowsHide: true
  })
  if (dec.status !== 0) {
    console.error('ffmpeg falhou ao decodificar')
    process.exit(2)
  }

  const buf = fs.readFileSync(tmpPcm)
  const audio = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4)

  const EssentiaWASM = require('./essentia-wasm.umd.js')
  const Essentia = require('./essentia.js-core.umd.js')
  const essentia = new Essentia(EssentiaWASM)

  const vec = essentia.arrayToVector(audio)
  const keyRes = essentia.KeyExtractor(vec)
  const rhythmRes = essentia.RhythmExtractor2013(vec, 208, 'multifeature', 40)
  vec.delete()

  // AS BATIDAS, uma a uma, em segundos. O extrator sempre calculou isto e a
  // gente jogava fora, guardando só a média (o BPM). A diferença importa pro
  // metrônomo: com o BPM sozinho o clique anda num grid perfeito e a música
  // real não é perfeita — banda humana acelera no refrão, atrasa na virada, e
  // em meio minuto o clique já está fora. Com as batidas medidas, ele acompanha.
  let ticks = []
  try {
    const t = rhythmRes.ticks
    const arr = essentia.vectorToArray ? essentia.vectorToArray(t) : null
    if (arr) {
      // 3 casas = milissegundo. Mais que isso é ruído e engorda o registro à toa.
      const bruto = Array.from(arr, (v) => Math.round(v * 1000) / 1000)
      // LIMPEZA DE BATIDA DOBRADA. Medido na Oceano: 93% dos intervalos caem
      // dentro de 3% da mediana, mas ~4% vêm curtos demais — é o detector
      // marcando duas vezes a mesma batida (contratempo forte, virada de
      // bateria). Num gráfico isso não faz diferença; num METRÔNOMO vira
      // clique fantasma, e clique fantasma atrapalha exatamente quem está ali
      // pra acertar o tempo. Quem chega antes de 60% do compasso não é batida
      // nova, é eco da anterior — e o corte é relativo à MEDIANA, não ao BPM
      // médio, pra música que muda de andamento no meio não ser massacrada.
      const difs = []
      for (let i = 1; i < bruto.length; i++) difs.push(bruto[i] - bruto[i - 1])
      if (difs.length > 8) {
        const ord = [...difs].sort((a, b) => a - b)
        const mediana = ord[Math.floor(ord.length / 2)]
        const minimo = mediana * 0.6
        ticks = []
        for (const x of bruto) {
          if (!ticks.length || x - ticks[ticks.length - 1] >= minimo) ticks.push(x)
        }
      } else {
        ticks = bruto
      }
    }
    try { t.delete() } catch { /* alguns builds já liberam sozinho */ }
  } catch { ticks = [] } // sem batidas, o metrônomo cai no grid do BPM

  // A GRADE FIRME: período e fase de um pulso constante que cai em cima das
  // batidas de verdade. Serve o metrônomo de quem quer ACERTAR o tempo — clique
  // que segue a banda não treina ninguém, acompanha.
  //
  // A fase não pode vir da primeira batida: medido na Oceano, a introdução é
  // rala e o detector patina lá (corridas de 0,58 / 0,63 / 0,45s), enquanto 93%
  // da música fica firme em 0,650s. Ancorar na primeira batida jogaria a grade
  // inteira fora por causa dos 10s mais frágeis. Então a fase é a MÉDIA
  // CIRCULAR das batidas boas (as que respeitam a mediana): cada batida vota em
  // onde o pulso cai dentro do compasso, e a maioria confiável decide.
  let grade = null
  if (ticks.length > 12) {
    const difs = []
    for (let i = 1; i < ticks.length; i++) difs.push(ticks[i] - ticks[i - 1])
    const ord = [...difs].sort((a, b) => a - b)
    const periodo = ord[Math.floor(ord.length / 2)]
    if (periodo > 0.15 && periodo < 2) {
      // só vota quem está perto do pulso dominante (dos dois lados)
      const bons = ticks.filter((t, i) => {
        const a = i > 0 ? Math.abs(difs[i - 1] - periodo) / periodo : 9
        const b = i < difs.length ? Math.abs(difs[i] - periodo) / periodo : 9
        return Math.min(a, b) <= 0.05
      })
      if (bons.length > 8) {
        // média circular: soma os ângulos de (t mod período) e tira o ângulo médio
        let sx = 0
        let sy = 0
        for (const t of bons) {
          const ang = ((t % periodo) / periodo) * 2 * Math.PI
          sx += Math.cos(ang)
          sy += Math.sin(ang)
        }
        let fase = (Math.atan2(sy, sx) / (2 * Math.PI)) * periodo
        while (fase < 0) fase += periodo
        // erro médio da grade contra as batidas boas — é o que diz se dá pra
        // confiar. Acima de ~15% do período, a grade não descreve esta música.
        let erro = 0
        for (const t of bons) {
          const d = Math.abs(((t - fase) % periodo + periodo) % periodo)
          erro += Math.min(d, periodo - d)
        }
        erro /= bons.length
        // SÓ VALE SE ENCAIXAR. Medido nas três músicas do acervo do dono:
        //   Girlfriend (NSYNC, tudo programado) .... 34 ms de 638  = 5%   encaixa
        //   Oceano (Djavan, banda tocando) ......... 153 ms de 650 = 24%  não
        //   Samurai (Djavan, banda tocando) ........ 171 ms de 697 = 25%  não
        // Banda humana anda de andamento, e nenhum pulso constante descreve
        // isso. Publicar uma grade ruim seria pior que não ter: o metrônomo
        // começaria junto e estaria meio compasso fora no meio da música, sem
        // ninguém entender por quê. Fora do corte, `grade` fica null e a tela
        // diz a verdade — esta música não tem tempo de máquina.
        if (erro <= periodo * 0.08) {
          grade = {
            periodo: Math.round(periodo * 10000) / 10000,
            fase: Math.round(fase * 10000) / 10000,
            erroMs: Math.round(erro * 1000),
            apoio: bons.length
          }
        }
      }
    }
  }

  const bpm = Math.round(rhythmRes.bpm * 10) / 10
  console.log(JSON.stringify({
    key: keyRes.key,
    scale: keyRes.scale,
    strength: Math.round(keyRes.strength * 100) / 100,
    bpm,
    bpmHalf: bpm > 130 ? Math.round((bpm / 2) * 10) / 10 : null,
    confidence: Math.round(rhythmRes.confidence * 100) / 100,
    ticks,
    grade
  }))
} finally {
  try { fs.unlinkSync(tmpPcm) } catch {}
}
