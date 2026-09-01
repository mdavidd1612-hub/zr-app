import sharp from 'sharp'

const AZUL = { r: 0x38, g: 0x69, b: 0xB1, alpha: 1 }
const SRC = 'public/logo-zr-mecademy.png'

// El logo es un lockup horizontal. El icono de la app es solo la insignia
// cuadrada de la izquierda (las letras ZR), que es lo único legible a 48 px.
const insignia = await sharp(SRC)
  .extract({ left: 0, top: 4, width: 347, height: 246 })
  .flatten({ background: AZUL })
  .png()
  .toBuffer()

// Recorte ajustado a las letras blancas, para poder escalarlas con precisión.
const { data, info } = await sharp(insignia).raw().toBuffer({ resolveWithObject: true })
let x0 = info.width, x1 = 0, y0 = info.height, y1 = 0
for (let y = 0; y < info.height; y++) {
  for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * info.channels
    if (data[i] > 200 && data[i + 1] > 200 && data[i + 2] > 200) {
      if (x < x0) x0 = x; if (x > x1) x1 = x
      if (y < y0) y0 = y; if (y > y1) y1 = y
    }
  }
}
const letras = await sharp(insignia)
  .extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 })
  .png().toBuffer()

const lienzo = (n) => sharp({
  create: { width: n, height: n, channels: 4, background: AZUL },
})

// `ratio` = cuánto del lado ocupan las letras. 0.62 en los normales;
// 0.42 en los maskable, porque Android recorta hasta un 20% por lado.
async function icono(n, ratio, salida) {
  const ancho = Math.round(n * ratio)
  const glifo = await sharp(letras).resize({ width: ancho }).toBuffer()
  const meta = await sharp(glifo).metadata()
  await lienzo(n)
    .composite([{
      input: glifo,
      left: Math.round((n - ancho) / 2),
      top: Math.round((n - meta.height) / 2),
    }])
    .png()
    .toFile(salida)
  console.log('✓', salida)
}

await icono(96, 0.62, 'public/icon-96.png')
await icono(180, 0.62, 'public/apple-touch-icon.png')
await icono(192, 0.62, 'public/icon-192.png')
await icono(512, 0.62, 'public/icon-512.png')
await icono(192, 0.42, 'public/icon-maskable-192.png')
await icono(512, 0.42, 'public/icon-maskable-512.png')
