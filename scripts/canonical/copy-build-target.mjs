export function resolveCopyBuildTarget(args=[]){
 const flags=['--stage4-copy','--shared-test-copy','--business-test-copy'].filter(flag=>args.includes(flag));if(flags.length>1||flags.some(flag=>args.filter(a=>a===flag).length!==1))throw Error('ONE_COPY_BUILD_TARGET_REQUIRED');
 if(flags[0]==='--business-test-copy')return {kind:'business',dist:'dist-business',apiPort:4184,nativePort:4186,webPort:5234,database:'MELISA_ERP_CRM_SHARED_TEST_20261009_02'};
 if(flags[0]==='--shared-test-copy')return {kind:'shared',dist:'dist-shared',apiPort:4174,nativePort:4176,webPort:5224,database:'MELISA_ERP_CRM_SHARED_TEST_20261009_01'};
 if(flags[0]==='--stage4-copy')return {kind:'stage4',dist:'dist-copy',apiPort:4154,nativePort:4156,webPort:5204,database:'MELISA_ERP_STAGE04_COPY_TEST_20261008_01'};
 return null;
}
export function copyBuildReleaseFields(target){if(!target)return {};const {apiPort,nativePort,webPort,database}=target;return target.kind==='stage4'?{stage4Copy:{apiPort,nativePort,webPort,loopbackOnly:true,database,nativeWrites:false,externalOperations:false,actualT1:false}}:{sharedTestCopy:{apiPort,nativePort,webPort,host:'127.0.0.1',lanHost:'192.168.1.46',nativeLoopbackOnly:true,database,nativeWrites:false,externalOperations:false,actualT1:false}};}
