// This POST computes a selected native read context. Authentication, both sales
// permissions and the existing native source/account admission remain downstream.
export function isCanonicalBusinessSaleReadAllowed(method,path,{writes=false,mode='native',protectedNormalAuth=false}={}){
 return writes===true&&mode==='erp'&&protectedNormalAuth===true&&method==='POST'&&path==='/api/work-sales/selected-context';
}
