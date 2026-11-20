import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import https from 'node:https'
import crypto from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {accountStore,publicUser,bank,Session} from './auth.mjs'
import {isolatedEndpoint,contextOf} from './context.mjs'
import {asrService} from './speech-asr.mjs'
import {validateImageDataUrl} from './request-validation.mjs'
import {fairPush} from './push-admission.mjs'
import {directPushService} from './personalized-push.mjs'
import {DIRECT_PROTOCOL} from './push-prompts.mjs'
const here=path.dirname(fileURLToPath(import.meta.url))
export function createV9({storeFile=process.env.DEMO_STORE,endpoint=process.env.JOYAI_DEMO_ENDPOINT,interactionEndpoint=process.env.JOYAI_DEMO_INTERACTION_ENDPOINT,apiKey=process.env.JOYAI_DEMO_KEY,secure=true,fetcher=fetch,staticDir=path.join(here,'dist')}={}){
 const db=accountStore(storeFile),pushURL=isolatedEndpoint(endpoint),interactionURL=isolatedEndpoint(interactionEndpoint),sessions=new Map(),attempts=new Map(),flights=new Map();let globalPush=0,globalInteraction=0
 const speechFile=process.env.DEMO_SPEECH_KEY_FILE||(storeFile?path.join(path.dirname(storeFile),'speech.key'):undefined)
 const speech=asrService({keyFile:speechFile&&fs.existsSync(speechFile)?speechFile:undefined,fetcher})
 const direct=true,pipeline=directPushService({bank,Session}),rotation=fairPush({ttl:direct?2500:14000});const app=express();app.disable('x-powered-by')
 app.use((_q,r,n)=>{r.set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Permissions-Policy':'camera=(self), microphone=(self), geolocation=()','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"});n()})
 app.get('/api/demo/health',(_q,r)=>r.json({ok:true,version:direct?'14.0':'12.0',push_mode:direct?'direct-v14':'legacy',deployment:'independent-server',live_available:!!pushURL,interaction_available:!!interactionURL,speech_available:speech.available,message:pushURL?'已连接':'服务未连接'}))
 app.use('/api',(q,r,n)=>{if(!['GET','HEAD'].includes(q.method)&&q.get('x-prism-request')!=='1')return r.status(403).json({message:'拒绝跨站请求'});const origin=q.get('origin');if(origin){try{if(new URL(origin).host!==q.get('host'))return r.status(403).json({message:'拒绝跨站来源'})}catch{return r.status(403).end()}}n()})
 app.use('/api',express.json({limit:'4mb'}))
 const cookie=(t)=>`prism_session=${t}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800${secure?'; Secure':''}`
 function signIn(q,r,u,status=200){
  const now=Date.now();for(const[k,v]of sessions)if(now-v.exp>0)sessions.delete(k)
  const old=q.headers.cookie?.match(/(?:^|;\s*)prism_session=([^;]+)/)?.[1];sessions.delete(old)
  const t=crypto.randomBytes(32).toString('hex');sessions.set(t,{id:u.id,exp:now+8*3600000});r.status(status).set('Set-Cookie',cookie(t)).json({user:publicUser(u),profile:u.profile,revision:u.revision})
 }
 app.post(['/api/auth/login','/api/auth/register'],async(q,r)=>{
  const register=q.path==='/api/auth/register',key=q.socket.remoteAddress+q.path,now=Date.now();for(const[k,a]of attempts)if(now-a.at>60000)attempts.delete(k)
  const a=attempts.get(key)||{at:now,n:0};attempts.set(key,a);if(++a.n>15)return r.status(429).json({message:'登录过于频繁，请一分钟后再试'})
  for(const[k,v]of sessions)if(now-v.exp>0)sessions.delete(k)
  if(sessions.size>=100)return r.status(429).json({message:'会话已满'})
  if(register){try{return signIn(q,r,await db.register(),201)}catch(e){return r.status(e.status||503).json({message:'暂时无法创建账号，请稍后重试'})}}
  if(typeof q.body?.username!=='string'||typeof q.body?.password!=='string')return r.status(400).json({message:'请输入账号和密码'})
  const u=await db.login(q.body.username,q.body.password);if(!u)return r.status(401).json({message:'账号或密码不正确'})
  signIn(q,r,u)
 })
 app.use('/api',(q,r,n)=>{const t=q.headers.cookie?.match(/(?:^|;\s*)prism_session=([^;]+)/)?.[1],s=sessions.get(t);if(!s||s.exp<Date.now()){sessions.delete(t);return r.status(401).json({message:'请登录独立 Demo 账号'})}q.account=db.users.find(u=>u.id===s.id);q.authToken=t;n()})
 app.post('/api/auth/logout',(q,r)=>{sessions.delete(q.authToken);r.set('Set-Cookie',cookie('')+'; Max-Age=0').json({ok:true})})
 app.post('/api/demo/asr',async(q,r)=>{const c=new AbortController(),timer=setTimeout(()=>c.abort(),22000),closed=()=>{if(!r.writableEnded)c.abort()};r.on('close',closed);try{r.json(await speech.recognize(q.account.id,q.body?.audio,q.body?.language,c.signal))}catch(e){if(!r.destroyed)r.status(e.status||502).json({message:'语音转写未完成，请重试'})}finally{clearTimeout(timer);r.off('close',closed)}})
 app.get('/api/auth/me',(q,r)=>r.json({user:publicUser(q.account),profile:q.account.profile,revision:q.account.revision}))
 app.post('/api/demo/push/ack',(q,r)=>r.json({ok:true,accepted:direct&&pipeline.ack(q.account.id,q.body?.run_id,q.body?.receipt)}))
 app.put('/api/profile',(q,r)=>{try{const u=db.update(q.account,q.body.profile,q.body.revision);r.json({profile:u.profile,revision:u.revision})}catch(e){r.status(e.status||400).json({message:e.message})}})
 app.use('/api/admin',(q,r,n)=>q.account.role==='admin'?n():r.status(403).json({message:'仅管理员可访问'}))
 app.get('/api/admin/users',(_q,r)=>r.json({users:db.users.filter(u=>u.role==='user').map(publicUser)}))
 app.get('/api/admin/users/:id',(q,r)=>{const u=db.users.find(u=>u.id===q.params.id&&u.role==='user');if(!u)return r.status(404).end();r.json({user:publicUser(u),profile:u.profile,revision:u.revision})})
 async function vision(q,r,interaction){
  const url=interaction?interactionURL:pushURL;if(!url)return r.status(503).json({message:'独立视觉接口未配置，请检查模型适配器配置。'})
  const key=q.account.id+(interaction?':interaction':':push'),now=Date.now(),state=flights.get(key)||{busy:false,last:0};flights.set(key,state)
  const turn=interaction||rotation.admit(q.account.id,now)
  if(!turn||state.busy||(!direct&&now-state.last<2000)||(interaction?globalInteraction>=1:globalPush>=1||globalInteraction>0))return r.status(429).json({message:'服务繁忙，将使用下一张最新帧',retry_ms:200})
  state.busy=true;state.last=now;if(interaction)globalInteraction++;else globalPush++
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000),closed=()=>{if(!r.writableEnded)controller.abort()};r.on('close',closed)
  try{const image=interaction&&!q.body?.image?undefined:validateImageDataUrl(q.body?.image);if(image&&image.length>3500000)throw Error();const ctx=contextOf(interaction?(q.body.context||{activity:'review'}):q.body.context),question=String(q.body.question||'').trim();if(interaction&&(!question||question.length>300))return r.status(400).json({message:'问题须为1至300字'})
   const start=performance.now(),language=q.body.language==='en-US'?'en-US':'zh-CN';let prepared
   if(direct&&!interaction){if(q.body.profile_revision!==q.account.revision)return r.status(409).json({code:'PROFILE_CHANGED',message:'偏好已更新，请刷新页面'});prepared=pipeline.prepare({account:q.account,language,context:ctx,runId:q.body.run_id,presented:q.body.presented})}
   const preferenceMs=performance.now()-start,response=await fetcher(url,{method:'POST',headers:{'content-type':'application/json',...(apiKey?{authorization:'Bearer '+apiKey}:{})},body:JSON.stringify({image,language,user_question:interaction?question:prepared?.prompt||'',context:ctx,...(direct?{protocol:DIRECT_PROTOCOL}:{})}),signal:controller.signal,redirect:'error'});if(response.status===429){const b=await response.json().catch(()=>({}));return r.status(429).json({message:'服务繁忙，稍后使用最新帧重试。',retry_ms:b.retry_ms||300})}if(!response.ok)throw Error();const body=await response.text();if(body.length>100000)throw Error();const raw=JSON.parse(body);if(raw.ok===false)throw Error()
   if(!interaction)rotation.success(q.account.id,Date.now());
   const parseStart=performance.now();if(interaction){const answer=raw.question_answer;if(typeof answer!=='string'||answer.length>6000)throw Error();r.json({ok:true,answer,elapsed_ms:performance.now()-start,timings:raw.timings||{}})}else if(prepared){const result=pipeline.finish(prepared,raw.question_answer??raw,q.account);r.json({ok:true,protocol:DIRECT_PROTOCOL,...result,profile_revision:prepared.revision,elapsed_ms:performance.now()-start,timings:{...raw.timings,preference_ms:preferenceMs,parse_ms:performance.now()-parseStart}})}else {throw Error('Missing prepared push request')}
  }catch(e){if(!r.destroyed)r.status(e.status||502).json({message:'视觉请求失败，未生成播报。'})}finally{clearTimeout(timer);r.off('close',closed);state.busy=false;if(interaction)globalInteraction--;else globalPush--}
 }
 app.post('/api/demo/push',(q,r)=>vision(q,r,false));app.post('/api/demo/interact',(q,r)=>vision(q,r,true))
 app.use('/api',(_q,r)=>r.status(404).json({message:'未开放此接口'}))
 app.use(express.static(staticDir,{index:false,dotfiles:'allow'}));app.get(['/', '/admin','/zh','/en','/zh/admin','/en/admin'],(_q,r)=>r.sendFile(path.join(staticDir,'index.html'),{dotfiles:'allow'}))
 app.use((e,_q,r,_n)=>r.status(e.status===413?413:400).json({message:'请求无效或过大'}));return app
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const local=process.env.DEMO_LOCAL_HTTP==='1',app=createV9({secure:!local}),port=Number(process.env.PORT||18475)
 if(local)app.listen(port,'127.0.0.1',()=>console.log('Independent Demo local test ready'))
 else https.createServer({key:fs.readFileSync(process.env.DEMO_TLS_KEY),cert:fs.readFileSync(process.env.DEMO_TLS_CERT)},app).listen(port,'127.0.0.1',()=>console.log('Independent Demo HTTPS ready'))
}
