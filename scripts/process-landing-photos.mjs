// Procesa las fotos crudas de Arias (3-5MB, algunas rotadas) y las deja
// optimizadas para web en src/assets/landing/photos/.
// Uso: node scripts/process-landing-photos.mjs
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const SRC = 'C:/Arias/brand-assets/fotos-arias';
const OUT = 'C:/Arias/frontend/src/assets/landing/photos';

// origen → nombre de salida semántico
const MAP = [
  ['tira-de-asado.jpg', 'tira-de-asado'],
  ['20250228_144641.jpg', 'plato-huevo'],
  ['20250305_145307.jpg', 'plato-napolitana'],
  ['20250307_125849.jpg', 'plato-ensalada-pollo'],
  ['AISelect_20250307_162746_IntentResolver.jpg', 'collage-platos'],
  ['20250306_132028.jpg', 'interior-lamparas'],
  ['20250313_132144.jpg', 'fachada'],
  ['20250313_141359.jpg', 'salon'],
  ['20250314_132608.jpg', 'ventana-salon'],
  ['20250321_142058(0).jpg', 'interior-vinos'],
];

// Fotos que se muestran en recuadros chicos de la galería "Un vistazo".
// Generamos un "tile" cuadrado recortado al tamaño real de display: así el
// navegador casi no reescala y evitamos el moiré del mantel cuadrillé.
//
// fx/fy: posición del recorte cuadrado dentro del margen disponible
//   (0 = izquierda/arriba, 0.5 = centro, 1 = derecha/abajo).
// Aprovechamos el mantel que sobra para reencuadrar el plato sin cortarlo.
const GALLERY_TILES = [
  { name: 'collage-platos', fx: 0.5, fy: 0.5 },
  { name: 'plato-huevo', fx: 0.32, fy: 0.5 }, // mostrar más a la izquierda → el plato queda más a la derecha
  { name: 'plato-napolitana', fx: 0.5, fy: 0.7 }, // mostrar más abajo → el plato sube
  { name: 'plato-ensalada-pollo', fx: 0.5, fy: 0.7 },
];
const TILE_PX = 800; // ~2x del recuadro mostrado → nítido en retina, sin moiré

// Mapa inverso para encontrar el archivo origen a partir del nombre semántico
const BY_NAME = Object.fromEntries(MAP.map(([from, to]) => [to, from]));

await mkdir(OUT, { recursive: true });

for (const [from, to] of MAP) {
  const input = path.join(SRC, from);
  const output = path.join(OUT, `${to}.jpg`);
  const info = await sharp(input)
    .rotate() // auto-orienta según EXIF (endereza las que están de costado)
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .toFile(output);
  console.log(`${to}.jpg  ->  ${info.width}x${info.height}  ${(info.size / 1024).toFixed(0)}KB`);
}

for (const { name, fx, fy } of GALLERY_TILES) {
  const input = path.join(SRC, BY_NAME[name]);
  const output = path.join(OUT, `${name}-tile.jpg`);
  // Enderezamos primero a un buffer para tener las dimensiones REALES (ya orientadas).
  const { data, info: ri } = await sharp(input)
    .rotate()
    .toBuffer({ resolveWithObject: true });
  const S = Math.min(ri.width, ri.height); // lado del recorte cuadrado
  const left = Math.round(fx * (ri.width - S));
  const top = Math.round(fy * (ri.height - S));
  const info = await sharp(data)
    .extract({ left, top, width: S, height: S }) // recorte cuadrado reencuadrado
    .resize(TILE_PX, TILE_PX)
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(output);
  console.log(`${name}-tile.jpg  ->  ${info.width}x${info.height}  ${(info.size / 1024).toFixed(0)}KB  (fx=${fx} fy=${fy})`);
}

// Tiles apaisados: fotos que se muestran en banda horizontal (mismo problema
// de moiré del cuadrillé, pero con relación de aspecto landscape).
const LANDSCAPE_TILES = [{ name: 'tira-de-asado', w: 1200, h: 720 }];
for (const { name, w, h } of LANDSCAPE_TILES) {
  const input = path.join(SRC, BY_NAME[name]);
  const output = path.join(OUT, `${name}-tile.jpg`);
  const info = await sharp(input)
    .rotate()
    .resize(w, h, { fit: 'cover', position: 'center' })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(output);
  console.log(`${name}-tile.jpg  ->  ${info.width}x${info.height}  ${(info.size / 1024).toFixed(0)}KB`);
}

console.log('\nListo.');
