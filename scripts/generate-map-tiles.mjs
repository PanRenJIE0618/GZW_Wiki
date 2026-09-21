/**
 * Generate a Leaflet-compatible raster tile pyramid (CRS.Simple + unproject).
 *
 * Usage:
 *   npm run map:tiles -- <input-image> [out-dir]
 *
 * Example:
 *   npm run map:tiles -- ./world.png ./public/map-tiles
 */

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const TILE = 256;
const input = process.argv[2];
const outDir = path.resolve(process.argv[3] || "./public/map-tiles");

if (!input) {
  console.error("Usage: npm run map:tiles -- <input-image> [out-dir]");
  process.exit(1);
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function main() {
  const absInput = path.resolve(input);
  const meta = await sharp(absInput).metadata();
  const width = meta.width || 0;
  const height = meta.height || 0;
  if (!width || !height) throw new Error("Cannot read image size");

  const maxZoom = Math.max(
    0,
    Math.ceil(Math.log2(Math.max(width, height) / TILE)),
  );

  console.log(`Source: ${width}x${height}`);
  console.log(`maxZoom: ${maxZoom}`);
  console.log(`Output: ${outDir}`);

  await ensureDir(outDir);

  for (let z = 0; z <= maxZoom; z++) {
    const scale = 2 ** (maxZoom - z);
    const scaledW = Math.max(1, Math.ceil(width / scale));
    const scaledH = Math.max(1, Math.ceil(height / scale));
    const cols = Math.ceil(scaledW / TILE);
    const rows = Math.ceil(scaledH / TILE);

    console.log(`z=${z} → ${scaledW}x${scaledH} (${cols}x${rows} tiles)`);

    const zoomImagePath = path.join(outDir, `_z${z}.webp`);
    await sharp(absInput)
      .resize(scaledW, scaledH, { fit: "fill", kernel: "lanczos3" })
      .webp({ quality: 82 })
      .toFile(zoomImagePath);

    for (let x = 0; x < cols; x++) {
      for (let y = 0; y < rows; y++) {
        const left = x * TILE;
        const top = y * TILE;
        const tw = Math.min(TILE, scaledW - left);
        const th = Math.min(TILE, scaledH - top);
        const tileDir = path.join(outDir, String(z), String(x));
        await ensureDir(tileDir);

        await sharp(zoomImagePath)
          .extract({ left, top, width: tw, height: th })
          .extend({
            top: 0,
            left: 0,
            right: TILE - tw,
            bottom: TILE - th,
            background: { r: 5, g: 8, b: 6, alpha: 1 },
          })
          .webp({ quality: 82 })
          .toFile(path.join(tileDir, `${y}.webp`));
      }
    }

    await fs.unlink(zoomImagePath).catch(() => {});
  }

  console.log("\nDone. Fill /map/setup with:");
  console.log(`  tile_url_template: /map-tiles/{z}/{x}/{y}.webp`);
  console.log(`  image_width: ${width}`);
  console.log(`  image_height: ${height}`);
  console.log(`  tile_min_zoom: 0`);
  console.log(`  tile_max_zoom: ${maxZoom}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
