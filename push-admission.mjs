// Fair admission metadata only: never queue images or inference work.
export function fairPush({ttl=14000}={}){
 const seen=new Map(),served=new Map();
 return {
  admit(id,now){
   for(const [key,at] of seen)if(now-at>ttl){seen.delete(key);served.delete(key)}
   seen.set(id,now);
   const next=[...seen.keys()].sort((a,b)=>(served.get(a)||0)-(served.get(b)||0))[0];
   return next===id;
  },
  success(id,now){served.set(id,now)},
 };
}
