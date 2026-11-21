// Client intake: email the pre-session Google Form to a client.
// Opens a draft in the advisor's own Gmail with the form link in it. The advisor reads it and presses Send;
// nothing is sent from here. The form link is kept in this browser (sbdc-intake-form) and can be changed.
(() => {
const $ = (s) => document.querySelector(s);
const KEY = 'sbdc-intake-form';
// "SBDC Pre-Session Client Intake" in the Maricopa SBDC work Drive.
const DEFAULT_FORM = 'https://docs.google.com/forms/d/1MTsnlumhsZ4h2NP_eIvWSwt60qXoNRj8LkXcHLpGCF0/viewform';
const ls = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const toast = (t) => (window.__toast ? window.__toast(t) : null);
const link = $('#fsLink'), to = $('#fsTo');
if (!link) return;

const isForm = (u) => /^https:\/\/(docs\.google\.com\/forms\/|forms\.gle\/)\S+$/.test(String(u || '').trim());
link.value = ls(KEY, DEFAULT_FORM);
const paintName = () => { $('#fsName').textContent = link.value.trim() === DEFAULT_FORM ? 'SBDC pre-session intake form' : 'Your own form: ' + link.value.trim().replace(/^https:\/\//, '').slice(0, 48); };
paintName();
// A small "Change form" button opens the link box; the choice is kept in this browser.
$('#fsChange').onclick = () => { const e = $('#fsEdit'); e.hidden = !e.hidden; if (!e.hidden) { link.select(); link.focus(); } };
$('#fsUse').onclick = () => { const u = link.value.trim(); if (!isForm(u)) { toast('That is not a Google Form link'); link.focus(); return; } try { localStorage.setItem(KEY, u); } catch {} paintName(); $('#fsEdit').hidden = true; toast('Form changed'); };
$('#fsReset').onclick = () => { try { localStorage.removeItem(KEY); } catch {} link.value = DEFAULT_FORM; paintName(); $('#fsEdit').hidden = true; toast('Back to the SBDC form'); };
const goodLink = () => isForm(link.value.trim());
const clientEmail = () => to.value.trim() || ($('#email') ? $('#email').value.trim() : '');
function message() {
  const first = (($('#client') ? $('#client').value : '').replace(/^Example:\s*/, '').trim().split(' ')[0]) || 'there';
  const me = ls('sbdc-advisor-name', '');
  return `Hi ${first},\n\nThanks for reaching out to the Maricopa SBDC. Before our first meeting, please fill in this short form. It takes about 5 minutes and helps us make the most of our time together:\n\n${link.value.trim()}\n\nIf you don't know an answer yet, leave it blank and we'll go through it together.\n\nSee you soon,${me ? '\n' + me : ''}\nMaricopa SBDC`;
}
const SUBJECT = 'A short form before your first SBDC meeting';
const ready = () => { if (goodLink()) return true; toast('Change form: that link is not a Google Form'); $('#fsEdit').hidden = false; link.focus(); return false; };

// The client email on the intake form is offered here too.
document.addEventListener('sbdc:route', (e) => { if (e.detail.view === 'intake-questions' && !to.value && $('#email')) to.value = $('#email').value.trim(); });

$('#fsMail').onclick = () => {
  if (!ready()) return;
  const addr = clientEmail();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr)) { toast("Add the client's email first"); to.focus(); return; }
  const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(addr)}&su=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(message())}`;
  window.__lastFormMail = url;
  window.open(url, '_blank', 'noopener');
  toast('Draft opened in Gmail. Read it, then press Send.');
};
$('#fsCopy').onclick = () => { if (!ready()) return; navigator.clipboard.writeText(message()).then(() => toast('Message copied'), () => toast('Could not copy')); };
$('#fsOpen').onclick = () => { if (ready()) window.open(link.value.trim(), '_blank', 'noopener'); };
})();
