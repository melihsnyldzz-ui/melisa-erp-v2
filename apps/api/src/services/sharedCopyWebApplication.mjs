import fs from 'node:fs';
import path from 'node:path';
// Route construction only. Shared bootstrap, SQL initialization and listening stay
// in their original entry. Tests/rehearsal supply the real Express implementation.
export function createSharedCopyWebApplication({expressImpl,root,publicScope,health,csp,hosts,remoteAllowed,terminal=null,hub=null,hubLanding=false}){
 const app=expressImpl();app.disable('x-powered-by');
 app.use((req,res,next)=>{if(!remoteAllowed(req.socket.remoteAddress)||!hosts.includes(req.get('host')))return res.sendStatus(403);res.set('Cache-Control','no-store');res.set('Content-Security-Policy',csp);next();});
 app.use((req,res,next)=>{if(terminal&&terminal.isApiPath(req.path))return terminal.handler(req,res);next();});
 app.get('/stage4-runtime.js',(_req,res)=>res.type('application/javascript').send('window.__MELISA_OPERATION_COPY__='+JSON.stringify(publicScope).replaceAll('<','\\u003c')+';'+(terminal?'window.__MELISA_TERMINAL_WORKTEST_HOME__='+JSON.stringify(terminal.homeRuntime)+';':'')));
 app.get('/test-health',(_req,res)=>res.json(health));
 if(hub)app.use('/melisa-hub',hub);
 if(hubLanding)app.get('/',(_req,res)=>res.redirect(308,'/melisa-hub/'));
 else app.get(['/','/ornek-akis.html','/terminal.html'],(req,res)=>res.type('html').send(fs.readFileSync(path.join(root,req.path==='/terminal.html'?'terminal.html':'ornek-akis.html'),'utf8').replace('<head>','<head><script src="/stage4-runtime.js"></script>')));
 app.use(expressImpl.static(root));return app;
}
