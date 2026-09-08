import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
// CatalogSendScreen and its dedicated service are messaging paths despite their names.
const excluded = /whatsapp|chatwoot|evolution|terminal-app[\\/]src[\\/](?:screens[\\/]CatalogSendScreen|services[\\/]catalogService)\.js$/i;
let failed = false;
const apps = ['api', 'web-admin', 'terminal-app', 'desktop'];
const requestedApp = process.argv[2];
if (requestedApp && !apps.includes(requestedApp)) throw new Error('Unknown application scope');
for (const app of requestedApp ? [requestedApp] : apps) {
  const appRoot = path.join(root, 'apps', app);
  const files = ts.sys.readDirectory(path.join(appRoot, 'src'), ['.js', '.mjs', '.cjs', '.jsx', '.d.ts'], undefined, ['**/*'])
    .filter(file => !excluded.test(file));
  if (app === 'terminal-app') files.push(path.join(appRoot, 'App.js'));
  files.push(path.join(root, 'types/commerce-errors.d.ts'));
  const program = ts.createProgram(files, {
    allowJs: true, checkJs: true, noEmit: true, skipLibCheck: true,
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler, jsx: ts.JsxEmit.ReactJSX,
    esModuleInterop: true, allowSyntheticDefaultImports: true,
    preserveSymlinks: true,
    types: app === 'api' || app === 'desktop' ? ['node'] : ['node', 'react'],
  });
  const all = ts.getPreEmitDiagnostics(program);
  const diagnostics = all.filter(d => !d.file || (!d.file.fileName.includes('node_modules') && !excluded.test(d.file.fileName)));
  console.log(`${app}: ${files.length} source roots, ${diagnostics.length} diagnostics; messaging paths excluded`);
  if (diagnostics.length) {
    failed = true;
    console.log(ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCanonicalFileName: f => f, getCurrentDirectory: () => root, getNewLine: () => '\n' }));
  }
  if (process.env.QUALITY_REPORT_DIR) {
    fs.mkdirSync(process.env.QUALITY_REPORT_DIR, { recursive: true });
    fs.writeFileSync(path.join(process.env.QUALITY_REPORT_DIR, `typecheck-${app}.json`), JSON.stringify({
      typescript: ts.version, sourceRoots: files.map(f => path.relative(root, f)),
      excludedImportedDiagnostics: all.length - diagnostics.length,
      diagnostics: diagnostics.map(d => ({ file: d.file ? path.relative(root, d.file.fileName) : null, line: d.file ? d.file.getLineAndCharacterOfPosition(d.start ?? 0).line + 1 : null, code: d.code, message: ts.flattenDiagnosticMessageText(d.messageText, '\n') })),
    }, null, 2));
  }
}
process.exitCode = failed ? 1 : 0;
