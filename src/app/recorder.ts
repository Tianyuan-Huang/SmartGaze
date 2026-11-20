export function wavData(chunks:Float32Array[]){const n=chunks.reduce((s,a)=>s+a.length,0),b=new ArrayBuffer(44+n*2),v=new DataView(b);const word=(p:number,s:string)=>{for(let i=0;i<s.length;i++)v.setUint8(p+i,s.charCodeAt(i))};word(0,'RIFF');v.setUint32(4,36+n*2,true);word(8,'WAVE');word(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,16000,true);v.setUint32(28,32000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);word(36,'data');v.setUint32(40,n*2,true);let at=44;for(const a of chunks)for(const x of a){v.setInt16(at,Math.max(-1,Math.min(1,x))*(x<0?32768:32767),true);at+=2}const bytes=new Uint8Array(b);let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return 'data:audio/wav;base64,'+btoa(binary)}
export type MicrophoneHandle={stream:MediaStream;flush:()=>Promise<void>;resume:()=>Promise<void>;close:()=>void}
export function pcmCollector(rate:number,emit:(a:Float32Array)=>void){let phase=0,sum=0,n=0,out:number[]=[];return{push(a:Float32Array){for(const v of a){sum+=v;n++;phase++;if(phase>=rate/16000){out.push(sum/n);phase-=rate/16000;sum=0;n=0;if(out.length===1024){emit(new Float32Array(out));out=[]}}}},flush(){if(out.length){emit(new Float32Array(out));out=[]}}}}
const bounded=<T,>(promise:Promise<T>,ms:number)=>new Promise<T>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Audio initialization timed out')),ms);promise.then(v=>{clearTimeout(timer);resolve(v)},e=>{clearTimeout(timer);reject(e)})})
export async function microphone(onPCM:(a:Float32Array)=>void):Promise<MicrophoneHandle>{
 const C=window.AudioContext||(window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext
 if(!C||!navigator.mediaDevices)throw Error('Microphone requires trusted HTTPS')
 const audio=new C();void audio.resume().catch(()=>{}) // Unlock synchronously in the pointer gesture.
 let stream:MediaStream|undefined,source:MediaStreamAudioSourceNode|undefined,mute:GainNode|undefined,worklet:AudioWorkletNode|undefined,legacy:ScriptProcessorNode|undefined,collector:ReturnType<typeof pcmCollector>|undefined,closed=false,received=false,serial=0
 const flushes=new Map<number,()=>void>();let first:()=>void=()=>{};const ready=new Promise<void>(r=>{first=r})
 const emit=(a:Float32Array)=>{if(closed||!a.length)return;received=true;onPCM(a);first()}
 const resume=async()=>{if(!closed&&audio.state!=='running')await bounded(audio.resume(),1500)}
 const close=()=>{if(closed)return;closed=true;audio.onstatechange=null;if(worklet){worklet.port.onmessage=null;worklet.disconnect()}if(legacy){legacy.onaudioprocess=null;legacy.disconnect()}source?.disconnect();mute?.disconnect();stream?.getTracks().forEach(t=>t.stop());for(const done of flushes.values())done();flushes.clear();void audio.close().catch(()=>{})}
 const fallback=()=>{
  if(worklet){try{source!.disconnect(worklet)}catch{/* The node may have failed before connection. */}worklet.port.onmessage=null;worklet.disconnect();worklet=undefined}
  collector=pcmCollector(audio.sampleRate,emit);legacy=audio.createScriptProcessor(4096,1,1)
  legacy.onaudioprocess=e=>collector!.push(e.inputBuffer.getChannelData(0));source!.connect(legacy);legacy.connect(mute!)
 }
 try{
  stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false})
  // Opening the iOS microphone can suspend/interupt a previously running context.
  source=audio.createMediaStreamSource(stream);mute=audio.createGain();mute.gain.value=0;mute.connect(audio.destination)
  // A suspended context can also hold addModule() pending: resume before awaiting it.
  await resume()
  if(audio.audioWorklet&&typeof AudioWorkletNode!=='undefined'){
   try{await bounded(audio.audioWorklet.addModule('/pcm-worklet.js'),1500);worklet=new AudioWorkletNode(audio,'demo-pcm');worklet.port.onmessage=e=>{if(e.data instanceof Float32Array)emit(e.data);else if(e.data?.type==='flushed'){flushes.get(e.data.id)?.();flushes.delete(e.data.id)}};source.connect(worklet);worklet.connect(mute)}catch{fallback()}
  }else fallback()
  await resume()
  try{await bounded(ready,900)}catch{
   if(!received){if(!legacy)fallback();if(audio.state==='running')await bounded(audio.suspend(),600).catch(()=>{});await resume();await bounded(ready,1200)}
  }
  audio.onstatechange=()=>{if(!closed&&document.visibilityState!=='hidden'&&audio.state!=='running')void resume().catch(()=>{})}
  return {stream,resume,async flush(){if(closed)return;if(collector){collector.flush();return}const node=worklet;if(!node)return;const id=++serial;await bounded(new Promise<void>(resolve=>{flushes.set(id,resolve);node.port.postMessage({type:'flush',id})}),180).catch(()=>{});flushes.delete(id)},close}
 }catch(e){close();throw e}
}
