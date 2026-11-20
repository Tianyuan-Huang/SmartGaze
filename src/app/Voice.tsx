import {useEffect,useRef,useState} from 'react'
import {Mic} from 'lucide-react'
import type {Bank,Session,Proposal} from '../shared/types'
import {microphone,wavData} from './recorder'
import {canonical} from './Commands'
import {preferenceRequest} from './chineseCommand'
import {en,lang,t,tr,say,stopSpeech} from './i18n'
type Props={data:Bank;session:Session;change:(f:()=>void)=>Promise<boolean>;notice:(s:string)=>void;frame:()=>string|undefined;paused:boolean;onBusy:(b:boolean)=>void;handsfree:boolean;setHandsfree:(b:boolean)=>void}
export default function Voice(p:Props){
 const [status,setStatus]=useState(''),[listening,setListening]=useState(false),[text,setText]=useState(''),[answer,setAnswer]=useState(''),[proposal,setProposal]=useState<Proposal|null>(null),[waiting,setWaiting]=useState(false),[recognizing,setRecognizing]=useState(false),[manual,setManual]=useState(false)
 const current=useRef(p),state=useRef({proposal}),alive=useRef(true),mic=useRef<Awaited<ReturnType<typeof microphone>>|null>(null),opening=useRef(false),finishing=useRef(false),generation=useRef(0),held=useRef(false),speaking=useRef(false),handling=useRef(false),chunks=useRef<Float32Array[]>([]),samples=useRef(0),silence=useRef(0),voiced=useRef(0),pre=useRef<Float32Array[]>([]),queue=useRef<{audio:string;auto:boolean}[]>([]),asrBusy=useRef(false),requests=useRef(new Set<AbortController>()),suppressClick=useRef(false)
 current.current=p;state.current={proposal}
 const feedbackTimer=useRef<ReturnType<typeof setTimeout>|null>(null)
 function feedback(v:string){if(feedbackTimer.current)clearTimeout(feedbackTimer.current);setStatus(v);current.current.notice(v);feedbackTimer.current=setTimeout(()=>{if(alive.current)setStatus(s=>s===v?'':s)},6500)}
 function resetClip(){chunks.current=[];samples.current=0;silence.current=0;voiced.current=0;pre.current=[]}
 function closeMic(){generation.current++;mic.current?.close();mic.current=null;held.current=false;resetClip();if(alive.current){setListening(false);setManual(false)}}
 async function confirm(){const pr=state.current.proposal;if(!pr||handling.current)return;handling.current=true;setWaiting(true);try{const ok=await current.current.change(()=>{if(current.current.session.phase==='initial')current.current.session.start();current.current.session.apply(pr)});if(alive.current){setProposal(null);const msg=ok?t('已保存，相关场景的播报会按这个偏好调整。','Saved. Assistance will adapt within this scope.'):t('没有保存成功，请重试。','Not saved. Please retry.');setAnswer('');feedback(msg);say(msg,current.current.notice)}}finally{handling.current=false;if(alive.current)setWaiting(false)}}
 async function submit(raw:string){
  const input=raw.trim(),p=current.current;if(!input||handling.current)return;stopSpeech();setText('');setStatus('');setAnswer('')
  if(state.current.proposal&&/^(确认|确认修改|是的|confirm|yes)[。.!！]?$/i.test(input)){await confirm();return}
  if(state.current.proposal&&/^(取消|cancel|no)[。.!！]?$/i.test(input)){setProposal(null);say(t('已取消，没有修改偏好。','Cancelled. Your preferences are unchanged.'),p.notice);return}
  if(/^(取消今天的目标|取消临时目标|cancel (today's |my )?(goals?|temporary goals?))[。.!！]?$/i.test(input)){const ids=[...new Set(p.session.activeGoals().map(g=>g.id))];const ok=await p.change(()=>ids.forEach(id=>p.session.revoke(id,true)));const msg=ok?t('已取消当前临时目标，长期偏好不变。','Temporary goals cancelled. Lasting preferences are unchanged.'):t('取消没有成功，请重试。','Cancellation failed. Retry.');setProposal(null);feedback(msg);say(msg,p.notice);return}
  const natural=window.PRISM.naturalIntent(input);
  if(natural||preferenceRequest(input)){
   if(natural){setProposal(natural);const msg=(en?natural.summaryEn:natural.summary)+t('请说确认或取消。',' Say confirm or cancel.');say(msg,p.notice);setStatus('');return}
   try{const pr=p.session.proposal(canonical(input,p.data));setProposal(pr);const label=tr(p.data.skills.find(s=>s.id===pr.skill)?.label||''),scope=pr.scope==='shared'?t('所有相关场景','all relevant scenes'):tr(p.data.scenes[String(pr.scene||pr.scope)]||'');say(en?label+', '+scope+'. '+(pr.op==='goal'?'For '+Number(pr.ttl)/60000+' minutes':Number(pr.sign)>0?'Increase priority':'Decrease priority')+'. Say confirm or cancel.':pr.summary+'。请说确认或取消。',p.notice);setStatus('')}
   catch(e){setProposal(null);setText(input);const msg=(e as Error).message.includes('不是可降权')?t('未保存。这项信息不能用偏好降权，请选择可调整的补充信息。','Not saved. This item cannot be lowered through preferences. Choose adjustable supplementary information.'):t('未保存。请说明场景和关注内容，例如“长期，购物时多介绍价格”。','Not saved. Specify a scene and information item, for example “Long-term: in shopping, more exact price”.');feedback(msg);say(msg,p.notice)}return
  }
  setProposal(null);handling.current=true;setWaiting(true);setStatus(t('正在回答…','Thinking…'));const c=new AbortController();requests.current.add(c);const timer=setTimeout(()=>c.abort(),24000)
  try{let r:Response|undefined;for(let i=0;i<4;i++){if(c.signal.aborted)throw Error();r=await fetch('/api/demo/interact',{method:'POST',headers:{'content-type':'application/json','x-prism-request':'1'},body:JSON.stringify({question:input.slice(0,300),image:p.frame(),language:lang}),signal:c.signal});if(r.status!==429)break;await new Promise(resolve=>setTimeout(resolve,1700))}if(!r?.ok)throw Error();const b=await r.json();if(alive.current&&!c.signal.aborted){setAnswer(b.answer);say(b.answer,p.notice);setStatus('')}}
  catch{if(alive.current)feedback(t('对话暂未成功，请重新发送。','Conversation did not complete. Please send again.'));setText(input)}
  finally{clearTimeout(timer);requests.current.delete(c);handling.current=false;if(alive.current)setWaiting(false)}
 }
 async function drain(){
  if(asrBusy.current||!queue.current.length||!alive.current)return;asrBusy.current=true;setRecognizing(true);const item=queue.current.shift()!,c=new AbortController();requests.current.add(c);const timer=setTimeout(()=>c.abort(),20000)
  try{const r=await fetch('/api/demo/asr',{method:'POST',headers:{'content-type':'application/json','x-prism-request':'1'},body:JSON.stringify({audio:item.audio,language:lang}),signal:c.signal});if(!r.ok)throw Error();const b=await r.json();if(!alive.current||c.signal.aborted)return;if(item.auto&&current.current.handsfree&&!handling.current)await submit(b.text);else {setText(b.text);setStatus(t('已转写，可修改后发送。','Transcribed. Edit or send.'))}}
  catch{if(alive.current&&!c.signal.aborted)feedback(t('转写没有成功，请重试或直接输入。','Transcription failed. Retry or type.'))}
  finally{clearTimeout(timer);requests.current.delete(c);asrBusy.current=false;if(alive.current){setRecognizing(false);void drain()}}
 }
 function finish(auto:boolean){
  if(samples.current>=3200&&(!auto||voiced.current>=3200)){if(queue.current.length<2){queue.current.push({audio:wavData(chunks.current),auto});setStatus(t('正在转写…','Transcribing…'));void drain()}else feedback(t('请稍候上一句处理完成。','Please wait for the previous message.'))}
  else if(!auto)feedback(samples.current===0?t('没有收到麦克风声音，请允许麦克风后重新按住说话。','No microphone audio received. Allow microphone access and hold to speak again.'):t('录音太短，请按住说完整的一句话。','Too short. Hold while saying a sentence.'));resetClip()
 }
 function pcm(a:Float32Array){
  if(held.current){chunks.current.push(a);samples.current+=a.length;if(samples.current>=224000&&!finishing.current)void release();return}
  if(!current.current.handsfree||speaking.current||handling.current||current.current.paused){resetClip();return}
  let power=0;for(const x of a)power+=x*x;const voicedNow=Math.sqrt(power/a.length)>.015
  if(!samples.current){pre.current.push(a);if(pre.current.length>4)pre.current.shift();if(!voicedNow)return;chunks.current=pre.current;pre.current=[];samples.current=chunks.current.reduce((n,x)=>n+x.length,0);voiced.current=a.length;return}
  chunks.current.push(a);samples.current+=a.length;if(voicedNow){voiced.current+=a.length;silence.current=0}else silence.current+=a.length
  if(silence.current>=12800||samples.current>=224000)finish(true)
 }
 async function startMic(){
  if(mic.current){void mic.current.resume().catch(()=>feedback(t('音频被系统暂停，请重新开启麦克风。','Audio was suspended. Reopen the microphone.')));return}if(opening.current||current.current.paused)return;opening.current=true;const gen=generation.current;setStatus(t('正在开启麦克风…','Opening microphone…'))
  try{const m=await microphone(pcm);if(!alive.current||gen!==generation.current||(!held.current&&!current.current.handsfree)){m.close();return}mic.current=m;setListening(true);setStatus(t('正在听…','Listening…'));for(const track of m.stream.getTracks())track.onended=()=>{closeMic();current.current.setHandsfree(false);feedback(t('麦克风已断开，请重新开启。','Microphone disconnected. Turn it on again.'))}}
  catch{if(gen!==generation.current||!alive.current)return;held.current=false;setManual(false);current.current.setHandsfree(false);feedback(t('麦克风未能开始采样，请检查权限并重新按住说话。','Microphone audio did not start. Check permission and hold to speak again.'))}
  finally{opening.current=false}
 }
 function press(){if(handling.current||finishing.current||current.current.paused)return;held.current=true;setManual(true);resetClip();stopSpeech();void startMic()}
 async function release(){if(!held.current||finishing.current)return;finishing.current=true;const gen=generation.current;try{await mic.current?.flush();if(gen!==generation.current)return;held.current=false;setManual(false);finish(false);if(!current.current.handsfree)closeMic()}finally{finishing.current=false}}
 useEffect(()=>{alive.current=true;const speech=(e:Event)=>{speaking.current=!!(e as CustomEvent).detail;if(speaking.current&&!held.current)resetClip()},hidden=()=>{if(document.hidden){closeMic();queue.current=[];requests.current.forEach(c=>c.abort());current.current.setHandsfree(false);stopSpeech()}};window.addEventListener('prism-speaking',speech);document.addEventListener('visibilitychange',hidden);return()=>{alive.current=false;if(feedbackTimer.current)clearTimeout(feedbackTimer.current);closeMic();queue.current=[];requests.current.forEach(c=>c.abort());window.removeEventListener('prism-speaking',speech);document.removeEventListener('visibilitychange',hidden);stopSpeech()}},[])
 useEffect(()=>{if(p.handsfree)void startMic();else if(!held.current)closeMic()},[p.handsfree])
 useEffect(()=>{if(p.paused){closeMic();queue.current=[];requests.current.forEach(c=>c.abort());p.setHandsfree(false)}},[p.paused])
 useEffect(()=>{p.onBusy(waiting||manual)},[waiting,manual])
 return <div className="voice-direct"><div className="voice-feedback" role="status" aria-live="polite">{status}{answer&&<p>{answer}</p>}</div>
 {proposal&&<div className="voice-inline"><p>{proposal.op==='intent_goal'?(en?proposal.summaryEn:proposal.summary):en?tr(p.data.skills.find(s=>s.id===proposal.skill)?.label||'')+' · '+(proposal.scope==='shared'?'All relevant scenes':tr(p.data.scenes[String(proposal.scene||proposal.scope)]||''))+' · '+(proposal.op==='goal'?Number(proposal.ttl)/60000+' min':Number(proposal.sign)>0?'More':'Less'):proposal.summary}</p><button disabled={waiting} onClick={()=>void confirm()}>{t('确认修改','Confirm change')}</button><button onClick={()=>setProposal(null)}>{t('取消','Cancel')}</button></div>}
 <form className="voice-text" onSubmit={e=>{e.preventDefault();void submit(text)}}><input aria-label={t('说话内容','Message')} placeholder={t('按住说话，或输入文字','Hold to talk, or type')} maxLength={300} value={text} onChange={e=>setText(e.target.value)}/><button disabled={waiting||recognizing||!text.trim()}>{t('发送','Send')}</button></form>
 <button className="push-to-talk" disabled={waiting||p.paused} onContextMenu={e=>e.preventDefault()} onPointerDown={e=>{if(e.button!==0)return;try{e.currentTarget.setPointerCapture(e.pointerId)}catch{/* Some WebKit versions release capture during a permission sheet. */}suppressClick.current=true;press()}} onPointerUp={()=>void release()} onPointerCancel={()=>{held.current=false;setManual(false);resetClip();if(!current.current.handsfree)closeMic()}} onClick={()=>{if(suppressClick.current){suppressClick.current=false;return}if(held.current)void release();else press()}}><span className="push-to-talk-icon"><Mic/></span><strong>{manual?(listening?t('正在录音 · 松开转文字','Recording · release to transcribe'):t('正在开启麦克风…','Opening microphone…')):recognizing?t('正在转写…','Transcribing…'):t('按住说话','Hold to talk')}</strong><span className="push-to-talk-wave" data-listening={listening}><i/><i/><i/><i/></span></button>
 <details className="voice-help"><summary>{t('可以这样说','Try saying')}</summary><p>{t('“我今天想买点水果”“我想去买点苹果”“我今天想去医院”。确认后会留意画面中的相关目标，今天结束自动停止。说“取消今天的目标”即可撤销。','“I want to buy some fruit today.” “I want to buy apples.” “I need to go to a hospital.” Confirm to watch for visible targets until midnight. Say “Cancel my goals” to stop.')}</p><p>{t('长期偏好例如：“长期：在用餐场景，多介绍餐盘分布”。也可以问“眼前有什么”。普通问答不改变偏好。','For lasting preferences: “Long-term: in dining, more plate layout.” You can also ask “What is in front of me?” Questions do not change preferences.')}</p></details></div>
}
