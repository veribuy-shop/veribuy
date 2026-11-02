// Renders the app's icon, splash and logo PNGs from the SVGs in assets/brand.
// Run from anywhere: node mobile/scripts/render-brand.mjs
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const mobile = join(dirname(fileURLToPath(import.meta.url)), '..');

// Mobile has no use for sharp at runtime; borrow the copy Next.js brings to the frontend.
const fromFrontend = createRequire(join(mobile, '../frontend/package.json'));
const sharp = createRequire(fromFrontend.resolve('next/package.json'))('sharp');

const brand = (name) => readFileSync(join(mobile, 'assets/brand', name));
const output = (name) => join(mobile, 'assets/images', name);
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
const CLEAR = { r: 255, g: 255, b: 255, alpha: 0 };

/** The mark centred on a square canvas, `size` wide with `markWidth` for the mark. */
async function markOnSquare(file, size, markWidth, background) {
  const mark = await sharp(brand('veribuy-mark.svg'), { density: 600 }).resize({ width: markWidth }).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: mark, gravity: 'centre' }])
    .png()
    .toFile(output(file));
}

// iOS rounds the corners itself and rejects transparency, so the icon is opaque.
await markOnSquare('icon.png', 1024, 720, WHITE);
// Android crops adaptive icons to the middle 66%, so the mark stays inside that.
await markOnSquare('adaptive-icon.png', 1024, 580, CLEAR);
await markOnSquare('favicon.png', 48, 40, WHITE);

for (const [file, width] of [
  ['splash-icon.png', 1000],
  ['veribuy-logo.png', 800],
]) {
  await sharp(brand('veribuy-logo.svg'), { density: 600 }).resize({ width }).png().toFile(output(file));
}
