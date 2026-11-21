// Example automations for Advisor Toolbox (counts only, no client details). area: 'intake' = Client Intake, 'toolbox' = Toolbox.
window.AUTOS=[
 {area:'intake',id:'form-brief',name:'Pre-session form → brief',desc:'Turns each new pre-session form response into a client brief draft.',icon:'forms',state:'running',s:{type:'event',text:'When a client submits the pre-session form',ago:5,every:26,next:'On the next form'},unit:['brief drafted','briefs drafted'],hist:[1,2,1,1,3]},
 {area:'intake',id:'bring-email',name:'What-to-bring email',desc:'Drafts the what-to-bring checklist email 2 days before session 1.',icon:'mail',state:'running',s:{type:'daily',h:8,m:0},unit:['email drafted','emails drafted'],hist:[1,0,2,1,1]},
 {area:'intake',id:'missing-nudge',name:'Missing-info nudge',desc:'Lists clients with missing intake answers 24 hours before their session.',icon:'bell',state:'paused',s:{type:'daily',h:9,m:0},unit:['client flagged','clients flagged'],hist:[1,2,0,1,0]},
 {area:'intake',id:'weekly-digest',name:'Weekly intake digest',desc:'A Monday summary: new intakes, sections done and funding requests.',icon:'chart-bar',state:'running',s:{type:'weekly',dow:1,h:7,m:30},unit:['intake summarized','intakes summarized'],hist:[4,6,3,5,4]},
 {area:'toolbox',id:'tickler-60',name:'60-day portfolio check-in',desc:'Lists clients 60+ days since last contact so you can send a check-in.',icon:'calendar-stats',state:'running',s:{type:'weekly',dow:1,h:8,m:0},unit:['client listed','clients listed'],hist:[3,4,2,5,3]},
 {area:'toolbox',id:'graydot-30',name:'30-day Gray Dot outreach',desc:'Drafts the Gray Dot email for clients 30 to 59 days without contact.',icon:'mail',state:'running',s:{type:'weekly',dow:3,h:9,m:0},unit:['email drafted','emails drafted'],hist:[2,1,3,2,2]},
 {area:'toolbox',id:'overdue-90',name:'90+ day overdue alert',desc:'Flags clients 90+ days since contact so they get a call first.',icon:'bell',state:'error',err:'no CIC list to read',s:{type:'daily',h:8,m:0},unit:['client flagged','clients flagged'],hist:[0,1,0,2,1]},
 {area:'toolbox',id:'post-session',name:'Post-session follow-up',desc:'Drafts the recap email the day after each session.',icon:'notes',state:'running',s:{type:'event',text:'The day after each session',ago:20,every:48,next:'After the next session'},unit:['email drafted','emails drafted'],hist:[1,2,1,1,3]},
 {area:'toolbox',id:'cic-notes',name:'CIC notes reminder',desc:'Reminds you to finish CIC session notes for the month.',icon:'file-text',state:'paused',s:{type:'monthly',h:8,m:0},unit:['session open','sessions open'],hist:[3,2,4,1,2]}
];
// Area labels shared by the Automations rows and filter chips.
window.SBDC_AREAS={intake:{name:'Client Intake',project:'p2'},toolbox:{name:'Toolbox',project:'p3'}};
