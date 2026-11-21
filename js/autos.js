// Automations page, Examples list for Client Intake and Toolbox (your own bots and the KPIs come from toolbox.js). Example data only, kept in memory: toggles reset on reload and nothing is written to storage.
(()=>{
const $=s=>document.querySelector(s);
const list=$('#autoList');if(!list)return;
const A=(window.AUTOS||[]).map(a=>({...a,runs:[]}));
const H=36e5,D=864e5,AZ=-7*H; // Arizona is UTC-7 all year (no daylight saving)
const DOW=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const az=t=>new Date(t+AZ);
const hm=(h,m)=>`${h%12||12}:${String(m).padStart(2,'0')} ${h<12?'AM':'PM'}`;
function hits(a,t){const d=az(t);if(a.s.type==='weekly'&&d.getUTCDay()!==a.s.dow)return false;if(a.s.type==='monthly'&&d.getUTCDate()!==1)return false;return true}
function at(a,base,i){const d=az(base);return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()+i,a.s.h,a.s.m)-AZ}
function next(a,now){if(a.s.type==='event')return null;for(let i=0;i<40;i++){const c=at(a,now,i);if(c>now&&hits(a,c))return c}return null}
function prevN(a,now,n){const out=[];if(a.s.type==='event'){let t=now-a.s.ago*H;for(let i=0;i<n;i++){out.push(t);t-=a.s.every*H}return out}
  for(let i=0;i>-200&&out.length<n;i--){const c=at(a,now,i);if(c<=now&&hits(a,c))out.push(c)}return out}
function when(t,now){const d=az(t),n=az(now);const days=Math.round((Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())-Date.UTC(n.getUTCFullYear(),n.getUTCMonth(),n.getUTCDate()))/D);
  const day=days===0?'Today':days===1?'Tomorrow':days>1&&days<7?DOW[d.getUTCDay()]:`${DOW[d.getUTCDay()]} ${MON[d.getUTCMonth()]} ${d.getUTCDate()}`;return `${day} ${hm(d.getUTCHours(),d.getUTCMinutes())} MST`}
function rel(t,now){const m=Math.round((now-t)/6e4);if(m<1)return 'just now';if(m<60)return m+' min ago';const h=Math.round(m/60);if(h<24)return h+(h===1?' hour ago':' hours ago');const d=Math.round(h/24);return d===1?'yesterday':d+' days ago'}
function sched(a){const s=a.s,t=s.h!=null?hm(s.h,s.m)+' MST':'';return s.type==='weekly'?`Every ${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][s.dow]} at ${t}`:s.type==='daily'?`Every day at ${t}`:s.type==='monthly'?`1st of each month at ${t}`:s.text}
const cnt=(a,n)=>`${n} ${n===1?a.unit[0]:a.unit[1]}`;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const AREAS=window.SBDC_AREAS||{};
const tag=a=>AREAS[a.area]?`<span class="badge area-tag" data-space="${a.area}">${esc(AREAS[a.area].name)}</span>`:'';
const now0=Date.now();
A.forEach(a=>{a.runs=prevN(a,now0,5).map((t,i)=>({t,n:a.hist[i]??0,fail:a.state==='error'&&i===0}))});
const PILL={running:['Running','bg-green-lt'],paused:['Paused','bg-secondary-lt'],error:['Error','bg-red-lt']};
function toast(m){const t=$('#toast');if(!t)return;t.textContent=m;t.classList.add('show');clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('show'),2200)}
function res(a,r){return r.fail?`Failed: ${a.err}`:r.test?'Test run, nothing sent':cnt(a,r.n)}
function row(a,now){const p=PILL[a.state],on=a.state!=='paused',nx=on?next(a,now):null,last=a.runs[0];
 return `<li class="arow" data-auto="${a.id}" data-area="${a.area||''}"><div class="ahead" data-space="${a.area||''}">
  <span class="ttile"><i data-icon="${a.icon}"></i></span>
  <div class="amain"><h3 class="card-title" id="an-${a.id}">${esc(a.name)}</h3>${tag(a)}<p class="tdesc">${esc(a.desc)}</p>
   <div class="ameta"><span><i data-icon="clock"></i>${esc(sched(a))}</span><span><i data-icon="history"></i>Last: ${last?rel(last.t,now)+' · '+esc(res(a,last)):'not run yet'}</span><span><i data-icon="calendar-stats"></i>Next: ${on?(nx?when(nx,now):esc(a.s.next||'On the next trigger')):'Paused'}</span></div></div>
  <div class="actl"><span class="badge apill ${p[1]}">${p[0]}</span>
   <label class="form-check form-switch m-0" title="${on?'Turn off':'Turn on'}"><input class="form-check-input aswitch" type="checkbox" role="switch" aria-checked="${on}" ${on?'checked':''} aria-labelledby="an-${a.id}"><span class="visually-hidden">On</span></label>
   <button class="btn btn-outline-secondary btn-sm arun" type="button" aria-label="Run ${esc(a.name)} now"><i data-icon="player-play"></i>Run now</button></div>
 </div><details class="more"><summary>Last ${Math.min(5,a.runs.length)} runs</summary><ul class="ahist">${a.runs.slice(0,5).map(r=>`<li><span class="dot ${r.fail?'bg-danger':r.test?'bg-secondary':'bg-success'}"></span><span>${when(r.t,now).replace(' MST','')}</span><span class="ms-auto">${esc(res(a,r))}</span></li>`).join('')}</ul></details></li>`}
function render(){const now=Date.now();list.innerHTML=A.map(a=>row(a,now)).join('');if(window.renderIcons)window.renderIcons(list);
}
list.addEventListener('change',e=>{const sw=e.target.closest('.aswitch');if(!sw)return;const id=sw.closest('[data-auto]').dataset.auto,a=A.find(x=>x.id===id);
 a.state=sw.checked?'running':'paused';render();const n=list.querySelector(`[data-auto="${id}"] .aswitch`);n&&n.focus();toast(`${a.name}: ${sw.checked?'turned on':'paused'}`)});
list.addEventListener('click',e=>{const b=e.target.closest('.arun');if(!b)return;const id=b.closest('[data-auto]').dataset.auto,a=A.find(x=>x.id===id);
 a.runs.unshift({t:Date.now(),n:0,test:true});a.runs=a.runs.slice(0,5);if(a.state==='error')a.state='running';render();const n=list.querySelector(`[data-auto="${id}"] .arun`);n&&n.focus();toast('Example: nothing ran')});
window.__autos=A;render();
})();
