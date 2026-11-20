(function(root){'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
const assert=(c,m)=>{if(!c)throw Error(m)};
const dot=(a,b)=>Object.keys(a).reduce((s,k)=>s+a[k]*(b[k]||0),0);
const add=(a,b,scale=1)=>{const r={...a};for(const k in b)r[k]=(r[k]||0)+scale*b[k];return Object.fromEntries(Object.entries(r).filter(([,v])=>v!==0))};
const sigmoid=z=>1/(1+Math.exp(-Math.max(-35,Math.min(35,z))));
// Finite semantic aliases, not substring matching: Apple phones are not apples.
const topicAliases={水果:['水果','fruit','fruits','苹果','apple','apples','香蕉','banana','bananas','梨','pear','pears','橙子','orange','oranges','葡萄','grape','grapes'],苹果:['苹果','apple','apples'],水果店:['水果店','水果摊','水果专卖店','fruit shop','fruit store','fruit stall'],医院:['医院','hospital','hospitals']};
const topicMatch=(topic,tags)=>{const names=topicAliases[topic]||[topic.toLowerCase()];return tags.some(t=>typeof t==='string'&&names.includes(t.trim().toLowerCase()))};
function naturalIntent(text,t=Date.now()){
 const raw=text.trim().replace(/[。.!！]$/,'');
 const likely=/^(?:我|今天|现在|这次|帮我|请|i\b|today\b)/i.test(raw)&&/(?:想|要|买|找|去|want|need|buy|looking|going)/i.test(raw);
 if(!likely)return null;
 if(/[?？]|不想|不要|不去|没想|昨天|明天|如果|假如|还是|或者|don't|do not|yesterday|tomorrow|\bor\b/i.test(raw))return null;
 let m=raw.match(/^(?:我)?(?:今天|现在|这次)?(?:想要|想|要|打算|准备)?(?:去)?(?:买|购买)(?:一下|下|一些|一点|点)?(水果|苹果)(?:吧)?$/);
 let type=m?(m[1]==='苹果'?'apple':'fruit'):null;
 if(/^(?:我)?(?:今天|现在|这次)?(?:想要|想|要|打算|准备)?(?:去|到|找)(?:一下|下|一家|附近的)?医院(?:去)?$/.test(raw))type='hospital';
 if(/^(?:i\s+)?(?:want|need|would like)(?:\s+to)?\s+(?:go\s+(?:and\s+)?)?buy\s+(?:some\s+)?(fruit|apples?)(?:\s+today)?$/i.test(raw))type=/apples?/i.test(raw)?'apple':'fruit';
 if(/^(?:i\s+)?(?:want|need|would like)(?:\s+to)?\s+(?:go\s+to|find)\s+(?:a\s+|the\s+)?hospital(?:\s+today)?$/i.test(raw))type='hospital';
 if(!type)return null;
 const end=new Date(t);end.setHours(24,0,0,0);
 const label=type==='fruit'?'买水果':type==='apple'?'买苹果':'去医院',titleEn=type==='fruit'?'Buy fruit':type==='apple'?'Buy apples':'Go to a hospital';
 return {op:'intent_goal',intent:type,title:label,titleEn,expiresAt:end.getTime(),summary:`今天${label}：${type==='hospital'?'留意画面中可辨认的医院名称或标识，不提供路线或医疗建议':type==='apple'?'留意可见的苹果和水果店；水果店不代表一定有苹果出售':'留意可见的水果和水果店'}。今天结束自动停止，不修改长期偏好。`,summaryEn:`${titleEn} today. ${type==='hospital'?'Look for visible hospital names or signs; no navigation or medical advice.':type==='apple'?'Watch for visible apples and fruit shops; a shop does not prove apple availability.':'Watch for visible fruit and fruit shops.'} Ends at local midnight; lasting preferences stay unchanged.`};
}
function inverse(a){const n=a.length,m=a.map((r,i)=>[...r,...Array.from({length:n},(_,j)=>+(i===j))]);for(let i=0;i<n;i++){let p=i;for(let j=i+1;j<n;j++)if(Math.abs(m[j][i])>Math.abs(m[p][i]))p=j;assert(Math.abs(m[p][i])>1e-12,'后验矩阵不可逆');[m[i],m[p]]=[m[p],m[i]];const v=m[i][i];for(let k=0;k<2*n;k++)m[i][k]/=v;for(let j=0;j<n;j++)if(j!==i){const z=m[j][i];for(let k=0;k<2*n;k++)m[j][k]-=z*m[i][k]}}return m.map(r=>r.slice(n))}
const prior=k=>(k.startsWith('global:')||k.startsWith('feature:'))?0.3:k.startsWith('local:')?0.7:k.startsWith('shared:')?2:4;
function fit(events){
 const keys=[...new Set(events.flatMap(e=>Object.keys(e.row)))].sort(),n=keys.length;
 if(!n)return {mean:{},keys:[],cov:[],observations:0};
 const x=events.map(e=>keys.map(k=>e.row[k]||0)),offsets=events.map(e=>e.offset||0),precision=keys.map(k=>1/prior(k));let w=Array(n).fill(0);
 const loss=v=>x.reduce((s,r,i)=>{const z=offsets[i]+r.reduce((a,b,j)=>a+b*v[j],0);return s+Math.max(-z,0)+Math.log1p(Math.exp(-Math.abs(z)))},0)+v.reduce((s,z,i)=>s+.5*precision[i]*z*z,0);
 function hessian(v){const p=x.map((r,i)=>sigmoid(offsets[i]+r.reduce((a,b,j)=>a+b*v[j],0)));return {p,h:keys.map((_,j)=>keys.map((_,k)=>(j===k?precision[j]:0)+x.reduce((s,r,i)=>s+p[i]*(1-p[i])*r[j]*r[k],0)))}}
 for(let it=0;it<80;it++){const {p,h}=hessian(w),inv=inverse(h),g=keys.map((_,j)=>x.reduce((s,r,i)=>s+r[j]*(1-p[i]),0)-precision[j]*w[j]),step=inv.map(r=>r.reduce((s,a,j)=>s+a*g[j],0));let rate=1;while(rate>1e-9&&loss(w.map((v,j)=>v+rate*step[j]))>loss(w)+1e-12)rate*=.5;w=w.map((v,j)=>v+rate*step[j]);if(Math.sqrt(step.reduce((s,v)=>s+(rate*v)**2,0))<1e-9)break}
 return {mean:Object.fromEntries(keys.map((k,i)=>[k,w[i]])),keys,cov:inverse(hessian(w).h),observations:events.length};
}
function variance(p,row){let total=0;const ix=new Map(p.keys.map((k,i)=>[k,i]));for(const [k,v]of Object.entries(row)){if(!ix.has(k)){total+=v*v*prior(k);continue}for(const [l,u]of Object.entries(row))if(ix.has(l))total+=v*u*p.cov[ix.get(k)][ix.get(l)]}return Math.max(0,total)}
class Session{
 constructor(data,id='mine'){this.data=data;this.id=id;this.skills=Object.fromEntries(data.skills.map(s=>[s.id,s]));this.questions=Object.fromEntries(data.questions.map(q=>[q.id,q]));this.phase='initial';this.events=[];this.actions=[];this.serial=0;this.rebuild()}
 now(t){assert(Number.isFinite(t)&&t>=0,'时间无效');return t}
 legal(scene,skill){return this.skills[skill]?.scenes.includes(scene)}
 encode(o,scene,initial=false){assert(this.legal(scene,o.skill),'没有合法场景关联');let r={};for(const [f,v] of Object.entries(o.features||{})){assert(this.data.features.includes(f)&&Number.isFinite(v),'非法特征');r[(initial?'global:':'feature:')+f]=v}r[(initial?'shared:':'skill:')+o.skill]=1;if(initial)r['local:'+scene+':'+o.skill]=1;return r}
 rebuild(){this.base=fit(this.events.filter(e=>!e.revoked&&e.kind==='initial_pair'));this.corrections={};for(const scope of ['shared',...Object.keys(this.data.scenes)]){const e=this.events.filter(e=>!e.revoked&&['online_pair','direction'].includes(e.kind)&&e.scope===scope);if(e.length)this.corrections[scope]=fit(e)}}
 score(o,scene){const x=this.encode(o,scene,true),z=this.encode(o,scene,false);return dot(x,this.base.mean)+dot(z,this.corrections.shared?.mean||{})+dot(z,this.corrections[scene]?.mean||{})}
 params(){const p={};for(const [k,v]of Object.entries(this.base.mean))p['基础/'+k]=v;for(const [s,b]of Object.entries(this.corrections))for(const[k,v]of Object.entries(b.mean))p['修正/'+s+'/'+k]=v;return p}
 record(kind,scope,input,row={},offset=0,t=Date.now()){this.now(t);const e={id:this.id+'-'+(++this.serial),kind,scope,...clone(input),row,offset,time:t,revoked:false};this.events.push(e);return e}
 start(t=Date.now()){this.now(t);assert(this.phase==='initial','已进入使用阶段');this.phase='assistance';this.actions.push({op:'start',t});return this.phase}
 answer(qid,choice,scope,confirmed,t=Date.now()){
  this.now(t);const q=this.questions[qid];assert(q,'题目不存在');assert(confirmed,'请确认本次更新范围');assert(['A','B','BOTH','NEITHER','SKIP'].includes(choice),'不支持的选项');
  const initial=this.phase==='initial';assert(initial?scope==='foundation':[q.scene,'shared'].includes(scope),'回答范围不匹配');
  // Replacement is scoped; a frozen foundation cannot be rewritten from the online page.
  for(const e of this.events)if(!e.revoked&&e.qid===qid&&e.scope===scope&&['initial_pair','online_pair','response'].includes(e.kind))e.revoked=true;
  this.rebuild();let row={},offset=0;
  if(['A','B'].includes(choice)){const other=choice==='A'?'B':'A';row=add(this.encode(q.options[choice],q.scene,initial),this.encode(q.options[other],q.scene,initial),-1);assert(Object.keys(row).length,'两选项无可学习差分');if(!initial){const baseDiff=add(this.encode(q.options[choice],q.scene,true),this.encode(q.options[other],q.scene,true),-1);offset=dot(baseDiff,this.base.mean)+dot(row,this.corrections[scope==='shared'?q.scene:'shared']?.mean||{})}}
  const e=this.record(['A','B'].includes(choice)?(initial?'initial_pair':'online_pair'):'response',scope,{qid,choice,source:this.id.startsWith('demo_')?'author_demo_choice':'explicit_choice',scene:q.scene},row,offset,t);this.rebuild();this.actions.push({op:'answer',qid,choice,scope,confirmed:true,t});return e;
 }
 direction(skill,sign,scope,confirmed,t=Date.now()){
  this.now(t);assert(this.phase==='assistance','请先结束或跳过首次校准');assert(confirmed,'请确认长期范围');assert(this.skills[skill]?.role==='optional','该节点不接受偏好降权；请使用需求开关或保护机制');assert(sign===1||sign===-1,'方向无效');assert(scope==='shared'||this.legal(scope,skill),'范围不支持该Skill');
  for(const e of this.events)if(e.kind==='direction'&&e.skill===skill&&e.scope===scope&&!e.revoked)e.revoked=true;
  const e=this.record('direction',scope,{skill,sign,source:'directional_constraint_not_AB'},{['skill:'+skill]:sign},0,t);this.rebuild();this.actions.push({op:'direction',skill,sign,scope,confirmed:true,t});return e;
 }
 need(skill,on,scope,confirmed,t=Date.now()){
  this.now(t);assert(this.phase==='assistance','请先结束或跳过首次校准');assert(confirmed,'请确认需求范围');assert(this.skills[skill]?.role==='task','只能设置明确任务需求');assert(typeof on==='boolean','需求开关无效');assert(scope==='shared'||this.legal(scope,skill),'需求范围无效');
  for(const e of this.events)if(e.kind==='need'&&e.skill===skill&&e.scope===scope&&!e.revoked)e.revoked=true;
  const e=this.record('need',scope,{skill,on,source:'explicit_need_not_BT'}, {},0,t);this.actions.push({op:'need',skill,on,scope,confirmed:true,t});return e;
 }
 needOn(skill,scene){const local=this.events.filter(e=>e.kind==='need'&&!e.revoked&&e.skill===skill&&e.scope===scene).at(-1),shared=this.events.filter(e=>e.kind==='need'&&!e.revoked&&e.skill===skill&&e.scope==='shared').at(-1);return !!(local||shared)?.on}
 goal(skill,scene,topic,ttl,confirmed,t=Date.now()){
  this.now(t);assert(this.phase==='assistance','请先结束或跳过首次校准');assert(confirmed,'请确认临时目标及期限');assert(this.legal(scene,skill)&&['optional','task'].includes(this.skills[skill].role),'该节点不能设置目标');assert(typeof topic==='string'&&topic.trim().length<=30,'目标须为0至30字的明确名称');assert(Number.isFinite(ttl)&&ttl>=1000&&ttl<=86400000,'有效期须在1秒至24小时内');
  const e=this.record('goal',scene,{skill,topic:topic.trim(),expires:t+ttl,source:'temporary_goal_not_BT'}, {},0,t);this.actions.push({op:'goal',skill,scene,topic:topic.trim(),ttl,confirmed:true,t});return e;
 }
 revoke(id,confirmed,t=Date.now()){this.now(t);assert(confirmed,'请确认撤销');const e=this.events.find(e=>e.id===id);assert(e&&!e.revoked,'记录不存在或已经撤销');assert(!(e.kind==='initial_pair'&&this.phase==='assistance'),'初始基础已冻结；如需重建请新建画像，旧画像仍保留');e.revoked=true;this.rebuild();this.actions.push({op:'revoke',id,confirmed:true,t});return e}
 intentGoal(intent,expiresAt,confirmed,t=Date.now()){
  assert(this.phase==='assistance'&&confirmed,'请确认本次目标');assert(['fruit','apple','hospital'].includes(intent),'目标暂不支持');assert(Number.isFinite(expiresAt)&&expiresAt-t>=1000&&expiresAt-t<=86400000,'目标已过期或期限无效');
  const targets=[],addTarget=(skill,scene,topic)=>{if(this.legal(scene,skill))targets.push({skill,scope:scene,topic})};
  for(const scene of ['mobility','transit','shopping','indoor',...(intent==='hospital'?['healthcare']:[])]){
   const place=intent==='hospital'?'医院':'水果店';addTarget('route_landmark',scene,place);addTarget('requested_object',scene,place);
  }
  if(intent!=='hospital'){const topic=intent==='apple'?'苹果':'水果';addTarget('product_identity','shopping',topic);addTarget('requested_object','shopping',topic)}
  for(const e of this.events)if(e.kind==='intent_goal'&&e.intent===intent&&!e.revoked)e.revoked=true;
  const e=this.record('intent_goal','scoped',{intent,targets,expires:expiresAt,source:'confirmed_natural_goal_not_BT'}, {},0,t);this.actions.push({op:'intent_goal',intent,expiresAt,confirmed:true,t});return e;
 }
 activeGoals(t=Date.now()){this.now(t);return this.events.filter(e=>['goal','intent_goal'].includes(e.kind)&&!e.revoked&&e.time<=t&&e.expires>t).flatMap(e=>e.kind==='goal'?[e]:e.targets.map(target=>({...e,...target,kind:'goal'})))}
 select(fixture,{now=Date.now(),budget=1,privateAuthorized=false,directSkills=[],lastSpoken={},cooldown=24000}={}){
  this.now(now);assert(Number.isInteger(budget)&&budget>=0&&budget<=5,'补充信息预算为0至5');assert(fixture&&Object.hasOwn(this.data.scenes,fixture.scene)&&Array.isArray(fixture.facts),'事实包无效');
  const mandatory=[],optional=[],blocked=[],goals=this.activeGoals(now);let seen=new Set();
  for(const f of fixture.facts){const s=this.skills[f.skill],reason=!s?'未知Skill':seen.has(f.id)?'重复事实ID':!this.legal(fixture.scene,f.skill)?'没有合法边':['disabled','temporal','privacy'].includes(s.role)?'能力禁用或隐私门控':!f.evidence||!Number.isFinite(f.confidence)||f.confidence<.8?'证据不足':f.private&&!privateAuthorized?'没有私密内容授权':null;seen.add(f.id);if(reason){blocked.push({id:f.id,reason});continue}
   const direct=directSkills.includes(f.skill),needSpec=this.data.needs.find(n=>n.skill===f.skill),activity=f.activity===fixture.activity;
   const match=goals.filter(g=>g.scope===fixture.scene&&g.skill===f.skill&&(!g.topic||topicMatch(g.topic,f.tags||[]))),explicitTarget=match.some(g=>!!g.topic);
   if(s.role==='task'&&!explicitTarget&&(!fixture.taskConfirmed||(needSpec?.requires_target&&!(fixture.targetTags||[]).some(t=>(f.tags||[]).includes(t))))){blocked.push({id:f.id,reason:'当前任务或目标对应关系未确认'});continue}
   if(!f.required&&!direct&&!explicitTarget&&(!activity||(s.role==='task'&&needSpec?.activity!==fixture.activity))){blocked.push({id:f.id,reason:'活动不匹配'});continue}
   const required=f.required||s.role==='safety'||direct;
   if(s.role==='task'&&!required&&!this.needOn(f.skill,fixture.scene)&&!match.length){blocked.push({id:f.id,reason:'尚未开启相关需求'});continue}
   const score=this.score(f,fixture.scene),bonus=match.length?3:0,r={...f,score,bonus,total:score+bonus,reason:required?'必要／明确请求':s.role==='task'?'已开启且活动相关的需求':bonus?'有效临时目标与事实标签匹配':'图偏好排序'};
   if(required){mandatory.push(r);continue}
   if(now-(lastSpoken[f.id]??-Infinity)<cooldown){blocked.push({id:f.id,reason:'重复播报冷却'});continue}
   optional.push(r);
  }
  optional.sort((a,b)=>(+(b.bonus>0)-+(a.bonus>0))||(+ (this.skills[b.skill].role==='task')-+(this.skills[a.skill].role==='task'))||(b.total-a.total)||a.id.localeCompare(b.id));
  return {mandatory,ranked:optional,selected:[...mandatory,...optional.slice(0,budget)],blocked};
 }
 next(scene){const answered=new Set(this.events.filter(e=>!e.revoked&&e.qid).map(e=>e.qid)),covered=new Set(this.events.filter(e=>!e.revoked&&['initial_pair','online_pair'].includes(e.kind)).flatMap(e=>Object.values(this.questions[e.qid].options).map(o=>this.questions[e.qid].scene+'/'+o.skill)));
  return this.data.questions.filter(q=>(!scene||q.scene===scene)&&!answered.has(q.id)).map(q=>{const initial=this.phase==='initial',row=add(this.encode(q.options.A,q.scene,initial),this.encode(q.options.B,q.scene,initial),-1),p=initial?this.base:(this.corrections[q.scene]||fit([])),prob=sigmoid(this.score(q.options.A,q.scene)-this.score(q.options.B,q.scene));return{q,coverage:Object.values(q.options).filter(o=>!covered.has(q.scene+'/'+o.skill)).length,informationProxy:Math.log1p(prob*(1-prob)*variance(p,row))/2}}).sort((a,b)=>b.coverage-a.coverage||b.informationProxy-a.informationProxy||a.q.id.localeCompare(b.q.id))[0]||null;
 }
 proposal(text,t=Date.now()){
  this.now(t);assert(typeof text==='string'&&text.length<=180,'指令过长或无效');text=text.trim().replace(/[。！]$/,'').replace(/:/g,'：').replace(/,/g,'，');
  const natural=naturalIntent(text,t);if(natural)return natural;
  const sceneId=n=>n==='所有适用'?'shared':Object.keys(this.data.scenes).find(k=>this.data.scenes[k]===n);
  if(text==='今天买水果'){const end=new Date(t);end.setHours(24,0,0,0);return{op:'goal',skill:'product_identity',scene:'shopping',topic:'水果',ttl:end.getTime()-t,expiresAt:end.getTime(),summary:'购物场景关注已核验为水果的商品；至本机今天结束，不修改长期偏好。'}}
  let m=text.match(/^长期：在(.+)场景，(多介绍|少介绍|留意|不自动留意)(.+)$/);
  if(m){const scope=sceneId(m[1]),s=this.data.skills.find(s=>s.label===m[3]||s.id===m[3]);assert(scope&&s,'请使用页面列出的完整场景名和Skill名称');assert(scope==='shared'||this.legal(scope,s.id),'该场景与Skill没有合法关联');if(['多介绍','少介绍'].includes(m[2])){assert(s.role==='optional','该项不是可降权的补充信息，请用需求开关');return{op:'direction',skill:s.id,sign:m[2]==='多介绍'?1:-1,scope,summary:`长期${scope==='shared'?'共享':this.data.scenes[scope]}修正：${m[2]}${s.label}；只改排序，不创造事实。`}}
   assert(s.role==='task','留意开关仅用于任务类Skill');return{op:'need',skill:s.id,on:m[2]==='留意',scope,summary:`${scope==='shared'?'相关场景':this.data.scenes[scope]}：${m[2]}${s.label}；仍须匹配当前活动。`};}
  m=text.match(/^临时：在(.+)场景，关注(.+?)(?:中的(.+?))?，持续([1-9][0-9]*)(秒|分钟)$/);
  if(m){const scene=sceneId(m[1]),s=this.data.skills.find(s=>s.label===m[2]||s.id===m[2]),ttl=Number(m[4])*(m[5]==='秒'?1000:60000);assert(scene&&scene!=='shared'&&s&&this.legal(scene,s.id),'请提供合法的单一场景和Skill');assert(['optional','task'].includes(s.role)&&ttl<=86400000,'目标范围或期限不支持');return{op:'goal',skill:s.id,scene,topic:m[3]||'',ttl,summary:`临时${this.data.scenes[scene]}目标：${s.label}${m[3]?'／'+m[3]:''}，${m[4]}${m[5]}；期限从确认开始。`}}
  throw Error('未写入：指令含糊或不在支持语法中。请选择下方场景、Skill和期限生成明确指令。');
 }
 apply(p,t=Date.now()){assert(p&&['direction','need','goal','intent_goal'].includes(p.op),'无效指令');if(p.op==='intent_goal')return this.intentGoal(p.intent,p.expiresAt,true,t);if(p.op==='direction')return this.direction(p.skill,p.sign,p.scope,true,t);if(p.op==='need')return this.need(p.skill,p.on,p.scope,true,t);const ttl=p.expiresAt!==undefined?p.expiresAt-t:p.ttl;assert(ttl>=1000,'目标已过期或临近到期，请重新说明期限');return this.goal(p.skill,p.scene,p.topic,ttl,true,t)}
 export(){return{version:this.data.version,graphHash:this.data.graphHash,bankHash:this.data.bankHash,id:this.id,actions:clone(this.actions)}}
 static restore(data,p){assert(p?.version===data.version&&p.graphHash===data.graphHash&&p.bankHash===data.bankHash,'版本不匹配：旧题证据已隔离，不能自动套用新图');assert(typeof p.id==='string'&&p.id.length<=80&&Array.isArray(p.actions)&&p.actions.length<=500,'画像格式或规模无效');const s=new Session(data,p.id);for(const a of p.actions){assert(a&&Number.isFinite(a.t),'事件时间无效');switch(a.op){case'start':s.start(a.t);break;case'answer':s.answer(a.qid,a.choice,a.scope,a.confirmed,a.t);break;case'direction':s.direction(a.skill,a.sign,a.scope,a.confirmed,a.t);break;case'need':s.need(a.skill,a.on,a.scope,a.confirmed,a.t);break;case'goal':s.goal(a.skill,a.scene,a.topic,a.ttl,a.confirmed,a.t);break;case'intent_goal':s.intentGoal(a.intent,a.expiresAt,a.confirmed,a.t);break;case'revoke':s.revoke(a.id,a.confirmed,a.t);break;default:throw Error('未知画像事件')}}return s}
}
const api={Session,fit,variance,add,dot,prior,naturalIntent,topicMatch};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.PRISM=api;
})(typeof globalThis!=='undefined'?globalThis:this);
