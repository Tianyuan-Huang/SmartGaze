// Microphone PCM only. No network, storage, or audible monitoring.
class DemoPCM extends AudioWorkletProcessor {
 constructor(){super();this.phase=0;this.sum=0;this.n=0;this.out=[];this.port.onmessage=e=>{if(e.data?.type==='flush'){if(this.out.length){this.port.postMessage(new Float32Array(this.out));this.out=[]}this.port.postMessage({type:'flushed',id:e.data.id})}}}
 process(inputs){const a=inputs[0]?.[0];if(!a)return true;const ratio=sampleRate/16000;for(const v of a){this.sum+=v;this.n++;this.phase++;if(this.phase>=ratio){this.out.push(this.sum/this.n);this.phase-=ratio;this.sum=0;this.n=0;if(this.out.length===1024){this.port.postMessage(new Float32Array(this.out));this.out=[]}}}return true}
}
registerProcessor('demo-pcm',DemoPCM)
