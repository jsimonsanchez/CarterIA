import fs from 'node:fs'
import zlib from 'node:zlib'

const file = process.argv[2]
const buf = fs.readFileSync(file)

const width = buf.readUInt32BE(16)
const height = buf.readUInt32BE(20)
const colorType = buf[25]
if (colorType !== 6) throw new Error('esperaba RGBA (colorType 6), encontrado ' + colorType)

// Recolecta todos los chunks IDAT (pueden venir partidos en varios).
let offset = 8
const idatParts = []
while (offset < buf.length) {
  const len = buf.readUInt32BE(offset)
  const type = buf.toString('ascii', offset + 4, offset + 8)
  const data = buf.subarray(offset + 8, offset + 8 + len)
  if (type === 'IDAT') idatParts.push(data)
  offset += 8 + len + 4
  if (type === 'IEND') break
}

const raw = zlib.inflateSync(Buffer.concat(idatParts))
const bpp = 4 // RGBA 8-bit
const rowBytes = width * bpp
const pixels = Buffer.alloc(height * rowBytes)

function paeth(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  if (pb <= pc) return b
  return c
}

let rawPos = 0
for (let y = 0; y < height; y++) {
  const filterType = raw[rawPos++]
  const rowStart = y * rowBytes
  const prevRowStart = (y - 1) * rowBytes
  for (let x = 0; x < rowBytes; x++) {
    const val = raw[rawPos++]
    const a = x >= bpp ? pixels[rowStart + x - bpp] : 0
    const b = y > 0 ? pixels[prevRowStart + x] : 0
    const c = y > 0 && x >= bpp ? pixels[prevRowStart + x - bpp] : 0
    let out
    switch (filterType) {
      case 0: out = val; break
      case 1: out = (val + a) & 0xff; break
      case 2: out = (val + b) & 0xff; break
      case 3: out = (val + Math.floor((a + b) / 2)) & 0xff; break
      case 4: out = (val + paeth(a, b, c)) & 0xff; break
      default: throw new Error('filtro desconocido ' + filterType)
    }
    pixels[rowStart + x] = out
  }
}

function alphaAt(x, y) {
  return pixels[y * rowBytes + x * bpp + 3]
}

console.log(`${width}x${height}`)
console.log('esquina (0,0) alpha:', alphaAt(0, 0))
console.log('esquina (', width - 1, ',0) alpha:', alphaAt(width - 1, 0))
console.log('centro alpha:', alphaAt(Math.floor(width / 2), Math.floor(height / 2)))
