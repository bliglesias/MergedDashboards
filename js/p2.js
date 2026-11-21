// Client Intake: branching intake form, client brief, readiness flags, what to bring, form questions.
(()=>{
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const f=$('#f');
const money=n=>n===''||n==null||isNaN(n)?'':'$'+Number(n).toLocaleString('en-US',{maximumFractionDigits:2});
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('show'),2200)}
async function copy(text,msg){try{await navigator.clipboard.writeText(text)}catch(e){const a=document.createElement('textarea');a.value=text;document.body.appendChild(a);a.select();document.execCommand('copy');a.remove()}toast(msg||'Copied')}
window.__copy=copy;

const STAGE={idea:'Idea, no sales yet (pre-venture)',startup:'Startup, just started selling',existing:'Established business'};
const PLACE={online:'Online / mobile only',home:'From home',physical:'Physical location',planned:'Plans a physical location'};
const CREDIT={unknown:"Doesn't know",lt620:'Below 620','620':'620 to 679','680':'680 to 719','720':'720 or higher'};
const ONLINE={both:'Website and social',social:'Social only',none:'Neither yet'};
const YNU={yes:'Yes',no:'No',unsure:'Not sure'};const TPT={...YNU,na:'Not needed'};

function data(){
  const fd=new FormData(f), d={};
  for(const [k,v] of fd.entries()){ if(k==='docs'||k==='assist'){(d[k]=d[k]||[]).push(v)} else d[k]=typeof v==='string'?v.trim():v }
  d.docs=d.docs||[]; d.assist=d.assist||[]; return d;
}
function applyBranches(d){
  $$('[data-show]').forEach(el=>{
    const [k,vals]=el.dataset.show.split(':'); el.hidden=!vals.split(',').includes(d[k]||'');
  });
}
function math(d){
  const p=+d.price,c=+d.cost,fx=+d.fixed,v=+d.volume; const o={};
  if(d.price&&d.cost){o.margin=p-c;o.marginPct=p?Math.round((p-c)/p*100):0;
    if(d.fixed&&o.margin>0)o.breakeven=Math.ceil(fx/o.margin);
    if(d.volume)o.monthlyProfit=Math.round(v*o.margin-(fx||0));}
  return o;
}
function flags(d){
  const F=[]; const add=(level,text,ask)=>F.push({level,text,ask});
  const isNew=d.stage==='idea'||d.stage==='startup', wantsMoney=d.funding==='yes'||d.funding==='maybe';
  if(!d.stage) add('bad','Business stage not known','Where is the business today: idea, just started, or established?');
  // financials
  if(d.stage==='existing'){
    d.docs.includes('Financial statements')?add('ok','Financial statements ready'):add('bad','No financial statements yet','Can you bring your last 12 months of financial statements (profit and loss, balance sheet)?');
    d.revenue?add('ok','Sales figure given'):add('warn','Sales for last 12 months missing','What were your total sales over the last 12 months?');
  }
  if(isNew){
    (d.price&&d.cost)?add('ok','Has run basic numbers (price and cost per sale)'):add('bad',"Hasn't run the numbers yet",'What will you charge for one sale, and what does it cost you to make or deliver it?');
    if(!d.fixed) add('warn','Monthly fixed costs unknown','What will you pay every month no matter what (rent, insurance, loan payments)?');
    if(!d.projection&&!d.volume) add('warn','No sales estimate','How many sales do you expect in a typical month?');
  }
  if(wantsMoney){
    (d.amount||'')!==''&&!d.amountUnknown?add('ok','Knows how much money they need'):add('bad',"Doesn't know how much money they need",'How much money do you need, and what exactly will it pay for?');
    if(!d.use) add('warn','Use of funds not stated','What will the money pay for?');
    (!d.credit||d.credit==='unknown')?add('bad','Personal credit score unknown','Do you know your personal credit score? (Free checks are available through most banks and card issuers.)'):add('ok','Knows credit score range');
    d.liquid?add('ok','Liquid assets stated'):add('warn','Cash they can put in unknown','How much of your own cash could you put into the business?');
    d.loanChecklist?add('ok','Has the loan checklist'):add('warn','Loan checklist not sent yet','Send the loan document checklist before session 1.');
  }
  if(d.ein==='yes') add('ok','Has a federal EIN');
  else if(d.ein==='no'||d.ein==='unsure') add('warn',d.ein==='no'?'No federal EIN yet':'Not sure if they have an EIN','Do you have a federal EIN (Employer Identification Number)? It is free from the IRS.');
  if(d.tpt==='yes') add('ok','Has an Arizona TPT license');
  else if(d.tpt==='no'||d.tpt==='unsure') add('warn',d.tpt==='no'?'No Arizona TPT license yet':'Not sure about the Arizona TPT license','Do you sell anything taxable in Arizona? If so, you may need a TPT (sales tax) license from ADOR.');
  if(d.llc==='yes') add('ok','Entity registered');
  else if(d.llc==='unsure') add('warn','Not sure if they have an LLC: check ACC','Is the business registered with the Arizona Corporation Commission? Under what name?');
  else if(d.llc==='no') add('warn','No LLC or entity yet','Have you thought about how to set up the business (LLC, sole proprietor, other)?');
  else add('warn','LLC status not asked','Is the business registered as an LLC or other entity?');
  if((d.place==='physical'||d.place==='planned')){ d.sqft?add('ok','Location size known'):add('warn','Square footage unknown','How big is the space, in square feet?'); }
  if(wantsMoney||d.place==='physical'||d.place==='planned'){
    d.assets?add('ok','Assets listed'):add('warn','No asset list','Please list your buildings, tools and equipment, and what each cost.');
    if(d.assets&&!d.proof) add('warn','No proof of equipment costs','Can you bring receipts or quotes for the equipment?');
  }
  if(d.online==='none') add('warn','No website or social media yet');
  else if(d.online) add('ok','Has an online presence');
  if(d.stage==='existing'&&!d.docs.includes('Business plan')) add('warn','No business plan on hand');
  return F;
}
let exampleMode=false;const hist=[];
function filled(el){if(el.type==='radio')return !!f.querySelector(`[name="${el.name}"]:checked`);return (el.value||'').trim()!==''}
function sections(){return $$('fieldset.sec').map(fs=>{const vis=!fs.hidden;const seen=new Set(),fields=[];
  fs.querySelectorAll('input,select,textarea').forEach(el=>{if(el.type==='checkbox'||el.name==='notes'||el.hasAttribute('data-opt'))return;if(el.closest('[hidden]'))return;if(el.type==='radio'){if(seen.has(el.name))return;seen.add(el.name)}fields.push(el)});
  const done=fields.filter(filled).length;return {fs,title:fs.dataset.title,vis,total:fields.length,done,pct:fields.length?Math.round(done/fields.length*100):0}})}
function spark(){const svg=$('#kSpark');if(hist.length<2){svg.innerHTML='<line x1="0" y1="40" x2="200" y2="40" stroke="rgba(255,255,255,.18)" stroke-dasharray="4 4"/>';return}
  const n=hist.length,pts=hist.map((v,i)=>[i/(n-1)*196+2,42-v/100*38]);const dp=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
  const last=pts[n-1];svg.innerHTML=`<defs><linearGradient id="spA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#21d4fd" stop-opacity=".35"/><stop offset="1" stop-color="#0075ff" stop-opacity="0"/></linearGradient><linearGradient id="spL" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0075ff"/><stop offset="1" stop-color="#21d4fd"/></linearGradient></defs><path d="${dp} L198 44 L2 44Z" fill="url(#spA)"/><path d="${dp}" fill="none" stroke="url(#spL)" stroke-width="2.5" vector-effect="non-scaling-stroke" style="filter:drop-shadow(0 0 4px rgba(33,212,253,.5))"/><circle cx="${last[0]}" cy="${last[1]}" r="3.5" fill="#21d4fd" stroke="#0a0f2e" stroke-width="1.5"/>`}
function dash(d,F,any){
  const ok=F.filter(x=>x.level==='ok').length,warn=F.filter(x=>x.level==='warn').length,bad=F.filter(x=>x.level==='bad').length,tot=F.length||1;
  const pct=any?Math.round(ok/tot*100):0;
  if(any&&!hist.length)hist.push(0);if(any&&hist[hist.length-1]!==pct){hist.push(pct);if(hist.length>40)hist.shift()}
  $('#kReady').textContent=any?pct+'%':'—';$('#kRing').style.setProperty('--p',pct);$('#mobReady').textContent=any?pct+'% ready':'Not started';
  $('#kReadyLbl').textContent=any?`${ok} of ${F.length} readiness items in place`:'Nothing entered yet';$('#kStart').hidden=any;
  const rp=$('#kReadyPill');const st=!any?['Not started','bg-secondary-lt']:pct>=80?['Ready','bg-green-lt']:pct>=50?['Getting there','bg-yellow-lt']:['Needs prep','bg-red-lt'];rp.textContent=st[0];rp.className='ms-auto badge '+st[1];
  spark();
  $('#kMissing').textContent=any?bad+warn:'—';$('#kMissingLbl').innerHTML=any?'Items to cover in session&nbsp;1':'Shows up as you fill the intake';$('#kOk').textContent=any?ok:'—';$('#kWarn').textContent=any?warn:'—';$('#kBad').textContent=any?bad:'—';
  const w=x=>(any?x/tot*100:0)+'%';$('#kbOk').style.width=w(ok);$('#kbWarn').style.width=w(warn);$('#kbBad').style.width=w(bad);
  const nm=$('#navMissing');nm.hidden=!any||!(bad+warn);nm.textContent=bad+warn;
  const fp=$('#kFundPill'),fund={yes:['Funding request','bg-blue-lt'],maybe:['Maybe later','bg-yellow-lt'],no:['No funding','bg-secondary-lt']}[d.funding]||['Not asked','bg-secondary-lt'];fp.textContent=fund[0];fp.className='ms-auto badge '+fund[1];
  $('#kFund').textContent=d.funding==='yes'||d.funding==='maybe'?(d.amountUnknown||!d.amount?'Amount unknown':money(d.amount)):d.funding==='no'?'None':'—';
  $('#kFundLbl').textContent=d.funding==='yes'||d.funding==='maybe'?(d.use?'For: '+d.use:'Use of funds not stated yet'):d.funding==='no'?'Not looking for a loan right now':'Ask if they want a loan or other funding';
  $('#kRoute').innerHTML=window.icon('users')+'<span>'+(d.funding==='yes'?'Consider routing to a Funding advisor':d.funding==='maybe'?'Send the loan checklist so they can get ready':'Routing shows here when there\'s a funding request')+'</span>';
  const S=sections(),vis=S.filter(x=>x.vis),done=vis.filter(x=>x.pct===100).length;
  vis.forEach((x,i)=>{const n=x.fs.querySelector('.secnum');if(n)n.textContent=i+1});
  S.forEach(x=>{const pill=x.fs.querySelector('.secpill'),bar=x.fs.querySelector('.secbar');bar.style.width=x.pct+'%';const p=x.pct===100?['Complete','bg-green-lt']:x.done?[`${x.done}/${x.total} answered`,'bg-yellow-lt']:['Not started','bg-secondary-lt'];pill.textContent=p[0];pill.className='badge ms-auto secpill '+p[1];bar.className='progress-bar secbar'+(x.pct===100?' bg-success':'')});
  $('#kSec').textContent=done;$('#kSec').nextElementSibling.textContent='/'+vis.length;$('#sideSec').textContent=`${done} of ${vis.length}`;$('#sideBar').style.width=(vis.length?done/vis.length*100:0)+'%';
  const next=vis.find(x=>x.pct<100);$('#kSecLbl').textContent=next?'Next: '+next.title:'All sections done';
  $('#kSecList').innerHTML='<div class="seclist">'+vis.map(x=>`<div><span class="dot ${x.pct===100?'bg-success':x.done?'bg-warning':'bg-secondary'}"></span>${esc(x.title)}<span class="ms-auto text-secondary">${x.pct}%</span></div>`).join('')+'</div>';
  $('#exBadge').hidden=!exampleMode;
  $('#ovIntake').textContent=`${done} of ${vis.length} sections`+(any&&(bad+warn)?` · ${bad+warn} to ask`:'');
}
function sessWhen(d){if(!d.sdate)return '';const [y,mo,da]=d.sdate.split('-').map(Number);const dt=new Date(Date.UTC(y,mo-1,da,12));let t=dt.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});
  if(d.stime){const [h,m]=d.stime.split(':').map(Number);t+=` · ${h%12||12}:${String(m).padStart(2,'0')} ${h<12?'AM':'PM'} MST`}return t}
window.__sessWhen=sessWhen;
function line(k,v){return v?`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`:''}
function render(){
  const d=data(); applyBranches(d);
  const m=math(d), F=flags(d), ok=F.filter(x=>x.level==='ok').length, total=F.length;
  const wantsMoney=d.funding==='yes'||d.funding==='maybe';
  const any=Object.entries(d).some(([k,v])=>Array.isArray(v)?v.length:v);
  dash(d,F,any);
  if(!any){$('#brief').innerHTML='<p class="empty">Start filling in the form, or load an example client, and the brief builds itself here.</p>';return}
  let h=`<div class="score"><b>${ok}/${total}</b><span>readiness items in place</span></div>`;
  if(d.funding==='yes') h+=`<div class="route">Funding request: consider routing to a Funding advisor.</div>`;
  h+=`<h4>Snapshot</h4><dl>${line('Client',d.client)}${line('Session 1',sessWhen(d))}${line('Business',d.biz)}${line('Sells',d.industry)}${line('Stage',STAGE[d.stage])}${line('In business',d.years)}${line('Ownership',d.owners)}${line('Wants help with',d.goal)}${line('Expects from SBDC',d.expect)}${line('Email',d.email)}</dl>`;
  const nums=line('Own money in',money(d.invested))+line('Employees',d.employees)+line('Sales, last 12 mo',money(d.revenue))+line('Expected sales, yr 1',money(d.projection));
  const bm=d.price&&d.cost?line('One sale',`${d.unit||'unit'}: ${money(d.price)} price, ${money(d.cost)} cost (${m.marginPct}% margin)`)+line('Break-even',m.breakeven?`${m.breakeven.toLocaleString()} sales a month`:(m.margin<=0?'Price is at or below cost':''))+line('At expected volume',m.monthlyProfit!=null?`${money(m.monthlyProfit)} a month ${d.fixed?'after':'before'} fixed costs`:''):'';
  if(nums||bm) h+=`<h4>Numbers</h4><dl>${nums}${bm}${line('Fixed costs / mo',money(d.fixed))}</dl>`;
  if(wantsMoney) h+=`<h4>Funding</h4><dl>${line('Wants',d.amountUnknown?"Doesn't know yet":money(d.amount))}${line('For',d.use)}${line('Credit score',CREDIT[d.credit]||'Not asked')}${line('Cash to put in',money(d.liquid))}${line('Loan checklist',d.loanChecklist?'Has it':'Not yet')}</dl>`;
  h+=`<h4>Legal &amp; location</h4><dl>${line('LLC / entity',{yes:'Yes',no:'No',unsure:'Not sure'}[d.llc]||'Not asked')}${line('Federal EIN',YNU[d.ein])}${line('Arizona TPT',TPT[d.tpt])}${line('Operates',PLACE[d.place])}${line('Size',d.sqft?Number(d.sqft).toLocaleString()+' sq ft':'')}${line('Online',ONLINE[d.online])}</dl>`;
  if(d.assets||d.docs.length) h+=`<h4>Assets &amp; documents</h4><dl>${line('Assets',d.assets)}${d.assets?line('Proof of costs',d.proof?'Yes':'Not yet'):''}${line('Documents ready',d.docs.join(', '))}</dl>`;
  if(d.notes) h+=`<h4>Notes</h4><p>${esc(d.notes)}</p>`;
  h+=`<h4>Readiness flags</h4><ul class="flags">${F.map(x=>`<li><span class="badge ${x.level==='ok'?'bg-green-lt':x.level==='warn'?'bg-yellow-lt':'bg-red-lt'}">${x.level==='ok'?'Ready':x.level==='warn'?'Check':'Missing'}</span><span>${esc(x.text)}</span></li>`).join('')}</ul>`;
  const asks=F.filter(x=>x.ask&&x.level!=='ok');
  if(asks.length) h+=`<h4>Ask in session 1</h4><ol class="ask">${asks.map(x=>`<li>${esc(x.ask)}</li>`).join('')}</ol>`;
  $('#brief').innerHTML=h;
}
function briefText(cic){
  const d=data(),m=math(d),F=flags(d),wants=d.funding==='yes'||d.funding==='maybe';
  const L=[],kv=(k,v)=>{if(v)L.push(`${k}: ${v}`)};
  L.push(cic?'PRE-SESSION INTAKE':'CLIENT BRIEF (pre-session)');
  kv('Prepared',new Date().toLocaleDateString('en-US'));
  kv('Client',d.client);kv('Session 1',sessWhen(d));kv('Business',d.biz);kv('Sells',d.industry);kv('Stage',STAGE[d.stage]);kv('In business',d.years);kv('Ownership',d.owners);kv('Wants help with',d.goal);kv('Expects from SBDC',d.expect);
  kv('Own money invested',money(d.invested));kv('Employees',d.employees);kv('Sales last 12 months',money(d.revenue));kv('Expected sales first 12 months',money(d.projection));
  if(d.price&&d.cost){kv('One sale',`${d.unit||'unit'} at ${money(d.price)}, costs ${money(d.cost)} (${m.marginPct}% margin)`);kv('Monthly fixed costs',money(d.fixed));if(m.breakeven)kv('Break-even',`${m.breakeven} sales a month`)}
  if(wants){kv('Funding wanted',d.amountUnknown?"doesn't know yet":money(d.amount));kv('Use of funds',d.use);kv('Credit score',CREDIT[d.credit]||'not asked');kv('Cash to put in',money(d.liquid));kv('Loan checklist',d.loanChecklist?'has it':'not yet')}
  kv('LLC/entity',{yes:'yes',no:'no',unsure:'not sure'}[d.llc]);kv('Federal EIN',(YNU[d.ein]||'').toLowerCase());kv('Arizona TPT license',(TPT[d.tpt]||'').toLowerCase());kv('Operates',PLACE[d.place]);if(d.sqft)kv('Space',d.sqft+' sq ft');kv('Online',ONLINE[d.online]);
  if(d.assets)kv('Assets',d.assets.replace(/\n+/g,'; '));if(d.assets)kv('Proof of equipment costs',d.proof?'yes':'not yet');
  if(d.docs.length)kv('Documents ready',d.docs.join(', '));kv('Notes',d.notes);
  const miss=F.filter(x=>x.level!=='ok');
  if(miss.length){L.push('');L.push(cic?'Missing before session 1:':'Missing / to check:');miss.forEach(x=>L.push(`- ${x.text}`))}
  if(!cic){const asks=F.filter(x=>x.ask&&x.level!=='ok');if(asks.length){L.push('');L.push('Ask in session 1:');asks.forEach((x,i)=>L.push(`${i+1}. ${x.ask}`))}}
  if(d.funding==='yes')L.push('','Routing: funding request (Funding advisor).');
  return L.join('\n');
}
f.addEventListener('input',render);f.addEventListener('change',render);
$('#copyBrief').onclick=()=>copy(briefText(false),'Brief copied');
// Copy for CIC: the CIC client / eRFC block (CIC field names, 17 Assistance Requested boxes, what is not captured yet).
// Same builder as the server tool p2.cic (cic.js), so it works offline and gives the same text.
function cicText(){const d=data();return window.P2CIC?window.P2CIC.cicIntakeText(d,{flags,money}).text:briefText(true)}
window.__cicText=cicText;
$('#copyCIC').onclick=()=>copy(cicText(),'CIC client block copied. Paste it field by field into the client record in CIC');
$('#printBrief').onclick=()=>{document.body.classList.remove('print-packet');window.print()};
$('#accBtn').onclick=()=>{const n=($('#biz').value||'').trim(); if(n)copy(n,`"${n}" copied. Paste it into the ACC search box`); window.open('https://arizonabusinesscenter.azcc.gov/businesssearch','_blank','noopener')};
$('#clearForm').onclick=()=>{f.reset();exampleMode=false;hist.length=0;render();toast('Form cleared')};

const EX={
 idea:{client:'Example: Maria Lopez (fictional)',email:'maria@example.com',biz:'Example Taco Truck',industry:'Mobile food (tacos)',stage:'idea',funding:'yes',goal:'Start a food truck and find out what a loan would take',expect:'Help with a plan and a loan application',llc:'unsure',ein:'no',tpt:'no',place:'planned',online:'social',invested:'3000',employees:'0',projection:'90000',unit:'plate of 3 tacos',price:'11',cost:'4.25',fixed:'2700',volume:'900',amount:'',amountUnknown:'on',use:'Truck and kitchen equipment',credit:'unknown',liquid:'',assets:'Used truck (quote) – $38,000\nGriddle and fryer – $3,500 (quote)',notes:'Found us through a library workshop.'},
 startup:{client:'Example: Jordan Reed (fictional)',email:'jordan@example.com',biz:'Example Thread Co.',industry:'Printed apparel sold online',stage:'startup',years:'8 months',owners:'Sole owner',funding:'maybe',goal:'Figure out pricing and grow online sales',expect:'Monthly check-ins on pricing and marketing',llc:'yes',ein:'yes',tpt:'unsure',place:'home',online:'both',invested:'6500',employees:'0',revenue:'14000',projection:'30000',unit:'printed shirt',price:'28',cost:'11',fixed:'450',volume:'120',use:'Second heat press',credit:'680',liquid:'2000',docs:['Business Model Canvas']},
 existing:{bizDesc:'Auto repair shop',ft:'4',pt:'1',pl:'52000',website:'www.example-autocare.com',startDate:'2020-03-01',client:'Example: Sam Patel (fictional)',email:'sam@example.com',biz:'Example Auto Care LLC',industry:'Auto repair',stage:'existing',years:'6 years',owners:'Two owners, 60/40',funding:'yes',goal:'Loan to add two service bays',expect:'Help getting the loan package ready',llc:'yes',ein:'yes',tpt:'yes',place:'physical',sqft:'4200',online:'both',invested:'85000',employees:'5',revenue:'640000',amount:'250000',use:'Buildout and two lifts',credit:'720',liquid:'40000',loanChecklist:'on',assets:'Building lease (10 yrs left)\nThree lifts – $27,000\nDiagnostic tools – $12,000',proof:'on',docs:['Financial statements','Tax returns','Business plan']}
};
function load(k){f.reset();exampleMode=true;const e=EX[k];for(const [n,v] of Object.entries(e)){
  const els=f.querySelectorAll(`[name="${n}"]`);
  els.forEach(el=>{if(el.type==='radio')el.checked=el.value===v;else if(el.type==='checkbox')el.checked=Array.isArray(v)?v.includes(el.value):!!v;else el.value=v});
}render();toast('Example loaded. This client is made up');}
$$('[data-example]').forEach(b=>b.onclick=()=>load(b.dataset.example));

// What to bring
const BRING={
 idea:{name:'idea / pre-venture',list:['A short description of what you want to sell and who will buy it','Your best guess at price and cost for one sale (one meal, one shirt, one hour)','How many sales you expect in a month','Monthly costs you know of: rent, insurance, supplies','How much of your own money you can put in','Whether you have registered an LLC or other business name','A filled-in Business Model Canvas (template attached)'],
  packet:['SBDC advising is free. There is no contract to sign and no charge for meeting with an advisor.','Your first meeting is about your idea and your numbers. Rough numbers are fine; we will work through them together.','If you think you will need a loan, ask us for the loan checklist now. Lenders will ask for the same items.']},
 startup:{name:'startup',list:['Sales so far and your sales goal for the next 12 months','Price and cost for your main product or service','Monthly fixed costs (rent, software, insurance)','How much you have invested so far','LLC or entity paperwork, if registered','Your website and social media links','A filled-in Business Model Canvas (template attached)'],
  packet:['SBDC advising is free. There is no contract to sign and no charge for meeting with an advisor.','Bring what you have, even if it is a spreadsheet or a notebook. The more numbers we see, the more useful the first session is.','If you are thinking about funding, ask for the loan checklist before we meet.']},
 existing:{name:'established business',list:['Financial statements for the last 12 months (profit and loss, balance sheet)','Business tax returns, most recent year','Number of employees','Business plan or pitch deck, if you have one','Size of your location (square feet) and lease details','List of major equipment and assets with what each cost','What you want to change or grow'],
  packet:['SBDC advising is free. There is no contract to sign and no charge for meeting with an advisor.','Sending your documents before we meet means we can skip the background questions and spend the session on your goals.','Accepted files: PDF, Excel, Word or PowerPoint.']},
 loan:{name:'loan',list:['How much money you need and exactly what it will pay for','Your personal credit score (most banks and card issuers show it free)','How much of your own cash you can put in','Personal financial statement (SBA Form 413)','Borrower information form (SBA Form 1919), if it is an SBA loan','Business and personal tax returns (lenders often ask for 3 years)','Current financial statements and a debt schedule','Quotes or receipts for equipment you want to buy','List of assets: buildings, tools, equipment and vehicles'],
  packet:['SBDC advising is free. There is no contract to sign. We do not lend money, but we help you get ready to talk to lenders.','Lenders look first at how much you need, what it is for, your credit, and how much of your own money you are putting in. Knowing these before we meet saves a session.','Every lender\'s list is a little different. This checklist covers what most of them ask for.']}
};
let cur='idea';
function showBring(t){cur=t;$$('.tab').forEach(b=>{b.setAttribute('aria-selected',b.dataset.type===t);b.classList.toggle('active',b.dataset.type===t)});$('#bringCount').textContent=BRING[t].list.length+' items';const B=BRING[t];
 $('#bringList').innerHTML=B.list.map(x=>`<li>${esc(x)}</li>`).join('');$('#packet').innerHTML=B.packet.map(x=>`<p>${esc(x)}</p>`).join('');$('#ovBring').textContent=`${B.list.length} items · ${$('.tab[data-type='+t+']').textContent.split(' /')[0]}`;}
$$('.tab').forEach(b=>b.onclick=e=>{e.preventDefault();showBring(b.dataset.type)});
function packetText(){const B=BRING[cur],n=(($('#client').value||'').replace(/^Example:\s*/,'').split(' ')[0])||'there';
 return `Hi ${n},\n\nThanks for reaching out to the Maricopa SBDC. ${(()=>{const w=sessWhen(data());return w?`Our first meeting is ${w.replace(' · ',' at ')}. `:''})()}To get the most out of it, please gather what you can from this list:\n\n${B.list.map(x=>'- '+x).join('\n')}\n\nGood to know:\n${B.packet.map(x=>'- '+x).join('\n')}\n\nIf you don't have something yet, that's fine. Bring what you have and we'll work through the rest together.\n\nSee you soon,`}
$('#copyPacket').onclick=()=>copy(packetText(),'Checklist email copied');
// Open in email: if no mail app takes over within about a second, copy the text instead.
function mailOr(href,text){window.__lastMail=href;let left=false;const off=()=>{left=true};window.addEventListener('blur',off,{once:true});document.addEventListener('visibilitychange',off,{once:true});
  try{location.href=href}catch(e){}setTimeout(()=>{window.removeEventListener('blur',off);if(!left&&!document.hidden){window.__mailFallback=(window.__mailFallback||0)+1;copy(text,'No mail app opened. Text copied instead')}},1100)}
$('#mailPacket').onclick=()=>{const to=$('#email').value||'';const t=packetText();mailOr(`mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent('What to bring to your first SBDC meeting')}&body=${encodeURIComponent(t)}`,t)};
$('#printPacket').onclick=()=>{const pm=$('#packetMore'),was=pm.open;pm.open=true;setTimeout(()=>{pm.open=was},500);document.body.classList.add('print-packet');window.print();setTimeout(()=>document.body.classList.remove('print-packet'),500)};
showBring('idea');

// Form questions
const Q=`SECTION 1: ABOUT YOU (everyone)
1. Your name, email and phone
2. Business name (or working name)
3. What do you sell, and who buys it?
4. Where is the business today? [Idea, no sales yet] [Just started selling] [Established, steady sales]
   -> Idea: go to Section 2A. Just started: 2A then 2B. Established: go to Section 2B.
5. Are you looking for a loan or other funding? [Yes] [Maybe later] [No]
   -> Yes or Maybe: also show Section 3.
6. What area do you most need help with from an advisor?
7. What do you expect from working with the SBDC?

SECTION 2A: YOUR NUMBERS (idea and startup)
8. What is one sale? (a meal, a shirt, an hour of service)
9. Price for one sale, and what it costs you to make or deliver it
10. Monthly costs you'll pay no matter what (rent, insurance, loan payments)
11. How many sales do you expect in a month? Expected sales in your first 12 months?

SECTION 2B: YOUR BUSINESS (startup and established)
12. How long have you been in business? Who owns it, and how is ownership split?
13. Sales in the last 12 months, and number of employees
14. How much of your own money have you invested?
15. Do you currently have an LLC or other registered entity? [Yes] [No] [Not sure]
16. Do you have a federal EIN? [Yes] [No] [Not sure]
17. Are you registered for an Arizona Transaction Privilege Tax (TPT) license? [Yes] [No] [Not sure] [Not needed]
18. Do you have a website or social media? (links)
19. If you have a physical location: how big is it (square feet)?

SECTION 3: FUNDING (yes or maybe)
20. How much money do you need, and what will it pay for? [I don't know yet]
21. Do you know your personal credit score? [Below 620] [620-679] [680-719] [720+] [I don't know]
22. How much of your own cash could you put in?
23. List your assets: buildings, tools, equipment, vehicles, and what each cost.

SECTION 4: UPLOADS (optional, everyone)
24. Upload what you have: business plan, pitch deck, financial statements, Business Model Canvas (PDF, Excel, Word, PowerPoint).`;
$('#qText').textContent=Q;
$('#copyQ').onclick=()=>copy(Q,'Form questions copied');
// Master sheet: one column per form question, same order as Q.
const SHEET_COLS=['Submitted','Name','Email','Phone','Business name','What you sell / who buys it','Business stage','Looking for funding','Area you most need help with','What you expect from the SBDC','What one sale is','Price per sale','Cost per sale','Monthly fixed costs','Sales per month','Expected sales, first 12 months','Time in business','Ownership','Sales, last 12 months','Employees','Own money invested','LLC or entity','Federal EIN','Arizona TPT license','Website / social links','Square feet','Funding amount','Use of funds','Credit score range','Cash to put in','Assets and costs','Uploads'];
window.__sheetCols=SHEET_COLS;
const dl=$('#dlSheet');if(dl)dl.onclick=()=>{const csv=SHEET_COLS.map(c=>/[",]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c).join(',')+'\r\n';const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='sbdc-intake-master-sheet.csv';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);toast('Master sheet columns downloaded')};
// Top search: jump to a form question by label
function findQ(){const q=$('#fieldSearch').value.trim().toLowerCase();if(!q)return;window.__go('#/intake/intake');
 const L=$$('#f .form-label').filter(l=>l.offsetParent&&l.textContent.toLowerCase().includes(q));
 if(!L.length){toast('No question matches "'+$('#fieldSearch').value.trim()+'"');return}
 const l=L[0],t=(l.htmlFor&&document.getElementById(l.htmlFor))||l.parentElement.querySelector('input,select,textarea');
 l.scrollIntoView({behavior:'smooth',block:'center'});const box=l.closest('.col-md-6,.col-md-4,.col-md-3,.col-12,.mb-3')||l.parentElement;box.classList.remove('qflash');void box.offsetWidth;box.classList.add('qflash');if(t)t.focus({preventScroll:true})}

// Pages and routing live in shell.js. Form answers stay in memory in this page, so moving between pages keeps them; nothing is written to storage.
$('#fieldSearch').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();findQ()}});
$('#fieldSearch').addEventListener('search',findQ);
render();

// Session 1 calendar file (.ics), built in memory and downloaded
$('#icsBrief').onclick=()=>{const d=data();if(!d.sdate){toast('Add the session 1 date first');const el=$('#sdate');if(location.hash!=='#/intake/intake')window.__go('#/intake/intake');setTimeout(()=>el.focus(),50);return}
 const [y,mo,da]=d.sdate.split('-').map(Number);const [h,m]=(d.stime||'09:00').split(':').map(Number);const st=Date.UTC(y,mo-1,da,h+7,m),en=st+36e5;
 const z=t=>new Date(t).toISOString().replace(/[-:]/g,'').replace(/\.\d+/,'');const who=(d.biz||d.client||'client').replace(/^Example:\s*/,'').replace(/[,;\\\n]/g,' ');
 const ics=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Maricopa SBDC//Client Intake//EN','BEGIN:VEVENT',`UID:${Date.now()}@sbdc-intake`,`DTSTAMP:${z(Date.now())}`,`DTSTART:${z(st)}`,`DTEND:${z(en)}`,`SUMMARY:SBDC session 1: ${who}`,'BEGIN:VALARM','TRIGGER:-P1D','ACTION:DISPLAY','DESCRIPTION:SBDC session tomorrow','END:VALARM','END:VEVENT','END:VCALENDAR'].join('\r\n');
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([ics],{type:'text/calendar'}));a.download='sbdc-session-1.ics';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('Calendar file downloaded')};
})();