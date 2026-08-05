// Cancelador de vazamento entre faixas separadas.
//
// O PROBLEMA: o separador de voz reivindica junto o que soa parecido com voz.
// Medido na Samurai: a gaita aparece DENTRO de vocals.flac com correlação de
// até 0,99 — nos trechos de solo, a "voz" é literalmente a gaita. Isso não é
// bug de tocador nem de mixagem: está gravado no arquivo.
//
// O CONSERTO: pra cada janela de tempo, o ganho ótimo por mínimos quadrados
//   α = <alvo, vazador> / <vazador, vazador>
// diz exatamente QUANTO do vazador está dentro do alvo. Subtrai-se só essa
// fração. Onde não há vazamento, α ≈ 0 e o alvo passa intocado — por isso é
// seguro rodar sempre: o cancelador só age onde a medição manda.
//
// α é suavizado entre janelas (rampa linear) pra não estalar na emenda.
//
// Uso: limpa_vazamento.cjs <ffmpeg> <alvo> <saida> <vazador1> [vazador2 ...]
'use strict'
const { spawnSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const [ffmpeg, alvoPath, saidaPath, ...vazadores] = process.argv.slice(2)
if (!ffmpeg || !alvoPath || !saidaPath || !vazadores.length) {
  console.error('uso: limpa_vazamento.cjs <ffmpeg> <alvo> <saida> <vazador...>')
  process.exit(1)
}

const SR = 44100
const JANELA = 4096 // ~93ms: curto o bastante pra seguir a música, longo pro α ser estável

function decodificar(arq, tag) {
  const tmp = path.join(os.tmpdir(), `mptrix-limpa-${process.pid}-${tag}.pcm`)
  const r = spawnSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', arq, '-ac', '2', '-ar', String(SR), '-f', 'f32le', tmp], { windowsHide: true })
  if (r.status !== 0) throw new Error(`falha ao decodificar ${arq}`)
  const buf = fs.readFileSync(tmp)
  fs.unlinkSync(tmp)
  return new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4)
}

const alvo = decodificar(alvoPath, 'alvo')
let removidoTotal = 0

for (let vi = 0; vi < vazadores.length; vi++) {
  const vaz = decodificar(vazadores[vi], `v${vi}`)
  const n = Math.min(alvo.length, vaz.length)
  // por canal (amostras intercaladas L R L R): o vazamento pode ser assimétrico
  for (let canal = 0; canal < 2; canal++) {
    let alphaAnt = 0
    for (let ini = canal; ini < n; ini += JANELA * 2) {
      const fim = Math.min(n, ini + JANELA * 2)
      let vv = 0
      let av = 0
      for (let i = ini; i < fim; i += 2) { vv += vaz[i] * vaz[i]; av += alvo[i] * vaz[i] }
      // ganho ótimo, preso em [0, 1.2]: negativo não é vazamento, e acima de
      // 1.2 é o vazador mais alto DENTRO do alvo do que na própria faixa —
      // sinal de coincidência espectral, não de vazamento real
      let alpha = vv > 1e-9 ? av / vv : 0
      alpha = Math.max(0, Math.min(1.2, alpha))
      // correlação fraca = provavelmente música parecida, não o mesmo sinal;
      // não mexe (α abaixo de 0.1 não paga o risco)
      if (alpha < 0.1) alpha = 0
      const meio = ini + Math.floor((fim - ini) / 4) * 2 + canal - ini
      let k = 0
      const total = (fim - ini) / 2
      for (let i = ini; i < fim; i += 2, k++) {
        // rampa: metade inicial interpola do α anterior pro atual
        const t = Math.min(1, (2 * k) / total)
        const a = alphaAnt + (alpha - alphaAnt) * t
        const antes = alvo[i]
        alvo[i] = antes - a * vaz[i]
        removidoTotal += Math.abs(a * vaz[i])
      }
      alphaAnt = alpha
    }
  }
}

// devolve pro ffmpeg codificar
const tmpOut = path.join(os.tmpdir(), `mptrix-limpa-${process.pid}-out.pcm`)
fs.writeFileSync(tmpOut, Buffer.from(alvo.buffer, alvo.byteOffset, alvo.length * 4))
const enc = spawnSync(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'f32le', '-ac', '2', '-ar', String(SR), '-i', tmpOut, '-compression_level', '5', saidaPath], { windowsHide: true })
fs.unlinkSync(tmpOut)
if (enc.status !== 0) { console.error('falha ao codificar a saída'); process.exit(1) }
console.log(JSON.stringify({ ok: true, energiaRemovida: Math.round(removidoTotal) }))
