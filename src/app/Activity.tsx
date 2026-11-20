import type {Bank} from '../shared/types'
import {t,tr} from './i18n'
export type Context={activity:string;taskConfirmed:boolean;targetTags:string[]}
export default function Activity({data,value,change}:{data:Bank;value:Context;change:(v:Context)=>void}){
 const need=data.needs.find(n=>n.activity===value.activity),activities=[...new Set(data.needs.map(n=>n.activity))]
 return <details><summary>{t('当前任务','Current activity')}</summary><label>{t('正在做什么','What are you doing?')}<select value={value.activity} onChange={e=>change({activity:e.target.value,taskConfirmed:false,targetTags:[]})}><option value="review">{t('观察周围','Looking around')}</option>{activities.map(a=><option key={a} value={a}>{tr(data.skills.find(s=>s.id===data.needs.find(n=>n.activity===a)?.skill)?.label||a)}</option>)}</select></label>{value.activity!=='review'&&<>{need?.requires_target&&<label>{t('具体目标','Specific target')}<input maxLength={30} value={value.targetTags[0]||''} onChange={e=>change({...value,targetTags:e.target.value?[e.target.value]:[],taskConfirmed:false})}/></label>}<label className="check"><input type="checkbox" disabled={!!need?.requires_target&&!value.targetTags.length} checked={value.taskConfirmed} onChange={e=>change({...value,taskConfirmed:e.target.checked})}/>{t('确认正在进行这项任务','I am currently doing this activity')}</label></>}</details>
}
