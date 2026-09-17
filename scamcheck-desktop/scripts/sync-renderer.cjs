const fs = require('fs');
const path = require('path');

const desktopRoot = path.resolve(__dirname, '..');
const projectRoot = path.resolve(desktopRoot, '..');
const rendererRoot = path.join(desktopRoot, 'renderer');
const extensionRoot = path.join(projectRoot, 'scamcheck-extension');

fs.rmSync(rendererRoot, { recursive: true, force: true });
fs.mkdirSync(rendererRoot, { recursive: true });

let html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
html = html
  .replace('href="/manifest.webmanifest"', 'href="./manifest.webmanifest"')
  .replace('href="/scamcheck-icon.svg"', 'href="./scamcheck-icon.svg"')
  .replace('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js', './vendor/tesseract/tesseract.min.js')
  .replace('https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js', './vendor/jsqr/jsQR.js')
  .replace("navigator.serviceWorker.register('/sw.js')", "Promise.reject(new Error('Service worker is disabled in the desktop app'))");

// The web app contains the literal string "</body>" inside its export-template
// JavaScript. Insert the desktop bridge only before the final real body tag.
const finalBodyClose = html.lastIndexOf('</body>');
if (finalBodyClose < 0) throw new Error('Không tìm thấy thẻ đóng </body> của web app.');
html = `${html.slice(0, finalBodyClose)}    <script src="./desktop-bridge.js"></script>\n${html.slice(finalBodyClose)}`;

fs.writeFileSync(path.join(rendererRoot, 'index.html'), html, 'utf8');
for (const file of ['privacy.html', 'manifest.webmanifest', 'scamcheck-icon.svg', 'icon.png']) {
  fs.copyFileSync(path.join(projectRoot, file), path.join(rendererRoot, file));
}
fs.copyFileSync(path.join(projectRoot, 'sw.js'), path.join(rendererRoot, 'sw.js'));
fs.copyFileSync(path.join(desktopRoot, 'src', 'desktop-bridge.js'), path.join(rendererRoot, 'desktop-bridge.js'));
fs.cpSync(path.join(extensionRoot, 'vendor', 'tesseract'), path.join(rendererRoot, 'vendor', 'tesseract'), { recursive: true });
fs.cpSync(path.join(extensionRoot, 'vendor', 'tesseract-core'), path.join(rendererRoot, 'vendor', 'tesseract-core'), { recursive: true });
fs.cpSync(path.join(extensionRoot, 'vendor', 'tessdata'), path.join(rendererRoot, 'vendor', 'tessdata'), { recursive: true });

const jsqrSource = path.join(desktopRoot, 'node_modules', 'jsqr', 'dist', 'jsQR.js');
if (!fs.existsSync(jsqrSource)) {
  throw new Error('Không tìm thấy jsqr. Hãy chạy npm install trước.');
}
fs.mkdirSync(path.join(rendererRoot, 'vendor', 'jsqr'), { recursive: true });
fs.copyFileSync(jsqrSource, path.join(rendererRoot, 'vendor', 'jsqr', 'jsQR.js'));
console.log(`Renderer synced to ${rendererRoot}`);
