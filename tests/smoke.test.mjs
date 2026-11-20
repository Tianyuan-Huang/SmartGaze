import {test} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {once} from 'node:events'
import {initialize,standardizeAccounts,Session,bank} from '../auth.mjs'
import {createV9} from '../server.mjs'
import {createBridge} from '../model-adapter.mjs'

test('fresh accounts, bilingual UI, calibration persistence, push and logout',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'smartgaze-demo-')),file=path.join(dir,'accounts.json')
 const bridgeCalls=[]
 await initialize(file,path.join(dir,'initial.json'));await standardizeAccounts(file)
 const app=createV9({storeFile:file,secure:false,endpoint:'https://localhost:18476/push',interactionEndpoint:'https://localhost:18476/interact',fetcher:async(url,options)=>{bridgeCalls.push(JSON.parse(options.body));return new Response(JSON.stringify({ok:true,question_answer:'{"action":"push","content":"A tree is ahead.","event_key":"ahead|tree|obstacle"}'}),{status:200})}})
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port
 let cookie='';const request=async(route,method='GET',body)=>{const response=await fetch(origin+route,{method,headers:{'x-prism-request':'1',...(body?{'content-type':'application/json'}:{}),...(cookie?{cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});if(response.headers.has('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];return response}
 try{
  for(const route of ['/zh','/en','/en/admin','/pcm-worklet.js','/prism/data.json'])assert.equal((await request(route)).status,200,route)
  const login=await request('/api/auth/login','POST',{username:'user01',password:'user01'});assert.equal(login.status,200);const me=await login.json(),session=Session.restore(bank,me.profile)
  const q=bank.questions.find(q=>q.scene==='dining');session.answer(q.id,'B','foundation',true);session.start()
  const save=await request('/api/profile','PUT',{profile:session.export(),revision:me.revision});assert.equal(save.status,200);const updated=await save.json()
  const push=await request('/api/demo/push','POST',{image:'data:image/jpeg;base64,YQ==',language:'en-US',context:{activity:'review'},run_id:'handoff-smoke-run-01',profile_revision:updated.revision,presented:[]});assert.equal(push.status,200);assert.equal((await push.json()).action,'push');assert.match(bridgeCalls[0].user_question,/SmartGaze/)
  const register=await request('/api/auth/register','POST',{});assert.equal(register.status,201);assert.equal((await register.json()).user.username,'user07')
  assert.equal((await request('/api/auth/logout','POST',{})).status,200);assert.equal((await request('/api/auth/me')).status,401)
 }finally{await new Promise(resolve=>server.close(resolve));fs.rmSync(dir,{recursive:true,force:true})}
})

test('model adapter forwards configured model, image and token budget',async()=>{
 let sent;const key='handoff-test-token-'.repeat(3),handler=createBridge({key,modelBase:'http://127.0.0.1:8000/v1',modelName:'JoyAI-VL-Interaction-Preview',fetcher:async(url,options)=>{
  if(String(url).endsWith('/metrics'))return new Response('vllm:num_requests_running{model_name="demo"} 0\nvllm:num_requests_waiting{model_name="demo"} 0\n')
  assert.equal(String(url),'http://127.0.0.1:8000/v1/chat/completions');sent=JSON.parse(options.body);return Response.json({choices:[{message:{content:'{"action":"no_push","content":"","event_key":""}'}}]})
 }})
 const {createServer}=await import('node:http');const server=createServer(handler).listen(0,'127.0.0.1');await once(server,'listening')
 try{const r=await fetch('http://127.0.0.1:'+server.address().port+'/push',{method:'POST',headers:{authorization:'Bearer '+key,'content-type':'application/json'},body:JSON.stringify({protocol:'prism-direct-v14',language:'en-US',image:'data:image/jpeg;base64,YQ==',user_question:'Describe what is useful.'})});assert.equal(r.status,200);assert.equal(sent.model,'JoyAI-VL-Interaction-Preview');assert.equal(sent.max_tokens,80);assert.equal(sent.messages[1].content[1].type,'image_url')}
 finally{await new Promise(resolve=>server.close(resolve))}
})
