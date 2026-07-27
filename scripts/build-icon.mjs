import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Resvg } from '@resvg/resvg-js'
import pngToIco from 'png-to-ico'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const svgPath = resolve(root, 'build/icon.svg')
const icoPath = resolve(root, 'build/icon.ico')
const pngPath = resolve(root, 'build/icon.png')

const svg = readFileSync(svgPath, 'utf8')

const SIZES = [16, 24, 32, 48, 64, 128, 256]

const pngBuffers = SIZES.map((size) => {
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: size } })
  return resvg.render().asPng()
})

const ico = await pngToIco(pngBuffers)
writeFileSync(icoPath, ico)

const big = new Resvg(svg, { fitTo: { mode: 'width', value: 512 } })
writeFileSync(pngPath, big.render().asPng())

console.log(`OK -> ${icoPath} (${SIZES.join(', ')})`)
console.log(`OK -> ${pngPath} (512)`)
