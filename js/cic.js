// CIC client / eRFC paste block, shared by the P2 dashboard ("Copy for CIC") and the server tool p2.cic.
// Same file in both places: dashboards/p2/cic.js and server/vendor/p2-cic.js. Plain script in the browser (window.P2CIC), CommonJS on the server.
(function (root) {
// CIC Client / eRFC paste block. Field names and the 17 "Assistance Requested" checkboxes are as they appear on the
// SBDC Register For Counseling (eRFC) screens and the CIC client record (Business Information).
const CIC_ASSIST = ['Business Accounting/Budget', 'Business Plan', 'Buy/Sell a Business', 'Cash Flow Management', 'Customer Relations', 'eCommerce', 'Financing/Capital', 'Franchising', 'Government Contracting', 'Human Resources/Employees', 'International Trade', 'Legal Issues', 'Managing Business', 'Marketing/Sales', 'Start-up Assistance', 'Tax Planning', 'Technology/Computers'];
// Rules: which checkbox a goal or answer points to. A suggestion; the client's own eRFC ticks win when given (field "assist").
const ASSIST_RULES = [
  ['Business Accounting/Budget', d => /\b(account|bookkeep|books|budget|quickbooks|pricing|price|costs?)\b/i.test(d.goal || '')],
  ['Business Plan', d => /\bbusiness plan|\bplan\b/i.test(d.goal || '')],
  ['Buy/Sell a Business', d => /\b(buy|buying|sell|selling|purchase|acquire)\b.{0,20}\bbusiness\b/i.test(d.goal || '')],
  ['Cash Flow Management', d => /\bcash ?flow|cash\b/i.test(d.goal || '')],
  ['Customer Relations', d => /\bcustomer (service|relations|experience|retention)\b/i.test(d.goal || '')],
  ['eCommerce', d => /\b(e-?commerce|online (sales|store|shop)|shopify|etsy|amazon)\b/i.test(d.goal || '')],
  ['Financing/Capital', d => d.funding === 'yes' || d.funding === 'maybe' || /\b(loan|funding|financ|capital|investor|grant)/i.test(d.goal || '')],
  ['Franchising', d => /\bfranchis/i.test(d.goal || '')],
  ['Government Contracting', d => /\bgovernment|\bcontracting\b|\bprocurement\b/i.test(d.goal || '')],
  ['Human Resources/Employees', d => /\b(hire|hiring|staff|employees?|hr|payroll)\b/i.test(d.goal || '')],
  ['International Trade', d => /\b(export|import|international)\b/i.test(d.goal || '')],
  ['Legal Issues', d => /\b(legal|lawyer|attorney|contract law|lawsuit|llc|license|permit)\b/i.test(d.goal || '')],
  ['Managing Business', d => /\b(manage|management|operations|grow|growth|expand|expansion|bays?)\b/i.test(d.goal || '')],
  ['Marketing/Sales', d => /\b(market|marketing|sales|customers|social|advertis|brand)\b/i.test(d.goal || '')],
  ['Start-up Assistance', d => d.stage === 'idea' || /\b(start|starting|launch|open)\b/i.test(d.goal || '')],
  ['Tax Planning', d => /\btax/i.test(d.goal || '')],
  ['Technology/Computers', d => /\b(website|web site|software|computer|tech|technology|app)\b/i.test(d.goal || '')],
];
const listOf = v => (Array.isArray(v) ? v : String(v || '').split(/[;|\n]/)).map(s => String(s).trim()).filter(Boolean);
function cicAssist(d) {
  const given = listOf(d.assist).map(x => CIC_ASSIST.find(c => c.toLowerCase() === x.toLowerCase())).filter(Boolean);
  if (given.length) return { picked: new Set(given), from: 'client' };
  return { picked: new Set(ASSIST_RULES.filter(([, f]) => f(d)).map(([n]) => n)), from: 'rules' };
}
const fmtDate = s => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${+m[2]}/${+m[3]}/${m[1]}` : String(s || ''); };
const fiveWords = s => String(s || '').replace(/\(.*?\)/g, '').trim().split(/\s+/).filter(Boolean).slice(0, 5).join(' ');
function cicIntakeText(d, deps) {
  const { flags, money } = deps;
  const notYet = d.stage === 'idea', status = notYet ? 'Not Yet in Business' : d.stage ? 'In Business' : '';
  const A = cicAssist(d), miss = [], L = [];
  const row = (k, v, missLabel) => { const has = v !== undefined && v !== null && String(v).trim() !== ''; L.push(`${k}: ${has ? v : ''}`); if (!has) miss.push(missLabel || k); };
  L.push('CIC CLIENT / eRFC (paste field by field into CIC)');
  row('Business Name', String(d.biz || '').replace(/^Example:\s*/, ''));
  row('Business Description (3-5 words)', d.bizDesc ? fiveWords(d.bizDesc) : fiveWords(d.industry), 'Business Description');
  row('Status', status);
  const ft = d.ft !== undefined && d.ft !== '' ? d.ft : '', pt = d.pt !== undefined && d.pt !== '' ? d.pt : '';
  if (ft === '' && pt === '' && String(d.employees ?? '').trim() === '0') L.push('Employees FT: 0', 'Employees PT: 0');
  else if (ft !== '' || pt !== '') L.push(`Employees FT: ${ft === '' ? '' : ft}`, `Employees PT: ${pt === '' ? '' : pt}`);
  else { L.push(`Employees FT: ${notYet ? '0' : ''}`, `Employees PT: ${notYet ? '0' : ''}`); if (!notYet) miss.push(d.employees ? `Employees FT / PT split (intake says ${d.employees} total)` : 'Employees FT / PT'); }
  if (notYet && !d.revenue) L.push('Annual Sales $: 0'); else row('Annual Sales $', d.revenue ? money(d.revenue) : '');
  if (notYet && !d.pl) L.push('Annual P/L $: 0'); else row('Annual P/L $', d.pl !== undefined && d.pl !== '' ? money(d.pl) : '');
  row('Web Site', d.website);
  if (notYet && !d.startDate) L.push('Start Date: (not started)'); else row('Start Date', fmtDate(d.startDate));
  row('NAICS (if known)', d.naics, 'NAICS');
  L.push('', `Assistance Requested${A.from === 'rules' ? ' (suggested from the intake answers; confirm with the client)' : ''}:`);
  CIC_ASSIST.forEach(c => L.push(`[${A.picked.has(c) ? 'x' : ' '}] ${c}`));
  if (!A.picked.size) miss.push('Assistance Requested');
  const spec = d.specific || [d.goal, (d.funding === 'yes' || d.funding === 'maybe') && (d.amount || d.use) ? `Funding: ${d.amountUnknown ? 'amount not known yet' : money(d.amount) || 'amount not given'}${d.use ? ' for ' + d.use : ''}` : ''].filter(Boolean).join('. ');
  L.push('', `Specific assistance: ${spec}`); if (!spec) miss.push('Specific assistance');
  L.push('', 'Not captured yet:'); L.push(...(miss.length ? miss.map(m => `- ${m}`) : ['- Nothing: every field above has an answer']));
  const F = flags(d).filter(x => x.level !== 'ok');
  if (F.length) { L.push('', 'Also check before session 1:'); F.forEach(x => L.push(`- ${x.text}`)); }
  return { text: L.join('\n'), missing: miss, assist: [...A.picked], assistFrom: A.from };
}

root.P2CIC = { CIC_ASSIST, cicAssist, cicIntakeText };
if (typeof module !== 'undefined' && module.exports) module.exports = root.P2CIC;
})(typeof window !== 'undefined' ? window : globalThis);
