import {readFileSync} from 'node:fs'
export const bank=JSON.parse(readFileSync(new URL('./prism/data.json',import.meta.url),'utf8'))
const skills=new Map(bank.skills.map(s=>[s.id,s]))
export function isolatedEndpoint(raw){
 if(!raw)return null
 const u=new URL(raw)
 if(u.protocol!=='https:'||u.username||u.password||u.hash||u.search)throw Error('Demo 接口必须是不含凭据和查询参数的 HTTPS 地址')
 return u.href
}
export function contextOf(v={}){
 const activities=new Set(['review',...bank.needs.map(n=>n.activity)])
 if(!activities.has(v.activity))throw Error('请选择明确的当前活动')
 const tags=Array.isArray(v.targetTags)?v.targetTags.filter(x=>typeof x==='string'&&x.trim().length>0&&x.length<=30).slice(0,3):[]
 const goals=Array.isArray(v.goals)?v.goals.filter(g=>g&&skills.has(g.skill)&&skills.get(g.skill).scenes.includes(g.scene)&&typeof g.topic==='string'&&g.topic.length<=30).slice(0,32).map(g=>({skill:g.skill,scene:g.scene,topic:g.topic})):[]
 return {activity:v.activity,taskConfirmed:v.taskConfirmed===true,targetTags:tags,goals}
}
