// Toolbox: tool cards (Setup -> Run), the Setup/Run modal, bots on a schedule, and the Outputs page.
// localStorage: sbdc-setups (advisor preferences + bot schedules) and sbdc-outputs (run results, 50 newest, 30 days).
(()=>{
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const {SECS,TOOLS,AZ,DOW,MON,hm}=window.TB;const T=Object.fromEntries(TOOLS.map(t=>[t.id,t]));
const ic=n=>window.icon(n);
const SKEY='sbdc-setups',OKEY='sbdc-outputs',KEEP=30*864e5,MAXO=50;
const rd=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k));return v??d}catch(e){return d}};
const wr=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
let S=rd(SKEY,{});if(typeof S!=='object'||Array.isArray(S))S={};
let O=rd(OKEY,[]);if(!Array.isArray(O))O=[];O=O.filter(o=>o&&Date.now()-o.t<KEEP).slice(0,MAXO);
const saveS=()=>wr(SKEY,S),saveO=()=>{O=O.slice(0,MAXO);wr(OKEY,O)};
const MEM={};const RUN=new Set();
// The advisor's own name (signature, or how it appears in notes) is typed once and offered to every tool that asks.
const PKEY='sbdc-profile',NAMEF=['sig','me'];let P=rd(PKEY,{});if(typeof P!=='object'||!P||Array.isArray(P))P={};
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);

// ---------- small helpers
function toast(m,link){const t=$('#toast');t.innerHTML=`<span>${esc(m)}</span>${link?` <a class="tlink" href="${link[1]}">${esc(link[0])}</a>`:''}`;t.classList.toggle('act',!!link);t.classList.add('show');clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('show','act'),link?4200:2600)}
window.__toast=toast;
async function copy(text,msg){try{await navigator.clipboard.writeText(text)}catch(e){const a=document.createElement('textarea');a.value=text;document.body.appendChild(a);a.select();document.execCommand('copy');a.remove()}toast(msg||'Copied');window.__lastCopy=text}
function mail(to,subject,body){const href=`mailto:${encodeURIComponent(to||'')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;window.__lastMail=href;let left=false;const off=()=>{left=true};window.addEventListener('blur',off,{once:true});document.addEventListener('visibilitychange',off,{once:true});
 try{location.href=href}catch(e){}setTimeout(()=>{window.removeEventListener('blur',off);if(!left&&!document.hidden){window.__mailFallback=(window.__mailFallback||0)+1;copy(body,'No mail app opened. Text copied instead')}},1100)}
function download(f){const b=new Blob([f.text],{type:f.type||'text/plain'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=f.name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);window.__lastDownload=f;toast(`Downloaded ${f.name}`)}
const openUrl=u=>{window.__lastOpen=u;window.open(u,'_blank','noopener')};
const X={copy,open:openUrl};
// AI picker (top bar)
const sel=$('#ai');try{const s=localStorage.getItem('sbdc-ai');if(s&&window.TB.AI[s])sel.value=s}catch(e){}
sel.onchange=()=>{try{localStorage.setItem('sbdc-ai',sel.value)}catch(e){}};

// ---------- Arizona time + schedules
const az=t=>new Date(t+AZ);
function at(b,base,i){const d=az(base);return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()+i,b.h,b.m)-AZ}
function hits(b,t){const d=az(t);if(b.f==='weekly'&&d.getUTCDay()!==b.dow)return false;if(b.f==='monthly'&&d.getUTCDate()!==1)return false;return true}
function nextAt(b,now){for(let i=0;i<40;i++){const c=at(b,now,i);if(c>now&&hits(b,c))return c}return null}
function prevAt(b,now){for(let i=0;i>-40;i--){const c=at(b,now,i);if(c<=now&&hits(b,c))return c}return null}
function when(t,now=Date.now()){const d=az(t),n=az(now);const days=Math.round((Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())-Date.UTC(n.getUTCFullYear(),n.getUTCMonth(),n.getUTCDate()))/864e5);
 const day=days===0?'Today':days===1?'Tomorrow':days===-1?'Yesterday':days>1&&days<7?DOW[d.getUTCDay()]:`${DOW[d.getUTCDay()]} ${MON[d.getUTCMonth()]} ${d.getUTCDate()}`;return `${day} ${hm(d.getUTCHours(),d.getUTCMinutes())} MST`}
const FULLDOW=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const schedTxt=b=>`${b.f==='daily'?'Every day':b.f==='monthly'?'1st of each month':'Every '+FULLDOW[b.dow]} at ${hm(b.h,b.m)} MST`;
const botsOf=id=>(S[id]&&S[id].bots)||[];
const allBots=()=>Object.entries(S).flatMap(([tool,s])=>(s.bots||[]).map(b=>({...b,tool})));
const outsOf=id=>O.filter(o=>o.tool===id);

// ---------- cards
function state(t){const s=S[t.id],bots=botsOf(t.id),on=bots.filter(b=>b.on),n=on.length+(RUN.has(t.id)?1:0);return {set:!!s,bots,on,n}}
function footHTML(t){const st=state(t),k=outsOf(t.id).length,now=Date.now();let L;
 if(t.soon)L=`<span class="tc-dot"></span><span>Coming soon${st.set?' · Setup saved':''}</span>`;
 else if(st.n){const nx=st.on.map(b=>nextAt(b,now)).filter(Boolean).sort((a,b)=>a-b)[0];L=`<span class="tc-dot on"></span><b>${RUN.has(t.id)&&!st.on.length?'Running…':st.n+' running'}</b>${nx?`<span class="tc-sub">Next ${when(nx,now)}</span>`:''}`}
 else if(st.set){const o=outsOf(t.id)[0];L=`<span class="tc-dot idle"></span><span>Idle</span><span class="tc-sub">${o?'Last run '+when(o.t,now):'No runs yet'}</span>`}
 else L=`<span class="tc-dot"></span><span>Not set up yet</span>`;
 return `${L}<span class="tc-outs">${k?`${k} output${k===1?'':'s'}`:'Outputs'}${ic('arrow-right')}</span>`}
function cardHTML(t){const st=state(t);
 const badge=t.soon?'<span class="badge bg-purple-lt tc-badge">Coming soon</span>':st.set?'<span class="badge bg-green-lt tc-badge">Ready</span>':t.isNew?'<span class="badge bg-blue-lt tc-badge">New</span>':'';
 const main=t.soon?(st.set?'Edit setup':'Setup'):st.set?'Run':'Setup';
 return `<li class="tcell"><article class="tcard card" data-tool="${t.id}" id="tool-${t.id}" data-kw="${esc(t.kw)}" data-running="${st.n}" data-set="${st.set?1:0}">
  <div class="tc-body"><div class="tc-top"><span class="ttile">${ic(t.icon)}</span>${badge}</div>
  <h3 class="card-title" id="tt-${t.id}">${esc(t.title)}</h3><p class="tdesc">${esc(t.desc)}</p>
  <div class="tc-acts"><button class="btn btn-primary btn-sm tc-main" type="button" aria-describedby="tt-${t.id}">${ic(main==='Run'?'player-play':'settings')}${main}</button>${st.set&&!t.soon?`<button class="btn btn-icon btn-ghost-secondary btn-sm tc-gear" type="button" aria-label="Change setup for ${esc(t.title)}" title="Change setup">${ic('settings')}</button>`:''}</div></div>
  <a class="tc-foot${st.n?' live':''}" href="#/outputs/${t.id}" aria-label="${esc(t.title)}: outputs and status">${footHTML(t)}</a></article></li>`}
function renderCard(id){const t=T[id],el=$(`#tool-${id}`);if(!el)return;const f=document.activeElement,cls=f&&f.closest(`#tool-${id}`)?[...f.classList].find(c=>/^tc-(main|gear|foot)$/.test(c)):null;
 el.closest('.tcell').outerHTML=cardHTML(t);if(cls){const n=$(`#tool-${id} .${cls}`)||$(`#tool-${id} .tc-main`);n&&n.focus({preventScroll:true})}window.__filter&&$('#toolSearch').value&&window.__filter(true)}
function renderToolbox(){
 $('#secJump').innerHTML=SECS.map(s=>`<a class="chip" href="#/toolbox/${s.id}">${esc(s.title)}<span>${TOOLS.filter(t=>t.sec===s.id).length}</span></a>`).join('');
 $('#tbSecs').innerHTML=SECS.map(s=>{const ts=TOOLS.filter(t=>t.sec===s.id);return `<section class="tsec" id="sec-${s.id}" aria-labelledby="sh-${s.id}"><header class="tsec-head"><span class="sh-ico">${ic(s.icon)}</span><div class="sh-t"><h2 id="sh-${s.id}">${esc(s.title)}</h2><p>${esc(s.sub)}</p></div><span class="sh-count" data-sec="${s.id}"></span></header>${s.legend?`<ul class="dot-legend" aria-label="Client dots">${s.legend.map(([k,n,d])=>`<li><span class="cdot cdot-${k}" aria-hidden="true"></span><b>${esc(n)}</b><span>${esc(d)}</span></li>`).join('')}</ul>`:''}<ul class="tgrid">${ts.map(cardHTML).join('')}</ul></section>`}).join('');
 counts()}
function counts(){SECS.forEach(s=>{const ts=TOOLS.filter(t=>t.sec===s.id),r=ts.reduce((a,t)=>a+state(t).n,0);const el=$(`.sh-count[data-sec=${s.id}]`);if(el)el.innerHTML=`${ts.length} tools${r?` · <b>${r} running</b>`:''}`});
 const run=TOOLS.reduce((a,t)=>a+state(t).n,0);const nr=$('#navRun');nr.textContent=run;nr.hidden=!run;
 const no=$('#navOut');no.textContent=O.length;no.hidden=!O.length;
 const ov=$('#ovSecs');if(ov)ov.innerHTML=SECS.map(s=>{const ts=TOOLS.filter(t=>t.sec===s.id),r=ts.reduce((a,t)=>a+state(t).n,0);return `<a class="rowlink" href="#/toolbox/${s.id}"><span class="ri">${ic(s.icon)}</span><span class="rt"><b>${esc(s.title)}</b><span>${esc(ts.slice(0,3).map(t=>t.title.replace(/"/g,'')).join(', '))}${ts.length>3?'…':''}</span></span><span class="rs">${ts.length} tools${r?` · ${r} running`:''}</span>${ic('arrow-right')}</a>`}).join('');
 const oo=$('#ovOuts');if(oo)oo.innerHTML=O.length?O.slice(0,4).map(o=>`<a class="rowlink" href="#/outputs/${o.tool}"><span class="ri">${ic(T[o.tool]?.icon||'file-text')}</span><span class="rt"><b>${esc(o.title)}</b><span>${esc(T[o.tool]?.title||'')} · ${when(o.t)}</span></span>${pill(o)}${ic('arrow-right')}</a>`).join(''):`<div class="rowlink empty"><span class="rt"><b>No runs yet</b><span>Set up a tool and run it. Results show up here.</span></span><a class="btn btn-outline-secondary btn-sm" href="#/toolbox">Open Toolbox</a></div>`}
function refresh(id){if(id)renderCard(id);else TOOLS.forEach(t=>renderCard(t.id));counts();renderOutputs();renderBots()}

$('#tbSecs').addEventListener('click',e=>{const c=e.target.closest('.tcard');if(!c)return;const id=c.dataset.tool;
 if(e.target.closest('.tc-gear'))return openModal(id,'setup');if(e.target.closest('.tc-main'))return openModal(id,S[id]&&!T[id].soon?'run':'setup')});

// ---------- modal
const dlg=$('#tm');let cur=null;
const fid=(t,f)=>`f-${t}-${f}`;
function fieldHTML(t,f,val){const id=fid(t.id,f.id),req=f.req?' required aria-required="true"':'',ph=f.ph?` placeholder="${esc(f.ph)}"`:'',cls=`tm-f${f.full?' full':''}`;
 const lab=`${esc(f.label)}${f.req?'<span class="req" aria-hidden="true"> *</span>':''}`;
 if(f.type==='checks'){const v=new Set(Array.isArray(val)?val:[]);return `<fieldset class="${cls} tm-checks" data-f="${f.id}"><legend class="form-label">${lab}</legend>${f.opts.map(([k,l])=>`<label class="form-check"><input class="form-check-input" type="checkbox" name="${id}" value="${k}"${v.has(k)?' checked':''}><span class="form-check-label">${esc(l)}</span></label>`).join('')}</fieldset>`}
 if(f.type==='radio')return `<fieldset class="${cls}" data-f="${f.id}"><legend class="form-label">${lab}</legend><div class="form-selectgroup">${f.opts.map(([k,l])=>`<label class="form-selectgroup-item"><input type="radio" name="${id}" value="${k}" class="form-selectgroup-input"${String(val)===k?' checked':''}><span class="form-selectgroup-label">${esc(l)}</span></label>`).join('')}</div></fieldset>`;
 let ctl;if(f.type==='select')ctl=`<select class="form-select" id="${id}"${req}>${f.opts.map(([k,l])=>`<option value="${esc(k)}"${String(val)===k?' selected':''}>${esc(l)}</option>`).join('')}</select>`;
 else if(f.type==='textarea')ctl=`<textarea class="form-control" id="${id}" rows="${f.rows||3}"${ph}${req}>${esc(val||'')}</textarea>`;
 else ctl=`<input class="form-control" id="${id}" type="${f.type}"${f.type==='number'?' min="0" step="any" inputmode="decimal"':''} value="${esc(val||'')}"${ph}${req}>`;
 return `<div class="${cls}" data-f="${f.id}"><div class="tm-lrow"><label class="form-label" for="${id}">${lab}</label>${f.sample?`<button class="btn btn-link btn-sm tm-sample" type="button" data-sample="${f.id}">Use example rows</button>`:''}</div>${ctl}${f.hint?`<div class="tm-hint">${esc(f.hint)}</div>`:''}</div>`}
const defOf=f=>f.val!==undefined?f.val:f.type==='select'?f.opts[0][0]:f.type==='checks'?[]:'';
function getVal(t,f){if(f.type==='checks')return $$(`#tm [name="${fid(t.id,f.id)}"]:checked`).map(i=>i.value);if(f.type==='radio'){const c=$(`#tm [name="${fid(t.id,f.id)}"]:checked`);return c?c.value:''}const e=$('#'+fid(t.id,f.id));return e?e.value.trim():''}
function openModal(id,mode){const t=T[id];if(!t)return;cur={t,mode};const s=S[id]?.v||{},m=MEM[id]||{};
 $('#tmIcon').innerHTML=ic(t.icon);$('#tmTitle').textContent=(mode==='run'?'Run ':S[id]?'Change setup: ':'Set up ')+t.title;$('#tmDesc').textContent=t.desc;
 $('#tmSetup').innerHTML=t.setup.map(f=>fieldHTML(t,f,NAMEF.includes(f.id)&&!s[f.id]&&P.name?P.name:s[f.id]!==undefined?s[f.id]:defOf(f))).join('');$('#tmSetupSec').hidden=!t.setup.length;
 $('#tmRun').innerHTML=t.run.map(f=>fieldHTML(t,f,m[f.id]!==undefined?m[f.id]:f.from?(s[f.from]||defOf(f)):defOf(f))).join('');$('#tmRunSec').hidden=!t.run.length||!!t.soon;
 $('#tmSoon').hidden=!t.soon;$('#tmSoonTxt').textContent=t.soonText||'';$('#tmSchedBox').hidden=!!t.soon;
 const sw=$('#tmSched');sw.checked=false;sw.setAttribute('aria-checked','false');$('#tmSchedOpts').hidden=true;
 $('#tmSchedHint').textContent=window.SBDC_LISTS&&window.SBDC_LISTS[t.id]?'Adds a bot that runs this tool on your saved clients and puts the result in Outputs. With no saved clients it asks you for a list instead. Times are Arizona time (MST).':t.needsInput?'Adds a bot. This tool needs fresh details each time, so each scheduled run puts a "Needs input" item in Outputs for you to finish.':'Adds a bot that runs this tool with your setup and puts the result in Outputs. Times are Arizona time (MST).';
 const nb=botsOf(id).length;$('#tmBots').hidden=!nb;$('#tmBots').innerHTML=nb?`${nb} bot${nb===1?'':'s'} on this tool. <a href="#/automations">Manage in Automations</a>`:'';
 const rb=$('#tmRunBtn');rb.disabled=!!t.soon;rb.innerHTML=t.soon?`${ic('lock')}Run · coming soon`:`${ic('player-play')}Run`;$('#tmErr').textContent='';
 $('#tmFreq').value='weekly';$('#tmDow').value='1';$('#tmTime').value='08:00';$('#tmDowWrap').hidden=false;
 if(!dlg.open)dlg.showModal();dlg.classList.remove('closing');
 const firstF=(mode==='run'&&t.run.length&&!t.soon?$('#tmRun'):$('#tmSetup')).querySelector('input,select,textarea');(firstF||rb).focus()}
function closeModal(){if(!dlg.open)return;dlg.close();const c=cur&&$(`#tool-${cur.t.id} .tc-main`);if(c&&window.__view()==='toolbox')c.focus({preventScroll:true})}
$('#tmClose').onclick=closeModal;$('#tmCancel').onclick=closeModal;
dlg.addEventListener('click',e=>{if(e.target===dlg)closeModal()});
$('#tmSched').addEventListener('change',e=>{e.target.setAttribute('aria-checked',e.target.checked);$('#tmSchedOpts').hidden=!e.target.checked});
$('#tmFreq').addEventListener('change',e=>{$('#tmDowWrap').hidden=e.target.value!=='weekly'});
$('#tm').addEventListener('click',e=>{const b=e.target.closest('[data-sample]');if(!b||!cur)return;const t=cur.t,ta=$('#'+fid(t.id,b.dataset.sample));
 const setupNow=Object.fromEntries(t.setup.map(f=>[f.id,getVal(t,f)]));ta.value=t.sampleFor?t.sampleFor(setupNow):window.TB.sampleCIC();ta.classList.remove('is-invalid');toast('Example rows added')});
function collect(withRun){const t=cur.t;let bad=null;$$('#tm .is-invalid').forEach(e=>e.classList.remove('is-invalid'));
 const fields=[...t.setup,...(withRun?t.run:[])];const v={};fields.forEach(f=>{v[f.id]=getVal(t,f);if(f.req&&!v[f.id]&&!bad)bad=f});
 if(bad){const e=$('#'+fid(t.id,bad.id));e&&(e.classList.add('is-invalid'),e.focus());$('#tmErr').textContent=`Add ${bad.label.replace(/\s*\(.*?\)/g,'').toLowerCase()} first`;return null}return v}
function persistSetup(t,v){const sv=Object.fromEntries(t.setup.map(f=>[f.id,v[f.id]]));const nm=NAMEF.map(k=>sv[k]).find(Boolean);if(nm&&nm!==P.name){P={...P,name:nm};wr(PKEY,P)}S[t.id]={...(S[t.id]||{}),v:sv,at:Date.now(),bots:botsOf(t.id)};
 let added=false;if($('#tmSched').checked&&!t.soon){const [h,m]=$('#tmTime').value.split(':').map(Number);const b={id:uid(),f:$('#tmFreq').value,dow:+$('#tmDow').value,h:h||8,m:m||0,on:true,created:Date.now(),last:null};
  if(!S[t.id].bots.some(x=>x.f===b.f&&(b.f!=='weekly'||x.dow===b.dow)&&x.h===b.h&&x.m===b.m)){S[t.id].bots.push(b);added=true}}
 saveS();return added}
$('#tmSave').onclick=()=>{const v=collect(false);if(!v)return;const t=cur.t;const added=persistSetup(t,v);closeModal();refresh(t.id);toast(added?`Setup saved. Bot added: ${schedTxt(botsOf(t.id).slice(-1)[0])}`:'Setup saved')};
$('#tmForm').addEventListener('submit',async e=>{e.preventDefault();if(!cur||cur.t.soon)return;const t=cur.t;const v=collect(true);if(!v)return;
 let out=null;
 if(window.SBDC_API){let mode;try{mode=await SBDC_API.ensure()}catch(err){$('#tmErr').textContent=err.message;return}
  if(!mode)return;
  if(mode==='server'){const rb=$('#tmForm [type=submit]');rb&&(rb.disabled=true);$('#tmErr').textContent=t.title.includes('prompt')||['zoom','email','industry'].includes(t.id)?'Working. AI tools take 10 to 60 seconds…':'Working…';
   try{const j=await SBDC_API.run('p3.'+t.id,v);out=j.output;if(out.status==='waiting')out.status='input';
    if(out.engine!=='ai'){const loc=t.exec(v,X);if(loc&&loc.after)out.after=loc.after}}
   catch(err){$('#tmErr').textContent=err.message;return}
   finally{rb&&(rb.disabled=false)}
   $('#tmErr').textContent=''}}
 if(!out)out=t.exec(v,X);if(!out)return;if(out.status==='error'){$('#tmErr').textContent=`${out.title}. ${out.text}`;return}
 MEM[t.id]=Object.fromEntries(t.run.map(f=>[f.id,v[f.id]]));const added=persistSetup(t,v);dlg.close();
 if(out.after)out.after();const rec=finish(t,out,{added});document.dispatchEvent(new CustomEvent('sbdc:run',{detail:{tool:t.id,v,rec}}))});

// ---------- runs and outputs
function finish(t,out,o={}){const rec={id:uid(),tool:t.id,t:Date.now(),status:out.status||'done',ex:!!out.ex,sched:!!o.sched,title:out.title,text:out.text,files:out.files||[],mail:out.mail||null,link:out.link||null,meter:out.meter??null};
 O.unshift(rec);saveO();window.__record&&window.__record(t.id);RUN.add(t.id);refresh(t.id);
 setTimeout(()=>{RUN.delete(t.id);refresh(t.id)},o.sched?300:750);
 if(!o.quiet)setTimeout(()=>{if(!/copied|Copied/.test($('#toast').textContent)||!$('#toast').classList.contains('show'))toast(o.added?'Output ready. Bot added':'Output ready',['View',`#/outputs/${t.id}`])},out.after&&!o.sched?1400:0);
 return rec}
function schedRun(t,b,manual){const s=S[t.id]?.v||{};let out;const rows=window.SBDC_LISTS&&window.SBDC_LISTS[t.id]?window.SBDC_LISTS[t.id]():'';
 if(rows){out=t.exec({...Object.fromEntries(t.run.map(f=>[f.id,defOf(f)])),...s,list:rows},X)||{};delete out.after}
 else if(t.needsInput)out={status:'input',title:`${t.title}: scheduled run`,text:`${manual?'Run':'Scheduled run'} at ${when(Date.now())}. This tool needs details for each run. Choose Finish run to add them.`};
 else{out=t.exec({...Object.fromEntries(t.run.map(f=>[f.id,defOf(f)])),...s},X)||{};delete out.after}
 b.last=Date.now();saveS();return finish(t,out,{sched:true,quiet:!manual})}
function tick(){const now=Date.now();let ran=0;Object.entries(S).forEach(([id,s])=>(s.bots||[]).forEach(b=>{if(!b.on||!T[id])return;const p=prevAt(b,now);if(p&&p>Math.max(b.created||0,b.last||0)){schedRun(T[id],b,false);ran++}}));if(ran)renderBots()}
const STAT={done:['Done','bg-green-lt'],input:['Needs input','bg-yellow-lt'],error:['Error','bg-red-lt']};
const pill=o=>`<span class="badge ${STAT[o.status]?.[1]||'bg-secondary-lt'} o-pill">${STAT[o.status]?.[0]||o.status}</span>`;
const filesOf=o=>o.files&&o.files.length?o.files:[{name:(o.title||'output').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40)+'.txt',type:'text/plain',text:o.text}];
function outHTML(o){const t=T[o.tool]||{title:o.tool==='pull'?'Pulled by the helper':o.tool,icon:'file-text'};const pv=String(o.text||'').split('\n').slice(0,4).join('\n');
 const acts=[o.status==='input'?`<button class="btn btn-primary btn-sm" data-act="finish">${ic('player-play')}Finish run</button>`:'',
  o.status!=='input'?`<button class="btn btn-outline-secondary btn-sm" data-act="copy">${ic('copy')}Copy</button>`:'',
  ...(o.status!=='input'?filesOf(o).map((f,i)=>`<button class="btn btn-outline-secondary btn-sm" data-act="dl" data-i="${i}" title="${esc(f.name)}" aria-label="Download ${esc(f.name)}">${ic('download')}.${esc(f.name.split('.').pop())}</button>`):[]),
  o.mail?`<button class="btn btn-outline-secondary btn-sm" data-act="mail">${ic('mail')}Open in email</button>`:'',
  o.link?`<button class="btn btn-outline-secondary btn-sm" data-act="open">${ic('external-link')}Open</button>`:'',
  `<button class="btn btn-icon btn-ghost-secondary btn-sm" data-act="del" aria-label="Remove this output" title="Remove">${ic('trash')}</button>`].join('');
 return `<li class="orow" data-out="${o.id}" id="out-${o.id}"><div class="o-head"><span class="ttile">${ic(t.icon)}</span><div class="o-main"><b class="o-title">${esc(o.title)}</b>
  <div class="o-meta"><span>${esc(t.title)}</span><span class="o-time">${when(o.t)}</span>${pill(o)}${o.ex?'<span class="badge bg-yellow-lt">Example</span>':''}${o.sched?'<span class="o-tag">'+ic('bolt')+'Bot</span>':''}</div></div></div>
  ${o.meter!=null?`<div class="o-meter" role="img" aria-label="${o.meter}%"><span style="width:${o.meter}%"></span></div>`:''}
  <pre class="o-prev">${esc(pv)}</pre><div class="o-acts">${acts}</div>
  ${o.status!=='input'?`<details class="o-det"><summary>Open details</summary><pre class="o-full">${esc(o.text)}</pre></details>`:''}</li>`}
function renderOutputs(){const f=$('#oTool').value;const L=f?O.filter(o=>o.tool===f):O;
 $('#oList').innerHTML=L.length?L.map(outHTML).join(''):`<li class="o-empty"><span class="ttile">${ic('inbox')}</span><div><b>${f?'No outputs from this tool yet':'No outputs yet'}</b><p>Set up a tool and run it. Every result lands here with copy and download.</p></div><a class="btn btn-primary btn-sm" href="#/toolbox${f?'/'+T[f].sec:''}">Open Toolbox</a></li>`;
 const d=O.filter(o=>o.status==='done').length,n=O.filter(o=>o.status==='input').length;$('#oN').textContent=O.length;$('#oNLbl').textContent=O.length?`latest ${when(O[0].t)}`:'No runs yet';$('#oDone').textContent=d;$('#oNeed').textContent=n;$('#oClear').disabled=!O.length}
$('#oTool').innerHTML='<option value="">All tools</option>'+SECS.map(s=>`<optgroup label="${esc(s.title)}">${TOOLS.filter(t=>t.sec===s.id&&!t.soon).map(t=>`<option value="${t.id}">${esc(t.title.replace(/"/g,''))}</option>`).join('')}</optgroup>`).join('');
$('#oTool').onchange=()=>{const v=$('#oTool').value;history.replaceState(null,'','#/outputs'+(v?'/'+v:''));renderOutputs()};
$('#oList').addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(!b)return;const id=b.closest('[data-out]').dataset.out,o=O.find(x=>x.id===id);if(!o)return;const a=b.dataset.act;
 if(a==='copy')copy(o.text,'Output copied');else if(a==='dl')download(filesOf(o)[+b.dataset.i]);else if(a==='mail')mail(o.mail.to,o.mail.subject,o.mail.body);else if(a==='open')openUrl(o.link);
 else if(a==='finish')openModal(o.tool,'run');else if(a==='del'){O=O.filter(x=>x.id!==id);saveO();refresh(o.tool);toast('Output removed')}});
$('#oClear').onclick=()=>{if(!O.length)return;if(!confirm('Clear all outputs from this browser?'))return;const ids=[...new Set(O.map(o=>o.tool))];O=[];saveO();ids.forEach(renderCard);counts();renderOutputs();toast('Outputs cleared')};

// ---------- Automations: your bots
function botRow(b,now){const t=T[b.tool],o=outsOf(b.tool).find(x=>x.sched);const nx=b.on?nextAt(b,now):null;
 return `<li class="arow" data-bot="${b.id}" data-tool="${b.tool}"><div class="ahead"><span class="ttile">${ic(t.icon)}</span>
 <div class="amain"><h3 class="card-title" id="bn-${b.id}">${esc(t.title)}</h3><p class="tdesc">${t.needsInput?'Reminds you in Outputs to add this run\'s details.':'Runs with your saved setup. Results go to Outputs.'}</p>
 <div class="ameta"><span>${ic('clock')}${schedTxt(b)}</span><span>${ic('history')}Last: ${b.last?when(b.last,now):'not run yet'}</span><span>${ic('calendar-stats')}Next: ${b.on?(nx?when(nx,now):'—'):'Paused'}</span></div></div>
 <div class="actl"><span class="badge apill ${b.on?'bg-green-lt':'bg-secondary-lt'}">${b.on?'Running':'Paused'}</span>
 <label class="form-check form-switch m-0" title="${b.on?'Pause':'Turn on'}"><input class="form-check-input bswitch" type="checkbox" role="switch" aria-checked="${b.on}" ${b.on?'checked':''} aria-labelledby="bn-${b.id}"><span class="visually-hidden">On</span></label>
 <button class="btn btn-outline-secondary btn-sm brun" type="button" aria-label="Run ${esc(t.title)} now">${ic('player-play')}Run now</button>
 <button class="btn btn-icon btn-ghost-secondary btn-sm bdel" type="button" aria-label="Remove this ${esc(t.title)} bot" title="Remove">${ic('trash')}</button></div></div></li>`}
function renderBots(){const now=Date.now(),B=allBots();$('#botList').innerHTML=B.length?B.map(b=>botRow(b,now)).join(''):`<li class="o-empty"><span class="ttile">${ic('bolt')}</span><div><b>No bots yet</b><p>In the Toolbox, open a tool, turn on Run on schedule, then Run or Save setup.</p></div><a class="btn btn-primary btn-sm" href="#/toolbox">Open Toolbox</a></li>`;
 const on=B.filter(b=>b.on);$('#aRun').textContent=on.length;$('#aRunLbl').textContent=B.length?`of ${B.length} bot${B.length===1?'':'s'}`:'No bots yet';
 $('#aPause').textContent=B.length-on.length;$('#aPauseLbl').textContent='turned off';
 const nx=on.map(b=>[nextAt(b,now),b]).filter(x=>x[0]).sort((x,y)=>x[0]-y[0])[0];$('#aNext').textContent=nx?when(nx[0],now):'—';$('#aNextLbl').textContent=nx?T[nx[1].tool].title:'Nothing scheduled';
 const nb=$('#navAuto');nb.textContent=on.length;nb.hidden=!on.length}
const findBot=el=>{const li=el.closest('[data-bot]');const tool=li.dataset.tool;return [tool,(S[tool].bots||[]).find(b=>b.id===li.dataset.bot)]};
$('#botList').addEventListener('change',e=>{const sw=e.target.closest('.bswitch');if(!sw)return;const [tool,b]=findBot(sw);b.on=sw.checked;saveS();refresh(tool);const n=$(`[data-bot="${b.id}"] .bswitch`);n&&n.focus();toast(`${T[tool].title}: ${b.on?'turned on':'paused'}`)});
$('#botList').addEventListener('click',e=>{const r=e.target.closest('.brun'),d=e.target.closest('.bdel');if(!r&&!d)return;const [tool,b]=findBot(r||d);
 if(r){schedRun(T[tool],b,true);renderBots();const n=$(`[data-bot="${b.id}"] .brun`);n&&n.focus()}
 else{S[tool].bots=S[tool].bots.filter(x=>x.id!==b.id);saveS();refresh(tool);toast('Bot removed')}});

// ---------- overview hooks
$$('.kact[data-goto]').forEach(b=>b.onclick=()=>openModal(b.dataset.goto,S[b.dataset.goto]?'run':'setup'));
$('#duePaste').onclick=()=>openModal('tracker','run');
$('#k90Ics').onclick=()=>{const o=O.find(x=>x.tool==='tracker'&&x.files&&x.files.some(f=>f.name.endsWith('.ics')));if(!o){toast("Run Who's due first");return}download(o.files.find(f=>f.name.endsWith('.ics')))};

// ---------- sticky section headers: glass only while stuck
let stickTop=56;function measure(){const m=$('.mob-top'),tb=$('.topbar');stickTop=(m&&getComputedStyle(m).display!=='none')?m.offsetHeight:(tb?tb.offsetHeight:56);document.documentElement.style.setProperty('--stick',stickTop+'px')}
let raf=0;function stuck(){raf=0;$$('.tsec-head').forEach(h=>{const r=h.getBoundingClientRect(),s=h.parentElement.getBoundingClientRect();h.classList.toggle('stuck',r.top<=stickTop+1&&s.bottom>stickTop+r.height+8&&s.top<stickTop)})}
addEventListener('scroll',()=>{if(!raf)raf=requestAnimationFrame(stuck)},{passive:true});addEventListener('resize',()=>{measure();stuck()});
document.addEventListener('sbdc:route',e=>{const {view,sub}=e.detail;
 if(view==='toolbox'&&sub){const s=$('#sec-'+sub);if(s){measure();const y=s.getBoundingClientRect().top+scrollY-stickTop-8;scrollTo({top:Math.max(0,y),behavior:'instant'});const h=s.querySelector('.tsec-head');h.classList.remove('flash');void h.offsetWidth;h.classList.add('flash')}}
 if(view==='outputs'){const v=T[sub]?sub:'';if($('#oTool').value!==v){$('#oTool').value=v;renderOutputs()}}
 requestAnimationFrame(stuck)});

renderToolbox();renderOutputs();renderBots();counts();measure();tick();setInterval(tick,30000);
// A page the Advisor Helper extension pulled (the advisor clicked "Pull"). Kept as an output; text only.
// The 5 newest pulls are kept, and the pull is refused if this browser has no room to store it.
function addPull(p){if(!p||typeof p.text!=='string'||!p.text.trim())return false;const before=O;
 const rec={id:uid(),tool:'pull',t:Date.now(),status:'done',ex:false,sched:false,title:String(p.title||'Pulled page').replace(/\s+/g,' ').trim().slice(0,120)||'Pulled page',text:p.text.slice(0,150000),files:[],mail:null,link:null,meter:null};
 let n=0;O=[rec,...O.filter(o=>o.tool!=='pull'||++n<5)].slice(0,MAXO);
 try{localStorage.setItem(OKEY,JSON.stringify(O))}catch(e){O=before;return false}
 refresh();toast('Pulled page saved',['View','#/outputs']);return true}
window.__tb={S:()=>S,O:()=>O,openModal,tick,T,cur:()=>cur?cur.t.id:'',addPull};
})();
