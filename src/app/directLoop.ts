import type {Session} from '../shared/types'
import type {Context} from './Activity'
import type {PushState} from './pushState'
import {capture} from '../shared/media'
import {cameraProbe,frameFreshness,hasVisualDetail} from './freshness'
import {pushHistory,type Announcement} from '../../push-history.mjs'
import {lang,t,say,appSpeaking} from './i18n'
import {pushBody} from './pushBody'

type Current={session:Session;revision:number;audio:boolean;paused:boolean;context:Context;pending:boolean}
type Options={video:()=>HTMLVideoElement|null;current:()=>Current;runId:string;valid:()=>boolean;flight:{current:boolean};controller:{current:AbortController|null};state:(s:PushState)=>void;output:(s:string)=>void;timings:(v:Record<string,number>)=>void;notice:(s:string)=>void;stop:()=>void}
const stamp=(v:Current)=>JSON.stringify([v.revision,v.context,v.session.activeGoals().map(g=>[g.id,g.scope,g.skill,g.topic,g.expires])])

// Completion-driven, single-flight and latest-frame-only. No frame queue.
export function directLoop(o:Options){
 let cancelled=false,timer:ReturnType<typeof setTimeout>,request:AbortController|null=null,failures=0,retries=0,lastVideoTime=-1,lastPolicy=''
 let history=pushHistory();const presented=new Set<string>()
 const valid=()=>!cancelled&&o.valid()
 const later=(ms:number)=>{if(valid())timer=setTimeout(()=>void tick(),ms)}
 function delivered(action:Announcement,receipt:string|undefined){
  history.remember(action,Date.now());if(!receipt)return;presented.add(receipt);while(presented.size>8)presented.delete(presented.values().next().value!)
  const c=new AbortController(),deadline=setTimeout(()=>c.abort(),4000)
  void fetch('/api/demo/push/ack',{method:'POST',headers:{'content-type':'application/json','x-prism-request':'1'},body:JSON.stringify({run_id:o.runId,receipt}),signal:c.signal,keepalive:true}).then(r=>{if(r.ok)presented.delete(receipt)}).catch(()=>{}).finally(()=>clearTimeout(deadline))
 }
 async function tick(){
  if(!valid())return
  const current=o.current();if(o.flight.current||current.paused||current.pending){later(80);return}
  const begin=performance.now(),policy=stamp(current),video=o.video()
  if(policy!==lastPolicy){history=pushHistory();lastPolicy=policy}
  if(!video||video.currentTime===lastVideoTime){later(40);return}
  let image:string,probe:Uint8ClampedArray
  try{probe=cameraProbe(video);if(!hasVisualDetail(probe)){o.state('waiting-frame');later(100);return}image=capture(video)}catch{o.state('waiting-frame');later(100);return}
  lastVideoTime=video.currentTime;const captureMs=performance.now()-begin
  const c=new AbortController();request=c;o.controller.current=c;o.flight.current=true
  const timeout=setTimeout(()=>c.abort(),12000);let delay=0
  if(!appSpeaking())o.state('processing')
  const fresh=()=>{if(!valid())return false;const now=o.current();if(now.paused||now.pending||stamp(now)!==policy)return false;try{return frameFreshness(performance.now()-begin,probe,cameraProbe(o.video()!))==='fresh'}catch{return false}}
  try{
   const encodeStart=performance.now(),encoded=await pushBody({image,language:lang,context:current.context,run_id:o.runId,profile_revision:current.revision,presented:[...presented]}),encodeMs=performance.now()-encodeStart
   if(!fresh()){o.state('refresh');return}
   const sent=performance.now(),r=await fetch('/api/demo/push',{method:'POST',headers:{'content-type':'application/json','x-prism-request':'1',...encoded.headers},body:encoded.body,signal:c.signal})
   if(!valid())return
   if(r.status===429){const body=await r.json().catch(()=>({}));delay=Math.min(1000,Math.max(Number(body.retry_ms)||200,150*2**Math.min(retries++,3)))+Math.random()*50;o.state(appSpeaking()?'speaking':'retry');return}
   if(r.status===409){o.stop();o.notice(t('偏好已在其他页面更新，请刷新后继续。','Preferences changed in another page. Reload to continue.'));return}
   if(!r.ok)throw Error('Push failed')
   const body=await r.json(),httpMs=performance.now()-sent;failures=0;retries=0
   o.timings({capture_ms:captureMs,encode_ms:encodeMs,upload_bytes:encoded.bytes,uncompressed_bytes:encoded.originalBytes,http_ms:httpMs,server_ms:body.elapsed_ms,...body.timings,frame_age_ms:performance.now()-begin})
   if(!fresh()){o.state('refresh');return}
   if(body.protocol!=='prism-direct-v14'||body.profile_revision!==current.revision)throw Error('Incompatible push result')
   if(body.action!=='push'||!body.content){o.state(appSpeaking()?'speaking':'quiet');return}
   const action={content:body.content,event_key:body.event_key}
   if(history.reject(action,Date.now())){o.state(appSpeaking()?'speaking':'quiet');return}
   o.output(action.content);o.state('ready')
   if(o.current().audio)say(action.content,o.notice,ms=>{o.state('speaking');o.timings({speech_start_ms:ms,frame_to_speech_ms:performance.now()-begin});delivered(action,body.receipt)},()=>{if(fresh()&&o.current().audio)return true;o.state('refresh');return false})
   else delivered(action,body.receipt)
  }catch{
   if(valid()&&!o.current().paused&&!o.current().pending){o.state('retry');delay=Math.min(2000,300*2**failures);if(++failures>=3){o.stop();o.notice(t('连接中断，请重新开启推送。','Connection interrupted. Restart assistance.'))}}
  }finally{
   clearTimeout(timeout);o.flight.current=false;if(o.controller.current===c)o.controller.current=null;request=null
   // Run the continuous push loop: fill out 250ms only if faster.
   later(Math.max(delay,250-(performance.now()-begin),0))
  }
 }
 void tick();return()=>{cancelled=true;clearTimeout(timer);request?.abort()}
}
