// Supply dictated punctuation and an omitted preposition, preserving explicit scope.
export function normalizeCommandText(text:string){
 const numeral=(v:string)=>{const digits:Record<string,number>={'零':0,'〇':0,'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9},units:Record<string,number>={'十':10,'百':100,'千':1000};if(!/[十百千]/.test(v))return [...v].map(c=>digits[c]).join('');let total=0,n=0;for(const c of v){if(c in units){total+=(n||1)*units[c];n=0}else n=digits[c]}return String(total+n)}
 const s=text.trim().replace(/\s+/g,'').replace(/[,:]/g,c=>c===','?'，':'：').replace(/[。！]$/,'').replace(/持续([零〇一二两三四五六七八九十百千]+)(秒|分钟)/g,(_m,n,u)=>'持续'+numeral(n)+u)
 const long=s.match(/^长期[：，]?在?(.+?)场景[，]?(多介绍|少介绍|留意|不自动留意)(.+)$/)
 if(long)return `长期：在${long[1]}场景，${long[2]}${long[3]}`
 const temp=s.match(/^临时[：，]?在?(.+?)场景[，]?关注(.+?)[，]?持续([1-9][0-9]*)(秒|分钟)$/)
 if(temp)return `临时：在${temp[1]}场景，关注${temp[2]}，持续${temp[3]}${temp[4]}`
 return text.trim()
}
