// Toolbox layer: tool search, usage sparkline, follow-ups card. Routing, greeting and menu are in shell.js.
(()=>{
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const ls={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:v}catch(e){return d}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};

let searching=false;
// Leaving the Toolbox tools page clears the tool search.
document.addEventListener('sbdc:route',e=>{const {view,sub}=e.detail;if(searching&&!(view==='toolbox'&&!sub)){$('#toolSearch').value='';filter(true)}});

// ---- Search: filters tool cards on the Toolbox page
function filter(quiet){const q=$('#toolSearch').value.trim().toLowerCase();let shown=0;
 $$('.tcard').forEach(c=>{const hay=(c.dataset.kw+' '+c.textContent).toLowerCase();const ok=!q||q.split(/\s+/).every(w=>hay.includes(w));c.closest('.tcell').hidden=!ok;if(ok)shown++});
 $$('.tsec').forEach(s=>s.hidden=!s.querySelector('.tcell:not([hidden])'));
 searching=!!q;$('#noMatch').hidden=!q||shown>0;$('#searchHead').hidden=!q;$('#tbHead').hidden=!!q;
 if(q){$('#searchSub').textContent=`${shown} tool${shown===1?'':'s'} matching "${$('#toolSearch').value.trim()}".`;if(window.__view()!=='toolbox')window.__show('toolbox');window.__crumb('Search results')}
 else if(!quiet&&window.__view())window.__crumb($(`[data-view=${window.__view()}]`).dataset.title)}
$('#toolSearch').addEventListener('input',()=>filter());
window.__filter=filter;

// ---- Usage sparkline (tool ids + run times only)
const KEY='sbdc-tool-use';
function load(){try{const u=JSON.parse(ls.get(KEY,'{}'));return u&&typeof u==='object'?u:{}}catch(e){return {}}}
function record(id){const u=load(),now=Date.now(),cut=now-30*864e5;const e=u[id]||{t:[]};e.t=(e.t||[]).filter(x=>x>cut).concat(now).slice(-50);u[id]=e;ls.set(KEY,JSON.stringify(u));spark()}
window.__record=record;
function spark(){const u=load();const day=d=>{const x=new Date(d);x.setHours(0,0,0,0);return +x};const today=day(Date.now());const days=[...Array(7)].map((_,i)=>today-(6-i)*864e5);
 const c=days.map(()=>0);Object.values(u).forEach(e=>(e.t||[]).forEach(t=>{const i=days.indexOf(day(t));if(i>=0)c[i]++}));
 const tot=c.reduce((a,b)=>a+b,0);$('#sideUses').textContent=`${tot} run${tot===1?'':'s'}`;
 const mx=Math.max(1,...c),pts=c.map((v,i)=>`${(i*200/6).toFixed(1)},${(42-v/mx*36).toFixed(1)}`).join(' ');
 $('#useSpark').innerHTML=`<defs><linearGradient id="usA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9f8cff" stop-opacity=".25"/><stop offset="1" stop-color="#9f8cff" stop-opacity="0"/></linearGradient></defs><polygon points="0,46 ${pts} 200,46" fill="url(#usA)"/><polyline points="${pts}" fill="none" stroke="#9f8cff" stroke-width="2"/>`}
spark();

// ---- Follow-ups due card (counts only, from the last list you ran; kept in memory)
function tracker(){const T=window.__tracker||{rows:[],sample:false};const r=T.rows,n=r.length;
 const b={k30:r.filter(x=>x.days>=30&&x.days<60).length,k60:r.filter(x=>x.days>=60&&x.days<90).length,k90:r.filter(x=>x.days>=90).length};const recent=n-b.k30-b.k60-b.k90;
 $('#kSrc').textContent=n?(T.sample?'Example data':T.saved?'Your saved clients':'Your pasted list'):'No list';$('#kSrc').className='ms-auto badge '+(n?(T.sample?'bg-yellow-lt':'bg-green-lt'):'bg-secondary-lt');
 $('#dueEmpty').hidden=!!n;$('#dueFull').hidden=!n;
 $('#kTotal').textContent=n||'—';$('#kTotalLbl').textContent=n?`clients in the list · ${b.k30+b.k60+b.k90} due`:'';
 $('#kRecent').textContent=n?recent:'—';for(const k in b)$('#'+k).textContent=n?b[k]:'—';
 const due=b.k30+b.k60+b.k90;$('#mobDue').textContent=n?`${due} due`:'No list yet';
 const bars=[['Under 30',recent,'#35d28a','#01b574'],['30–59',b.k30,'#21d4fd','#0075ff'],['60–89',b.k60,'#ffcd75','#f6ad55'],['90+',b.k90,'#ee5d50','#e31a1a']];
 const ch=$('#kChart');if(n&&!ch.dataset.grown){ch.dataset.grown='1';ch.classList.add('grow');setTimeout(()=>ch.classList.remove('grow'),700)}
 let x=0;const W=400,gap=n?3:0;ch.innerHTML=n?'<defs>'+bars.map(([l,v,c,d],i)=>`<linearGradient id="kb${i}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="${d}"/></linearGradient>`).join('')+'</defs>'+bars.map(([l,v],i)=>{const w=v?Math.max(4,v/n*W-gap):0,r=`<rect x="${x.toFixed(1)}" y="0" width="${w.toFixed(1)}" height="14" rx="5" fill="url(#kb${i})"><title>${l}: ${v}</title></rect>`;x+=v?w+gap:0;return r}).join(''):'';
 ch.setAttribute('aria-label',n?`Clients by days since last contact: ${bars.map(([l,v])=>l+' '+v).join(', ')}`:'No list yet')}
document.addEventListener('sbdc:tracker',tracker);tracker();
})();
