const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const desktopRoot = path.resolve(__dirname, '..');
const outDir = path.join(desktopRoot, 'build');
const source = path.resolve(desktopRoot, '..', 'icon.png');
const script = [
  'from PIL import Image',
  'from pathlib import Path',
  `src = Path(r'''${source}''')`,
  `out = Path(r'''${path.join(outDir, 'icon.ico')}''')`,
  'out.parent.mkdir(parents=True, exist_ok=True)',
  'image = Image.open(src).convert("RGBA")',
  'canvas = image.resize((256, 256), Image.Resampling.LANCZOS)',
  'canvas.save(out, format="ICO", sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])'
].join('\n');

fs.mkdirSync(outDir, { recursive: true });
execFileSync('python', ['-c', script], { stdio: 'inherit' });
console.log(`Icon created at ${path.join(outDir, 'icon.ico')}`);
