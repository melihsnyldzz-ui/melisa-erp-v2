import { cp, mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(scriptRoot, '..');
const repoRoot = path.resolve(desktopRoot, '..', '..');
const webDist = path.join(repoRoot, 'apps', 'web-admin', 'dist');
const iconSource = path.join(repoRoot, 'apps', 'terminal-app', 'src', 'assets', 'branding', 'melisa-baby-icon.png');
const stageRoot = path.join(desktopRoot, 'dist', 'stage');
const stagedWeb = path.join(stageRoot, 'web-admin');
const stagedResources = path.join(stageRoot, 'resources');

async function requirePath(target, description) {
  try {
    return await stat(target);
  } catch {
    throw new Error(`${description} bulunamadi: ${target}`);
  }
}

await requirePath(path.join(webDist, 'index.html'), 'Web-admin build');
await requirePath(iconSource, 'Melisa ERP uygulama ikonu');

await rm(stageRoot, { recursive: true, force: true });
await mkdir(stagedResources, { recursive: true });
await cp(webDist, stagedWeb, { recursive: true });
await cp(iconSource, path.join(stagedResources, 'icon.png'));

console.log(`Desktop package stage hazir: ${stageRoot}`);
