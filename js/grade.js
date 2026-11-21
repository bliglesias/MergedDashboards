// Client grade: a percent for how ready a client's business is to get off the ground and grow with advising.
// Pure function, no page or storage access, so the same file runs in the browser (window.SBDC_GRADE) and in Node tests.
//
// Where the rubric comes from:
// - Lenders' "5 Cs of credit" (capacity, capital, character, collateral, conditions) for the money section.
// - Accelerator selection rubrics: four to six criteria, each with a written anchor, so two people score the same way.
// - SBA's SBDC measures: a "long-term client" has 5 or more hours of counseling, and outcomes are starts, jobs and capital.
//
// Rules this file keeps:
// - Only business facts and engagement count. Race, sex, age, disability, veteran status, language and location are
//   never read, even when a record holds them.
// - A fact nobody has entered scores zero and is listed as "not known yet", so the grade rises as the record fills in.
//   The "known" percent says how much of the grade rests on real answers.
// - The grade says where a client stands and what would move them. It is not a reason to turn anyone away.
(function (root) {
  const num = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(String(v).replace(/[$,\s]/g, ''));
    return Number.isFinite(n) ? n : null;
  };
  const has = (v) => (Array.isArray(v) ? v.length > 0 : String(v ?? '').trim() !== '');
  const yes = (v) => /^(yes|y|true|on|x)$/i.test(String(v ?? '').trim());
  const stageOf = (f) => {
    const s = String(f.stage || f.status || '').toLowerCase();
    if (/exist|establish|in business(?!.*not)/.test(s) && !/not yet/.test(s)) return 'existing';
    if (/start/.test(s)) return 'startup';
    if (/idea|pre-?venture|not yet/.test(s)) return 'idea';
    return '';
  };
  const yearsOf = (f, now) => {
    const y = num(String(f.years ?? '').match(/[\d.]+/)?.[0]);
    if (y !== null) return y;
    const t = Date.parse(f.startDate || '');
    return Number.isFinite(t) ? Math.max(0, (now - t) / 31557600000) : null;
  };
  const CREDIT = { 720: 1, 680: 0.8, 620: 0.5, lt620: 0.2 };
  const creditOf = (v) => {
    const s = String(v ?? '').trim().toLowerCase();
    if (!s) return null;
    if (s === 'unknown' || /know/.test(s)) return 0;
    if (s in CREDIT) return CREDIT[s];
    const n = num(s.match(/\d{3}/)?.[0]);
    if (n === null) return null;
    return n >= 720 ? 1 : n >= 680 ? 0.8 : n >= 620 ? 0.5 : 0.2;
  };

  // Each item: [section, points, label, what would raise it, (facts, client, now) => 0..1, or null when not known].
  const ITEMS = [
    ['Foundation', 5, 'Legal entity formed', 'Form the LLC or corporation with the AZ Corporation Commission.', (f) => (has(f.llc) ? (yes(f.llc) ? 1 : 0) : null)],
    ['Foundation', 4, 'EIN from the IRS', 'Apply for the EIN online; it is free and takes minutes.', (f) => (has(f.ein) ? (yes(f.ein) ? 1 : 0) : null)],
    ['Foundation', 4, 'TPT license sorted', 'Check whether the business needs an Arizona TPT license, then apply.', (f) => (has(f.tpt) ? (/^(yes|na)$/i.test(f.tpt) || /not needed/i.test(f.tpt) ? 1 : 0) : null)],
    ['Foundation', 3, 'Customers can find it online', 'Set up a simple website and one social account.', (f) => (has(f.online) ? (/both|website and/i.test(f.online) ? 1 : /social/i.test(f.online) ? 0.5 : 0) : has(f.website) ? 1 : null)],
    ['Foundation', 4, 'Key documents on hand', 'Gather financial statements, tax returns and a business plan.', (f) => (Array.isArray(f.docs) ? Math.min(1, f.docs.length / 3) : has(f.docs) ? Math.min(1, String(f.docs).split(/[,;\n]/).filter((x) => x.trim()).length / 3) : null)],

    ['Traction', 10, 'Stage of the business', 'Get to a first paying customer.', (f) => ({ existing: 1, startup: 0.6, idea: 0.2 })[stageOf(f)] ?? null],
    ['Traction', 8, 'Sales coming in', 'Grow yearly sales; even small steady sales count.', (f) => { const r = num(f.revenue ?? f.sales); return r === null ? null : r >= 250000 ? 1 : r >= 50000 ? 0.75 : r > 0 ? 0.5 : 0; }],
    ['Traction', 4, 'People working in it', 'Bring on the first employee or contractor when sales allow.', (f) => { const ft = num(f.ft), pt = num(f.pt), e = num(f.employees); const n = e !== null ? e : ft !== null || pt !== null ? (ft || 0) + (pt || 0) : null; return n === null ? null : n >= 5 ? 1 : n >= 1 ? 0.75 : 0.25; }],
    ['Traction', 3, 'Time in business', 'Time in business grows on its own; keep records from day one.', (f, c, now) => { const y = yearsOf(f, now); return y === null ? null : y >= 2 ? 1 : y >= 1 ? 0.67 : 0.33; }],

    ['Money', 5, "Owner's own money in", 'Lenders look for the owner to put in about 10% or more.', (f) => { const i = num(f.invested), a = num(f.amount); return i === null ? null : i <= 0 ? 0 : i >= 10000 || (a && i >= a * 0.1) ? 1 : 0.6; }],
    ['Money', 5, 'Personal credit', 'Pull a free credit report and work toward 680 or higher.', (f) => creditOf(f.credit)],
    ['Money', 3, 'Cash on hand', 'Build a cash cushion before borrowing.', (f) => { const l = num(f.liquid); return l === null ? null : l > 0 ? 1 : 0; }],
    ['Money', 4, 'Each sale makes money', 'Raise the price or cut the cost so each sale leaves a margin.', (f) => { const p = num(f.price), c = num(f.cost); if (p === null || c === null) return null; if (p <= c) return 0; const v = num(f.volume), fx = num(f.fixed); return v !== null && v * (p - c) - (fx || 0) > 0 ? 1 : 0.75; }],
    ['Money', 3, 'Business is profitable', 'Track profit and loss monthly.', (f) => { const p = num(f.pl); return p === null ? null : p > 0 ? 1 : 0; }],

    ['Engagement', 6, 'Intake filled in', 'Finish the client intake.', (f) => { const core = ['biz', 'industry', 'stage', 'goal', 'expect', 'llc', 'ein', 'revenue', 'invested', 'credit']; const n = core.filter((k) => has(f[k])).length; return n ? n / core.length : null; }],
    ['Engagement', 6, 'Sessions held', 'Book the next session.', (f, c) => { const n = c.sessions.length; return n >= 3 ? 1 : n / 3; }],
    ['Engagement', 4, 'Five or more hours together', 'SBA counts a client as long-term at 5 hours.', (f, c) => Math.min(1, c.sessions.reduce((a, s) => a + (num(s.mins) || 0), 0) / 300)],
    ['Engagement', 4, 'In touch recently', 'Check in; it has been a while.', (f, c, now) => { const last = lastContact(c); if (!last) return c.sessions.length ? 0 : null; const days = (now - last) / 86400000; return days <= 30 ? 1 : days <= 90 ? 0.5 : 0; }],

    ['Clarity', 5, 'Clear goal', 'Write the one goal for the next 12 months.', (f) => (has(f.goal) ? 1 : null)],
    ['Clarity', 3, 'Knows what help they want', 'Agree what the client expects from the SBDC.', (f) => (has(f.expect) || has(f.assist) ? 1 : null)],
    ['Clarity', 4, 'Funding ask is specific', 'Pin down the amount and what it pays for.', (f) => (!has(f.funding) ? null : !yes(f.funding) ? 1 : (has(f.amount) ? 0.5 : 0) + (has(f.use) ? 0.5 : 0))],
    ['Clarity', 3, 'Can say what the business sells', 'Describe what it sells and who buys it in one sentence.', (f) => (has(f.bizDesc) || has(f.industry) ? 1 : null)],
  ];

  function lastContact(c) {
    const times = c.sessions.map((s) => Date.parse(s.date)).concat(Date.parse(c.facts.lastContact || '')).filter(Number.isFinite);
    return times.length ? Math.max(...times) : 0;
  }

  const BANDS = [[80, 'Strong'], [60, 'Promising'], [40, 'Building'], [0, 'Early']];

  // client: { facts: {...}, sessions: [{ date, mins }] }.  Returns the percent and everything behind it.
  function grade(client, now = Date.now()) {
    const c = { facts: client?.facts || {}, sessions: Array.isArray(client?.sessions) ? client.sessions : [] };
    let earned = 0, knownPts = 0;
    const sections = {};
    const items = ITEMS.map(([section, pts, label, tip, fn]) => {
      const share = fn(c.facts, c, now);
      const known = share !== null && share !== undefined;
      const got = known ? Math.round(pts * Math.max(0, Math.min(1, share)) * 10) / 10 : 0;
      earned += got;
      if (known) knownPts += pts;
      const s = (sections[section] ||= { name: section, pts: 0, got: 0 });
      s.pts += pts;
      s.got += got;
      return { section, pts, label, tip, known, got };
    });
    const pct = Math.round(earned);
    const known = Math.round(knownPts);
    const raise = items.filter((i) => i.pts - i.got >= 1).sort((a, b) => b.pts - b.got - (a.pts - a.got)).slice(0, 3)
      .map((i) => ({ label: i.label, tip: i.tip, pts: Math.round((i.pts - i.got) * 10) / 10, known: i.known }));
    return {
      pct,
      known,
      thin: known < 40,
      band: known < 40 ? 'Not enough info yet' : BANDS.find(([min]) => pct >= min)[1],
      sections: Object.values(sections).map((s) => ({ ...s, got: Math.round(s.got * 10) / 10 })),
      items,
      raise,
    };
  }

  const api = { grade, lastContact: (client) => lastContact({ facts: client?.facts || {}, sessions: client?.sessions || [] }) };
  root.SBDC_GRADE = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
