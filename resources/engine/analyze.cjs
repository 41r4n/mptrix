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

  const bpm = Math.round(rhythmRes.bpm * 10) / 10
  console.log(JSON.stringify({
    key: keyRes.key,
    scale: keyRes.scale,
    strength: Math.round(keyRes.strength * 100) / 100,
    bpm,
    bpmHalf: bpm > 130 ? Math.round((bpm / 2) * 10) / 10 : null,
    confidence: Math.round(rhythmRes.confidence * 100) / 100
  }))
} finally {
  try { fs.unlinkSync(tmpPcm) } catch {}
}
