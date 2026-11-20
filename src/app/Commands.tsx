import {useEffect,useState} from 'react'
import type {Bank,Session,Proposal} from '../shared/types'
import {normalizeCommandText} from '../shared/commandText'
import {chineseCommand} from './chineseCommand'
import {en,t,tr} from './i18n'
export function canonical(text:string,data:Bank){
 if(typeof window!=='undefined'&&window.PRISM?.naturalIntent(text))return text;
 const chinese=chineseCommand(text,data);if(chinese)return chinese
 if(!en)return normalizeCommandText(text)
 const m=text.trim().match(/^(long[ -]term|temporary)\s*:?\s*in\s+(.+?)(?:,\s*|\s+)(more|less|enable|disable|focus on)\s+(.+?)(?:,?\s+for\s+(\d+)\s*minutes?)?\.?$/i)
 if(!m)throw Error('Use an example or the command builder to specify a scope.')
 const scene=m[2].toLowerCase()==='all relevant scenes'?'shared':Object.keys(data.scenes).find(s=>s===m[2].toLowerCase()||tr(data.scenes[s]).toLowerCase()===m[2].toLowerCase())
 const [item,rawTopic='']=m[4].split(/\s+matching\s+/i),topic=rawTopic.trim().toLowerCase()
 const s=data.skills.find(s=>s.id.replace(/_/g,' ')===item.toLowerCase()||tr(s.label).toLowerCase()===item.toLowerCase())
 if(!scene||!s)throw Error('Choose a listed scene and information item.')
 const scope=scene==='shared'?'所有适用':data.scenes[scene]
 if(m[1].toLowerCase()==='temporary'){if(!m[5]||m[3].toLowerCase()!=='focus on')throw Error('Include a duration and use “focus on”.');return `临时：在${scope}场景，关注${s.label}${topic?'中的'+topic:''}，持续${m[5]}分钟`}
 if(topic)throw Error('Use matching only with a temporary goal.')
 if(m[5])throw Error('Use Temporary for a timed goal.')
 const verb:Record<string,string>={more:'多介绍',less:'少介绍',enable:'留意',disable:'不自动留意'};if(!verb[m[3].toLowerCase()])throw Error('Choose more, less, enable, or disable.')
 return `长期：在${scope}场景，${verb[m[3].toLowerCase()]}${s.label}`
}
export default function Commands({data,session,change,notice}:{data:Bank;session:Session;change:(f:()=>void)=>void;notice:(s:string)=>void}){
 const [text,setText]=useState(''),[proposal,setProposal]=useState<Proposal|null>(null),[clock,setClock]=useState(Date.now())
 const [kind,setKind]=useState('long'),[scene,setScene]=useState('dining'),[skill,setSkill]=useState('plate_layout'),[verb,setVerb]=useState('more'),[minutes,setMinutes]=useState(10)
 useEffect(()=>{const id=setInterval(()=>setClock(Date.now()),1000);return()=>clearInterval(id)},[])
 function edit(v:string){setText(v);setProposal(null)}

 const skills=data.skills.filter(s=>(scene==='shared'||s.scenes.includes(scene))&&(kind==='need'?s.role==='task':kind==='temp'?['optional','task'].includes(s.role):s.role==='optional')),s=skills.find(s=>s.id===skill)||skills[0]
 function generate(){if(!s)return;const scope=scene==='shared'?t('所有适用','all relevant scenes'):en?scene:data.scenes[scene];edit(en?`${kind==='temp'?'Temporary':'Long-term'}: in ${scope}, ${kind==='temp'?'focus on':kind==='need'?(verb==='more'?'enable':'disable'):verb} ${tr(s.label)}${kind==='temp'?`, for ${minutes} minutes`:''}`:`${kind==='temp'?'临时':'长期'}：在${scope}场景，${kind==='temp'?'关注':kind==='need'?(verb==='more'?'留意':'不自动留意'):verb==='more'?'多介绍':'少介绍'}${s.label}${kind==='temp'?`，持续${minutes}分钟`:''}`)}
 const examples=en?['I want to buy some fruit today','I want to buy apples','I need to go to a hospital','Long-term: in dining, more plate layout']:['我今天想买点水果','我想去买点苹果','我今天想去医院','长期：在用餐场景，多介绍餐盘分布']
 return <section><h2>{t('告诉我你的偏好','Tell me what matters')}</h2><label className="sr-only" htmlFor="command">{t('偏好指令','Preference command')}</label><textarea id="command" value={text} rows={3} maxLength={240} placeholder={examples[0]} onChange={e=>edit(e.target.value)}/><div className="row"><button className="primary" disabled={!text.trim()} onClick={()=>{try{setProposal(session.proposal(canonical(text,data)))}catch(e){notice(en?'Could not parse the command. Check the example format.':(e as Error).message)}}}>{t('预览修改','Preview change')}</button></div>
 {proposal&&<div className="confirmation"><h3>{t('确认后生效','Confirm to apply')}</h3>{proposal.op==='intent_goal'?<p>{en?proposal.summaryEn:proposal.summary}</p>:<><p>{tr(data.skills.find(s=>s.id===proposal.skill)?.label||'')} · {proposal.scope==='shared'?t('所有相关场景','All relevant scenes'):tr(data.scenes[String(proposal.scene||proposal.scope)]||'')}</p><p>{en?(proposal.op==='goal'?`Temporary, ${Number(proposal.ttl)/60000||minutes} minutes`:proposal.op==='need'?'Update task attention':Number(proposal.sign)>0?'Increase priority':'Decrease priority'):proposal.summary}</p></>}<button className="primary" onClick={()=>{change(()=>{if(session.phase==='initial')session.start();session.apply(proposal)});setProposal(null);setText('')}}>{t('确认','Confirm')}</button><button onClick={()=>setProposal(null)}>{t('取消','Cancel')}</button></div>}
 <details><summary>{t('例句与指令生成','Examples and command builder')}</summary>{examples.map(v=><button className="example" key={v} onClick={()=>edit(v)}>{v}</button>)}<label>{t('类型','Type')}<select value={kind} onChange={e=>{setKind(e.target.value);if(e.target.value==='temp')setScene('shopping')}}><option value="long">{t('长期偏好','Long-term preference')}</option><option value="need">{t('任务关注','Task attention')}</option><option value="temp">{t('临时目标','Temporary goal')}</option></select></label><label>{t('场景','Scene')}<select value={scene} onChange={e=>setScene(e.target.value)}>{kind!=='temp'&&<option value="shared">{t('所有相关场景','All relevant scenes')}</option>}{Object.entries(data.scenes).filter(([id])=>id!=='unknown').map(([id,label])=><option key={id} value={id}>{tr(label)}</option>)}</select></label><label>{t('关注项','Information item')}<select value={s?.id||''} onChange={e=>setSkill(e.target.value)}>{skills.map(s=><option key={s.id} value={s.id}>{tr(s.label)}</option>)}</select></label>{kind==='temp'?<label>{t('分钟','Minutes')}<input type="number" min={1} max={1440} value={minutes} onChange={e=>setMinutes(Number(e.target.value))}/></label>:<label>{t('方向','Direction')}<select value={verb} onChange={e=>setVerb(e.target.value)}><option value="more">{t('更多 / 开启','More / enable')}</option><option value="less">{t('更少 / 关闭','Less / disable')}</option></select></label>}<button onClick={generate}>{t('生成','Build command')}</button></details>
 <h3>{t('生效中的调整','Active changes')}</h3>{session.events.filter(e=>!e.revoked&&(['direction','need'].includes(e.kind)||['goal','intent_goal'].includes(e.kind)&&(e.expires||0)>clock)).map(e=><div className="change-row" key={e.id}><span>{e.kind==='intent_goal'?({fruit:t('今天买水果','Buy fruit today'),apple:t('今天买苹果','Buy apples today'),hospital:t('今天去医院','Go to a hospital today')}[e.intent||'']):tr(data.skills.find(s=>s.id===e.skill)?.label||'')+' · '+(e.scope==='shared'?t('全部相关场景','All relevant scenes'):tr(data.scenes[e.scope]||e.scope))}{['goal','intent_goal'].includes(e.kind)?` · ${Math.ceil(((e.expires||clock)-clock)/60000)} ${t('分钟','min')}`:''}</span><button onClick={()=>change(()=>session.revoke(e.id,true))}>{t('撤销','Revoke')}</button></div>)}</section>
}
