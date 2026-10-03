import test from 'node:test';
import assert from 'node:assert/strict';
import {requireNativeDeviceScope} from './nativeDeviceScope.mjs';
const check=req=>{let error;requireNativeDeviceScope(req,null,e=>{error=e;});return error;};
test('route mode requires a server-authenticated device claim and refuses body/query spoofing',()=>{
 process.env.NATIVE_CUSTOMER_ROUTES_ENABLED='true';
 assert.equal(check({method:'GET',authContext:{nativeTerminalCode:'A'},query:{terminalCode:'A'}}),undefined);
 assert.equal(check({method:'POST',authContext:{nativeTerminalCode:'A'},body:{terminalCode:'A'}}),undefined);
 assert.equal(check({method:'GET',query:{terminalCode:'A',nativeTerminalCode:'A'}}).code,'AUTH_TOKEN_INVALID');
 assert.equal(check({method:'POST',authContext:{nativeTerminalCode:'A'},body:{terminalCode:'B'}}).code,'NATIVE_DEVICE_SCOPE_MISMATCH');
 assert.equal(check({method:'GET',authContext:{nativeTerminalCode:'A'},query:{terminalCode:['A']}}).code,'NATIVE_DEVICE_SCOPE_MISMATCH');
 process.env.NATIVE_CUSTOMER_ROUTES_ENABLED='false';assert.equal(check({}),undefined);
});
