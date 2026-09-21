/**
 * Generate a Leaflet-compatible raster tile pyramid (CRS.Simple + unproject).
 *
 * Usage:
 *   npm run map:tiles -- <input-image> [out-dir] [--extra-zoom N]
 *
 * Examples:
 *   npm run map:tiles -- ./world.png ./public/map-tiles
 *   npm run map:tiles -- ./public/Map.png ./public/map-tiles --extra-zoom 2
 *
 * --extra-zoom N  Adds N zoom levels beyond the native image size by
 *                 upscaling (sharper only if you later supply a bigger source).
 */

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const TILE = 256;

function parseArgs(argv) {
  const positional = [];
  let extraZoom = 0;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--extra-zoom" || a === "--extra") {
      const n = Number(argv[++i]);
      if (!Number.isFinite(n) || n < 0 || n > 6) {
        throw new Error("--extra-zoom must be an integer 0..6");
      }
      extraZoom = Math.floor(n);
    } else if (a.startsWith("--extra-zoom=")) {
      const n = Number(a.split("=")[1]);
      if (!Number.isFinite(n) || n < 0 || n > 6) {
        throw new Error("--extra-zoom must be an integer 0..6");
      }
      extraZoom = Math.floor(n);
    } else if (a.startsWith("-")) {
      throw new Error(`Unknown flag: ${a}`);
    } else {
      positional.push(a);
    }
  }
  return {
    input: positional[0],
    outDir: path.resolve(positional[1] || "./public/map-tiles"),
    extraZoom,
  };
}

const { input, outDir, extraZoom } = parseArgs(process.argv.slice(2));

if (!input) {
  console.error(
    "Usage: npm run map:tiles -- <input-image> [out-dir] [--extra-zoom N]",
  );
  process.exit(1);
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function main() {
  const absInput = path.resolve(input);
  const meta = await sharp(absInput).metadata();
  const srcW = meta.width || 0;
  const srcH = meta.height || 0;
  if (!srcW || !srcH) throw new Error("Cannot read image size");

  const nativeMaxZoom = Math.max(
    0,
    Math.ceil(Math.log2(Math.max(srcW, srcH) / TILE)),
  );
  const maxZoom = nativeMaxZoom + extraZoom;
  const scaleUp = 2 ** extraZoom;
  const width = Math.round(srcW * scaleUp);
  const height = Math.round(srcH * scaleUp);

  console.log(`Source: ${srcW}x${srcH}`);
  if (extraZoom > 0) {
    console.log(
      `extra-zoom: +${extraZoom} → working canvas ${width}x${height} (upscaled)`,
    );
  }
  console.log(`nativeMaxZoom: ${nativeMaxZoom} → maxZoom: ${maxZoom}`);
  console.log(`Output: ${outDir}`);

  // Wipe previous pyramid so stale higher/lower z folders don't linger
  await fs.rm(outDir, { recursive: true, force: true });
  await ensureDir(outDir);

  // Build once from (possibly upscaled) raster
  const base = sharp(absInput).resize(width, height, {
    fit: "fill",
    kernel: extraZoom > 0 ? "lanczos3" : "nearest",
  });

  for (let z = 0; z <= maxZoom; z++) {
    const scale = 2 ** (maxZoom - z);
    const scaledW = Math.max(1, Math.ceil(width / scale));
    const scaledH = Math.max(1, Math.ceil(height / scale));
    const cols = Math.ceil(scaledW / TILE);
    const rows = Math.ceil(scaledH / TILE);

    console.log(`z=${z} → ${scaledW}x${scaledH} (${cols}x${rows} tiles)`);

    const zoomImagePath = path.join(outDir, `_z${z}.webp`);
    await base
      .clone()
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
  if (extraZoom > 0) {
    console.log(
      `\nNote: extra zoom is upscaled from ${srcW}x${srcH}; for crisp max zoom, use a larger source image.`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
