export function requireNativeDeviceScope(req,_res,next){
 if(process.env.NATIVE_CUSTOMER_ROUTES_ENABLED!=='true')return next();
 const bound=req.authContext?.nativeTerminalCode;
 if(!bound)return next(Object.assign(new Error('Terminal oturumu yenilenmeli.'),{code:'AUTH_TOKEN_INVALID',statusCode:401}));
 const requested=req.method==='GET'?req.query?.terminalCode:req.body?.terminalCode;
 if(typeof requested!=='string'||requested!==bound)return next(Object.assign(new Error('Oturum başka cihaz koduna ait.'),{code:'NATIVE_DEVICE_SCOPE_MISMATCH',statusCode:403}));
 return next();
}
