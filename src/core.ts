import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {initial,scenes,sceneOf,type Scene,type State,type Card,type Draft,type Feedback} from './shared.js';
export {initial,scenes};
export function text(value:unknown,max=4000):string {if(typeof value!=='string'||value.length>max)throw new Error('文本格式不正确或过长');return value;}
export function feedback(raw:string):Feedback {
 const cleaned=raw.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'');
 const v=JSON.parse(cleaned);if(!v||!['clear','improve'].includes(v.verdict))throw new Error('反馈格式不完整，请重试');
 for(const k of ['note','natural','explanation','reply'])if(typeof v[k]!=='string'||v[k].length>2000)throw new Error('反馈格式不完整，请重试');
 if(!v.natural.trim()||!v.reply.trim())throw new Error('反馈缺少参考句或追问');
 return {verdict:v.verdict,note:v.note,natural:v.natural,explanation:v.explanation,reply:v.reply};
}
export function validScene(v:any):v is Scene {return !!v&&typeof v.id==='string'&&v.id.length<=100&&['daily','work'].includes(v.kind)&&['title','context','question'].every(k=>typeof v[k]==='string'&&v[k].trim()&&v[k].length<=2000)&&['keywords','starter','reference','followup'].every(k=>typeof v[k]==='string'&&v[k].length<=2000);}
export function generatedScene(raw:string,id:string,kind?:'daily'|'work'):Scene {
 const cleaned=raw.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');let parsed:any;
 try{parsed=JSON.parse(cleaned);}catch{const start=cleaned.indexOf('{'),end=cleaned.lastIndexOf('}');if(start<0||end<start)throw new Error('没有收到完整的话题，请重新生成；当前练习已保留');try{parsed=JSON.parse(cleaned.slice(start,end+1));}catch{throw new Error('话题内容无法读取，请重新生成；当前练习已保留');}}
 const v=parsed?.scene??parsed?.topic??parsed;
 if(!v||typeof v!=='object'||Array.isArray(v))throw new Error('没有收到可用的话题，请重新生成');
 const get=(...values:unknown[])=>values.find(x=>typeof x==='string'&&x.trim()) as string|undefined;
 const topic={id,kind:kind??v.kind,title:get(v.title,v.name)??'',context:get(v.context,v.scenario,v.description)??'',question:get(v.question,v.opening,v.openingLine)??'',keywords:Array.isArray(v.keywords)?v.keywords.filter((x:unknown)=>typeof x==='string').join(' / '):get(v.keywords)??'',starter:get(v.starter)??'',reference:get(v.reference,v.exampleAnswer)??'',followup:get(v.followup)??''};
 if(!validScene(topic))throw new Error('新话题缺少标题、情境或开场白，请重新生成；当前练习已保留');return topic;
}
function knownScene(v:any){return v.scene?validScene(v.scene)&&v.scene.id===v.sceneId:scenes.some(s=>s.id===v.sceneId);}
function validDraft(v:any):v is Draft {return v===null||!!v&&knownScene(v)&&typeof v.input==='string'&&v.input.length<=4000&&(v.clarificationInput===undefined||typeof v.clarificationInput==='string'&&v.clarificationInput.length<=4000)&&Number.isInteger(v.hint)&&v.hint>=0&&v.hint<=3&&Number.isInteger(v.phase)&&v.phase>=0&&v.phase<=3&&Array.isArray(v.history)&&v.history.every((h:any)=>{try{text(h.question);text(h.answer);feedback(JSON.stringify(h.feedback));if(h.questions!==undefined&&(!Array.isArray(h.questions)||h.questions.length>20||!h.questions.every((q:any)=>typeof q.question==='string'&&q.question.length<=4000&&typeof q.answer==='string'&&q.answer.length<=32000)))return false;return true;}catch{return false;}});}
export function validate(v:any):State {
 if(!v||v.version!==1||!Number.isSafeInteger(v.revision)||v.revision<0||!validDraft(v.draft)||!Number.isSafeInteger(v.completed)||v.completed<0||!Array.isArray(v.cards)||v.cards.length>5000)throw new Error('学习数据格式无效');
 if(v.pendingScene!==undefined&&!validScene(v.pendingScene)||v.previousDraft!==undefined&&!validDraft(v.previousDraft))throw new Error('待切换的话题格式无效');
 const ids=new Set();for(const c of v.cards){if(!c||typeof c.id!=='string'||ids.has(c.id)||!knownScene(c)||![c.due,c.created].every(Number.isFinite)||!Number.isInteger(c.stage)||c.stage<0||c.stage>3)throw new Error('表达卡格式无效');ids.add(c.id);for(const k of ['original','expression','note'])text(c[k]);}
 const s=v.settings;if(!s||!['all','daily','work'].includes(s.kind)||!['starter','comfortable'].includes(s.level))throw new Error('学习偏好格式无效');if(s.modelMode!==undefined&&!['system','manual'].includes(s.modelMode))throw new Error('模型选择方式无效');text(s.provider,200);text(s.model,200);
 return structuredClone(v);
}
export class Store {
 state=initial();private queue:Promise<unknown>=Promise.resolve();
 constructor(readonly directory:string){}
 async init(){await fs.mkdir(this.directory,{recursive:true});try{this.state=validate(JSON.parse(await fs.readFile(path.join(this.directory,'state.json'),'utf8')));}catch(e:any){if(e.code!=='ENOENT')throw e;}}
 snapshot(){return structuredClone(this.state);}
 change(expected:number,update:(state:State)=>void){const task=this.queue.then(async()=>{if(expected!==this.state.revision)throw new Error('学习进度已在其他面板更新，请刷新后重试');const next=this.snapshot();update(next);next.revision++;validate(next);const temp=path.join(this.directory,randomUUID()+'.tmp');try{await fs.writeFile(temp,JSON.stringify(next),{mode:0o600});await fs.rename(temp,path.join(this.directory,'state.json'));}finally{await fs.rm(temp,{force:true});}this.state=next;return this.snapshot();});this.queue=task.catch(()=>{});return task;}
}
export function review(card:Card,remembered:boolean,now=Date.now()){card.stage=remembered?Math.min(3,card.stage+1):0;card.due=now+([1,3,7,14][card.stage])*86400000;}
