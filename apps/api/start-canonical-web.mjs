import express from 'express';import path from 'node:path';import fs from 'node:fs';
const root=path.resolve('../web-admin/dist-test');
const release=JSON.parse(fs.readFileSync(path.resolve('../../release-manifest.json'),'utf8'));
const app=express();app.disable('x-powered-by');
app.use((_req,res,next)=>{res.set('Cache-Control','no-store');res.set('X-Melisa-Environment','CANONICAL-TEST');res.set('Content-Security-Policy',"connect-src 'self' http://127.0.0.1:4144 http://127.0.0.1:4146");next();});
app.get('/test-health',(_req,res)=>res.json({ok:true,environment:'CANONICAL_TEST',port:5194,sourceCommit:release.sourceCommit,packageId:release.packageId}));
app.use(express.static(root,{dotfiles:'deny'}));
app.get('*',(_req,res)=>res.sendFile(path.join(root,'index.html')));
app.listen(5194,'127.0.0.1',()=>console.log('CANONICAL_TEST_WEB_READY'));
