import sql from 'mssql';
import {getDesktopWritePool} from '../config/desktopWriteTlsConnector.mjs';
import {getDesktopWriteSessionVerifier} from './desktopWriteAuthCore.mjs';
import {createDesktopSaleWorkflowTransactions} from './desktopSaleWorkflowTransactions.mjs';
// No caller-supplied pool or session authority enters this production assembly.
export function createDesktopSaleWorkflowService({connector,auth}={}){
 const pool=getDesktopWritePool(connector),verifySession=getDesktopWriteSessionVerifier(auth,pool);
 return auth.bindWorkflowService(createDesktopSaleWorkflowTransactions({pool,sql,verifySession}));
}
