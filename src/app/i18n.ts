import dictionary from './english-data.json'
export const en=location.pathname.split('/').includes('en')
export const lang=en?'en-US':'zh-CN'
export const t=(zh:string,english:string)=>en?english:zh
export const tr=(s:string)=>en?(dictionary as Record<string,string>)[s]||s:s
export const labels:Record<string,string>={new01:'New user 1',new02:'New user 2',price01:'Price first',size01:'Size first',product01:'Product first',admin:'Administrator'}
export const userLabel=(id:string,label:string)=>en?labels[id]||id:label
export {say,stopSpeech,prepareSpeech,appSpeaking} from './speech'
