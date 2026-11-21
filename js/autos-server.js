// Automations from the server (real runs on your saved lists) once connected. Without a key the example list stays.
(()=>{
// One page for both areas: asks the server for Client Intake (p2) and Toolbox (p3) bots and shows them together.
const AREAS=window.SBDC_AREAS||{intake:{name:'Client Intake',project:'p2'},toolbox:{name:'Toolbox',project:'p3'}};const $=s=>document.querySelector(s);
let list=$('#autoList');if(!list||!window.SBDC_API)return;
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const DOW={SU:'Sunday',MO:'Monday',TU:'Tuesday',WE:'Wednesday',TH:'Thursday',FR:'Friday',SA:'Saturday'};
const hm=(h,m)=>`${(+h)%12||12}:${String(m).padStart(2,'0')} ${+h<12?'AM':'PM'}`;
function sched(s){const p=s.split(':');return p[0]==='daily'?`Every day at ${hm(p[1],p[2])} MST`:p[0]==='weekly'?`Every ${DOW[p[1]]} at ${hm(p[2],p[3])} MST`:`Day ${+p[1]} of each month at ${hm(p[2],p[3])} MST`}
const az=t=>t?new Date(t).toLocaleString('en-US',{timeZone:'America/Phoenix',weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+' MST':'';
const DS={cic:['CIC list','Name, Email and Last contact columns from the CIC "not contacted" export, one client per line.'],sessions:['Session log','Date, Client, Email, Minutes and Type, one session per line.'],intakes:['Intake responses','A JSON array of intake answers, or CSV with a header row of the intake field names.']};
const banner=document.createElement('div');banner.className='card mb-3';banner.innerHTML='<div class="card-body d-flex align-items-center gap-3 flex-wrap"><div class="flex-fill"><b id="asTitle">Run these for real</b><div class="text-secondary" id="asSub">Sign in and these bots run on your own lists.</div></div><button class="btn btn-primary" type="button" id="asConnect">Sign in</button></div>';
list.closest('.card').before(banner);
$('#asConnect').onclick=()=>SBDC_API.open();
let A=[];
async function load(){if(!SBDC_API.connected())return;
  const got=await Promise.allSettled(Object.entries(AREAS).map(([area,x])=>SBDC_API.call(`/v1/automations?project=${x.project}`).then(j=>(j.automations||[]).map(a=>({...a,area})))));
  const ok=got.filter(r=>r.status==='fulfilled');if(!ok.length){$('#asSub').textContent=got[0].reason.message;return}
  const seen=new Set();A=ok.flatMap(r=>r.value).filter(a=>!seen.has(a.id)&&seen.add(a.id));
  if(list.dataset.server!=='1'){const fresh=list.cloneNode(false);fresh.dataset.server='1';list.replaceWith(fresh);list=fresh;list.addEventListener('click',onClick);list.addEventListener('change',onChange);
    document.querySelectorAll('#automations .ex-badge').forEach(b=>b.hidden=true)}
  $('#asTitle').textContent='Signed in: these bots run for real';$('#asSub').textContent='Each bot reads the list you saved for it. Nothing is sent to clients: bots only draft.';$('#asConnect').hidden=true;render()}
function row(a){const ds=DS[a.dataset];const st=a.lastStatus==='waiting'?['Waiting for a list','bg-yellow-lt']:a.lastStatus==='error'?['Error','bg-red-lt']:a.enabled?['Running','bg-green-lt']:['Off','bg-secondary-lt'];
 return `<li class="arow" data-auto="${a.id}" data-area="${a.area}"><div class="ahead" data-space="${a.area}"><div class="amain"><h3 class="card-title" id="as-${a.id}">${esc(a.name)}</h3><span class="badge area-tag" data-space="${a.area}">${esc(AREAS[a.area].name)}</span><p class="tdesc">${esc(a.desc)}</p>
 <div class="ameta"><span>${esc(sched(a.schedule))}</span><span>Last: ${a.lastRun?esc(az(a.lastRun)+' · '+(a.lastDetail||a.lastStatus)):'not run yet'}</span><span>Next: ${a.enabled?esc(az(a.nextRun)):'Off'}</span><span>${esc(ds[0])}: ${a.datasetUpdatedAt?`${a.datasetRows} rows, saved ${esc(az(a.datasetUpdatedAt))}`:'none saved yet'}</span></div></div>
 <div class="actl"><span class="badge apill ${st[1]}">${st[0]}</span><label class="form-check form-switch m-0"><input class="form-check-input asw" type="checkbox" role="switch" ${a.enabled?'checked':''} aria-labelledby="as-${a.id}"><span class="visually-hidden">On</span></label>
 <button class="btn btn-outline-secondary btn-sm asdata" type="button">Paste ${esc(ds[0].replace(/^(Session|Intake)/,m=>m.toLowerCase()))}</button><button class="btn btn-outline-secondary btn-sm asrun" type="button" aria-label="Run ${esc(a.name)} now">Run now</button></div></div>
 ${a.runs.length?`<details class="more"><summary>Last ${a.runs.length} runs</summary><ul class="ahist">${a.runs.map(r=>`<li><span class="dot ${r.status==='done'?'bg-success':r.status==='waiting'?'bg-warning':'bg-danger'}"></span><span>${esc(az(r.started))}</span><span class="ms-auto">${esc(r.detail||r.status)}</span></li>`).join('')}</ul></details>`:''}</li>`}
function render(){list.innerHTML=A.map(row).join('')}
async function onChange(e){const sw=e.target.closest('.asw');if(!sw)return;const id=sw.closest('[data-auto]').dataset.auto;
 try{await SBDC_API.call(`/v1/automations/${id}`,{method:'PATCH',body:{enabled:sw.checked}});await load()}catch(err){sw.checked=!sw.checked;SBDC_API.show('Could not change it',err.message)}}
async function onClick(e){const li=e.target.closest('[data-auto]');if(!li)return;const a=A.find(x=>x.id===li.dataset.auto);
 if(e.target.closest('.asdata')){const ds=DS[a.dataset];const t=await SBDC_API.paste(`Paste your ${ds[0].replace(/^(Session|Intake)/,m=>m.toLowerCase())}`,ds[1]+' It is saved on the server for your bots and replaces the last one.','');if(t==null||!t.trim())return;
  try{const r=await SBDC_API.call(`/v1/data/${a.dataset}`,{method:'POST',body:{text:t}});await load();SBDC_API.show('Saved',`${r.rows} rows saved. Bots that use the ${ds[0].toLowerCase()} read it from now on.`)}catch(err){SBDC_API.show('Not saved',err.message)}return}
 const b=e.target.closest('.asrun');if(b){b.disabled=true;b.textContent='Running…';try{const j=await SBDC_API.call(`/v1/automations/${a.id}/run`,{method:'POST',body:{}});await load();SBDC_API.show(j.output.title,j.output.text)}catch(err){SBDC_API.show('Run failed',err.message);b.disabled=false;b.textContent='Run now'}}}
document.addEventListener('sbdc:api',load);load();
})();
