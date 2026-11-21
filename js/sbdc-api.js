// Connects this dashboard to the SBDC Advisor Tools server. Advisors sign in with their work email and a 6-digit code
// (the server returns a revocable 14-day session token, kept in this browser's localStorage only), or paste an old advisor key.
(()=>{
const LS_KEY='sbdc-api-key',LS_BASE='sbdc-api-base',LS_OFF='sbdc-api-offline';
const DEF_BASE=window.SBDC_API_DEFAULT_BASE||'https://sbdc-tools.betbotpicks.com';
const get=k=>{try{return localStorage.getItem(k)||''}catch(e){return ''}};
const set=(k,v)=>{try{v?localStorage.setItem(k,v):localStorage.removeItem(k)}catch(e){}};
const base=()=>(get(LS_BASE)||DEF_BASE).replace(/\/+$/,'');
let me=null;
async function call(path,{method='GET',body}={}){
  const key=get(LS_KEY);if(!key)throw Object.assign(new Error('Not connected'),{code:'nokey'});
  let r;try{r=await fetch(base()+path,{method,headers:{authorization:'Bearer '+key,'content-type':'application/json'},body:body?JSON.stringify(body):undefined})}
  catch(e){throw Object.assign(new Error(`Can't reach the server at ${base()}.`),{code:'network'})}
  let j=null;try{j=await r.json()}catch(e){}
  if(r.status===401){throw Object.assign(new Error(j&&j.message||'Key not accepted.'),{code:'auth'})}
  if(r.status===429)throw Object.assign(new Error(`${j&&j.message||'Too many requests.'} Try again in ${j&&j.retryAfter||60}s.`),{code:'rate'});
  if(!r.ok)throw new Error(j&&j.message||`Server error ${r.status}`);return j}
const css=`.sbdc-dlg{border:0;border-radius:14px;padding:0;max-width:440px;width:92vw;background:#121a2e;color:#e8eefc;box-shadow:0 20px 60px rgba(0,0,0,.5)}
.sbdc-dlg::backdrop{background:rgba(5,10,25,.6)}.sbdc-dlg form{padding:18px;display:grid;gap:10px}.sbdc-dlg h2{margin:0;font-size:17px}
.sbdc-dlg p{margin:0;color:#9fb0d3;font-size:13px}.sbdc-dlg label{font-size:12px;color:#9fb0d3;display:grid;gap:4px}
.sbdc-dlg input,.sbdc-dlg textarea{background:#0b1222;color:#e8eefc;border:1px solid #33456f;border-radius:8px;padding:8px;font:inherit}
.sbdc-dlg textarea{min-height:140px;font:12px ui-monospace,Consolas,monospace}.sbdc-dlg pre{white-space:pre-wrap;max-height:50vh;overflow:auto;background:#0b1222;border-radius:8px;padding:10px;font:12px/1.45 ui-monospace,Consolas,monospace;margin:0}
.sbdc-row{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.sbdc-err{color:#ff8a8a!important}
.sbdc-chip{position:fixed;right:12px;bottom:12px;z-index:50;border:1px solid #33456f;background:rgba(18,26,46,.92);color:#cfe0ff;border-radius:99px;padding:6px 12px;font-size:12px;cursor:pointer}
.sbdc-chip b{color:#7ee2a8;font-weight:600}.sbdc-dlg [hidden]{display:none!important}.sbdc-adv{font-size:12px}.sbdc-adv summary{cursor:pointer;color:#6B6A64}.sbdc-adv[open]{display:grid;gap:10px}`;
const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
const dlg=document.createElement('dialog');dlg.className='sbdc-dlg';dlg.setAttribute('aria-labelledby','sbdcDlgT');
dlg.innerHTML=`<form method="dialog"><h2 id="sbdcDlgT">Sign in</h2>
<p>Use your work email. We send you a 6-digit code.</p>
<label>Work email<input id="sbdcEmail" type="email" autocomplete="email" placeholder="you@maricopa.edu"></label>
<label id="sbdcCodeL" hidden>6-digit code from the email<input id="sbdcCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••"></label>
<div class="sbdc-row" style="justify-content:flex-start"><button class="btn btn-primary" type="button" id="sbdcSend">Email me a code</button><button class="btn btn-primary" type="button" id="sbdcVerify" hidden>Sign in</button></div>
<p id="sbdcMsg" role="status" aria-live="polite"></p>
<details class="sbdc-adv"><summary>Advanced</summary>
<label>Server address<input id="sbdcBase" type="url" autocomplete="off"></label>
<label>Advisor API key (old keys still work)<input id="sbdcKey" type="password" placeholder="sbdc_…" autocomplete="off" spellcheck="false"></label>
<div class="sbdc-row"><button class="btn btn-outline-primary" type="button" id="sbdcGo">Connect with key</button></div></details>
<div class="sbdc-row"><button class="btn btn-ghost-secondary" value="offline" type="submit" id="sbdcOff">Not now</button><button class="btn btn-outline-danger" type="button" id="sbdcForget" hidden>Sign out</button></div></form>`;
document.body.appendChild(dlg);
const chip=document.createElement('button');chip.type='button';chip.className='sbdc-chip';chip.onclick=()=>open();document.body.appendChild(chip);
function paint(){chip.innerHTML=me?`<b>Signed in</b> · ${me.advisor.replace(/[<&]/g,'')}`:get(LS_KEY)?'Can’t connect · Try again':'Sign in';}
let resolver=null;
function open(){dlg.querySelector('#sbdcBase').value=base();dlg.querySelector('#sbdcKey').value='';dlg.querySelector('#sbdcMsg').textContent=me?`Signed in as ${me.advisor}.`:'';dlg.querySelector('#sbdcMsg').classList.remove('sbdc-err');dlg.querySelector('#sbdcForget').hidden=!get(LS_KEY);if(!dlg.open)dlg.showModal();(me?dlg.querySelector('#sbdcForget'):dlg.querySelector('#sbdcEmail')).focus();return new Promise(r=>{resolver=r})}
dlg.addEventListener('close',()=>{const r=resolver;resolver=null;if(!r)return;if(dlg.returnValue==='offline'){set(LS_OFF,'1');r('offline')}else r(me?'server':null)});
dlg.querySelector('#sbdcGo').onclick=async()=>{const m=dlg.querySelector('#sbdcMsg');const k=dlg.querySelector('#sbdcKey').value.trim();const b=dlg.querySelector('#sbdcBase').value.trim();
  if(!/^https?:\/\//.test(b)){m.textContent='Server address must start with https://';m.classList.add('sbdc-err');return}
  set(LS_BASE,b);if(k)set(LS_KEY,k);m.classList.remove('sbdc-err');m.textContent='Checking…';
  try{me=await call('/v1/me');set(LS_OFF,'');paint();document.dispatchEvent(new CustomEvent('sbdc:api'));dlg.returnValue='server';dlg.close()}
  catch(e){me=null;paint();m.textContent=e.message;m.classList.add('sbdc-err')}};
const post=async(path,body)=>{let r;try{r=await fetch(base()+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})}catch(e){throw new Error(`Can't reach the server at ${base()}.`)}
  let j=null;try{j=await r.json()}catch(e){}if(!r.ok)throw new Error(j&&j.message||`Server error ${r.status}`);return j};
const useBase=m=>{const b=dlg.querySelector('#sbdcBase').value.trim();if(!/^https?:\/\//.test(b)){m.textContent='Server address must start with https://';m.classList.add('sbdc-err');return false}set(LS_BASE,b);return true};
dlg.querySelector('#sbdcSend').onclick=async()=>{const m=dlg.querySelector('#sbdcMsg');const em=dlg.querySelector('#sbdcEmail').value.trim();if(!useBase(m))return;
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)){m.textContent='Enter your work email.';m.classList.add('sbdc-err');return}
  m.classList.remove('sbdc-err');m.textContent='Sending…';
  try{const r=await post('/auth/start',{email:em});dlg.querySelector('#sbdcCodeL').hidden=false;dlg.querySelector('#sbdcVerify').hidden=false;dlg.querySelector('#sbdcSend').textContent='Send a new code';dlg.querySelector('#sbdcSend').className='btn btn-ghost-secondary';
    m.textContent=r.mail==='console'?'Test mode: no email is sent yet; the code is in the server log.':`Code sent to ${em}. It expires in ${r.minutes} minutes.`;dlg.querySelector('#sbdcCode').focus()}
  catch(e){m.textContent=e.message;m.classList.add('sbdc-err')}};
dlg.querySelector('#sbdcVerify').onclick=async()=>{const m=dlg.querySelector('#sbdcMsg');if(!useBase(m))return;m.classList.remove('sbdc-err');m.textContent='Checking…';
  try{const r=await post('/auth/verify',{email:dlg.querySelector('#sbdcEmail').value.trim(),code:dlg.querySelector('#sbdcCode').value.trim(),token:true});
    if(!r.token)throw new Error('This dashboard address is not allowed to sign in. Use the SBDC site.');
    set(LS_KEY,r.token);me=await call('/v1/me');set(LS_OFF,'');paint();document.dispatchEvent(new CustomEvent('sbdc:api'));dlg.returnValue='server';dlg.close()}
  catch(e){me=null;paint();m.textContent=e.message;m.classList.add('sbdc-err')}};
dlg.querySelector('#sbdcCode').addEventListener('input',e=>{e.target.value=e.target.value.replace(/\D/g,'').slice(0,6);if(e.target.value.length===6)dlg.querySelector('#sbdcVerify').click()});
dlg.querySelector('#sbdcForget').onclick=()=>{const k=get(LS_KEY);if(/^sbdcs_/.test(k))fetch(base()+'/auth/logout',{method:'POST',headers:{authorization:'Bearer '+k,'content-type':'application/json'},body:'{}'}).catch(()=>{});set(LS_KEY,'');me=null;paint();document.dispatchEvent(new CustomEvent('sbdc:api'));dlg.querySelector('#sbdcMsg').textContent='Signed out on this browser.';dlg.querySelector('#sbdcForget').hidden=true};
// 'server' when connected, 'offline' when the advisor chose to run without the server, null when cancelled.
async function ensure(){if(me)return 'server';if(get(LS_KEY)){try{me=await call('/v1/me');paint();return 'server'}catch(e){if(e.code!=='auth'&&e.code!=='network')throw e}}
  if(get(LS_OFF)&&!get(LS_KEY))return 'offline';return open()}
async function run(id,input){return call(`/v1/tools/${id}/run`,{method:'POST',body:{input,trigger:'dashboard'}})}
// Generic paste-a-list dialog and output viewer, used by the Automations page.
const pd=document.createElement('dialog');pd.className='sbdc-dlg';pd.innerHTML=`<form method="dialog"><h2 id="sbdcPT"></h2><p id="sbdcPS"></p><textarea id="sbdcPX"></textarea><pre id="sbdcPO" hidden></pre><div class="sbdc-row"><button class="btn btn-ghost-secondary" value="cancel">Close</button><button class="btn btn-outline-secondary" type="button" id="sbdcPC" hidden>Copy</button><button class="btn btn-primary" value="ok" id="sbdcPOK">Save</button></div></form>`;document.body.appendChild(pd);
function paste(title,sub,sample){return new Promise(r=>{pd.querySelector('#sbdcPT').textContent=title;pd.querySelector('#sbdcPS').textContent=sub;const x=pd.querySelector('#sbdcPX');x.hidden=false;x.value=sample||'';pd.querySelector('#sbdcPO').hidden=true;pd.querySelector('#sbdcPC').hidden=true;pd.querySelector('#sbdcPOK').hidden=false;pd.returnValue='';pd.showModal();pd.addEventListener('close',()=>r(pd.returnValue==='ok'?x.value:null),{once:true})})}
function show(title,text){pd.querySelector('#sbdcPT').textContent=title;pd.querySelector('#sbdcPS').textContent='';pd.querySelector('#sbdcPX').hidden=true;const o=pd.querySelector('#sbdcPO');o.hidden=false;o.textContent=text;const c=pd.querySelector('#sbdcPC');c.hidden=false;c.onclick=()=>navigator.clipboard.writeText(text).then(()=>{c.textContent='Copied'});c.textContent='Copy';pd.querySelector('#sbdcPOK').hidden=true;pd.showModal()}
window.SBDC_API={base,call,run,ensure,open,paste,show,connected:()=>!!me,me:()=>me,hasKey:()=>!!get(LS_KEY)};
paint();if(get(LS_KEY))call('/v1/me').then(j=>{me=j;paint();document.dispatchEvent(new CustomEvent('sbdc:api'))}).catch(()=>paint());
})();
