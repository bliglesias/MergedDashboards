// v7 motion: a short, quiet fade-in when you open a page (route change only).
// It does not replay for searches, typing, or other in-page changes. Pure presentation; stores nothing.
(function(){
  const still=matchMedia('(prefers-reduced-motion: reduce)');
  const SEL='.page-head,#kpis>[class*=col],.row-cards>[class*=col],.sec-title,.card,.blk-title';
  let last=null;
  function play(view){
    const key=location.hash||'#/overview';
    if(key===last)return;last=key;
    if(still.matches||!view||view.hidden)return;
    const all=[...view.querySelectorAll(SEL)].filter(e=>!e.closest('[hidden]'));
    const els=all.filter(e=>!all.some(o=>o!==e&&o.contains(e))).slice(0,12);
    els.forEach(e=>e.classList.remove('rise'));void view.offsetWidth;
    els.forEach((e,i)=>{e.style.setProperty('--i',i);e.classList.add('rise')});
    clearTimeout(view._t);view._t=setTimeout(()=>els.forEach(e=>e.classList.remove('rise')),450);
  }
  window.__flair=play;
  const views=[...document.querySelectorAll('[data-view]')];
  const mo=new MutationObserver(ms=>ms.forEach(m=>{const v=m.target;if(!v.hidden&&m.oldValue!==null)play(v)}));
  views.forEach(v=>mo.observe(v,{attributes:true,attributeFilter:['hidden'],attributeOldValue:true}));
  const first=views.find(v=>!v.hidden);if(first)play(first);
})();
