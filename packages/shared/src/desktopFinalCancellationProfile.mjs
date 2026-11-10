import {DESKTOP_EMPTY_V7_PROFILE_ID,DESKTOP_EMPTY_V7_PUBLIC_BINDING,DESKTOP_EMPTY_V7_EXPORT_DIRECTORY} from './desktopEmptyProfile.mjs';
// Public finite TEST identity, shared by the offline plan and runtime fence.
export const DESKTOP_FINAL_CANCELLATION_EXPORT_DIRECTORY='C:/Users/Xaser/Desktop/ERP/kurulum/master-v5-export-journal';
export const DESKTOP_FINAL_CANCELLATION_EXPORT_BINDING=Object.freeze({profile:'desktop-master-v5',server:'Semih\\MELISAERP',database:'MELISA_ERP_DESKTOP_TEST_20261105',databaseGuid:'c67f5317-9c0d-4831-aadd-fadc379a95d1',environmentId:'eb2888c2-51cb-4570-a933-397cf7e62806',actualT1:0,externalOperations:0});
export const DESKTOP_FINAL_CANCELLATION_EXPORT_BINDING_TEXT=JSON.stringify(DESKTOP_FINAL_CANCELLATION_EXPORT_BINDING,null,2)+'\n';

export function desktopFinalCancellationProfile(targetProfile=null){if(targetProfile===null||targetProfile===undefined)return {directory:DESKTOP_FINAL_CANCELLATION_EXPORT_DIRECTORY,binding:DESKTOP_FINAL_CANCELLATION_EXPORT_BINDING};if(targetProfile!==DESKTOP_EMPTY_V7_PROFILE_ID)throw Error('DESKTOP_FINAL_CANCEL_PROFILE_REJECTED');return {directory:DESKTOP_EMPTY_V7_EXPORT_DIRECTORY,binding:DESKTOP_EMPTY_V7_PUBLIC_BINDING};}
