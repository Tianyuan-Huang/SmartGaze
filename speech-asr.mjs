import fs from 'node:fs'
// Server-side speech recognition; audio is not persisted.
export function asrService({key=process.env.DEMO_SPEECH_KEY||'',keyFile=process.env.DEMO_SPEECH_KEY_FILE,fetcher=fetch}={}){
 if(!key&&keyFile)key=fs.readFileSync(keyFile,'utf8').trim()
 let active=0;const last=new Map()
 return {available:!!key,async recognize(id,audio,language,signal){
  if(!key)throw Object.assign(Error('Speech service not configured'),{status:503})
  if(typeof audio!=='string'||!/^data:audio\/wav;base64,[A-Za-z0-9+/=]+$/.test(audio)||audio.length>660000)throw Object.assign(Error('Invalid recording'),{status:400})
  const b=Buffer.from(audio.split(',')[1],'base64');if(b.length<3244||b.length>480044||b.toString('ascii',0,4)!=='RIFF'||b.toString('ascii',8,12)!=='WAVE'||b.readUInt16LE(22)!==1||b.readUInt32LE(24)!==16000||b.readUInt16LE(34)!==16)throw Object.assign(Error('Invalid WAV'),{status:400})
  const now=Date.now();if(active>=2||now-(last.get(id)||0)<700)throw Object.assign(Error('Speech service busy'),{status:429});active++;last.set(id,now);for(const[k,t]of last)if(now-t>60000)last.delete(k)
  try{const started=performance.now(),r=await fetcher('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',{method:'POST',headers:{authorization:'Bearer '+key,'content-type':'application/json'},body:JSON.stringify({model:'qwen3-asr-flash',messages:[{role:'user',content:[{type:'input_audio',input_audio:{data:audio}}]}],stream:false,asr_options:{language:language==='en-US'?'en':'zh',enable_itn:true}}),signal});if(!r.ok)throw Error('Speech provider failed');const data=await r.json(),text=data.choices?.[0]?.message?.content;if(typeof text!=='string'||!text.trim())throw Error('No speech recognized');return {text:text.trim().slice(0,300),asr_ms:performance.now()-started}}
  finally{active--}
 }}
}
