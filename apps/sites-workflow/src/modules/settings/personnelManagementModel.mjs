export function canManageCleanRecord(scope,kind,id){
  if(!scope)return true;
  return scope.ready===true&&(id==null||(kind==='user'?scope.userIds:scope.employeeIds)?.includes(Number(id))===true);
}
export function availablePersonnelAccounts(overview,currentEmployeeId=null){
  const scope=overview.cleanPersonnel;
  return (overview.users??[]).filter(user=>user.isActive&&canManageCleanRecord(scope,'user',user.id)
    &&!(overview.employees??[]).some(employee=>employee.userId===user.id&&employee.id!==currentEmployeeId));
}
export function availablePersonnelRoles(data){
  return (data.roles??[]).filter(role=>role.isActive&&(!data.cleanPersonnel||data.cleanPersonnel.roleIds.includes(role.id)));
}
export function personnelLoginFields({selectedId,userId,loginUsername,loginPassword}){
  if(selectedId||userId)return {userId:userId?Number(userId):null};
  return {userId:null,loginUsername:loginUsername.trim(),loginPassword};
}
