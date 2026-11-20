import {lang,t} from './i18n'
let generation=0,active:SpeechSynthesisUtterance|null=null,primer:SpeechSynthesisUtterance|null=null
export function appSpeaking(){return active!==null}
export function prepareSpeech(){const s=window.speechSynthesis;if(!s)return;s.getVoices();s.resume();if(!active&&!primer){const u=new SpeechSynthesisUtterance(' ');primer=u;u.volume=0;u.lang=lang;u.onend=u.onerror=()=>{if(primer===u)primer=null};s.speak(u);setTimeout(()=>{if(primer===u&&!active){primer=null;s.cancel()}},250)}}
export function stopSpeech(){generation++;window.speechSynthesis?.cancel();active=null;primer=null;window.dispatchEvent(new CustomEvent('prism-speaking',{detail:false}))}
export function say(text:string,notice:(v:string)=>void,onStart?:(ms:number)=>void,allowed?:()=>boolean){
 if(!window.speechSynthesis){notice(t('浏览器不支持播报，请使用系统读屏。','Speech output is unavailable. Use a screen reader.'));return}
 stopSpeech();const gen=generation,started=performance.now(),synth=window.speechSynthesis
 const speak=()=>{if(gen!==generation||allowed&&!allowed())return;const u=new SpeechSynthesisUtterance(text),voices=synth.getVoices().filter(v=>v.lang.toLowerCase().startsWith(lang.slice(0,2)));u.lang=lang;u.voice=voices.find(v=>v.localService)||voices[0]||null;u.rate=1;active=u
 let began=false;const watchdog=setTimeout(()=>{if(!began&&gen===generation){stopSpeech();notice(t('未能启动声音。请点“重听”或重新开启播报，并检查媒体音量和系统语音。','Audio did not start. Tap Replay or toggle speech, and check media volume and system voices.'))}},5000)
 u.onstart=()=>{clearTimeout(watchdog);if(gen!==generation||active!==u)return;began=true;if(allowed&&!allowed()){stopSpeech();return}onStart?.(performance.now()-started);window.dispatchEvent(new CustomEvent('prism-speaking',{detail:true}))}
 const end=()=>{clearTimeout(watchdog);if(active===u){active=null;window.dispatchEvent(new CustomEvent('prism-speaking',{detail:false}))}}
 u.onend=end;u.onerror=e=>{end();if(!['canceled','interrupted'].includes(e.error))notice(t('播报失败，请点“重听”，并检查系统语音设置。','Speech failed. Tap Replay and check system voice settings.'))};synth.resume();synth.speak(u)
 }
 // Mobile engines may enumerate voices asynchronously. Still allow their default voice.
 if(synth.getVoices().length)speak();else {let done=false;const ready=()=>{if(done)return;done=true;synth.removeEventListener('voiceschanged',ready);speak()};synth.addEventListener('voiceschanged',ready);setTimeout(ready,350)}
}
