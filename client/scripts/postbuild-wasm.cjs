// Postbuild step: ensure swisseph.wasm and swisseph.data are present
// with the fixed filenames the runtime expects.

const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist', 'assets');
const manifestPath = path.join(__dirname, '..', 'dist', '.vite', 'manifest.json');

function copyIfExists(pattern, targetName) {
  const files = fs.readdirSync(distDir).filter(f => f.match(pattern));
  if (!files.length) {
    console.warn(`[postbuild-wasm] No file matching ${pattern} found in dist/assets`);
    return;
  }
  const source = path.join(distDir, files[0]);
  const target = path.join(distDir, targetName);
  fs.copyFileSync(source, target);
  console.log(`[postbuild-wasm] Copied ${files[0]} -> ${targetName}`);
}

try {
  if (!fs.existsSync(distDir)) {
    console.warn('[postbuild-wasm] dist/assets does not exist, skipping');
    process.exit(0);
  }

  // WASM and data files emitted by swisseph-wasm
  copyIfExists(/^swisseph-.*\.wasm$/, 'swisseph.wasm');
  copyIfExists(/^swisseph-.*\.data$/, 'swisseph.data');
} catch (err) {
  console.error('[postbuild-wasm] Error while copying WASM assets:', err);
  process.exit(1);
}
