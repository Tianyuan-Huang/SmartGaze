import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import vm from 'node:vm'
import {promisify} from 'node:util'
const scrypt=promisify(crypto.scrypt)
export const bank=JSON.parse(fs.readFileSync(new URL('./prism/data.json',import.meta.url),'utf8'))
const context=vm.createContext({});vm.runInContext(fs.readFileSync(new URL('./prism/core.js',import.meta.url),'utf8'),context)
export const Session=context.PRISM.Session
export const definitions=[['new01','新用户一',[]],['new02','新用户二',[]],['price01','价格优先',['exact_price','plate_layout']],['size01','规格优先',['product_variant','tableware_location']],['product01','品类优先',['product_identity','visual_style']],['admin','管理员',[]]]
export function seedProfile(id,targets){const s=new Session(bank,id);if(targets.length){for(const q of bank.questions){const c=Object.entries(q.options).find(([,o])=>targets.includes(o.skill));if(c&&s.events.length<7)s.answer(q.id,c[0],'foundation',true,1000+s.events.length)}s.start(2000)}return s.export()}
export async function initialize(file,credentialsFile){
 if(fs.existsSync(file))throw Error('Existing account store is preserved; initialization refused')
 const users=[],credentials=[]
 for(const[id,label,targets]of definitions){const password=crypto.randomBytes(12).toString('base64url'),salt=crypto.randomBytes(16).toString('hex'),hash=(await scrypt(password,salt,64)).toString('hex');users.push({id,label,role:id==='admin'?'admin':'user',seeded:!!targets.length,salt,hash,revision:0,profile:seedProfile(id,targets),logins:0,lastLogin:null});credentials.push({username:id,password,label})}
 fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify({users}),{mode:0o600,flag:'wx'});fs.writeFileSync(credentialsFile,JSON.stringify(credentials,null,2),{mode:0o600,flag:'wx'});return users.map(publicUser)
}
export function publicUser(u){return{id:u.id,username:u.username||u.id,label:u.label,role:u.role,seeded:u.seeded,revision:u.revision,logins:u.logins,lastLogin:u.lastLogin,events:Session.restore(bank,u.profile).events.filter(e=>!e.revoked).length}}
export async function standardizeAccounts(file){
 const db=JSON.parse(fs.readFileSync(file,'utf8'));if(db.accountNamingVersion===1)return db.users.map(publicUser)
 for(const [index,u]of db.users.entries()){u.username='user'+String(index+1).padStart(2,'0');u.salt=crypto.randomBytes(16).toString('hex');u.hash=(await scrypt(u.username,u.salt,64)).toString('hex')}
 db.accountNamingVersion=1;const temp=file+'.next';fs.writeFileSync(temp,JSON.stringify(db),{mode:0o600});fs.renameSync(temp,file);return db.users.map(publicUser)
}
export function accountStore(file){
 const db=JSON.parse(fs.readFileSync(file,'utf8'))
 let registration=Promise.resolve()
 function save(){const temp=file+'.next';fs.writeFileSync(temp,JSON.stringify(db),{mode:0o600});fs.renameSync(temp,file)}
 return{users:db.users,save,register(){
  const result=registration.then(async()=>{
   if(db.users.length>=200)throw Object.assign(Error('Demo account limit reached'),{status:429})
   let n=Math.max(0,...db.users.map(u=>Number((u.username||u.id).match(/^user(\d+)$/)?.[1])||0))+1
   let id='user'+String(n).padStart(2,'0');while(db.users.some(u=>u.id===id||u.username===id))id='user'+String(++n).padStart(2,'0')
   const salt=crypto.randomBytes(16).toString('hex'),hash=(await scrypt(id,salt,64)).toString('hex')
   const u={id,username:id,label:id,role:'user',seeded:false,salt,hash,revision:0,profile:seedProfile(id,[]),logins:1,lastLogin:Date.now()};db.users.push(u)
   try{save()}catch(e){db.users.pop();throw e}return u
  });registration=result.catch(()=>{});return result
 },async login(id,password){const u=db.users.find(u=>(u.username||u.id)===id);const salt=u?.salt||'nonexistent-account';const hash=await scrypt(String(password).slice(0,200),salt,64);if(!u||!crypto.timingSafeEqual(hash,Buffer.from(u.hash,'hex')))return null;u.logins++;u.lastLogin=Date.now();save();return u},update(u,profile,revision){if(revision!==u.revision){const e=Error('画像已在其他设备更新，请重新加载后再修改');e.status=409;throw e}if(profile?.id!==u.id)throw Error('账号与画像不匹配');const canonical=Session.restore(bank,profile).export();u.profile=canonical;u.revision++;save();return u}}
}
