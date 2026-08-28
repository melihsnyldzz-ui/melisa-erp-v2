import { access, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(scriptRoot, '..');
const installerPath = path.join(desktopRoot, 'dist', 'windows', 'Melisa-ERP-Setup-0.1.0.exe');
const unpackedExe = path.join(desktopRoot, 'dist', 'windows', 'win-unpacked', 'Melisa ERP.exe');
const packagedIndex = path.join(desktopRoot, 'dist', 'windows', 'win-unpacked', 'resources', 'web-admin', 'index.html');
const packagedAssets = path.join(desktopRoot, 'dist', 'windows', 'win-unpacked', 'resources', 'web-admin', 'assets');

await Promise.all([access(installerPath), access(unpackedExe), access(packagedIndex)]);

const installer = await stat(installerPath);
if (installer.size < 10 * 1024 * 1024) {
  throw new Error(`Kurulum dosyasi beklenenden kucuk: ${installer.size} byte`);
}

const html = await readFile(packagedIndex, 'utf8');
if (!html.includes('./assets/')) {
  throw new Error('Paketlenmis web-admin goreli asset yolu icermiyor.');
}

const javascriptFiles = (await readdir(packagedAssets)).filter((file) => file.endsWith('.js'));
const javascript = (await Promise.all(
  javascriptFiles.map((file) => readFile(path.join(packagedAssets, file), 'utf8')),
)).join('\n');
if (!javascript.includes('melisaDesktop')) {
  throw new Error('Paketlenmis web-admin masaustu API/IP ayarini kullanmiyor.');
}

console.log(`Desktop package smoke PASS (${(installer.size / 1024 / 1024).toFixed(2)} MB)`);
