// Explicit isolated localhost preview. No ERP/CRM routes, proxies, probes or operational writes.
import http from 'node:http';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {pathToFileURL} from 'node:url';
const publicRoot = new URL('../apps/sites-workflow/public/melisa-hub/', import.meta.url);
const files = new Map([['/melisa-hub/hub.css',['hub.css','text/css']], ...['index.html','model.mjs','progress.mjs','progress.css','evidence.json'].map(name=>['/melisa-hub/progress/'+name,['progress/'+name,name.endsWith('.mjs')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.json')?'application/json':'text/html']])]);
export function progressRequestPath(target) {
  if (typeof target !== 'string' || target.length > 2048 || !target.startsWith('/') || target.startsWith('//') || /[\s\\%#]/u.test(target) || target.split(/[/?]/u).includes('..')) return null;
  try { return new URL(target,'http://127.0.0.1').pathname; } catch { return null; }
}
export function createProgressServer({port = 5294} = {}) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('INVALID_PORT');
  return http.createServer(async (req,res) => {
    res.setHeader('Cache-Control','no-store'); res.setHeader('X-Content-Type-Options','nosniff'); res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
    if (!['127.0.0.1:'+port,'localhost:'+port].includes(req.headers.host)) {res.writeHead(421).end();return;}
    if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405,{'Allow':'GET, HEAD'}).end();return;}
    const pathname = progressRequestPath(req.url);
    if (pathname === null) {res.writeHead(400).end();return;}
    if (['/','/melisa-hub/progress'].includes(pathname)) {res.writeHead(302,{'Location':'/melisa-hub/progress/'}).end();return;}
    if(pathname==='/favicon.ico'){res.writeHead(204).end();return;}
    const entry=files.get(pathname==='/melisa-hub/progress/'?pathname+'index.html':pathname);
    if(!entry){res.writeHead(404).end();return;}
    try {const body=await fs.readFile(new URL(entry[0],publicRoot));res.writeHead(200,{'Content-Type':entry[1]+'; charset=utf-8'}).end(req.method==='HEAD'?undefined:body);}
    catch {res.writeHead(503).end();}
  });
}
if(process.argv[1]&&pathToFileURL(fileURLToPath(pathToFileURL(process.argv[1]))).href===import.meta.url){
  const server=createProgressServer(); server.on('error',()=>{console.error('Hub preview could not start; no other process was stopped.');process.exitCode=1;});
  server.listen(5294,'127.0.0.1',()=>console.log('Hub progress preview: http://127.0.0.1:5294/melisa-hub/progress/'));
}
