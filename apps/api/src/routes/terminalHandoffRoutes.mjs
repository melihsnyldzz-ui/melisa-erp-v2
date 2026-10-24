import {Router} from 'express';
import {TERMINAL_HANDOFF_PEER_HEADER} from '../services/terminalHandoffProvider.mjs';

const local=address=>address==='127.0.0.1'||address==='::1'||address==='::ffff:127.0.0.1';
export function createTerminalHandoffRoutes({provider,requireAuth}){
 const router=Router();
 const deny=res=>res.status(403).json({success:false,error:{code:'TERMINAL_HANDOFF_INVALID',message:'Oturum bağlantısı doğrulanamadı.'}});
 router.use('/auth/terminal-handoff',(req,res,next)=>{
  res.set('Cache-Control','no-store');
  if(req.method!=='POST'||!req.is('application/json')||Object.keys(req.query||{}).length||!req.body||Object.getPrototypeOf(req.body)!==Object.prototype||JSON.stringify(req.body).length>4096)return deny(res);
  next();
 });
 const handle=operation=>async(req,res)=>{
  try{return res.json({success:true,data:await operation(req)});}catch{return deny(res);}
 };
 router.post('/auth/terminal-handoff/prepare',requireAuth,handle(req=>{
  const header=req.get('authorization');
  if(typeof header!=='string'||!/^Bearer [^\s]+$/.test(header)||Object.hasOwn(req.body,'accessToken'))throw Error('Invalid request');
  return provider.prepare({...req.body,accessToken:header.slice(7)});
 }));
 const peer=(req,res,next)=>{
  if(!local(req.socket?.remoteAddress)||req.get('origin')||req.get('forwarded')||req.get('x-forwarded-for')||req.get('x-forwarded-host'))return deny(res);
  next();
 };
 for(const name of ['redeem','verify','revoke'])router.post('/auth/terminal-handoff/'+name,peer,handle(req=>provider[name](req.body,req.get(TERMINAL_HANDOFF_PEER_HEADER))));
 return router;
}
