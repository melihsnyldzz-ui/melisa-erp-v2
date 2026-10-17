const fail=()=>{throw Error('Sistem durumu doğrulanamadı. Yenileyerek tekrar deneyin.');};
const stamp=v=>v===null||typeof v==='string'&&Number.isFinite(Date.parse(v));
export function validateSystemSummary(data){
 if(!['TEST','LIVE'].includes(data?.environment)||!data.package||typeof data.package.packageId!=='string'||typeof data.package.sourceCommit!=='string'||!data.currentUser||!Number.isSafeInteger(data.currentUser.id)||data.currentUser.id<1||typeof data.currentUser.displayName!=='string'||!Array.isArray(data.currentUser.roleCodes)||data.currentUser.roleCodes.some(v=>typeof v!=='string')||!Array.isArray(data.currentUser.permissionsSummary)||data.currentUser.permissionsSummary.some(v=>typeof v!=='string'))fail();
 if(!Array.isArray(data.services)||data.services.length>8||new Set(data.services.map(v=>v.id)).size!==data.services.length||data.services.some(v=>typeof v.id!=='string'||typeof v.label!=='string'||!['ready','unavailable','unknown'].includes(v.status)||!stamp(v.checkedAt)))fail();
 const t=data.terminal;if(!t||typeof t.webReady!=='boolean'||!['pending','accepted','unknown'].includes(t.physicalAcceptance)||!stamp(t.lastAccessAt))fail();
 const b=data.backup,r=data.restore;if(!b||typeof b.status!=='string'||!stamp(b.lastSuccessAt)||b.sizeBytes!==null&&(!Number.isSafeInteger(b.sizeBytes)||b.sizeBytes<0)||![true,false,null].includes(b.checksumVerified)||!r||typeof r.status!=='string'||!stamp(r.lastSuccessAt)||![true,false,null].includes(r.sourceDatabaseMatched)||![true,false,null].includes(r.criticalDataMatched))fail();
 for(const key of ['erp','crm'])if(!data.autostart?.[key]||typeof data.autostart[key].status!=='string'||!stamp(data.autostart[key].lastCheckAt))fail();
 if(data.recoveryEvidence!==undefined&&data.recoveryEvidence!==null&&!historicalRecoveryEvidence(data))fail();
 return data;
}
export function systemDate(value){return value===null?'Henüz doğrulanmadı':new Date(value).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'});}
export function historicalRecoveryEvidence(data){
 const e=data?.recoveryEvidence,fields=['basis','comparedAt','coverage','currentBackupVerified'];
 if(!e||typeof e!=='object'||Array.isArray(e)||Object.keys(e).sort().join(',')!==fields.sort().join(',')||e.basis!=='historical_copy_comparison'||e.coverage!=='recorded_copy_scope'||e.currentBackupVerified!==false||typeof e.comparedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(e.comparedAt)||!stamp(e.comparedAt))return null;
 if(data.backup?.status!=='success'||data.restore?.status!=='success'||data.backup.checksumVerified!==true||data.restore.sourceDatabaseMatched!==true||data.restore.criticalDataMatched!==true||data.backup.lastSuccessAt!==e.comparedAt||data.restore.lastSuccessAt!==e.comparedAt)return null;
 return e;
}
export function systemRole(code){return ({owner_manager:'Patron / Müdür',owner_partner:'Patron',isolated_test_sales:'Satış personeli',isolated_test_ilker:'Alış ve finans personeli',admin:'Yönetici',manager:'Müdür',accountant:'Muhasebe',accounting:'Muhasebe',sales:'Satış',seller:'Satış',sales_user:'Satış',sales_staff:'Satış personeli',personnel:'Personel',staff:'Personel',terminal_user:'Terminal personeli',warehouse:'Depo',warehouse_staff:'Depo personeli',purchasing:'Alış',readonly:'Görüntüleme',read_only:'Görüntüleme'})[code]??'Mevcut kullanıcı rolü';}
export function systemState(value){return ({ready:'Hazır',available:'Hazır',success:'Başarılı',succeeded:'Başarılı',verified:'Doğrulandı',technical_ready:'Teknik hazır · Oturum açma kabulü bekliyor',technical_ready_acceptance_pending:'Teknik hazır · Oturum açma kabulü bekliyor',configured:'Hazırlandı · Oturum açma kabulü bekliyor',enabled:'Etkin',disabled:'Kapalı',failed:'Başarısız',unavailable:'Bağlantı kurulamadı',unknown:'Henüz doğrulanmadı',pending:'Kabul bekliyor',not_verified:'Henüz doğrulanmadı',not_configured:'Henüz hazırlanmadı',not_available:'Henüz veri yok'})[value]??'Henüz doğrulanmadı';}
