export type Announcement={content:string;event_key:string}
export function textKey(v:string):string
export function editDistance(a:string,b:string):number
export function similarity(a:string,b:string):number
export function pushHistory():{recent(now:number):(Announcement&{at:number})[];reject(candidate:Announcement,now:number):string;remember(candidate:Announcement,now:number):boolean}
