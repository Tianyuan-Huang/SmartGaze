export type Recognition = {lang:string;continuous:boolean;interimResults:boolean;maxAlternatives:number;onresult:((e:{results:ArrayLike<ArrayLike<{transcript:string}>>})=>void)|null;onerror:((e:{error:string})=>void)|null;onend:(()=>void)|null;start():void;stop():void;abort():void}
export function recognitionConstructor(){return (window as unknown as {SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition}).SpeechRecognition||(window as unknown as {webkitSpeechRecognition?:new()=>Recognition}).webkitSpeechRecognition}
export function speak(text:string,onError:(message:string)=>void,interrupt=false):boolean{
 if(!('speechSynthesis' in window)){onError('当前浏览器不能朗读，请使用系统读屏或更换浏览器。');return false}
 if(speechSynthesis.speaking&&!interrupt)return false
 if(interrupt)speechSynthesis.cancel()
 const voices=speechSynthesis.getVoices().filter(v=>v.lang.toLowerCase().startsWith('zh')&&v.localService)
 if(!voices.length){onError('未检测到本机中文语音。请在系统中安装中文语音后重试；当前仅显示文字。');return false}
 const u=new SpeechSynthesisUtterance(text);u.lang='zh-CN';u.voice=voices[0];u.rate=1;u.onerror=()=>onError('语音未能播放，可点“重听”重试。');speechSynthesis.speak(u);return true
}
export function capture(video:HTMLVideoElement){
 if(video.readyState<2||!video.videoWidth)throw Error('摄像头尚未提供有效画面。')
 const c=document.createElement('canvas'),scale=Math.min(1,960/video.videoWidth);c.width=Math.round(video.videoWidth*scale);c.height=Math.round(video.videoHeight*scale);c.getContext('2d')!.drawImage(video,0,0,c.width,c.height)
 return c.toDataURL('image/jpeg',.78)
}
