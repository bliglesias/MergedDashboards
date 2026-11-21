// Advisor Toolbox shell: one router for Client Intake and the Toolbox, greeting, phone menu and nav, Home cards, Automations filter.
// Client intake is one sidebar link with its pages as tabs (#intakeTabs); the Toolbox is the main thing.
// Routes: #/home, #/clients[/<client id>], #/intake/{overview,intake,bring,questions}, #/toolbox[/overview|/<section>], #/outputs[/<tool>], #/automations.
// Old P2/P3 bookmarks (#/overview, #/bring, #/questions, #/intake, #/before…) are mapped to the new routes.
(()=>{
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const ls={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:v}catch(e){return d}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
const AREA_NAME={intake:'Client Intake',toolbox:'Toolbox'};
// Server project per area: Client Intake tools are p2, Toolbox tools are p3. Shared pages keep p3 (the toolbox runs).
const PROJECT={intake:'p2',toolbox:'p3',shared:'p3'};
const INTAKE_PAGES=['overview','intake','bring','questions'];
const LEGACY={overview:['home',''],bring:['intake-bring',''],questions:['intake-questions',''],
  before:['toolbox','before'],during:['toolbox','during'],after:['toolbox','during'],followups:['toolbox','follow'],followup:['toolbox','follow']};

function parse(hash){const p=(hash||'').replace(/^#\/?/,'').split('/').filter(x=>/^[\w-]+$/.test(x));const a=p[0]||'home',b=p[1]||'';
  if(LEGACY[a])return LEGACY[a];
  if(a==='home')return ['home',''];
  if(a==='intake')return [INTAKE_PAGES.includes(b)?'intake-'+b:b?'intake-overview':'intake-intake',''];
  if(a==='toolbox')return b==='overview'?['toolbox-overview','']:['toolbox',b];
  if(a==='outputs'||a==='automations'||a==='clients')return [a,b];
  return ['home','']}
function hashOf(view,sub){if(view.startsWith('intake-'))return '#/intake/'+view.slice(7);if(view==='toolbox-overview')return '#/toolbox/overview';return '#/'+view+(sub?'/'+sub:'')}
const areaOf=v=>v.startsWith('intake')?'intake':v.startsWith('toolbox')?'toolbox':'shared';

let curView=null;
function crumb(t,area){$('#crumbHere').textContent=t;$('#crumbTitle').textContent=t;if(area!==undefined)$('#crumbArea').textContent=AREA_NAME[area]||'Advisor Toolbox'}
function show(view){let title='';$$('[data-view]').forEach(v=>{const on=v.dataset.view===view;v.hidden=!on;if(on)title=v.dataset.title});
  const area=areaOf(view);document.body.dataset.space=area;document.body.dataset.page=view;window.SBDC_PROJECT=PROJECT[area];
  $$('.side a.nl[data-nav]').forEach(a=>{const on=a.dataset.nav===view||(a.dataset.nav==='intake'&&area==='intake');a.classList.toggle('active',on);on?a.setAttribute('aria-current','page'):a.removeAttribute('aria-current')});
  const tab=area==='shared'?(view==='home'?'home':view):area;
  $$('.mob-pills [data-area],.mob-tabbar [data-area]').forEach(a=>{const on=a.dataset.area===tab;a.classList.toggle('active',on);on?a.setAttribute('aria-current','page'):a.removeAttribute('aria-current')});
  mobSub(area,view);
  // Client intake is one sidebar link; its four pages are tabs at the top of the page.
  const it=$('#intakeTabs');if(it){it.hidden=area!=='intake';it.querySelectorAll('[data-tab]').forEach(a=>a.dataset.tab===view?a.setAttribute('aria-current','page'):a.removeAttribute('aria-current'))}
  crumb(title,area);document.title=`${area==='shared'?title:AREA_NAME[area]+' · '+title} · Advisor Toolbox · Maricopa SBDC`;curView=view;
  if(view==='home')paintHome()}
// Phone: a row of page pills for the current area, copied from the sidebar links.
function mobSub(area,view){const box=$('#mobSub');const g=$(`.nav-group[data-area="${area}"]`);const links=g?[...g.querySelectorAll('a.nl:not([hidden])')]:[];box.hidden=links.length<2;if(links.length<2){box.innerHTML='';return}
  box.innerHTML=links.map(a=>`<a class="msub${a.dataset.nav===view?' active':''}" href="${a.getAttribute('href')}"${a.dataset.nav===view?' aria-current="page"':''}>${a.textContent.trim().replace(/\d+$/,'')}</a>`).join('')}
function route(){const [view,sub]=parse(location.hash);const want=hashOf(view,sub);if(location.hash!==want)history.replaceState(null,'',want);
  const changed=view!==curView;if(changed){show(view);window.scrollTo(0,0)}
  document.dispatchEvent(new CustomEvent('sbdc:route',{detail:{view,sub,changed,area:areaOf(view)}}))}
// Routes right away (pushState does not fire hashchange), so callers can use the new page at once.
function go(hash){if(location.hash!==hash)history.pushState(null,'',hash);route()}
window.__go=go;window.__view=()=>curView;window.__show=v=>{history.replaceState(null,'',hashOf(v,''));show(v)};window.__crumb=t=>crumb(t);
window.addEventListener('hashchange',route);

// Greeting and name (Home)
function greet(){const h=new Date().getHours(),g=h<12?'Good morning':h<17?'Good afternoon':'Good evening';const n=ls.get('sbdc-advisor-name','');$('#hello').textContent=n?`${g}, ${n}`:g;$('#setName').textContent=n?'Change name':'Set your name'}
$('#setName').onclick=()=>{const n=prompt('Your first name:',ls.get('sbdc-advisor-name',''));if(n!==null){ls.set('sbdc-advisor-name',n.trim().slice(0,30));greet()}};
greet();

// Phone menu: aria-expanded, focus moves into the menu and back to the button.
(()=>{const b=$('#menuBtn'),sd=$('#side');if(!b||!sd)return;
 const set=(on,back)=>{sd.classList.toggle('open',on);b.setAttribute('aria-expanded',on);if(on){const f=sd.querySelector('a.nl.active')||sd.querySelector('a.nl');f&&f.focus({preventScroll:true})}else if(back)b.focus({preventScroll:true})};
 b.onclick=()=>set(!sd.classList.contains('open'),false);
 document.addEventListener('click',e=>{if(sd.classList.contains('open')&&!sd.contains(e.target)&&!e.target.closest('#menuBtn'))set(false,false)});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&sd.classList.contains('open'))set(false,true)});
 sd.querySelectorAll('a.nl').forEach(a=>a.addEventListener('click',()=>{if(sd.classList.contains('open'))set(false,false)}));
})();

// Home: numbers copied from the Client Intake and Toolbox pages (both live in this document).
const txt=s=>{const e=$(s);return e?e.textContent.trim():''};
function paintHome(){
  const r=txt('#kReady'),pill=$('#kReadyPill'),hp=$('#hReadyPill');$('#hReady').textContent=r||'—';if(pill&&hp){hp.textContent=pill.textContent;hp.className=pill.className}
  $('#hSec').textContent=txt('#sideSec')||'0 of 5';$('#hAsk').textContent=txt('#kMissing')||'—';
  const due=txt('#mobDue');$('#hDuePill').textContent=due==='No list yet'?'No follow-up list':due;
  $('#hRuns').textContent=(txt('#sideUses').match(/\d+/)||['0'])[0];
  const nb=$('#navAuto');$('#hBots').textContent=nb&&!nb.hidden?nb.textContent:'0';
  const no=$('#navOut');$('#hOuts').textContent=no&&!no.hidden?no.textContent:(txt('#oN')||'0');
  const src=$('#ovOuts'),dst=$('#homeOuts');if(src&&dst)dst.innerHTML=src.innerHTML}
let raf=0;const later=()=>{if(!raf)raf=requestAnimationFrame(()=>{raf=0;if(curView==='home')paintHome()})};
document.addEventListener('DOMContentLoaded',()=>{
  const mo=new MutationObserver(later);
  ['#kReady','#kMissing','#sideSec','#mobDue','#sideUses','#navAuto','#navOut','#ovOuts'].forEach(s=>{const e=$(s);e&&mo.observe(e,{childList:true,characterData:true,subtree:true,attributes:true})});
  route()});

// Counter rows on Automations and Outputs stay out of sight while every number in them is zero.
(()=>{const quiet=row=>{row.hidden=!/[1-9]/.test([...row.querySelectorAll('.big')].map(b=>b.textContent).join(' '))};
 ['#aKpis','#oKpis'].forEach(s=>{const row=$(s);if(!row)return;quiet(row);new MutationObserver(()=>quiet(row)).observe(row,{childList:true,characterData:true,subtree:true})})})();

// Automations: filter chips (All / Client Intake / Toolbox)
$$('.afilter [data-filter]').forEach(b=>b.onclick=()=>{const f=b.dataset.filter;$('#automations').dataset.filter=f;
  $$('.afilter [data-filter]').forEach(x=>x.setAttribute('aria-pressed',x===b))});
})();

// Server button: dock it in the top bar (desktop) or the phone top bar instead of floating over cards.
document.addEventListener('DOMContentLoaded',()=>{
  const chip=document.querySelector('.sbdc-chip');if(!chip)return;chip.classList.add('docked');
  const mq=matchMedia('(max-width: 991px)');
  const dock=()=>{const host=mq.matches?document.querySelector('.mob-top .ll-brandblock'):document.querySelector('.topbar');
    if(!host)return;mq.matches?host.after(chip):host.appendChild(chip)};
  dock();mq.addEventListener('change',dock)});
