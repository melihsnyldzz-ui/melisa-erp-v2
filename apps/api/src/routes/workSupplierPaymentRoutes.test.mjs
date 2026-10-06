import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {createWorkSupplierPaymentRoutes} from './workSupplierPaymentRoutes.mjs';
test('payment router mounted before login authenticates only its own paths and preserves service permission denial',async()=>{
 const app=express(),calls=[];app.use(express.json());
 const authenticate=(req,res,next)=>{calls.push(req.originalUrl);if(req.headers.authorization!=='Bearer fixture')return res.status(401).json({code:'AUTH_TOKEN_REQUIRED'});req.user={id:'15'};next();};
 app.use('/api',createWorkSupplierPaymentRoutes({authenticate,service:{context:async actor=>{assert.equal(actor.id,'15');throw Object.assign(Error('Yetki gerekli.'),{statusCode:403});}}}));
 app.post('/api/auth/login',(req,res)=>res.json({success:true}));app.get('/api/unrelated',(req,res)=>res.json({success:true}));app.use((error,req,res,next)=>res.status(error.statusCode??500).json({message:error.message}));
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const base='http://127.0.0.1:'+server.address().port;
 try{assert.equal((await fetch(base+'/api/auth/login',{method:'POST'})).status,200);assert.equal((await fetch(base+'/api/unrelated')).status,200);assert.deepEqual(calls,[]);assert.equal((await fetch(base+'/api/work-supplier-payments/context')).status,401);assert.equal((await fetch(base+'/api/work-supplier-payments/context',{headers:{authorization:'Bearer fixture'}})).status,403);assert.equal(calls.length,2);}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
