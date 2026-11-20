// Bounded text-only history: 3/30s prompt history,
// 60s refreshed exact cache, .95 semantic/text similarity and an adjacent guard.
// Explicit changed facts bypass fuzzy comparisons; no extra model is involved.
export const textKey=v=>String(v||'').toLowerCase().replace(/[\s，。！？、；：,.!?;:]/gu,'')
const semanticKey=v=>String(v||'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'')
export function editDistance(a,b){
 a=Array.from(a);b=Array.from(b);let previous=Array.from({length:b.length+1},(_,i)=>i)
 for(let i=0;i<a.length;i++){const row=[i+1];for(let j=0;j<b.length;j++)row.push(Math.min(row[j]+1,previous[j+1]+1,previous[j]+(a[i]===b[j]?0:1)));previous=row}return previous[b.length]
}
// SequenceMatcher-style matching blocks, with autojunk disabled for short text.
export function similarity(a,b){
 if(a===b)return 1;if(!a||!b)return 0;let matches=0;const blocks=[[0,a.length,0,b.length]]
 while(blocks.length){const [alo,ahi,blo,bhi]=blocks.pop();let best=0,ai=alo,bi=blo,previous=new Map()
  for(let i=alo;i<ahi;i++){const row=new Map();for(let j=blo;j<bhi;j++)if(a[i]===b[j]){const n=(previous.get(j-1)||0)+1;row.set(j,n);if(n>best){best=n;ai=i-n+1;bi=j-n+1}}previous=row}
  if(best){matches+=best;if(alo<ai&&blo<bi)blocks.push([alo,ai,blo,bi]);if(ai+best<ahi&&bi+best<bhi)blocks.push([ai+best,ahi,bi+best,bhi])}
 }return 2*matches/(a.length+b.length)
}
function changedFact(a,b){
 const countNames={one:'1',two:'2',three:'3',four:'4',five:'5',six:'6',seven:'7',eight:'8',nine:'9',ten:'10','一':'1','二':'2','两':'2','三':'3','四':'4','五':'5','六':'6','七':'7','八':'8','九':'9','十':'10'}
 const numbers=v=>(v.toLowerCase().match(/\d+(?:[.,]\d+)?|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|several|many)\b|[一二三四五六七八九十百两几多]+整?(?=[个排只辆件份碗杯层级处])/gu)||[]).map(n=>countNames[n.replace('整','')]||n.replace('整','')).join('|')
 const na=numbers(a.content),nb=numbers(b.content)
 if(na!==nb)return true
 const words=v=>new Set((v.toLowerCase().match(/\b(?:left|right|behind|ahead|open|closed|locked|unlocked|blocked|clear|approaching|stopped|red|green|yellow|upstairs|downstairs)\b|左|右|身后|前方|红灯|绿灯|黄灯|关闭|打开|迎面|驶离|上行|下行/gu)||[]))
 const x=words(a.content),y=words(b.content)
 if(x.size&&y.size&&[...new Set([...x,...y])].some(w=>x.has(w)!==y.has(w)))return true
 const ap=a.event_key.split('|'),bp=b.event_key.split('|')
 // A visibly named different object is not a paraphrase of the previous one.
 if(ap.length===3&&bp.length===3&&ap[1]!==bp[1]&&textKey(a.content).includes(textKey(ap[1]))&&textKey(b.content).includes(textKey(bp[1]))&&!textKey(a.content).includes(textKey(bp[1])))return true
 return false
}
export function pushHistory(){
 let recent=[],last=null;const exact=new Map()
 function prune(now){recent=recent.filter(r=>now-r.at<=30000).slice(-3);for(const[k,r]of exact)if(now-r.at>60000)exact.delete(k);while(exact.size>80)exact.delete(exact.keys().next().value)}
 function reject(candidate,now){
  prune(now);const key=textKey(candidate.content);if(exact.has(key)){exact.set(key,{at:now});return 'exact_text'}
  for(const record of [...recent,...(last?[last]:[])]){
   if(changedFact(candidate,record))continue
   const sameEvent=similarity(semanticKey(candidate.event_key),semanticKey(record.event_key))>=.95
   const nearText=similarity(key,textKey(record.content))>=.95
   const adjacent=record===last&&editDistance(key,textKey(record.content))<=3
   if(sameEvent||nearText||adjacent){exact.set(key,{at:now});return sameEvent?'semantic_event':adjacent?'adjacent_edit_distance':'similar_text'}
  }return ''
 }
 return {recent(now){prune(now);return recent.map(r=>({...r}))},reject,remember(candidate,now){
  const reason=reject(candidate,now);if(reason)return false;const record={content:candidate.content,event_key:candidate.event_key,at:now};recent.push(record);recent=recent.slice(-3);last=record;exact.set(textKey(record.content),{at:now});return true
 }}
}
