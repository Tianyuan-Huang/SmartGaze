// A cheap in-memory camera check, not semantic scene recognition.
export const MAX_FRAME_AGE_MS=4000
export const SCENE_CHANGE_THRESHOLD=.20
export function hasVisualDetail(pixels:Uint8ClampedArray){
 if(!pixels.length)return false
 let low=255,high=0
 for(let i=0;i<pixels.length;i+=4){const y=.2126*pixels[i]+.7152*pixels[i+1]+.0722*pixels[i+2];low=Math.min(low,y);high=Math.max(high,y)}
 return high-low>=12
}
export function frameDifference(a:Uint8ClampedArray,b:Uint8ClampedArray){
 if(!a.length||a.length!==b.length)return Infinity
 let difference=0
 for(let i=0;i<a.length;i+=4)for(let c=0;c<3;c++)difference+=Math.abs(a[i+c]-b[i+c])
 return difference/(a.length/4*3*255)
}
export function frameFreshness(age:number,before:Uint8ClampedArray,after:Uint8ClampedArray){
 if(age>MAX_FRAME_AGE_MS)return 'expired'
 if(!before.length||!after.length)return 'unavailable'
 return frameDifference(before,after)>SCENE_CHANGE_THRESHOLD?'changed':'fresh'
}
export function cameraProbe(video:HTMLVideoElement){
 if(video.readyState<2||!video.videoWidth||video.ended)return new Uint8ClampedArray()
 const canvas=document.createElement('canvas');canvas.width=16;canvas.height=12
 const ctx=canvas.getContext('2d',{willReadFrequently:true})!
 ctx.drawImage(video,0,0,16,12)
 return ctx.getImageData(0,0,16,12).data
}
