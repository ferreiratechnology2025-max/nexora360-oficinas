import sharp from 'sharp';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '../public');

async function generateIcon(size) {
  const radius = Math.round(size * 0.22);
  const circleR = Math.round(size * 0.33);
  const cx = size / 2;
  const cy = Math.round(size * 0.46);
  const letterSize = Math.round(size * 0.38);
  const letterY = cy + Math.round(letterSize * 0.36);
  const small = Math.round(size * 0.155);
  const smallY = Math.round(size * 0.82);

  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#1e3a5f"/>
  <!-- White circle -->
  <circle cx="${cx}" cy="${cy}" r="${circleR}" fill="white"/>
  <!-- N letter in blue -->
  <text
    x="${cx}" y="${letterY}"
    font-family="Arial Black, Arial, Helvetica, sans-serif"
    font-size="${letterSize}"
    font-weight="900"
    fill="#1e3a5f"
    text-anchor="middle"
  >N</text>
  <!-- 360 label -->
  <text
    x="${cx}" y="${smallY}"
    font-family="Arial, Helvetica, sans-serif"
    font-size="${small}"
    font-weight="bold"
    fill="rgba(255,255,255,0.9)"
    text-anchor="middle"
    dominant-baseline="middle"
  >360</text>
</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

const configs = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
];

for (const { file, size } of configs) {
  const buf = await generateIcon(size);
  await sharp(buf).toFile(resolve(outDir, file));
  console.log(`Generated ${file} (${size}x${size})`);
}
