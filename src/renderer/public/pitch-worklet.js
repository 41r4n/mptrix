// Pitch shifter em tempo real (granular, dois taps com crossfade).
// Usado como prévia instantânea da mudança de tom; a versão de qualidade
// máxima (Rubber Band) é renderizada em segundo plano e substituída depois.
class MptrixPitchShift extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: 'ratio', defaultValue: 1, minValue: 0.5, maxValue: 2, automationRate: 'k-rate' }]
  }

  constructor() {
    super()
    this.grain = Math.round(sampleRate * 0.1)
    this.ringSize = 1 << Math.ceil(Math.log2(this.grain * 3))
    this.mask = this.ringSize - 1
    this.ring = [new Float32Array(this.ringSize), new Float32Array(this.ringSize)]
    this.w = 0
    this.t = 0
  }

  readTap(c, delay) {
    const pos = this.w - delay
    const i0 = Math.floor(pos)
    const frac = pos - i0
    const a = this.ring[c][i0 & this.mask]
    const b = this.ring[c][(i0 + 1) & this.mask]
    return a + (b - a) * frac
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0]
    const output = outputs[0]
    if (!input || input.length === 0 || !output || output.length === 0) return true

    const ratio = parameters.ratio[0]
    const G = this.grain
    const chs = Math.min(output.length, 2)
    const n = output[0].length
    const bypass = Math.abs(ratio - 1) < 0.001

    for (let i = 0; i < n; i++) {
      for (let c = 0; c < chs; c++) {
        const inCh = input[Math.min(c, input.length - 1)]
        this.ring[c][this.w] = inCh ? inCh[i] : 0
      }
      if (bypass) {
        for (let c = 0; c < chs; c++) output[c][i] = this.ring[c][this.w]
      } else {
        const fA = this.t / G
        const fB = (fA + 0.5) % 1
        const wA = Math.sin(Math.PI * fA) ** 2
        const wB = 1 - wA
        for (let c = 0; c < chs; c++) {
          output[c][i] = wA * this.readTap(c, fA * G) + wB * this.readTap(c, fB * G)
        }
        this.t += 1 - ratio
        if (this.t >= G) this.t -= G
        else if (this.t < 0) this.t += G
      }
      this.w = (this.w + 1) & this.mask
    }
    return true
  }
}

registerProcessor('mptrix-pitch-shift', MptrixPitchShift)
