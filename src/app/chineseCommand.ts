import type {Bank} from '../shared/types'

const scenes:Record<string,string>={户外:'mobility',户外出行:'mobility',出行:'mobility',步行:'mobility',就餐:'dining',吃饭:'dining',家里:'home',家:'home',在家:'home',居家生活:'home',医院:'healthcare',看病:'healthcare',购物时:'shopping',所有相关:'shared',所有相关场景:'shared',全部相关:'shared',所有适用:'shared'}
const items:Record<string,string>={价格:'exact_price',价钱:'exact_price',商品价格:'exact_price',自然景观:'animal_nature',自然风景:'animal_nature',风景:'animal_nature',商品:'product_identity',餐盘布局:'plate_layout'}
const verbs:Record<string,string>={多介绍:'多介绍',多描述:'多介绍',多说说:'多介绍',多说:'多介绍',多告诉我:'多介绍',增加:'多介绍',少介绍:'少介绍',少描述:'少介绍',少说说:'少介绍',少说:'少介绍',少告诉我:'少介绍',减少:'少介绍',留意:'留意',不自动留意:'不自动留意',开启:'留意',关闭:'不自动留意'}

// Finite, exact aliases only. The core still checks the edge, role and safety boundary.
// A missing scene, contradictory direction or unknown information item is never guessed.
export function chineseCommand(text:string,data:Bank):string|null{
 const s=text.trim().replace(/\s+/g,'').replace(/[,:]/g,c=>c===','?'，':'：').replace(/[。.!！;；]+$/,'').replace(/^(?:请帮我|帮我|请)/,'')
 const m=s.match(/^(?:(?:长期(?:偏好|设置)?|从今以后|以后|今后)[：，、]?)?(?:请)?(?:在)?(.+?)(?:场景(?:中|下)?|的时候|时)?[，、]?(?:请)?(不自动留意|多介绍|少介绍|多描述|少描述|多说说|少说说|多告诉我|少告诉我|多说|少说|增加|减少|留意|开启|关闭)(.+)$/)
 if(!m)return null
 const scene=Object.keys(data.scenes).find(k=>data.scenes[k]===m[1]||k===m[1])||scenes[m[1]]
 const item=m[3].replace(/(?:的描述|的介绍|的信息)$/,'')
 const skill=data.skills.find(s=>s.label===item||s.id===item)||data.skills.find(s=>s.id===items[item])
 if(!scene||!skill)return null
 return `长期：在${scene==='shared'?'所有适用':data.scenes[scene]}场景，${verbs[m[2]]}${skill.label}`
}

export function preferenceRequest(text:string){
 return /(今天买水果|长期|临时|偏好|以后|今后|多介绍|少介绍|多告诉|少告诉|多描述|少描述|多说|少说|减少|增加|long[ -]term|temporary|preference|from now on|more about|less about)/i.test(text)
}
