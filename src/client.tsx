import React,{useEffect,useState,useSyncExternalStore} from 'react';
import type {Context} from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-client-connection/client';
import type {} from '@deepseek-ai/dsh-client-ui-layout/client';
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client';
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client';
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
import type {ConnectionHandle} from '@deepseek-ai/dsh-client-connection/client';
import type {MainPanelId} from '@deepseek-ai/dsh-client-ui-layout/client';
import {initial,scenes,sceneOf,type State,type Draft} from './shared.js';import css from './style.css';
export const name='dsh-english-break-client';export const inject=['connection','slots','layout','sidebarRight','sidebarRightTabs'];
type Call=(action:string,payload?:unknown)=>Promise<any>;
function createSource(call:Call){
 let value={data:initial(),ready:false,busy:false,error:'',saving:false,operation:'',progress:'',preview:''},listeners=new Set<()=>void>(),dirty=false,timer:ReturnType<typeof setTimeout>|undefined,request='',pending:Promise<unknown>=Promise.resolve();
 const emit=()=>{value={...value};listeners.forEach(f=>f());};
 const exclusive=<T,>(fn:()=>Promise<T>)=>{const task=pending.then(fn);pending=task.catch(()=>{});return task;};
 async function flush(){clearTimeout(timer);if(!dirty)return;const draft=structuredClone(value.data.draft);dirty=false;value.saving=true;emit();try{const saved=await call('draft',{revision:value.data.revision,draft});value.data=dirty?{...saved,draft:value.data.draft}:saved;value.error='';}catch(e){dirty=true;throw e;}finally{value.saving=false;emit();}}
 const report=(e:unknown)=>{value.error=String(e instanceof Error?e.message:e);emit();};
 let cancelRequested=false;
 const source={getSnapshot:()=>value,subscribe:(f:()=>void)=>{listeners.add(f);return()=>{listeners.delete(f);};},
  async load(){try{const data=await call('state');clearTimeout(timer);dirty=false;value.data=data;value.ready=true;value.error='';emit();}catch(e){report(e);}},
  edit(draft:Draft){value.data={...value.data,draft};dirty=true;emit();clearTimeout(timer);timer=setTimeout(()=>{void exclusive(flush).catch(report);},400);},
  async action(action:string,payload:unknown={}){return exclusive(async()=>{value.busy=true;emit();try{await flush();const data=await call(action,{...(payload as object),revision:value.data.revision});value.data=data;value.error='';emit();return data;}catch(e){report(e);throw e;}finally{value.busy=false;emit();}});},
  async evaluate(action='evaluate'){if(value.busy)return;cancelRequested=false;value.busy=true;value.operation=action;value.progress='正在保存并发送…';value.preview='';value.error='';emit();return exclusive(async()=>{try{await flush();if(cancelRequested)throw new Error('生成已取消，你的输入已保留');request=crypto.randomUUID();await call('generate',{operation:action,id:request,revision:value.data.revision});if(cancelRequested)await call('cancel',{id:request});const deadline=Date.now()+195000;for(;;){const job=await call('progress',{id:request});if(job.status==='error')throw new Error(job.error);if(job.status==='done'){value.data=job.value;value.error='';break;}value.progress=job.stage;value.preview=job.preview;emit();if(Date.now()>deadline)throw new Error('等待模型超时，输入已保留，请重新发送');await new Promise(resolve=>setTimeout(resolve,350));}}catch(e){if(request)void call('cancel',{id:request}).catch(()=>{});report(e);}finally{value.busy=false;value.progress='';value.preview='';request='';emit();}});},
  async cancel(){cancelRequested=true;if(request)try{await call('cancel',{id:request});}catch(e){report(e);}},
  async export(){return exclusive(async()=>{await flush();return value.data;});},
  call
 };return source;
}
type Source=ReturnType<typeof createSource>;
function Icon(){return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 5c4-1 6 0 9 2 3-2 5-3 9-2v14c-4-1-6 0-9 2-3-2-5-3-9-2Z"/><path d="M12 7v14M6 9h3M15 9h3"/></svg>;}
function App({source,open,side=false}:{source:Source;open:()=>void;side?:boolean}){
 const {data:s,ready,busy,error,saving,operation,progress,preview}=useSyncExternalStore(source.subscribe,source.getSnapshot);
 const [tab,setTab]=useState('practice'),[models,setModels]=useState<{provider:string;id:string;name:string}[]>([]),[modelError,setModelError]=useState(''),[systemModel,setSystemModel]=useState<{available:boolean;provider:string;model:string}|null>(null),[show,setShow]=useState(''),[confirm,setConfirm]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{if(tab==='settings'){void source.call('system-model').then(setSystemModel).catch(e=>setModelError(String(e)));void source.call('models').then(setModels).catch(e=>setModelError(String(e)));}},[tab]);
 const act=(a:string,p:unknown={})=>source.action(a,p).catch(()=>{});
 const d=s.draft,scene=sceneOf(d),latest=d?.history.at(-1);
 const due=s.cards.filter(c=>c.due<=Date.now()).sort((a,b)=>a.due-b.due).slice(0,5);
 const [reviewed,setReviewed]=useState(0);
 const change=(patch:Partial<Draft>)=>{if(d)source.edit({...d,...patch});};
 const start=()=>{const candidates=scenes.filter(v=>s.settings.kind==='all'||v.kind===s.settings.kind);return act('start',{sceneId:candidates[s.completed%candidates.length].id});};
 async function download(){try{const data=await source.export(),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='english-break-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){setNotice(String(e));}}
 return <section className={'eb-app '+(side?'eb-side':'')} tabIndex={0} aria-label="英语学习面板">
  <header><div className="eb-row"><span className="eb-brand">EN / 英语空档</span>{side&&<button onClick={open}>展开 ↗</button>}</div><h1>等一会儿，练一句。</h1><p className="eb-muted">日常口语 · 工作英语 · 随时继续</p></header>
  <nav aria-label="英语学习导航">{[['practice','练一练'],['review','复习'+(due.length?' · '+due.length:'')],['cards','表达本'],['settings','设置']].map(([id,label])=><button key={id} aria-pressed={tab===id} onClick={()=>{setTab(id);setConfirm('');setNotice('');}}>{label}</button>)}</nav>
  {!ready?<p role="status">{error||'正在读取学习记录…'}<button onClick={()=>source.load()}>重试</button></p>:<>
  {error&&operation!=='random'&&<div className="eb-error" role="alert">{error}<p>输入保留在面板中。如进度冲突，可先复制输入，再刷新。</p><button disabled={busy} onClick={()=>{if(window.confirm('刷新会载入最近保存的数据。是否继续？'))void source.load();}}>刷新进度</button></div>}
  {notice&&<p role="status">{notice}</p>}
  {tab==='practice'&&<>
   {busy&&operation&&<p className="eb-status" role="status">{progress||'正在处理…'}</p>}
   <div className="eb-categories" role="group" aria-label="选择对话类型">{[['all','全部'],['daily','日常口语'],['work','工作英语']].map(([kind,label])=><button key={kind} aria-pressed={s.settings.kind===kind} disabled={busy} onClick={()=>act('settings',{settings:{kind}})}>{label}</button>)}</div>
   <p className="eb-muted">选择下一个话题的类型，当前练习不会改变。</p>
   <div className="eb-random"><div><strong>让 AI 带来一个新话题</strong><p className="eb-muted">先预览，再决定是否开始。当前输入和讨论会保留。</p></div><button disabled={busy||(s.settings.modelMode==='manual'&&!s.settings.model)} onClick={()=>source.evaluate('random')}>{busy&&operation==='random'?'正在找新话题…':'AI 随机话题 ↗'}</button>{busy&&operation==='random'&&<button onClick={()=>source.cancel()}>取消生成</button>}
    {operation==='random'&&error&&!busy&&<div className="eb-error" role="alert">{error}<p>当前练习未切换，可点击「AI 随机话题」重试。</p></div>}
    {s.pendingScene&&<div className="eb-topic-preview"><span className="eb-tag">新话题预览 · {s.pendingScene.kind==='work'?'工作英语':'日常口语'}</span><h3>{s.pendingScene.title}</h3><p>{s.pendingScene.context}</p><blockquote>{s.pendingScene.question}</blockquote><div className="eb-row"><button className="eb-primary" disabled={busy} onClick={()=>act('accept-topic')}>开始这个话题</button><button disabled={busy} onClick={()=>act('discard-topic')}>暂不切换</button></div></div>}
   </div>
   {s.previousDraft&&<button disabled={busy} onClick={()=>act('restore-topic')}>返回上一话题：{sceneOf(s.previousDraft)?.title}</button>}
   {!d?<><div className="eb-hero"><span className="eb-tag">两分钟也算一次练习</span><h2>把想说的话，试着说出来。</h2><p>给你一个情境。先自己表达，卡住了再看提示。</p><button className="eb-primary" onClick={start}>练两分钟 →</button></div><div className="eb-row eb-stats"><span>完成 {s.completed} 轮</span><span>收藏 {s.cards.length} 个表达</span></div><h3>今天想练什么</h3><div className="eb-scenes">{scenes.filter(v=>s.settings.kind==='all'||v.kind===s.settings.kind).map(v=><button className="eb-scene" key={v.id} onClick={()=>act('start',{sceneId:v.id})}><span className="eb-muted">{v.kind==='work'?'工作':'日常'}</span><strong>{v.title}</strong><span>开始 →</span></button>)}</div></>:scene&&<>
    <div className="eb-row"><span className="eb-tag">{scene.kind==='work'?'工作英语':'日常口语'} · {scene.title}</span><span className="eb-muted">{saving?'保存中…':'自动保存草稿'}</span></div>
    <p>{scene.context}</p><blockquote>{latest?.feedback.reply??scene.question}</blockquote>
    <label htmlFor={'eb-input-'+(side?'side':'main')}>试着用英语回应</label><textarea id={'eb-input-'+(side?'side':'main')} value={d.input} maxLength={4000} disabled={busy} placeholder="不用追求完美，先写一句…" onChange={e=>change({input:e.target.value})}/>
    <div className="eb-row eb-actions">{busy?<button onClick={()=>source.cancel()}>取消生成</button>:<button className="eb-primary" disabled={!d.input.trim()} onClick={()=>source.evaluate()}>给我反馈</button>}<button disabled={busy||d.hint>=3} onClick={()=>change({hint:d.hint+1})}>给点提示</button></div>
    {s.settings.modelMode==='manual'&&!s.settings.model&&<p className="eb-muted">反馈需要先到「设置」选择模型；现在可以用提示和参考句练习。</p>}
    {d.hint>0&&<aside className="eb-hint"><strong>{latest?'继续表达的提示':'一点提示'}</strong><p>{latest?'可以用一句简短的话回答上面的追问，再补充一个细节。':(d.hint===1?scene.keywords:d.hint===2?scene.starter:scene.reference)||'这个话题没有预设提示。试着用一句简短的话回应，再提交给教练。'}</p>{d.hint===3&&!latest&&scene.reference&&<small>这是参考表达，其他正确说法也可以。</small>}</aside>}
    {latest&&<div className="eb-feedback"><span className="eb-tag">{latest.feedback.verdict==='clear'?'表达清楚 ✓':'再打磨一点'}</span><p>{latest.feedback.note}</p><p className="eb-muted">你刚才说：{latest.answer}</p><h3>{latest.feedback.verdict==='clear'?'也可以这样说':'参考表达'}</h3><p className="eb-english">{latest.feedback.natural}</p><p>{latest.feedback.explanation}</p><button disabled={busy} onClick={()=>act('collect').then(result=>{if(result)setNotice('已收进表达本；收藏不等于掌握。');})}>收藏这句</button><button disabled={busy} onClick={()=>change({input:latest.answer,history:d.history.slice(0,-1),hint:0,clarificationInput:''})}>再表达一次</button>
     <div className="eb-questions"><h3>对这条反馈有疑问？</h3><p className="eb-muted">可以用中文追问，也可以指出你觉得不对的地方。这里的讨论不占造句轮次。</p>{latest.questions?.map((q,i)=><div className="eb-qa" key={i}><strong>你问：{q.question}</strong><p>{q.answer}</p></div>)}<label htmlFor={'eb-ask-'+(side?'side':'main')}>追问这条反馈</label><textarea id={'eb-ask-'+(side?'side':'main')} value={d.clarificationInput??''} maxLength={4000} disabled={busy} placeholder="例如：为什么这里要用 station？可以只说 subway 吗？" onChange={e=>change({clarificationInput:e.target.value})}/>
      {operation==='ask'&&<div aria-live="polite">{busy&&<p className="eb-status" role="status">{progress}</p>}{busy&&preview&&<p className="eb-stream">{preview}</p>}{!busy&&error&&<p className="eb-error" role="alert">{error}</p>}</div>}
      <div className="eb-row"><button disabled={busy||!d.clarificationInput?.trim()||(latest.questions?.length??0)>=20} onClick={()=>source.evaluate('ask')}>{busy&&operation==='ask'?'正在回答…':'发送追问'}</button>{busy&&<button onClick={()=>source.cancel()}>取消生成</button>}</div></div>
    </div>}
    {d.history.length>=3&&<p className="eb-muted">已经练了 {d.history.length} 次回应，可以继续聊，也可以随时结束本轮。</p>}
    <div className="eb-row eb-end"><button disabled={busy} onClick={()=>act('finish')}>{d.history.length?'结束本轮':'返回场景'}</button>{!latest&&d.hint===3&&!!scene.reference&&<button disabled={busy} onClick={()=>act('collect').then(()=>setNotice('参考表达已收藏'))}>收藏参考句</button>}<small className="eb-muted">切回工作即可，草稿会保留。</small></div>
   </>}
  </>}
  {tab==='cards'&&<><h2>属于你的表达</h2><p className="eb-muted">收藏之后，再试着独立用出来。</p>{!s.cards.length&&<p>练习中点击「收藏这句」，它就会出现在这里。</p>}{s.cards.map(c=><article className="eb-card" key={c.id}><small>{sceneOf(c)?.title}</small><p className="eb-english">{c.expression}</p>{c.original&&<p className="eb-muted">我的原句：{c.original}</p>}<p>{c.note}</p><div className="eb-row"><small>下次复习：{new Date(c.due).toLocaleDateString('zh-CN')}</small><button disabled={busy} onClick={()=>act('delete',{id:c.id})}>移除</button></div></article>)}</>}
  {tab==='review'&&<><h2>先回忆，再看答案。</h2><p className="eb-muted">本次最多复习 5 个表达。判断是否能独立说出来即可。</p>{(!due.length||reviewed>=5)?<div className="eb-hero"><h3>{reviewed?'这次就练到这里。':'暂时没有到期的表达。'}</h3><p>想继续的话，可以去练一个新场景。</p><button onClick={()=>setTab('practice')}>去练习 →</button></div>:due.slice(0,1).map(c=><article className="eb-card" key={c.id}><p>{sceneOf(c)?.context}</p><textarea aria-label="复习时试着写出表达" key={c.id} placeholder="先说出来，或在这里写下你的表达…"/><button onClick={()=>setShow(c.id)}>查看参考</button>{show===c.id&&<><p className="eb-english">{c.expression}</p><p>{c.note}</p><div className="eb-row"><button disabled={busy} onClick={()=>act('review',{id:c.id,remembered:false}).then(result=>{if(result){setReviewed(reviewed+1);setShow('');}})}>还需要提示</button><button className="eb-primary" disabled={busy} onClick={()=>act('review',{id:c.id,remembered:true}).then(result=>{if(result){setReviewed(reviewed+1);setShow('');}})}>能独立表达</button></div></>}</article>)}</>}
  {tab==='settings'&&<><h2>按你的节奏</h2><label>练习方向<select value={s.settings.kind} disabled={busy} onChange={e=>act('settings',{settings:{kind:e.target.value}})}><option value="all">日常与工作均衡</option><option value="daily">更多日常口语</option><option value="work">更多工作英语</option></select></label><label>表达难度<select value={s.settings.level} disabled={busy} onChange={e=>act('settings',{settings:{level:e.target.value}})}><option value="starter">简单实用，适当提示</option><option value="comfortable">能交流，想更自然</option></select></label><label>学习模型<select value={s.settings.modelMode==='manual'?JSON.stringify([s.settings.provider,s.settings.model]):'system'} disabled={busy} onChange={e=>{if(e.target.value==='system'){void act('settings',{settings:{modelMode:'system'}});}else{const [provider,model]=JSON.parse(e.target.value);void act('settings',{settings:{provider,model,modelMode:'manual'}});}}}><option value="system">跟随 DSH 系统默认模型</option><option value={'["",""]'} disabled>手动选择其他模型</option>{models.map(m=><option key={JSON.stringify([m.provider,m.id])} value={JSON.stringify([m.provider,m.id])}>{m.name}</option>)}</select></label>{s.settings.modelMode!=='manual'&&<p className="eb-muted">{systemModel?.available?'当前系统默认：'+systemModel.provider+' / '+systemModel.model:'将使用 DSH 系统默认模型；请确认已在 DSH 设置中配置。'} 系统修改后，下次练习自动跟随。这里跟随全局默认，不跟随某个工作会话的临时选择。</p>}<p className="eb-muted">造句反馈、追问与 AI 随机话题会调用所选模型，可能产生该服务的用量费用。仅发送英语练习内容，不读取工作对话。输出预算为 16384 tokens，最多等待 3 分钟。</p>{modelError&&<p>{modelError}</p>}{!models.length&&<p>没有发现可选模型？请先在 DSH 配置模型服务，再重新打开此页。</p>}<hr/><h3>学习数据</h3><button disabled={busy} onClick={download}>导出备份</button><label className="eb-import">导入备份（替换当前进度）<input type="file" accept="application/json,.json" disabled={busy} onChange={async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;try{if(file.size>2000000)throw new Error('文件不能超过 2 MB');const data=JSON.parse(await file.text());if(window.confirm('导入将替换当前学习进度。确认已备份？'))await source.action('import',{data});}catch(err){setNotice(String(err));}}}/></label><button disabled={busy} onClick={()=>setConfirm('clear')}>清空学习数据</button>{confirm==='clear'&&<div className="eb-error"><p>这会删除草稿、表达本和学习偏好，请先导出备份。</p><button disabled={busy} onClick={()=>act('clear').then(()=>setConfirm(''))}>确认清空</button><button onClick={()=>setConfirm('')}>保留数据</button></div>}<p className="eb-muted">第一版练习文字表达，不提供发音评分。</p></>}
  </>}
 </section>;
}
export function apply(ctx:Context&{connection:ConnectionHandle}){
 const call:Call=async(action,payload={})=>{const response=await ctx.connection.rpc.call('/api','dsh-english-break/'+action,payload);if(!response.ok)throw new Error(response.error.message);return response.value;};
 const source=createSource(call);void source.load();
 ctx.effect(()=>{const style=document.createElement('style');style.textContent=css;document.head.append(style);return()=>style.remove();});
 const open=()=>ctx.layout.selectPanel('dsh-english-break' as MainPanelId);
 ctx.effect(()=>ctx.sidebarRightTabs.register({id:'dsh-english-break/practice',kind:'dsh-english-break',title:()=> '英语空档',keepMounted:true,guide:[{id:'english',order:40,title:()=> '英语空档',description:()=> '等一会儿，练一句英语'}]}));
 ctx.slots.inject('sidebar.right.pane.tab',()=>ctx.slots.register({name:'sidebar.right.pane.tab',key:'dsh-english-break/practice',inject:()=>({source,open,side:true})},App));
 ctx.slots.inject('main',()=>ctx.slots.register({name:'main',key:'dsh-english-break',inject:()=>({source,open})},App));
 ctx.slots.inject('sidebar.panellist',()=>ctx.slots.register({name:'sidebar.panellist',id:'dsh-english-break',order:25,label:'英语空档'},Icon));
}
