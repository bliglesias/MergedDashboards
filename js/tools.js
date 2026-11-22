// Advisor Toolbox tool registry: every tool's setup fields, run fields and what a run produces.
// Setup fields are advisor preferences (saved). Run fields hold the details for one run (kept in page memory only).
(()=>{
const BASE=location.href.replace(/[#?].*$/,'').replace(/[^/]*$/,'');
const pad=n=>String(n).padStart(2,'0');
const H=36e5,D=864e5,AZ=-7*H; // Arizona: UTC-7 all year
const DOW=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const hm=(h,m)=>`${h%12||12}:${pad(m)} ${h<12?'AM':'PM'}`;
const azNow=()=>new Date(Date.now()+AZ); // read with getUTC*
const todayISO=()=>{const d=azNow();return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`};
function sessWhen(date,time){if(!date)return '';const [y,m,d]=date.split('-').map(Number);const w=new Date(Date.UTC(y,m-1,d));let s=`${DOW[w.getUTCDay()]}, ${MON[m-1]} ${d}, ${y}`;if(time){const [h,mi]=time.split(':').map(Number);s+=` · ${hm(h,mi)} MST`}return s}
const lines=s=>String(s||'').split('\n').map(x=>x.trim().replace(/^[-•*]\s*/,'')).filter(Boolean);
const first=s=>String(s||'').trim().split(/\s+/)[0]||'there';
const icsEsc=s=>String(s||'').replace(/\\/g,'\\\\').replace(/[,;]/g,'\\$&').replace(/\n/g,'\\n');
const stamp=()=>new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+/,'');
const ymd=d=>`${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`;
function icsAllDay(events){const st=stamp();
 const ev=events.map((e,i)=>{const end=new Date(e.date);end.setDate(end.getDate()+1);return ['BEGIN:VEVENT',`UID:sbdc-${st}-${i}@advisor-toolbox`,`DTSTAMP:${st}`,`DTSTART;VALUE=DATE:${ymd(e.date)}`,`DTEND;VALUE=DATE:${ymd(end)}`,`SUMMARY:${icsEsc(e.title)}`,`DESCRIPTION:${icsEsc(e.desc)}`,'BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:Follow-up reminder','TRIGGER:PT9H','END:VALARM','END:VEVENT'].join('\r\n')});
 return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Maricopa SBDC//Advisor Toolbox//EN','CALSCALE:GREGORIAN',...ev,'END:VCALENDAR'].join('\r\n')}
function icsTimed(title,desc,date,time,mins){const [y,m,d]=date.split('-').map(Number);const [h,mi]=(time||'09:00').split(':').map(Number);
 const s=Date.UTC(y,m-1,d,h+7,mi),e=s+(mins||60)*6e4;const f=t=>new Date(t).toISOString().replace(/[-:]/g,'').replace(/\.\d+/,'');
 return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Maricopa SBDC//Advisor Toolbox//EN','BEGIN:VEVENT',`UID:sbdc-${stamp()}@advisor-toolbox`,`DTSTAMP:${stamp()}`,`DTSTART:${f(s)}`,`DTEND:${f(e)}`,`SUMMARY:${icsEsc(title)}`,`DESCRIPTION:${icsEsc(desc)}`,'BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:Session reminder','TRIGGER:-PT30M','END:VALARM','END:VEVENT','END:VCALENDAR'].join('\r\n')}
const csv=rows=>rows.map(r=>r.map(c=>{c=String(c??'');return /[",\n]/.test(c)?`"${c.replace(/"/g,'""')}"`:c}).join(',')).join('\r\n');
const sign=(v)=>`${v.signoff||'Best,'}${v.sig?'\n'+v.sig:''}`;

// --- CIC export parsing (Name, Email, Last contact) ---
function parseDate(s){s=(s||'').trim();if(!s)return null;let m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);if(m){let y=+m[3];if(y<100)y+=2000;return new Date(y,m[1]-1,+m[2])}
 m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);if(m)return new Date(+m[1],m[2]-1,+m[3]);if(/^\d{5}$/.test(s)){return new Date(Math.round((+s-25569)*864e5)+new Date().getTimezoneOffset()*6e4)}const d=new Date(s);return isNaN(d)?null:d}
const cells=l=>(l.includes('\t')?l.split('\t'):l.split(',')).map(x=>x.trim());
// Client dots, as advisors use them: gray = registered but no first meeting yet (brand new or inactive); yellow = had a first meeting, or already in business.
const DOT_RE=/^(gray|grey|yellow)(\s*dot)?$/i;
const DOTS=[['gray','Gray dot','Registered, no first meeting yet (brand new or inactive)'],['yellow','Yellow dot','Had a first meeting, or already in business']];
function parseCIC(text){const today=new Date();today.setHours(0,0,0,0);const rows=[];
 String(text||'').split(/\r?\n/).forEach(l=>{if(!l.trim())return;const c=cells(l);const di=c.findIndex(x=>parseDate(x)&&/\d/.test(x));if(di<0)return;const d=parseDate(c[di]);
  const email=c.find(x=>/@/.test(x))||'';const dc=c.find(x=>DOT_RE.test(x));const name=c.find((x,i)=>i!==di&&x&&!/@/.test(x)&&!DOT_RE.test(x))||'(no name)';
  const r={name,email,date:d,days:Math.floor((today-d)/864e5)};if(dc)r.dot=/yellow/i.test(dc)?'Yellow dot':'Gray dot';rows.push(r)});
 return rows.sort((a,b)=>b.days-a.days)}
const mdY=n=>{const x=new Date();x.setDate(x.getDate()-n);return `${x.getMonth()+1}/${x.getDate()}/${x.getFullYear()}`};
const sampleCIC=()=>`Name\tEmail\tLast contact\nExample Bakery Owner\tbakery@example.com\t${mdY(104)}\nExample Landscaping Co\tlandscape@example.com\t${mdY(67)}\nExample Yoga Studio\tyoga@example.com\t${mdY(35)}\nExample Coffee Cart\tcoffee@example.com\t${mdY(12)}`;
const isSample=t=>/Example /.test(t||'')&&parseCIC(t).every(r=>/^Example\b/.test(r.name));
const bucket=x=>x>=90?'90+ days':x>=60?'60–89 days':x>=30?'30–59 days':'Under 30 days';
// What the saved client list (clients.js) knows about this client, for the prep packet. Empty when they are not on it.
function recordNote(name){const C=window.SBDC_CLIENTS;if(!C||!name)return '';const n=String(name).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(),same=x=>String(x||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()===n;
 const c=C.all().find(x=>!x.ex&&(same(x.name)||same(x.biz)));if(!c)return '';const g=C.grade(c),unknown=g.items.filter(i=>!i.known).map(i=>i.label);
 return `\nFrom their record: grade ${g.pct}% (${g.band}), based on ${g.known}% of the facts\n${g.raise.length?`- Would raise it most: ${g.raise.slice(0,3).map(r=>r.label).join('; ')}\n`:''}${unknown.length?`- Not known yet, worth asking: ${unknown.slice(0,6).join('; ')}\n`:''}`}
function setTracker(rows,sample){window.__tracker={rows:rows.map(r=>({days:r.days})),sample};document.dispatchEvent(new CustomEvent('sbdc:tracker'))}
let lastDue=[];

// --- first-person rewrite ---
const IRREG={has:'have',is:'am',does:'do',goes:'go',was:'was'};
function deThird(w){const l=w.toLowerCase();if(IRREG[l])return IRREG[l];if(/ies$/.test(l))return l.slice(0,-3)+'y';if(/(ss|sh|ch|x|z)es$/.test(l))return l.slice(0,-2);if(/[^s]s$/.test(l))return l.slice(0,-1);return l}
function firstPerson(text,name){if(!name)return text;const parts=name.split(/\s+/).filter(Boolean);
 const alts=[name,...parts.length>1?[parts[0],parts[parts.length-1]]:[]].map(x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
 const N=`(?:(?:the )?(?:counselor|advisor|consultant) )?(?:${alts.join('|')})`;let t=text;
 t=t.replace(new RegExp(`\\b${N}(?:'s|’s)`,'gi'),'my');
 t=t.replace(new RegExp(`\\b(with|to|for|from|by|asked|told|thanked|gave|sent|emailed|called|showed|helped|met) ${N}\\b`,'gi'),(m,p)=>`${p} me`);
 t=t.replace(new RegExp(`\\b${N}\\b(\\s+)(\\w+)`,'gi'),(m,sp,verb)=>`I${sp}${/^(said|was|will|would|can|could|should|had|did|might|must|may)$/i.test(verb)||!/s$/i.test(verb)?verb:deThird(verb)}`);
 t=t.replace(new RegExp(`\\b${N}\\b`,'gi'),'I');t=t.replace(/(^|[.!?]\s+|\n\s*[-•*]?\s*)my\b/g,(m,p)=>p+'My');return t}
const plain=s=>String(s||'').replace(/\r/g,'').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu,'').replace(/^\s*#{1,6}\s*/gm,'').replace(/\*\*|__|`/g,'').replace(/^\s*(?:[-*•▪◦]|\d+[.)])\s+/gm,'').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/[–—]/g,'-').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim();

// --- CenterIC (CIC) session Notes layout, from the CIC Initial Session record and the CGA follow-up templates ---
const CIC_H=['THE PURPOSE OF THIS SESSION:','BRIEF DESCRIPTION OF THE BUSINESS AND/OR OWNERS:','THE FOLLOWING WAS DISCUSSED DURING THE SESSION:','NEXT STEPS & FOLLOW-UP ACTIONS - Client:','NEXT STEPS & FOLLOW-UP ACTIONS - Counselor:','POTENTIAL IMPACT AREA:'];
// CIC session "Contact Type" values. In-person is read off the CIC screen; the others are the usual CIC options (check the dropdown).
const CIC_CONTACT=[['In-person','In-person'],['Online','Online (Zoom / Teams)'],['Phone','Phone'],['Email','Email']];
const cicContact=t=>({'in person':'In-person','in-person':'In-person',zoom:'Online',teams:'Online',online:'Online',video:'Online',phone:'Phone',telephone:'Phone',email:'Email'})[String(t||'').trim().toLowerCase()]||t||'';
const CIC_STATUS=[['','(leave blank)'],['In Business','In Business'],['Not Yet in Business','Not Yet in Business']];
const reEsc=s=>String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
// Who owns a next step. Explicit "Client:" / "Me:" prefixes win; then the subject; then a leading "send/email/share" (the advisor's own to-do) -> counselor; else client.
function stepOwner(line,me){const l=String(line||'').trim();const names=String(me||'').split(/\s+/).filter(Boolean).map(reEsc);
 if(/^(client|owner|customer)\s*[:\-–]/i.test(l))return 'client';
 if(/^(me|counselor|counsellor|advisor|adviser|consultant|ba)\s*[:\-–]/i.test(l))return 'counselor';
 if(/^(i|i'll|i will|i'm|we'll|we will|my|the (advisor|counselor|consultant)|advisor|counselor|consultant)\b/i.test(l))return 'counselor';
 if(names.length&&new RegExp(`^(${names.join('|')})\\b`,'i').test(l))return 'counselor';
 if(/^(send|email|e-mail|share|forward|mail|refer|introduce|schedule|set up|book)\b/i.test(l))return 'counselor';
 if(/^next (mtg|meeting|session|appointment|appt)\b/i.test(l))return 'counselor';
 return 'client'}
const OWNER_RE=/^\s*(client|owner|customer|me|counselor|counsellor|advisor|adviser|consultant|ba)\s*[:\-–]/i;
const stripOwner=l=>String(l||'').replace(/^\s*(client|owner|customer|me|counselor|counsellor|advisor|adviser|consultant|ba)\s*[:\-–]\s*/i,'').trim();
const sentence=s=>{s=String(s||'').trim();if(!s)return '';s=s[0].toUpperCase()+s.slice(1);return /[.!?)]$/.test(s)?s:s+'.'};
function splitSteps(lines,me){const o={client:[],counselor:[]};for(const l of lines){const t=String(l||'').trim();if(!t)continue;o[stepOwner(t,me)].push(sentence(stripOwner(t)))}return o}
// Potential impact area guessed from the words used; the CGA names: Start Up, Capital, Owner Contribution, FTE, Sales increase.
function cicImpact(text){const t=String(text||'').toLowerCase(),a=[];
 if(/\b(start(ing)? (a|the|up|my)|startup|start-up|launch|open(ing)? (a|the)|new business|pre-venture|form(ing)? an? llc|register(ing)? (the|a) business)\b/.test(t))a.push('Start Up');
 if(/\b(loan|lender|lending|capital|financing|funding|504|7\(a\)|sba|microloan|line of credit|grant|investor)\b/.test(t))a.push('Capital');
 if(/\b(own (money|cash|savings)|owner (investment|contribution|injection)|personal (funds|savings|assets)|invested)\b/.test(t))a.push('Owner Contribution');
 if(/\b(hire|hiring|staff|employee|employees|jobs?|fte|workers?)\b/.test(t))a.push('FTE');
 if(/\b(sales|revenue|pricing|price|customers|marketing|grow|growth|expansion|expand)\b/.test(t))a.push('Sales increase');
 return a.join(', ')}
const joinS=a=>a.length?a.join(' '):'N/A';
// One CIC Notes block. Every heading always appears, in CIC order, all caps as in CIC; text follows on the same line.
function cicNotes(p){const nx=p.steps||{client:[],counselor:[]};const val=(s,d)=>{s=plain(s);return s||d};
 return [`${CIC_H[0]} ${val(p.purpose,'(add)')}`,`${CIC_H[1]} ${val(p.desc,'(add)')}`,`${CIC_H[2]} ${val(p.discussed,'(add)')}`,
  `${CIC_H[3]} ${joinS(nx.client)}`,`${CIC_H[4]} ${joinS(nx.counselor)}`,`${CIC_H[5]} ${val(p.impact,'(add, optional)')}`].join('\n')}
function cicHeader(v){const d=v.date?new Date(v.date+'T12:00').toLocaleDateString('en-US'):'';let tm='';if(v.time){const [h,m]=String(v.time).split(':').map(Number);if(!isNaN(h))tm=hm(h,m||0)}
 const hrs=v.mins?Math.round(+v.mins/60*100)/100:'';const L=['CIC SESSION FIELDS (set these on the session screen; they are not part of Notes)'];
 if(d)L.push(`Date: ${d}`);L.push(`Contact Type: ${cicContact(v.type)||'(select)'}`);if(tm)L.push(`Time: ${tm}`);if(hrs!=='')L.push(`Contact (hours): ${hrs}`);if(v.status)L.push(`Status: ${v.status}`);return L.join('\n')}
// Rick's "Maricopa SBDC New Client Initial Session" template, field names as written in his doc.
const RICK_FIELDS=['BA Name:','CIC Client #:','Business Name:','Client(s) Name(s):','Date:','Start Time:','End Time:','Meeting Method:','Expectations form Discussed?','Business Description/NAICS Type:','Client Status?','Pre-Venture?','In-Business currently?','Annual Revenue?','Annual NOI?','Business Debt $?','SBA Loans – Y/N?','Buying a Business?','If new business, Tasks completed:','Legal formation?','EIN number?','Bank Account (funded)?','Business Insurance Coverage?','Accountant/attorney?','Website, social media?','Accounting System: QuickBooks & Payroll?','Client: What are we trying to accomplish today?','Client background and experience?','Work/Education','Credentials','Licenses','Military','Client Goals and Objectives for Business: Income Expected Annually?','Financial Ask & Expected Sources?','Loans Required? SBA/SBSS Explanation?','Bank – current?','PCS/Collateral availability?','Other Guarantors/Owners/Investors?','Existing Financials available?','Financial Statement/QB Knowledge?','Biz Plan/Projections Required?','Sales Planner Needed?','SBDC forms, templates, reports, documents to send','Client Documents to be received by SBDC?','Next Steps/Meeting Date/Time?','Client Satisfaction with meeting (survey)?','Notes:'];
// Rules fill: each bullet goes to the first template field whose keywords it matches; every bullet also stays under Notes.
const RICK_RULES=[['Pre-Venture?',/\b(idea|pre-venture|not (yet )?(open|started|selling))\b/i],['Buying a Business?',/\b(buy(ing)? (a|the) business|acquisition|acquire)\b/i],['Annual Revenue?',/\b(sales|revenue|sells)\b.*\d|\d.*\b(sales|revenue)\b/i],['Annual NOI?',/\b(noi|net (operating )?income|profit)\b/i],['Business Debt $?',/\b(debt|owe[sd]?)\b/i],['Legal formation?',/\b(llc|corp|entity|sole prop|acc)\b/i],['EIN number?',/\bein\b/i],['Bank Account (funded)?',/\bbank account\b/i],['Business Insurance Coverage?',/\binsurance\b/i],['Website, social media?',/\b(website|web site|instagram|facebook|social)\b/i],['Accounting System: QuickBooks & Payroll?',/\b(quickbooks|qb|payroll|bookkeep)/i],['Military',/\b(veteran|military|army|navy|marine|air force)\b/i],['Licenses',/\blicen[cs]e/i],['Loans Required? SBA/SBSS Explanation?',/\b(sba|sbss|504|7\(a\)|microloan)\b/i],['PCS/Collateral availability?',/\b(credit score|credit report|fico|collateral)\b/i],['Financial Ask & Expected Sources?',/(\$\s?\d|\d+\s?k\b|\bloan\b|\bfunding\b|\bcapital\b|\binvestor)/i],['Existing Financials available?',/\b(financials|financial statements?|p&l|p and l|balance sheet|tax returns?)\b/i],['Sales Planner Needed?',/\bsales planner\b/i],['Biz Plan/Projections Required?',/\b(business plan|biz plan|projections?)\b/i],['Next Steps/Meeting Date/Time?',/\b(next (mtg|meeting|session)|follow[- ]up meeting|meet again)\b/i],['Client: What are we trying to accomplish today?',/\b(wants?|goal|trying to|hopes? to|looking to)\b/i]];
function rickTemplate(v,lines){const F={};const put=(k,s)=>{F[k]=F[k]?F[k]+'; '+s:s};
 if(v.sig||v.me)put('BA Name:',v.sig||v.me);if(v.client)put('Business Name:',v.client);if(v.names)put('Client(s) Name(s):',v.names);if(v.date)put('Date:',new Date(v.date+'T12:00').toLocaleDateString('en-US'));
 if(v.method||v.type)put('Meeting Method:',v.method||cicContact(v.type));if(v.status)put('Client Status?',v.status);
 const nm=l=>/\bnext (mtg|meeting|session|appointment|appt)\b/i.test(l);const st=splitSteps(lines.filter(l=>isStep(l)&&!nm(l)),v.me);
 for(const l of lines.filter(l=>!isStep(l))){const hit=RICK_RULES.find(([,re])=>re.test(l));if(hit)put(hit[0],l)}
 for(const l of lines.filter(nm))put('Next Steps/Meeting Date/Time?',l);
 if(st.counselor.length)put('SBDC forms, templates, reports, documents to send',st.counselor.join(' '));if(st.client.length)put('Client Documents to be received by SBDC?',st.client.join(' '));
 return ['Maricopa SBDC New Client Initial Session',...RICK_FIELDS.map(k=>k==='Notes:'?`Notes:${lines.length?'\n'+lines.join('\n'):''}`:F[k]?`${k}${/[?:]$/.test(k)?' ':': '}${F[k]}`:k)].join('\n')}
// Rough lines or Zoom sentences -> CIC Notes. Lines with a to-do (will / send / by / next) become next steps; the rest is the discussion.
const isStep=l=>/\bnext (mtg|meeting|session|appointment|appt)\b|\b(will|i'll|we'll|send|sends|to do|todo|follow up on|by (mon|tue|wed|thu|fri|sat|sun|next|end)\w*)\b|^(me|client|counselor|advisor)\s*:/i.test(l);
function cicFromLines(lines,o){o=o||{};const steps=splitSteps([...(o.next||[]),...lines.filter(isStep)],o.me);const disc=lines.filter(l=>!isStep(l)).map(sentence).join(' ');
 const all=[disc,...steps.client,...steps.counselor].join(' ');
 return cicNotes({purpose:o.purpose,desc:o.desc,discussed:disc,steps,impact:o.impact||cicImpact(all)})}
const sentencesOf=t=>String(t||'').replace(/\r/g,'').split(/\n+/).flatMap(p=>p.split(/(?<=[.!?])\s+(?=[A-Z])/)).map(s=>s.trim().replace(/^[-•*]\s*/,'')).filter(Boolean);

// --- shared content ---
const LOAN=[['use','How much you need and exactly what it will pay for (use of funds)'],['413','Personal financial statement (SBA Form 413) for each owner with 20% or more'],['1919','Borrower information form (SBA Form 1919), for SBA loans'],['btax','Business tax returns (lenders often ask for 3 years)'],['ptax','Personal tax returns for each owner (often 3 years)'],['pl','Current profit and loss statement and balance sheet'],['debt','Debt schedule: what the business owes now'],['plan','Business plan with 12-month projections'],['quotes','Quotes or receipts for equipment or property you plan to buy'],['coll','List of assets you could offer as collateral'],['lic','Business licenses, registration and LLC or entity documents'],['lease','Lease or purchase agreement for your location'],['resume','Resume for each owner']];
const LINKS=[['acc','ACC entity search (LLC check)','https://arizonabusinesscenter.azcc.gov/businesssearch'],['ein','Get an EIN (IRS)','https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online'],['tpt','Arizona TPT (sales tax) license','https://azdor.gov/business/transaction-privilege-tax'],['sba','SBA loan programs','https://www.sba.gov/funding-programs/loans'],['413','SBA Form 413','https://www.sba.gov/document/sba-form-413-personal-financial-statement'],['1919','SBA Form 1919','https://www.sba.gov/document/sba-form-1919-borrower-information-form'],['cost','SBA startup cost guide','https://www.sba.gov/business-guide/plan-your-business/calculate-your-startup-costs']];
const ACC='https://arizonabusinesscenter.azcc.gov/businesssearch';
const HOMEWORK=[['bmc','Fill in the Business Model Canvas',()=>BASE+'pages/bmc.html'],['numbers','Work out the price and cost of one sale, and your monthly fixed costs',null],['goal12','Write down a sales goal for the next 12 months',null],['competitors','List 3 competitors and what they charge',null],['llc','Register your business with the Arizona Corporation Commission (LLC or other entity)',()=>ACC],['ein','Get your federal EIN from the IRS (free)',()=>'https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online'],['tpt','Check whether you need an Arizona TPT (sales tax) license',()=>'https://azdor.gov/business/transaction-privilege-tax'],['credit','Check your personal credit score',null],['fin','Pull together your last 12 months of financial statements',null],['loan','Start gathering the loan documents on this checklist',()=>BASE+'pages/loan-checklist.html'],['assets','List your assets and equipment, with what each cost',()=>BASE+'pages/assets-worksheet.html'],['sba','Take a free course at the SBA Learning Center',()=>'https://learning.sba.gov/']];
const PROMPTS={
 industry:v=>`You are helping a small business advisor prepare for a first meeting with a client.
Give me a one-page industry overview for: ${v.industry||'[INDUSTRY]'} in ${v.area||'[AREA]'}.
Include:
1. How businesses in this industry usually make money, and typical price points
2. Typical startup costs and the biggest ongoing costs
3. Typical gross margins and what drives them
4. Licenses, permits or registrations usually needed in Arizona
5. Common reasons new businesses in this industry struggle
6. Five questions I should ask the client in our first meeting
Use plain language. Say when a number is a rough estimate, and list your sources.`,
 cleanup:()=>`Clean up these advising session notes.
- Fix spelling and grammar, and remove filler and repeated points.
- Organize them under: Background, What we discussed, Decisions, Next steps (who does what, by when).
- Plain text only: no tables, emoji or bold.
- Don't add anything that isn't in the notes.

Notes:
[PASTE NOTES HERE]`,
 email:()=>`Write a short, friendly follow-up email from a small business advisor to a client after an advising session.
- Thank them for meeting.
- Recap what we covered in 2 to 3 sentences.
- List next steps as bullets, showing who does what.
- Mention the next meeting date if I give one.
- Under 150 words, warm and professional, no jargon.

Client first name: [NAME]
What we covered: [TOPICS]
Next steps: [NEXT STEPS]
Next meeting: [DATE]`,
 loan:()=>`I'm a small business advisor helping a client get ready to apply for a loan. Using the list below of what the client has so far, tell me:
1. Which common lender documents are still missing (for example: SBA Form 1919, SBA Form 413 personal financial statement, business and personal tax returns, current financial statements, debt schedule, business plan with projections, quotes for equipment, use of funds)
2. Gaps or red flags a lender is likely to ask about
3. A short checklist I can send the client, in plain language

What the client has so far:
[LIST WHAT THEY HAVE: amount wanted, use of funds, documents, credit range, cash to put in]`,
 research:v=>{const inc=v.include||'both',biz=v.biz?` The client's business: ${v.biz}.`:'';
  const ind=`Part 1: Industry overview
1. How businesses in this industry usually make money, and typical price points
2. Typical startup costs and the biggest ongoing costs
3. Typical gross margins and what drives them
4. Licenses, permits or registrations usually needed in Arizona
5. Common reasons new businesses in this industry struggle`;
  const comp=`${inc==='both'?'Part 2':'Part 1'}: Competition check
1. Market landscape: who buys, how big the local market is, and the main trends
2. The main types of competitors near ${v.area||'[AREA]'} and online, with a few examples I can look up
3. Benchmarking: a simple table comparing typical competitors on price, what they offer, location or reach, and reviews
4. A SWOT for the client's business (strengths, weaknesses, opportunities, threats)${v.biz?'':', based on a typical new business in this industry'}
5. Where the client could stand out`;
  return `You are helping a small business advisor prepare for a meeting with a client.
Research: ${v.industry||'[INDUSTRY]'} in ${v.area||'[AREA]'}.${biz}

${inc==='competition'?comp:inc==='industry'?ind:ind+'\n\n'+comp}

Finish with five questions I should ask the client in our meeting.
Use plain language. Say when a number is a rough estimate, and list your sources.`},
 competition:()=>`Do a competition check for a small business client.
Business: [WHAT THEY SELL, AND WHERE]
1. Market landscape: who buys, how big the local market is, and the main trends
2. The main competitors nearby and online, with a few examples I can look up
3. Benchmarking: a simple table comparing competitors on price, what they offer, location or reach, and reviews
4. A SWOT for the client's business (strengths, weaknesses, opportunities, threats)
5. Where the client could stand out
Use plain language. Say when a number is a rough estimate, and list your sources.`,
 bignotes:()=>`Summarize these long notes so I can read them in two minutes.
- Start with a 3 to 5 sentence summary.
- Then list: Key facts (numbers, dates, names), Decisions, Open questions, Next steps (who does what, by when).
- Keep the client's own words where they matter.
- Plain text only. Don't add anything that isn't in the notes.

Notes:
[PASTE NOTES HERE]`,
 summary:v=>`Rewrite these meeting notes as a session summary written in the first person, from my point of view as the advisor${v.me?' ('+v.me+')':''}.
- Use "I" and "me" for me, and refer to the client as ${v.client||'"the client"'}.
- Keep it under 200 words, in short paragraphs.
- End with a "Next steps" list showing who does what.
- Don't add anything that isn't in the notes.

Notes:
${v.notes||'[PASTE NOTES HERE]'}`};
const AI={gemini:{n:'Gemini',u:'https://gemini.google.com/app'},chatgpt:{n:'ChatGPT',u:'https://chatgpt.com/'},copilot:{n:'Copilot',u:'https://copilot.microsoft.com/'}};
const ai=()=>AI[(document.querySelector('#ai')||{}).value]||AI.gemini;
const fmt$=n=>'$'+(Math.round(n*100)/100).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:2});
const SIGNOFF={id:'signoff',label:'Sign-off',type:'select',opts:[['Best,','Best,'],['Thanks,','Thanks,'],['Warmly,','Warmly,'],['Talk soon,','Talk soon,']]};
const SIG={id:'sig',label:'Your name for the signature',type:'text',ph:'Optional'};

// Field shorthand: {id,label,type,opts,req,ph,val,full}
const SECS=[
 {id:'before',title:'Before the session',sub:'Know the business and get the client ready before they walk in.',icon:'clipboard-list'},
 {id:'during',title:'During and after the session',sub:'Run the numbers, share links and write it up.',icon:'presentation'},
 {id:'follow',title:'Follow-ups and reminders',sub:'Gray Dot outreach, portfolio check-ins and calendar reminders.',icon:'calendar-stats',legend:DOTS},
 {id:'report',title:'Reporting and CIC',sub:'Session records and the numbers your center reports.',icon:'report-analytics'},
 {id:'templates',title:'Templates and printables',sub:'Forms to send or print, and tested AI prompts.',icon:'file-text'}];

const TOOLS=[
 // ---------- Before
 {id:'llc',sec:'before',icon:'id',title:'LLC check',desc:"Search the Arizona Corporation Commission for the client's business name.",kw:'llc entity acc corporation commission registration',
  setup:[{id:'mode',label:'When you run it',type:'select',opts:[['open','Copy the name and open the ACC search'],['copy','Copy the name only']],full:1}],
  run:[{id:'name',label:'Business name',type:'text',req:1,ph:'e.g. Example Bakery LLC',full:1}],
  exec(v,x){return {title:`ACC search: ${v.name}`,text:`ACC entity search for "${v.name}"\n${ACC}\n\nThe name is copied so you can paste it straight into the search box.`,link:ACC,
   after(){x.copy(v.name,`"${v.name}" copied. Paste it into the ACC search box`);if(v.mode!=='copy')x.open(ACC)}}}},
 {id:'industry',sec:'before',icon:'sparkles',title:'Industry and competition research',desc:'One AI prompt for an industry overview and a competition check: market landscape, benchmarking and a SWOT.',kw:'research industry ai market prompt competition competitors swot swat benchmark benchmarking landscape',
  setup:[{id:'area',label:'Area',type:'text',val:'Maricopa County, Arizona',full:1}],
  run:[{id:'industry',label:'Industry',type:'text',req:1,ph:'e.g. food trucks',full:1},{id:'biz',label:"Client's business (for the SWOT)",type:'text',ph:'Optional, e.g. taco truck in Tempe, catering on weekends',full:1},{id:'include',label:'Include',type:'radio',opts:[['both','Industry and competition'],['industry','Industry only'],['competition','Competition only']],full:1}],
  exec(v,x){const p=PROMPTS.research(v);const nm={industry:'Industry',competition:'Competition check'}[v.include]||'Industry and competition';return {title:`${nm}: ${v.industry}`,text:p,files:[{name:'industry-competition-prompt.txt',type:'text/plain',text:p}],after(){x.copy(p,`Prompt copied. Paste it into ${ai().n} (Ctrl+V / Cmd+V)`);x.open(ai().u)}}}},
 {id:'prep',sec:'before',icon:'checkup-list',title:'Session prep packet',isNew:1,desc:'One run gives you an agenda, a prep checklist and a calendar invite for the session.',kw:'prep agenda first session packet calendar invite',
  setup:[{id:'mins',label:'Session length',type:'select',opts:[['30','30 minutes'],['60','60 minutes'],['90','90 minutes']],val:'60'},{id:'how',label:'Meeting type',type:'select',opts:[['Zoom','Zoom'],['In person','In person'],['Phone','Phone']]}],
  run:[{id:'client',label:'Client or business',type:'text',req:1,ph:'e.g. Example Taco Truck'},{id:'industry',label:'Industry',type:'text',ph:'e.g. food trucks'},{id:'date',label:'Session date',type:'date',req:1},{id:'time',label:'Time (MST)',type:'time',val:'10:00'},{id:'goal',label:'What they want help with',type:'textarea',ph:'e.g. pricing, a loan for a second truck',full:1}],
  exec(v){const m=+v.mins||60,when=sessWhen(v.date,v.time),a=[['Welcome and their goal',.15],['Where the business is today',.25],['Work the main question',.4],['Next steps and who does what',.2]];
   const ag=a.map(([t,p],i)=>`${i+1}. ${t} (${Math.max(5,Math.round(m*p/5)*5)} min)`).join('\n');
   const t=`Session prep: ${v.client}\nWhen: ${when} · ${m} min · ${v.how}\n${v.goal?`Goal: ${v.goal}\n`:''}${recordNote(v.client)}\nBefore we meet\n- Run the LLC check for ${v.client}\n${v.industry?`- Run the industry research prompt for ${v.industry}\n`:''}- Send the client the what-to-bring list\n- Read the CIC record and any past notes\n\nAgenda (${m} min)\n${ag}\n\nQuestions to ask\n- What does a typical month look like in sales and costs?\n- What have you tried so far, and what happened?\n- What would make this session worth it for you?`;
   const slug=v.client.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
   return {title:`Prep packet: ${v.client}`,text:t,files:[{name:`prep-${slug}.txt`,type:'text/plain',text:t},{name:`session-${slug}.ics`,type:'text/calendar',text:icsTimed(`SBDC session: ${v.client}`,t,v.date,v.time,m)}]}}},
 {id:'loanready',sec:'before',icon:'file-dollar',title:'Loan package readiness',isNew:1,desc:"Tick what the client has. Get a percent-ready score and an email listing what's still missing.",kw:'loan readiness package sba lender documents missing score',
  setup:[{id:'type',label:'Usual loan type',type:'select',opts:[['sba','SBA 7(a) or 504'],['micro','SBA microloan'],['bank','Bank or credit union']]}],
  run:[{id:'client',label:'Client first name',type:'text',ph:'Optional'},{id:'have',label:'What they have so far',type:'checks',opts:LOAN.map(([k,t])=>[k,t]),full:1}],
  exec(v){const need=LOAN.filter(([k])=>v.type!=='bank'||k!=='1919'),have=new Set(v.have||[]),got=need.filter(([k])=>have.has(k)),miss=need.filter(([k])=>!have.has(k));const pct=Math.round(got.length/need.length*100);
   const email=`Hi ${first(v.client)},\n\nThanks for pulling your loan documents together. Here's what's still needed:\n\n${miss.map(([,t])=>'- '+t).join('\n')||'- Nothing. You have everything on the list.'}\n\nIf you get stuck on any of these, reply and we'll work through it together. As always, SBDC advising is free.\n\nBest,`;
   const t=`Loan package readiness${v.client?': '+v.client:''}\n${got.length} of ${need.length} items (${pct}%)\n\nHave:\n${got.map(([,t])=>'- '+t).join('\n')||'- Nothing yet'}\n\nStill needed:\n${miss.map(([,t])=>'- '+t).join('\n')||'- Nothing'}\n\n--- Email for the client ---\n${email}`;
   return {title:`Loan readiness ${pct}%${v.client?' · '+v.client:''}`,text:t,mail:{to:'',subject:'Your loan documents: what is still needed',body:email},files:[{name:'loan-readiness.txt',type:'text/plain',text:t}],meter:pct}}},
 // ---------- Intake Assistant
 // href: this card has no setup dialog. Its button says "Open" and goes
 // straight to the Intake Assistant page (see openModal in toolbox.js).
 // Empty setup and run lists: there is nothing to fill in here.
 {
  id: 'intake',
  sec: 'before',
  icon: 'clipboard-list',
  title: 'Intake Assistant',
  desc: 'Opens the Intake Assistant page.',
  kw: 'intake assistant',
  href: 'pages/Intake_assistant_index.html',
  setup: [],
  run: [],
  exec() { return null; }
 },
 // ---------- During / after
 {id:'breakeven',sec:'during',icon:'calculator',title:'Break-even calculator',desc:"The basic math most new clients haven't done: price, cost per sale, monthly costs.",kw:'break even margin math pricing numbers calculator',
  setup:[{id:'daily',label:'Also show sales per day',type:'select',opts:[['yes','Yes'],['no','No']]}],
  run:[{id:'price',label:'Price per sale ($)',type:'number',req:1},{id:'cost',label:'Cost per sale ($)',type:'number',req:1},{id:'fixed',label:'Monthly fixed costs ($)',type:'number'},{id:'vol',label:'Sales / month',type:'number'}],
  exec(v){const p=+v.price,c=+v.cost,f=+v.fixed||0,q=+v.vol||0,m=p-c,pct=p?m/p*100:0;const L=[`Each sale: ${fmt$(p)} price − ${fmt$(c)} cost = ${fmt$(m)} left over (${pct.toFixed(0)}% margin)`];let meter=null;
   if(m<=0)L.push('Price is at or below cost: every sale loses money.');else if(v.fixed){const u=Math.ceil(f/m);L.push(`Break-even: ${u.toLocaleString()} sales a month${v.daily!=='no'?` (about ${Math.ceil(u/30).toLocaleString()} a day)`:''} to cover ${fmt$(f)} in monthly costs`);if(v.vol)meter=Math.min(100,Math.round(q/u*100))}
   if(v.vol){const r=q*p,pr=q*m-f;L.push(`At ${q.toLocaleString()} sales a month: ${fmt$(r)} in sales, ${pr>=0?fmt$(pr)+' profit':fmt$(-pr)+' loss'} after fixed costs`)}
   const t='Your numbers\n'+L.join('\n');return {title:`Break-even at ${fmt$(p)} a sale`,text:t,files:[{name:'break-even.txt',type:'text/plain',text:t}],meter}}},
 {id:'planner',sec:'during',icon:'file-spreadsheet',title:'Sales planner',desc:'Spreadsheet with months, units, price, sales and costs. Opens in Excel or Google Sheets, totals built in.',kw:'sales planner forecast excel spreadsheet 12 month csv',
  setup:[{id:'start',label:'Start month',type:'select',opts:[['next','Next month'],['this','This month']]},{id:'months',label:'Months',type:'select',opts:[['12','12 months'],['24','24 months']]}],
  run:[{id:'biz',label:'Business name',type:'text',ph:'Optional',full:1}],
  exec(v){const n=+v.months||12,d=new Date(),off=v.start==='this'?0:1;const rows=[['Month','Units sold','Price per unit','Sales','Cost per unit','Cost of goods','Fixed costs','Profit']];
   for(let i=0;i<n;i++){const m=new Date(d.getFullYear(),d.getMonth()+off+i,1),r=i+2;rows.push([m.toLocaleString('en-US',{month:'short',year:'numeric'}),'','',`=B${r}*C${r}`,'',`=B${r}*E${r}`,'',`=D${r}-F${r}-G${r}`])}
   const e=n+1;rows.push(['Total',`=SUM(B2:B${e})`,'',`=SUM(D2:D${e})`,'',`=SUM(F2:F${e})`,`=SUM(G2:G${e})`,`=SUM(H2:H${e})`]);
   const c=csv(rows);return {title:`${n}-month sales planner${v.biz?' · '+v.biz:''}`,text:`${n}-month sales planner${v.biz?' for '+v.biz:''}, starting ${rows[1][0]}.\nColumns: ${rows[0].join(', ')}.\nTotals are built in.`,files:[{name:`${n}-month-sales-planner.csv`,type:'text/csv',text:c}]}}},
 {id:'links',sec:'during',icon:'link',title:'Client links',desc:'The resources clients ask for most, ready to send as one list.',kw:'links ein irs tpt sba resources license',
  setup:[{id:'pick',label:'Links to include',type:'checks',opts:LINKS.map(([k,n])=>[k,n]),val:LINKS.map(l=>l[0]),full:1}],run:[],
  exec(v){const L=LINKS.filter(([k])=>(v.pick||[]).includes(k));const t='Helpful links:\n'+L.map(([,n,u])=>`- ${n}: ${u}`).join('\n');return {title:`Client links (${L.length})`,text:t,mail:{to:'',subject:'Helpful links from the Maricopa SBDC',body:t},files:[{name:'client-links.txt',type:'text/plain',text:t}]}}},
 {id:'zoom',sec:'during',icon:'writing',title:'Zoom notes to first-person summary or CIC notes',desc:'Paste the Zoom AI notes. "Pat said…" becomes "I said…", ready to send or log. Pick CIC notes to get the six CenterIC Notes headings, next steps split into client and counselor.',kw:'zoom notes summary first person rewrite cic center ic',
  setup:[{id:'me',label:'Your name as it appears in the notes',type:'text',req:1,ph:'e.g. Pat Smith',full:1},{id:'out',label:'Output',type:'select',opts:[['summary','First-person summary'],['cic','CIC session notes (six CIC headings)']]}],
  run:[{id:'client',label:'Client first name',type:'text',ph:'Optional',full:1},{id:'notes',label:'Session notes',type:'textarea',req:1,ph:'Paste Zoom AI meeting notes here',rows:5,full:1},{id:'purpose',label:'Purpose of this session (CIC notes)',type:'text',ph:'e.g. Initial Counseling Session',full:1},{id:'desc',label:'Business and owners, one line (CIC notes)',type:'text',ph:'Optional',full:1}],
  exec(v){let o=firstPerson(v.notes,v.me);if(v.client)o=o.replace(/\bthe client\b/gi,v.client);
   if(v.out==='cic'){const ss=sentencesOf(o);const ab=(ss[0]||'').match(/\babout ([^.;]+)/i);
    const t=cicFromLines(ss,{me:v.me,purpose:v.purpose||(ab?sentence(ab[1].replace(/^(the|a|an|my|their|his|her) /i,'')):''),desc:v.desc});
    return {title:`CIC session notes${v.client?' · '+v.client:''}`,text:t,files:[{name:'cic-session-notes.txt',type:'text/plain',text:t}]}}
   return {title:`First-person summary${v.client?' · '+v.client:''}`,text:o,files:[{name:'session-summary.txt',type:'text/plain',text:o}],prompt:PROMPTS.summary(v)}}},
 {id:'email',sec:'during',icon:'mail',title:'Follow-up email with next steps',desc:'Fill a few fields and get a ready email.',kw:'follow up email next steps recap',
  setup:[SIGNOFF,SIG,{id:'attach',label:'Usually attach',type:'select',opts:[['','Nothing extra'],['loan','Loan document checklist'],['bmc','Business Model Canvas'],['assets','Assets and equipment list']],full:1}],
  run:[{id:'name',label:'Client first name',type:'text',req:1},{id:'to',label:'Client email',type:'email'},{id:'topics',label:'What we covered',type:'text',ph:'pricing, startup costs, loan options',full:1},{id:'next',label:'Next steps (one per line)',type:'textarea',full:1},{id:'when',label:'Next meeting',type:'text',ph:'Thu Nov 19, 10:00 AM'}],
  exec(v){const ATT={loan:['the loan document checklist','pages/loan-checklist.html'],bmc:['a blank Business Model Canvas','pages/bmc.html'],assets:['the assets and equipment list','pages/assets-worksheet.html']};const nx=lines(v.next);const owned=nx.some(l=>OWNER_RE.test(l)),st=owned?splitSteps(nx,''):null;
   let b=`Hi ${v.name},\n\nThank you for meeting with me today.`;if(v.topics)b+=` We covered ${v.topics}.`;
   if(owned){if(st.client.length)b+=`\n\nYour next steps:\n${st.client.map(s=>'- '+s).join('\n')}`;if(st.counselor.length)b+=`\n\nWhat I'll do:\n${st.counselor.map(s=>'- '+s).join('\n')}`}
   else if(nx.length)b+=`\n\nNext steps:\n${nx.map(s=>'- '+s).join('\n')}`;const a=ATT[v.attach];if(a)b+=`\n\nHere is ${a[0]}: ${BASE}${a[1]}`;
   if(v.when)b+=`\n\nOur next meeting: ${v.when}.`;b+=`\n\nAs always, SBDC advising is free. Reply here if anything comes up before then.\n\n${sign(v)}`;
   return {title:`Follow-up email · ${v.name}`,text:b,mail:{to:v.to,subject:'Next steps from our SBDC meeting',body:b}}}},
 // ---------- Follow-ups
 {id:'tracker',sec:'follow',icon:'calendar-stats',title:"Who's due for follow-up",desc:'Paste the CIC "not contacted" export. Get the list sorted by days since contact, plus reminders.',kw:'follow up gray dots tickler 60 day 90 day cic report export due',
  setup:[{id:'due',label:'Due after',type:'select',opts:[['30','30 days'],['60','60 days'],['90','90 days']]},{id:'remind',label:'Reminders go on',type:'select',opts:[['tomorrow','Tomorrow'],['monday','Next Monday']]}],
  run:[{id:'list',label:'CIC export rows',type:'textarea',req:1,rows:5,ph:'Name\tEmail\tLast contact\nExample Client One\tone@example.com\t9/1/2026',sample:1,full:1,hint:'In CIC, export the "not contacted" report to Excel, then copy the Name, Email and Last contact columns. Add a column with Gray or Yellow to tag each client\'s dot.'}],
  exec(v){const rows=parseCIC(v.list);const sample=isSample(v.list);if(!rows.length)return {status:'error',title:'No rows with a date found',text:'Paste Name, Email and Last contact date, one client per line.'};setTracker(rows,sample);
   const lim=+v.due||30,due=rows.filter(r=>r.days>=lim);lastDue=due;const tm=new Date();if(v.remind==='monday'){tm.setDate(tm.getDate()+((8-tm.getDay())%7||7))}else tm.setDate(tm.getDate()+1);
   const t=`${due.length} of ${rows.length} are ${lim}+ days since last contact.\n\n`+rows.map(r=>`${String(r.days).padStart(4)} days · ${r.name}${r.email?' · '+r.email:''}${r.dot?' · '+r.dot:''} · ${bucket(r.days)}`).join('\n');
   const files=[{name:'follow-ups-due.csv',type:'text/csv',text:csv([['Client','Email','Last contact','Days','Bucket','Dot'],...rows.map(r=>[r.name,r.email,r.date.toLocaleDateString('en-US'),r.days,bucket(r.days),r.dot||''])])}];
   if(due.length)files.push({name:'follow-up-reminders.ics',type:'text/calendar',text:icsAllDay(due.map(r=>({date:tm,title:`Follow up: ${r.name}`,desc:`${r.days} days since last contact${r.email?' - '+r.email:''}.`})))});
   return {title:`${due.length} of ${rows.length} due for follow-up`,text:t,files,ex:sample,rows:rows.map(r=>({name:r.name,email:r.email,days:r.days,dot:r.dot||''}))}}},
 {id:'graydot',sec:'follow',icon:'user-question',title:'Gray Dot check-in email',desc:"For people who registered but haven't met an advisor. Says up front that it's free and there's nothing to sign.",kw:'gray dot inactive free email outreach',
  setup:[SIGNOFF,SIG],run:[{id:'name',label:'First name',type:'text',ph:'Optional'},{id:'to',label:'Email',type:'email',ph:'Optional'}],
  exec(v){const b=`Hi ${first(v.name)},\n\nYou registered with the Maricopa Small Business Development Center a little while ago, and I wanted to make sure you got what you needed.\n\nA couple of things people often don't know:\n- Advising is free. There's no charge and no contract to sign.\n- A first meeting can be short: 30 minutes by Zoom or phone to answer your most pressing question.\n\nWould you like to set up a time? Just reply with a couple of days that work for you.\n\n${sign(v)}`;
   return {title:`Gray Dot email${v.name?' · '+v.name:''}`,text:b,mail:{to:v.to,subject:'Free help for your business: Maricopa SBDC',body:b}}}},
 {id:'checkin',sec:'follow',icon:'message-circle',title:'"Has your advisor been in touch?"',desc:'Short check-in for portfolio clients at 60 to 90 days.',kw:'check in portfolio email advisor touch',
  setup:[SIGNOFF,SIG],run:[{id:'name',label:'First name',type:'text',ph:'Optional'},{id:'to',label:'Email',type:'email',ph:'Optional'}],
  exec(v){const b=`Hi ${first(v.name)},\n\nQuick check-in from the Maricopa SBDC: has your advisor been in touch with you lately?\n\nIf there's something you're working on (funding, pricing, a plan, anything else), reply and let me know. We can set up a time to talk. As always, it's free.\n\n${sign(v)}`;
   return {title:`Check-in email${v.name?' · '+v.name:''}`,text:b,mail:{to:v.to,subject:'Checking in from the Maricopa SBDC',body:b}}}},
 {id:'reminder',sec:'follow',icon:'bell',title:'Calendar reminder',desc:'A follow-up reminder for Outlook or Google Calendar.',kw:'calendar reminder ics outlook tickler',
  setup:[{id:'days',label:'Usual follow-up',type:'radio',opts:[['30','30 days'],['60','60 days'],['90','90 days']],val:'30',full:1}],
  run:[{id:'name',label:'Client or business',type:'text',req:1,full:1}],
  exec(v){const days=+v.days||30,d=new Date();d.setDate(d.getDate()+days);const t=icsAllDay([{date:d,title:`${days}-day follow-up: ${v.name}`,desc:`Check in with ${v.name}. Created ${new Date().toLocaleDateString('en-US')} from the Advisor Toolbox.`}]);
   return {title:`${days}-day reminder · ${v.name}`,text:`${days}-day follow-up: ${v.name}\nOn ${d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'})}`,files:[{name:`follow-up-${days}-days.ics`,type:'text/calendar',text:t}]}}},
 {id:'noshow',sec:'follow',icon:'user-x',title:'No-show reschedule email',isNew:1,desc:'A friendly "sorry we missed you" with a link to rebook, sent the same day.',kw:'no show missed reschedule rebook email',
  setup:[{id:'book',label:'Booking link',type:'url',ph:'https://… (optional)',full:1},SIGNOFF,SIG],
  run:[{id:'name',label:'Client first name',type:'text',req:1},{id:'to',label:'Client email',type:'email'},{id:'date',label:'Missed session date',type:'date',val:todayISO()}],
  exec(v){const w=v.date?sessWhen(v.date).replace(/, \d{4}$/,''):'today';const b=`Hi ${v.name},\n\nSorry we missed each other on ${w}. Things come up, no problem at all.\n\nWould you like to pick a new time? ${v.book?`You can book one here: ${v.book}`:'Reply with a couple of days and times that work for you.'}\n\nAs always, SBDC advising is free.\n\n${sign(v)}`;
   return {title:`Reschedule email · ${v.name}`,text:b,mail:{to:v.to,subject:'Sorry we missed you: let\'s find a new time',body:b}}}},
 // ---------- Reporting / CIC
 {id:'cic',sec:'report',icon:'notes',title:'Format notes for CIC',desc:'Plain text for the CIC session Notes box, under the six CIC headings in CIC order, with next steps split into client and counselor. A short header lists the session fields to set on the CIC screen.',kw:'cic center ic notes format session record headings',
  setup:[{id:'type',label:'Usual contact type',type:'select',opts:CIC_CONTACT},{id:'mins',label:'Usual minutes',type:'number',val:'60'},{id:'header',label:'Session fields header',type:'select',opts:[['yes','Show Date / Contact Type / Time / Status'],['no','Notes only']]}],
  run:[{id:'date',label:'Date',type:'date',val:todayISO()},{id:'time',label:'Start time',type:'time'},{id:'client',label:'Client or business',type:'text'},{id:'status',label:'Status on the date of this session',type:'select',opts:CIC_STATUS},
   {id:'purpose',label:'The purpose of this session',type:'text',ph:'e.g. Initial Counseling Session',full:1},{id:'desc',label:'Brief description of the business and/or owners',type:'text',ph:'e.g. Family-owned auto repair shop, two owners',full:1},
   {id:'notes',label:'What was discussed',type:'textarea',req:1,ph:'Paste your summary or rough notes',full:1},{id:'next',label:'Next steps (one per line; start with Client: or Me:)',type:'textarea',ph:'Client: send 12 months of sales\nMe: send loan checklist',full:1},
   {id:'impact',label:'Potential impact area',type:'text',ph:'Blank = suggest from the notes (Start Up, Capital, Owner Contribution, FTE, Sales increase)',full:1}],
  exec(v,x){const nx=plain(v.next).split('\n').map(s=>s.trim()).filter(Boolean);const disc=plain(v.notes);
   const steps=splitSteps(nx,v.me);const notes=cicNotes({purpose:v.purpose,desc:v.desc,discussed:disc,steps,impact:v.impact||cicImpact([disc,...nx].join(' '))});
   const t=v.header==='no'?notes:`${cicHeader(v)}${v.client?'\nClient: '+v.client:''}\n\nNOTES (paste into the CIC Notes box)\n${notes}`;
   return {title:`CIC record${v.client?' · '+v.client:''}`,text:t,notes,files:[{name:'cic-notes.txt',type:'text/plain',text:notes}],after(){x.copy(notes,'CIC notes copied. Paste into the Notes box of the CIC session record')}}}},
 {id:'digest',sec:'report',icon:'chart-pie',title:'Weekly portfolio digest',isNew:1,desc:'Turn the CIC export into a one-page week: who to call first, who needs a check-in, totals by age.',kw:'weekly digest portfolio summary report caseload',
  setup:[{id:'top',label:'Names per group',type:'select',opts:[['5','Top 5'],['10','Top 10']]}],
  run:[{id:'list',label:'CIC export rows',type:'textarea',req:1,rows:5,ph:'Name\tEmail\tLast contact',sample:1,full:1}],
  exec(v){const rows=parseCIC(v.list);if(!rows.length)return {status:'error',title:'No rows with a date found',text:'Paste Name, Email and Last contact date, one client per line.'};const sample=isSample(v.list);setTracker(rows,sample);const n=+v.top||5;
   const g=k=>rows.filter(r=>bucket(r.days)===k);const B=['90+ days','60–89 days','30–59 days','Under 30 days'];const due=rows.filter(r=>r.days>=30).length;
   const wk=new Date();wk.setDate(wk.getDate()-((wk.getDay()+6)%7));
   const t=`Portfolio digest · week of ${wk.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}\n${rows.length} clients · ${due} due\n${B.map(k=>`${k}: ${g(k).length}`).join(' · ')}\n\nCall first (90+ days)\n${g('90+ days').slice(0,n).map(r=>`- ${r.name} (${r.days} days)`).join('\n')||'- None'}\n\nCheck-in email (60–89 days)\n${g('60–89 days').slice(0,n).map(r=>`- ${r.name} (${r.days} days)`).join('\n')||'- None'}\n\nGray Dot email (30–59 days)\n${g('30–59 days').slice(0,n).map(r=>`- ${r.name} (${r.days} days)`).join('\n')||'- None'}`;
   return {title:`Digest: ${due} of ${rows.length} due`,text:t,ex:sample,files:[{name:'portfolio-digest.txt',type:'text/plain',text:t},{name:'portfolio-digest.csv',type:'text/csv',text:csv([['Bucket','Clients'],...B.map(k=>[k,g(k).length])])}]}}},
 {id:'activity',sec:'report',icon:'report-analytics',title:'Monthly activity report',isNew:1,desc:'Paste your session log. Get sessions, hours and clients for the month, by contact type.',kw:'monthly activity report hours sessions counseling time reporting',
  setup:[{id:'period',label:'Report on',type:'select',opts:[['last','Last month'],['this','This month']]}],
  run:[{id:'list',label:'Session log rows',type:'textarea',req:1,rows:5,ph:'Date\tClient\tMinutes\tType\n10/6/2026\tExample Bakery Owner\t60\tZoom',sample:1,full:1,hint:'Date, Client, Minutes and Type columns, one session per line.'}],
  sampleFor:v=>{const n=new Date(),y=n.getFullYear(),m=n.getMonth()-(v.period==='this'?0:1),dd=v.period==='this'?Math.max(1,n.getDate()):28;const D=k=>{const x=new Date(y,m,Math.min(dd,k));return `${x.getMonth()+1}/${x.getDate()}/${x.getFullYear()}`};
   return `Date\tClient\tMinutes\tType\n${D(2)}\tExample Bakery Owner\t60\tZoom\n${D(3)}\tExample Landscaping Co\t45\tIn person\n${D(9)}\tExample Bakery Owner\t30\tPhone\n${D(14)}\tExample Yoga Studio\t90\tIn person\n${D(21)}\tExample Coffee Cart\t60\tZoom`},
  exec(v){const n=new Date(),ref=new Date(n.getFullYear(),n.getMonth()-(v.period==='this'?0:1),1),Y=ref.getFullYear(),M=ref.getMonth();const all=[];
   String(v.list||'').split(/\r?\n/).forEach(l=>{if(!l.trim())return;const c=cells(l);const di=c.findIndex(x=>parseDate(x)&&/\d/.test(x)&&!/^\d{1,3}$/.test(x));if(di<0)return;const d=parseDate(c[di]);const rest=c.filter((_,i)=>i!==di);
    const mins=+(rest.find(x=>/^\d{1,3}$/.test(x))||0);const type=rest.find(x=>/^(in person|zoom|phone|email|video|virtual)$/i.test(x))||'Other';const client=rest.find(x=>x&&!/^\d+$/.test(x)&&x!==type)||'(no name)';all.push({d,mins,type,client})});
   const s=all.filter(r=>r.d.getFullYear()===Y&&r.d.getMonth()===M);const sample=/Example /.test(v.list)&&s.every(r=>/^Example\b/.test(r.client));const label=`${MONTHS[M]} ${Y}`;
   if(!s.length)return {status:'error',title:`No sessions in ${label}`,text:`None of the pasted rows are dated in ${label}. Check the date column or switch the month in Setup.`};
   const hrs=x=>(Math.round(x/6)/10).toFixed(1);const tot=s.reduce((a,r)=>a+r.mins,0),cl=new Set(s.map(r=>r.client));const T={};s.forEach(r=>{const k=r.type.replace(/^./,c=>c.toUpperCase());T[k]=T[k]||{n:0,m:0};T[k].n++;T[k].m+=r.mins});
   const t=`Activity report · ${label}\nSessions: ${s.length} · Hours: ${hrs(tot)} · Clients: ${cl.size}\n\nBy contact type\n${Object.entries(T).map(([k,x])=>`- ${k}: ${x.n} session${x.n===1?'':'s'}, ${hrs(x.m)} h`).join('\n')}\n\nBy client\n${[...cl].map(c=>{const r=s.filter(x=>x.client===c);return `- ${c}: ${r.length} session${r.length===1?'':'s'}, ${hrs(r.reduce((a,x)=>a+x.mins,0))} h`}).join('\n')}`;
   return {title:`Activity · ${label}: ${s.length} sessions, ${hrs(tot)} h`,text:t,ex:sample,files:[{name:`activity-${Y}-${pad(M+1)}.txt`,type:'text/plain',text:t},{name:`activity-${Y}-${pad(M+1)}.csv`,type:'text/csv',text:csv([['Contact type','Sessions','Hours'],...Object.entries(T).map(([k,x])=>[k,x.n,hrs(x.m)]),['Total',s.length,hrs(tot)]])}]}}},
 {id:'impact',sec:'report',icon:'award',title:'Milestone and impact check-in',isNew:1,soon:1,desc:'Asks portfolio clients about jobs added, capital raised and businesses started, for center reporting.',kw:'impact milestones jobs capital survey reporting',
  soonText:'Coming soon. It needs a connection to send the survey and read the answers. You can save your setup now.',
  setup:[{id:'form',label:'Survey form link',type:'url',ph:'https://forms.gle/…',full:1},{id:'cadence',label:'Ask clients',type:'select',opts:[['quarter','Every quarter'],['half','Twice a year']]}],run:[],exec(){return null}},
 // ---------- Templates
 {id:'bmc',sec:'templates',icon:'presentation',title:'Business Model Canvas',desc:'Blank one-page canvas for the client to fill in before or during session 1.',kw:'canvas business model bmc template print',
  setup:[{id:'open',label:'Open as',type:'select',opts:[['print','Print view'],['page','Page to share']]}],run:[],
  exec(v,x){const u=`${BASE}pages/bmc.html${v.open==='page'?'':'?print=1'}`;return {title:'Business Model Canvas',text:`Business Model Canvas\n${BASE}pages/bmc.html`,link:u,after(){x.open(u)}}}},
 {id:'loan',sec:'templates',icon:'file-dollar',title:'Loan document checklist',desc:'What most lenders ask for, including SBA Form 1919 and Form 413. Send it to loan clients before session 1.',kw:'loan sba 1919 413 lender checklist funding print email',
  setup:[{id:'how',label:'When you run it',type:'select',opts:[['email','Make the email'],['print','Make the email and open the print view']],full:1}],run:[],
  exec(v,x){const b=`Hi,\n\nBefore we meet, please start gathering what you can from this list. Most lenders ask for these items; each lender's list is a little different.\n\n${LOAN.map(([,t])=>'- '+t).join('\n')}\n\nForms:\nSBA Form 413: https://www.sba.gov/document/sba-form-413-personal-financial-statement\nSBA Form 1919: https://www.sba.gov/document/sba-form-1919-borrower-information-form\n\nIf you don't have something yet, that's fine. Bring what you have and we'll work through the rest.\n`;
   return {title:'Loan checklist email',text:b,mail:{to:'',subject:'What to gather for your loan application',body:b},link:`${BASE}pages/loan-checklist.html?print=1`,after(){if(v.how==='print')x.open(`${BASE}pages/loan-checklist.html?print=1`)}}}},
 {id:'assets',sec:'templates',icon:'building-store',title:'Assets and equipment list',desc:'Worksheet for clients to list buildings, tools and equipment with what each cost and proof.',kw:'assets equipment worksheet collateral print',
  setup:[{id:'open',label:'Open as',type:'select',opts:[['print','Print view'],['page','Page to share']]}],run:[],
  exec(v,x){const u=`${BASE}pages/assets-worksheet.html${v.open==='page'?'':'?print=1'}`;return {title:'Assets and equipment list',text:`Assets and equipment list\n${BASE}pages/assets-worksheet.html`,link:u,after(){x.open(u)}}}},
 {id:'homework',sec:'templates',icon:'clipboard-check',title:'Client homework sheet',isNew:1,desc:'Pick the tasks for the client to do before the next session. Get an email and a printable sheet with the links.',kw:'homework sheet tasks client to do worksheet send out print email',
  setup:[{id:'due',label:'Due',type:'select',opts:[['next','Before our next session'],['1w','In 1 week'],['2w','In 2 weeks']]},SIGNOFF,SIG],
  run:[{id:'name',label:'Client first name',type:'text',ph:'Optional'},{id:'to',label:'Client email',type:'email',ph:'Optional'},{id:'next',label:'Next session date',type:'date'},{id:'items',label:'Homework',type:'checks',opts:HOMEWORK.map(([k,t])=>[k,t]),full:1},{id:'extra',label:'Anything else (one per line)',type:'textarea',rows:2,full:1}],
  exec(v){const pick=HOMEWORK.filter(([k])=>(v.items||[]).includes(k)),extra=String(v.extra||'').split(/\n+/).map(x=>x.trim()).filter(Boolean);
   if(!pick.length&&!extra.length)return {status:'error',title:'No homework picked',text:'Tick at least one task, or add your own.'};
   const nd=v.next?new Date(v.next+'T12:00:00'):null,ndt=nd?nd.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}):'';
   const dueTxt=v.due==='1w'?'within a week':v.due==='2w'?'within two weeks':ndt?`before we meet on ${ndt}`:'before our next session';
   const lines=[...pick.map(([,t,u])=>`- ${t}${u?`\n  ${u()}`:''}`),...extra.map(x=>'- '+x)];
   const body=`Hi ${first(v.name)},\n\nHere is your homework for ${dueTxt}. Do what you can; bring questions on anything you get stuck on.\n\n${lines.join('\n')}\n\nSBDC advising is free, and these steps help us make the most of our time together.\n\n${v.signoff||'Best,'}${v.sig?'\n'+v.sig:''}`;
   const sheet=`CLIENT HOMEWORK${v.name?' · '+v.name:''}\nDue: ${dueTxt}\n\n${[...pick.map(([,t,u])=>`[ ] ${t}${u?`\n    ${u()}`:''}`),...extra.map(x=>'[ ] '+x)].join('\n')}\n\nNotes:\n\n\n`;
   return {title:`Homework sheet${v.name?' · '+v.name:''} (${pick.length+extra.length} tasks)`,text:`${body}\n\n--- Printable sheet ---\n${sheet}`,mail:{to:v.to||'',subject:'Your homework before our next SBDC session',body},files:[{name:'client-homework.txt',type:'text/plain',text:sheet}]}}},
 {id:'prompts',sec:'templates',icon:'sparkles',title:'AI prompt library',desc:'Copy a tested prompt and open your AI tool.',kw:'ai prompts library cleanup email loan summary long notes big notes competition swot',
  setup:[{id:'def',label:'Usual prompt',type:'select',opts:[['cleanup','Clean up meeting notes'],['bignotes','Summarize long notes'],['email','Write a follow-up email'],['loan','Review a loan package'],['competition','Competition check (SWOT)']],full:1}],
  run:[{id:'which',label:'Prompt',type:'radio',opts:[['cleanup','Clean up notes'],['bignotes','Summarize long notes'],['email','Follow-up email'],['loan','Loan package'],['competition','Competition check (SWOT)']],from:'def',full:1}],
  exec(v,x){const p=PROMPTS[v.which||v.def||'cleanup']();const nm={cleanup:'Clean up notes',bignotes:'Summarize long notes',email:'Follow-up email',loan:'Loan package',competition:'Competition check (SWOT)'}[v.which||v.def];return {title:`AI prompt: ${nm}`,text:p,files:[{name:`prompt-${v.which||v.def}.txt`,type:'text/plain',text:p}],after(){x.copy(p,`Prompt copied. Paste it into ${ai().n} (Ctrl+V / Cmd+V)`);x.open(ai().u)}}}}
];
TOOLS.forEach(t=>{t.needsInput=t.run.some(f=>f.req)});
window.TB={DOTS,HOMEWORK,CIC_H,CIC_CONTACT,CIC_STATUS,cicContact,stepOwner,splitSteps,cicImpact,cicNotes,cicHeader,cicFromLines,sentencesOf,sentence,plain,firstPerson,RICK_FIELDS,rickTemplate,SECS,TOOLS,BASE,AZ,DOW,MON,hm,sessWhen,sampleCIC,parseCIC,lastDue:()=>lastDue,icsAllDay,PROMPTS,AI,ai};
})();
