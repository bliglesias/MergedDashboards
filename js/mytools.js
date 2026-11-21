// Toolbox page: "My tools / All tools". Once an advisor has set up at least one tool, they can show just
// those. Nothing is removed: "All tools" is one click away, and searching always looks through every tool.
(()=>{
const KEY='sbdc-tools-view';
const head=document.getElementById('tbHead'),box=document.getElementById('toolbox'),search=document.getElementById('toolSearch');
if(!head||!box)return;
const bar=document.createElement('div');bar.className='secjump tview';bar.setAttribute('role','group');bar.setAttribute('aria-label','Which tools to show');
bar.innerHTML='<button class="chip" type="button" data-view-tools="mine" aria-pressed="false">My tools</button><button class="chip" type="button" data-view-tools="all" aria-pressed="true">All tools</button>';
head.appendChild(bar);
let want='all';try{if(localStorage.getItem(KEY)==='mine')want='mine'}catch(e){}
function paint(){
  const mine=want==='mine'&&!(search&&search.value.trim());
  box.classList.toggle('only-mine',mine);
  bar.querySelectorAll('[data-view-tools]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.viewTools===want)));
}
bar.addEventListener('click',e=>{const b=e.target.closest('[data-view-tools]');if(!b)return;want=b.dataset.viewTools;try{localStorage.setItem(KEY,want)}catch(e){}paint()});
search&&search.addEventListener('input',paint);
document.addEventListener('sbdc:route',paint);
paint();
})();
