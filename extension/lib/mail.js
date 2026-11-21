// Builds the address that opens a new email DRAFT in the advisor's own mail. Nothing is sent: the advisor
// reads the draft and presses Send. Pure functions, no browser APIs.

export const MAIL_APPS = { gmail: 'Gmail', outlook: 'Outlook on the web', app: 'The mail app on this computer' };

// A draft travels in the address itself, so a very long email is cut. Mail apps take far less than web mail.
const MAX_BODY = { gmail: 6000, outlook: 6000, app: 1800 };
const CUT_NOTE = '\n\n[Cut short here. Copy the rest from your Toolbox results.]';
const ADDRESS = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;

// Returns { url, cut }. `cut` is true when the body was too long and was shortened.
export function draftUrl(app, mail) {
  if (!MAIL_APPS[app]) throw new Error('Unknown mail choice');
  const to = ADDRESS.test(String(mail?.to || '').trim()) ? String(mail.to).trim() : '';
  const subject = String(mail?.subject || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  let body = String(mail?.body || '').replace(/\r\n/g, '\n');
  const cut = body.length > MAX_BODY[app];
  if (cut) body = body.slice(0, MAX_BODY[app]) + CUT_NOTE;
  const e = encodeURIComponent;
  if (app === 'gmail') return { url: `https://mail.google.com/mail/?view=cm&fs=1&to=${e(to)}&su=${e(subject)}&body=${e(body)}`, cut };
  if (app === 'outlook') return { url: `https://outlook.office.com/mail/deeplink/compose?to=${e(to)}&subject=${e(subject)}&body=${e(body)}`, cut };
  return { url: `mailto:${e(to)}?subject=${e(subject)}&body=${e(body.replace(/\n/g, '\r\n'))}`, cut };
}
