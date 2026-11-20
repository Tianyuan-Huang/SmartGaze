export type Skill = {id:string;label:string;role:string;scenes:string[];features:Record<string,number>;evidence_requirement:string;safety_boundary:string;activate_when:string;suppress_when:string;value:string}
export type Option = {skill:string;text:string;features:Record<string,number>}
export type Question = {id:string;scene:string;prompt:string;options:{A:Option;B:Option}}
export type Need = {skill:string;activity:string;requires_target?:boolean;[key:string]:unknown}
export type Fact = Option & {id:string;tags:string[];required:boolean;activity:string;private:boolean;evidence:string;confidence:number;score?:number;bonus?:number;total?:number;reason?:string}
export type Fixture = {id?:string;title?:string;scene:string;activity:string;taskConfirmed?:boolean;targetTags?:string[];facts:Fact[]}
export type Bank = {version:string;graphHash:string;bankHash:string;scenes:Record<string,string>;skills:Skill[];questions:Question[];needs:Need[];fixtures:Fixture[];edges:unknown[]}
export type Event = {id:string;kind:string;scope:string;intent?:string;skill?:string;qid?:string;choice?:string;sign?:number;on?:boolean;topic?:string;expires?:number;revoked:boolean;time:number;source:string}
export type Proposal = {op:'direction'|'need'|'goal'|'intent_goal';skill:string;scope?:string;scene?:string;summary:string;summaryEn?:string;[key:string]:unknown}
export type Profile = {version:string;graphHash:string;bankHash:string;id:string;actions:unknown[]}
export type Selection = {selected:Fact[];ranked:Fact[];mandatory:Fact[];blocked:{id:string;reason:string}[]}
export interface Session {
 id:string;phase:'initial'|'assistance';events:Event[];
 start(t?:number):void;answer(qid:string,choice:string,scope:string,confirmed:boolean,t?:number):Event;
 direction(skill:string,sign:number,scope:string,confirmed:boolean,t?:number):Event;
 need(skill:string,on:boolean,scope:string,confirmed:boolean,t?:number):Event;
 needOn(skill:string,scene:string):boolean;activeGoals(t?:number):Event[];
 proposal(text:string,t?:number):Proposal;apply(p:Proposal,t?:number):Event;
 revoke(id:string,confirmed:boolean,t?:number):void;export():Profile;params():Record<string,number>;
 score(o:Option,scene:string):number;select(f:Fixture,options?:Record<string,unknown>):Selection;
}
declare global { interface Window {PRISM:{naturalIntent:(text:string,t?:number)=>Proposal|null;Session:{new(data:Bank,id?:string):Session;restore(data:Bank,p:Profile):Session}}} }
