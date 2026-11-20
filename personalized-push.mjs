import fs from 'node:fs'
import crypto from 'node:crypto'
import {baseTask,historyContext,DIRECT_PROTOCOL} from './push-prompts.mjs'
import {pushHistory} from './push-history.mjs'
const labels=JSON.parse(fs.readFileSync(new URL('./push-labels.json',import.meta.url),'utf8'))
const featureLabels={state_detail:['规格和状态细节','specifications and states'],action_focus:['当前动作','current actions'],task_focus:['当前任务','current task'],spatial_layout:['空间位置','spatial positions'],social_dynamics:['社交变化','social changes'],facility_interest:['店铺和设施','shops and facilities'],product_value:['商品和价格','products and prices'],health_attribute:['可核实的健康属性','verifiable health attributes'],aesthetic_detail:['外观和景观细节','appearance and scenery'],alternative_options:['可替代选项','alternatives'],verbosity:['描述详略','description detail'],silence_tolerance:['减少不必要打扰','less unnecessary interruption']}
const sha=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex')
const priorityAction={exact_price:['读出该商品对应的清晰价签数字','read the actual numeric price on the matching visible product label'],product_identity:['说明可见商品是什么','identify the visible product'],product_variant:['说明可核实的规格与口味','read the visible size or variant'],food_identity:['说明可见食物种类','name the visible food'],plate_layout:['说明盘中食物的相对位置','describe where the food lies on the plate'],tableware_location:['说明餐具和杯碗的位置','locate utensils and cups'],animal_nature:['介绍可见动物和自然景观','describe visible animals and natural scenery'],spatial_layout:['说明物体相对位置','describe relative object positions'],visual_style:['介绍外观和审美细节','describe appearance and decorative details']}
export function compilePreferences(session,bank,language){
 const en=language==='en-US',tr=v=>en?labels[v]||v:v,params=session.params(),lines=[],optional=bank.skills.filter(s=>s.role==='optional')
 const common=Object.entries(featureLabels).map(([k,v])=>({label:v[+en],score:(params['基础/global:'+k]||0)+(params['修正/shared/feature:'+k]||0)})).filter(v=>Math.abs(v.score)>=.04).sort((a,b)=>Math.abs(b.score)-Math.abs(a.score)).slice(0,6)
 if(common.length)lines.push((en?'General tendency: ':'一般倾向：')+common.map(v=>(v.score>0?(en?'more ':'多关注'):(en?'less ':'少关注'))+v.label).join(en?'; ':'；'))
 // Evaluate the existing three-layer PRISM utility on registered graph edges.
 // Group identical scenario rules; no model call or invented graph relation.
 const groups=new Map()
 for(const [scene,label]of Object.entries(bank.scenes)){
  if(scene==='unknown')continue
  const values=optional.filter(s=>s.scenes.includes(scene)).map(s=>({id:s.id,label:tr(s.label),score:session.score({skill:s.id,features:s.features},scene)}))
  const more=values.filter(s=>s.score>=.08).sort((a,b)=>b.score-a.score).slice(0,3).map(s=>priorityAction[s.id]?.[+en]||s.label),less=values.filter(s=>s.score<=-.08).sort((a,b)=>a.score-b.score).slice(0,3).map(s=>s.label)
  if(!more.length&&!less.length)continue
  const key=JSON.stringify({more,less});if(!groups.has(key))groups.set(key,{scenes:[],more,less});groups.get(key).scenes.push(tr(label))
 }
 for(const g of groups.values())lines.push(g.scenes.join('/')+': '+[g.more.length?(en?'priority order ':'优先顺序')+g.more.join(' > '):null,g.less.length?(en?'less detail on ':'少介绍')+g.less.join('/'):null].filter(Boolean).join('; '))
 const explicit=session.events.filter(e=>!e.revoked&&['direction','need'].includes(e.kind))
 if(explicit.length)lines.push(en?'Confirmed instructions below take precedence over learned tendencies within their stated scope; leave unrelated scenes unchanged.':'以下已确认指令在限定范围内优先于学习倾向，无关场景保持正常辅助。')
 for(const e of explicit){const skill=bank.skills.find(s=>s.id===e.skill);if(!skill)continue;const scope=e.scope==='shared'?(en?'all applicable scenes':'所有适用场景'):tr(bank.scenes[e.scope]||e.scope)
  lines.push(scope+': '+(e.kind==='direction'?(e.sign>0?(en?'more ':'多介绍'):(en?'less ':'少介绍')):(e.on?(en?'attend to ':'留意'):(en?'do not proactively attend to ':'不主动留意')))+tr(skill.label))}
 return lines.join('\n')
}
function primaryFocus(session,bank,language){
 const en=language==='en-US',tr=v=>en?labels[v]||v:v,ranked=[]
 for(const [scene,label]of Object.entries(bank.scenes)){
  if(scene==='unknown')continue
  const options=bank.skills.filter(s=>s.role==='optional'&&s.scenes.includes(scene)&&!session.events.some(e=>!e.revoked&&e.kind==='direction'&&e.skill===s.id&&e.sign<0&&[scene,'shared'].includes(e.scope))).map(s=>({skill:s,scene,label:tr(label),score:session.score({skill:s.id,features:s.features},scene)})).sort((a,b)=>b.score-a.score)
  if(options[0]?.score>=.08)ranked.push(options[0])
 }
 ranked.sort((a,b)=>b.score-a.score);const top=ranked[0];if(!top)return ''
 const scenes=ranked.filter(x=>x.skill.id===top.skill.id).map(x=>x.label),action=priorityAction[top.skill.id]?.[+en]||tr(top.skill.label)
 return en?`For THIS response: if the image is ${scenes.join(' or ')} and the relevant detail is clearly visible, ${action} before other optional descriptions. Do not merely name the general scene instead. Otherwise continue the applicable preferences and normal assistance. Necessary risks always take priority.`:`本轮重点：画面属于${scenes.join('或')}且相关细节清晰可见时，先${action}，不要只泛述场景；无法核实时按其他适用偏好正常辅助，必要风险始终优先。`
}
export function activeGoalText(session,bank,language,now){
 const en=language==='en-US',goals=session.activeGoals(now),groups=new Map()
 for(const g of goals){if(!groups.has(g.id))groups.set(g.id,[]);groups.get(g.id).push(g)}
 return [...groups.values()].map(gs=>{const g=gs[0];if(g.intent)return ({fruit:en?'Buy fruit today: when fruit or a fruit shop is clearly visible, directly name it and its visible direction. Otherwise use normal assistance.':'今天买水果：水果或水果店清晰可见时，直接说出它及可见方位；不可见时正常辅助。',apple:en?'Buy apples today: if apples are clearly visible, explicitly say apples and their direction, not just fruit. A clearly visible fruit shop is a useful lead, but does not prove apple availability. Never invent an apple.':'今天买苹果：如果清晰看见苹果，明确说“苹果”及其方位，不用笼统“水果”替代。水果店可作线索，但不代表一定卖苹果；不能编造苹果。',hospital:en?'Go to a hospital today: if a hospital name or sign is readable, directly name it and its direction, without providing routes. Otherwise use normal assistance.':'今天去医院：医院名称或标识可辨认时，直接说出它及方位，不提供路线；不可见时正常辅助。'})[g.intent]
  const skill=bank.skills.find(s=>s.id===g.skill);return (en?labels[bank.scenes[g.scope]]||g.scope:bank.scenes[g.scope])+': '+(en?labels[skill?.label]||skill?.label:skill?.label)+(g.topic?' / '+(en?({'水果':'fruit','苹果':'apples','水果店':'fruit shop','医院':'hospital'}[g.topic]||g.topic):g.topic):'')
 }).filter(Boolean).join('\n')
}
export function parseAction(raw){
 const v=typeof raw==='string'?JSON.parse(raw):raw
 if(!v||!['push','no_push'].includes(v.action)||typeof v.content!=='string')throw Error('Invalid push action')
 if(v.action==='no_push'){if(v.content.trim()||typeof v.event_key==='string'&&v.event_key.trim())throw Error('Invalid silent action');return {action:'no_push',content:'',event_key:''}}
 const content=v.content.trim().replace(/\s+/g,' ')
 if(!content||content.length>280)throw Error('Invalid spoken action')
 // The event key is an auxiliary hint, not a closed schema.
 // Some valid Chinese answers use one/two components or omit it entirely.
 const supplied=typeof v.event_key==='string'?v.event_key.trim():''
 const event_key=supplied&&supplied.length<=120&&/[\p{L}\p{N}]/u.test(supplied)?supplied:'text:'+sha(content)
 return {action:'push',content,event_key}
}
export function directPushService({bank,Session}){
 const policies=new Map(),runs=new Map()
 function prepare({account,language,context={},runId,now=Date.now(),presented=[]}){
  if(typeof runId!=='string'||!/^[-a-zA-Z0-9_]{12,80}$/.test(runId))throw Object.assign(Error('Invalid push run'),{status:400})
  let policy=policies.get(account.id)
  if(!policy||policy.profile!==account.profile||policy.language!==language){const session=Session.restore(bank,account.profile);policy={profile:account.profile,language,session,summary:compilePreferences(session,bank,language),focus:primaryFocus(session,bank,language)};policies.set(account.id,policy)}
  const goals=activeGoalText(policy.session,bank,language,now),key=sha([account.revision,language,goals,context]),id=account.id+':'+runId
  for(const [k,v]of runs)if(now-v.seen>900000)runs.delete(k)
  if(!runs.has(id)&&runs.size>=240)runs.delete(runs.keys().next().value)
  let run=runs.get(id)
  if(!run||run.key!==key){run={key,history:pushHistory(),pending:new Map(),seen:now};runs.set(id,run)}
  run.seen=now;for(const [k,v]of run.pending)if(now-v.at>15000)run.pending.delete(k)
  for(const receipt of Array.isArray(presented)?presented.slice(-8):[])ack(account.id,runId,receipt,now)
  const en=language==='en-US',segments=[baseTask(en)]
  if(policy.summary)segments.push((en?'Personal preferences (relative emphasis, not an announcement whitelist). Unless a necessary risk takes priority, use the highest-ranked relevant information that is clearly visible. Include that concrete detail rather than merely describing the general scene. If unavailable, use the next relevant detail or normal assistance:':'个人偏好（调整重点，不是允许播报的白名单）。必要风险优先；否则以清晰可见且匹配当前场景的首要偏好组织播报，直接说出该具体细节，不能只泛述场景而遗漏它；无法核实时再选后续相关信息或正常辅助：')+'\n'+policy.summary)
  if(context.taskConfirmed&&context.activity!=='review')segments.push((en?'The user explicitly confirmed this activity: ':'用户已明确确认当前任务：')+context.activity+(context.targetTags?.length?' / '+context.targetTags.join(', '):''))
  segments.push(historyContext(run.history.recent(now),en,now))
  if(policy.focus)segments.push(policy.focus)
  if(goals)segments.push((en?'For this response, active temporary goals take precedence over learned optional preferences, only when the target is visible. Necessary risks remain first; do not repeat already announced information:':'本轮有效临时目标：目标清晰可见时，优先于一般可选偏好；必要风险仍最优先，也不要重复已经播过的信息：')+'\n'+goals)
  return {protocol:DIRECT_PROTOCOL,prompt:segments.join('\n\n'),key,revision:account.revision,runId,id,run,summary:policy.summary,goals,session:policy.session,language}
 }
 function finish(prepared,raw,account,now=Date.now()){
  if(account.revision!==prepared.revision||runs.get(prepared.id)!==prepared.run||activeGoalText(prepared.session,bank,prepared.language,now)!==prepared.goals)return {action:'no_push',content:'',event_key:'',suppressed:'policy_changed'}
  const action=parseAction(raw);if(action.action==='no_push')return action
  const reason=prepared.run.history.reject(action,now);if(reason)return {action:'no_push',content:'',event_key:'',suppressed:reason}
  const receipt=crypto.randomUUID();prepared.run.pending.set(receipt,{action,at:now});while(prepared.run.pending.size>8)prepared.run.pending.delete(prepared.run.pending.keys().next().value)
  return {...action,receipt}
 }
 function ack(accountId,runId,receipt,now=Date.now()){
  const run=runs.get(accountId+':'+runId),item=run?.pending.get(receipt);if(!item||now-item.at>15000)return false
  run.pending.delete(receipt);run.history.remember(item.action,now);return true
 }
 return {prepare,finish,ack}
}
