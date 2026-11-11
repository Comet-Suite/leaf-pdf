/* ---------- rendering: queued, nearest page first, never leaves a blank page ---------- */
const MAXKEEP=matchMedia('(pointer:coarse)').matches?6:10;
let rq=[],rrun=0;const kept=new Set();
function mkQ(n,lifo){const q=[];let r=0;const pump=()=>{while(r<n&&q.length){const f=lifo?q.pop():q.shift();r++;f().catch(()=>{}).finally(()=>{r--;pump()})}};return f=>{q.push(f);pump()}}
const thq=mkQ(2,true);
const io=new IntersectionObserver(es=>{
  for(const e of es){
    const p=P[+e.target.dataset.i];if(!p)continue;p.vis=e.isIntersecting;
    if(e.isIntersecting)render(p.i);
    else if(!kept.has(p.i)){p.tk++;p.rs=null;p.pr=null;p.task&&p.task.cancel()}
  }
},{root:viewer,rootMargin:'150% 0px'});
const kio=new IntersectionObserver(es=>{for(const e of es){const p=P[+e.target.dataset.i];if(p&&!e.isIntersecting)unrender(p)}},{root:viewer,rootMargin:'350% 0px'});
const tio=new IntersectionObserver(es=>{
  for(const e of es)if(e.isIntersecting&&!e.target.done){e.target.done=1;const i=+e.target.dataset.i,box=e.target.firstChild;thq(()=>fillThumb(i,box))}
},{root:thEl,rootMargin:'1500px 0px'});

function pump(){
  rq=rq.filter(j=>j.my===j.p.tk||(j.done(),false));
  while(rrun<2&&rq.length){
    const c=Math.max(0,curPage);let bi=0,bd=1e9;
    for(let k=0;k<rq.length;k++){const d=Math.abs(rq[k].p.i-c);if(d<bd){bd=d;bi=k}}
    const j=rq.splice(bi,1)[0];rrun++;
    j.run().catch(()=>{}).finally(()=>{rrun--;j.done();pump()});
  }
}
function render(i){
  const p=P[i];if(!p||!doc)return;
  if(p.rs===scale)return p.pr;
  p.rs=scale;const my=++p.tk;
  return p.pr=new Promise(res=>{rq.push({p,my,run:()=>doRender(p,my),done:res});pump()});
}
async function doRender(p,my){
  const d=doc,i=p.i,page=await d.getPage(i+1);if(my!==p.tk||d!==doc)return;
  const vp=page.getViewport({scale});
  p.w=vp.width/scale;p.h=vp.height/scale;size(p);drawAnn(i);
  if(!p.lo)getLo(i);
  const r=dpr(),cv=document.createElement('canvas');
  cv.width=Math.floor(vp.width*r);cv.height=Math.floor(vp.height*r);
  p.task&&p.task.cancel();
  const task=p.task=page.render({canvasContext:cv.getContext('2d'),viewport:vp,transform:r!==1?[r,0,0,r,0,0]:null});
  try{await task.promise}catch(e){return}
  if(my!==p.tk||d!==doc)return;
  const old=p.el.querySelector('canvas');old&&old.remove();p.el.prepend(cv);
  kept.add(i);trim();
  const tc=await page.getTextContent();if(my!==p.tk)return;
  const tl=document.createElement('div');tl.className='textLayer';tl.style.setProperty('--scale-factor',scale);
  const divs=[];
  await pdfjsLib.renderTextLayer({textContentSource:tc,container:tl,viewport:vp,textDivs:divs}).promise;
  if(my!==p.tk)return;
  const eoc=document.createElement('div');eoc.className='endOfContent';tl.append(eoc);
  const ot=p.el.querySelector('.textLayer');ot&&ot.remove();p.el.append(tl);
  p.divs=divs;highlight(p);schedSel();
}
function trim(){
  if(kept.size<=MAXKEEP)return;
  const c=Math.max(0,curPage);
  [...kept].sort((a,b)=>Math.abs(b-c)-Math.abs(a-c)).slice(0,kept.size-MAXKEEP).forEach(i=>{if(!P[i].vis)unrender(P[i])});
}
function unrender(p){
  p.tk++;p.rs=null;p.pr=null;p.divs=null;p.task&&p.task.cancel();kept.delete(p.i);
  const c=p.el.querySelector('canvas');if(c){c.width=0;c.remove()}
  const t=p.el.querySelector('.textLayer');t&&t.remove();
}
/* small JPEG of every page: used as the placeholder under the canvas and as the thumbnail */
function getLo(i){
  const d=doc,p=P[i];if(!p)return Promise.resolve(null);
  if(p.lo)return Promise.resolve(p.lo);
  return p.lop||(p.lop=(async()=>{
    const page=await d.getPage(i+1),w=page.getViewport({scale:1}).width,vp=page.getViewport({scale:320/w});
    const cv=document.createElement('canvas');cv.width=Math.ceil(vp.width);cv.height=Math.ceil(vp.height);
    const x=cv.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,cv.width,cv.height);
    try{await page.render({canvasContext:x,viewport:vp}).promise}catch(e){p.lop=null;return null}
    const b=await new Promise(r=>cv.toBlob(r,'image/jpeg',.6));cv.width=0;
    if(!b||d!==doc){p.lop=null;return null}
    p.lo=URL.createObjectURL(b);
    if(!p.loEl){const im=new Image();im.className='lo';im.alt='';im.draggable=false;im.src=p.lo;p.loEl=im;p.el.prepend(im)}
    return p.lo;
  })());
}
async function fillThumb(i,box){
  const u=await getLo(i);
  if(u&&box.isConnected){box.textContent='';const im=new Image();im.src=u;im.alt='';im.draggable=false;box.append(im);box.classList.add('ok')}
}

/* open */
async function openBuf(buf,name,file){
  await ready;if(!window.pdfjsLib)return;
  $('#prog').classList.add('on');
  srcFile=file||null;srcName=name;const task=pdfjsLib.getDocument({data:new Uint8Array(buf)});
  task.onPassword=(cb,reason)=>{const pw=prompt(reason===2?'Wrong password. Try again:':'This PDF needs a password:');pw===null?task.destroy():cb(pw)};
  let d;try{d=await task.promise}catch(e){$('#prog').classList.remove('on');toast('Could not open this PDF');return}
  io.disconnect();kio.disconnect();tio.disconnect();P.forEach(p=>p.lo&&URL.revokeObjectURL(p.lo));
  doc&&doc.destroy();doc=d;rq=[];kept.clear();closePeek();
  P=[];texts=[];curPage=-1;A=loadAnn(d);H=[];R=[];BM=loadBM(d);hui();pagesEl.textContent='';thEl.textContent='';$('#sdOl').textContent='';
  sres=[];si=-1;sq='';qIn.value='';upd();
  const v=(await d.getPage(1)).getViewport({scale:1});base={w:v.width,h:v.height};
  $('#empty').hidden=true;$('#title').textContent=name;document.title=name+' - Leaf PDF';
  $('#tot').textContent=d.numPages;pgIn.disabled=false;$('#dock').hidden=false;document.body.classList.add('has');setTool('sel');
  let pos=null;try{pos=JSON.parse(localStorage.getItem(pkey(d))||'null')}catch(e){}
  fit=true;scale=fitScale();if(pos&&!pos.f&&pos.s){fit=false;scale=clamp(pos.s,.25,5)}zlabel();
  const fp=document.createDocumentFragment(),ft=document.createDocumentFragment();
  for(let i=0;i<d.numPages;i++){
    const el=document.createElement('div');el.className='page';el.dataset.i=i;
    const p={i,el,w:base.w,h:base.h,tk:0};size(p);el.append(mkSvg(i));p.sl=document.createElement('div');p.sl.className='selLayer';el.append(p.sl);fp.append(el);P.push(p);
    const tw=document.createElement('a');tw.className='tw';tw.dataset.i=i;
    const box=document.createElement('div');box.className='tb';box.style.aspectRatio=base.w+'/'+base.h;
    const lab=document.createElement('span');lab.className='tn';lab.textContent=i+1;
    tw.append(box,lab);tw.onclick=()=>{if(!peeking)go(i)};ft.append(tw);
  }
  pagesEl.append(fp);thEl.append(ft);
  P.forEach(p=>{io.observe(p.el);kio.observe(p.el)});[...thEl.children].forEach(t=>tio.observe(t));
  await loadLinks();
  viewer.scrollTop=0;viewer.scrollLeft=0;
  if(pos&&(pos.p>0||pos.o>.04)){
    const k=Math.min(pos.p,P.length-1),q=P[k];
    viewer.scrollTop=Math.max(0,q.el.offsetTop+q.el.offsetHeight*(pos.o||0)-14);toast('Continuing from page '+(k+1));
  }
  sync();loadOutline(d);refreshBM();
  if(Object.keys(A).length)setTimeout(()=>toast('Restored your annotations'),2800);
  $('#prog').classList.remove('on');
}
async function openFile(f){
  if(!f)return;
  if(f.type!=='application/pdf'&&!/\.pdf$/i.test(f.name)){toast('Choose a PDF file');return}
  openBuf(await f.arrayBuffer(),f.name.replace(/\.pdf$/i,''),f);
}
const pick=()=>$('#file').click();
$('#bOpen').onclick=$('#eOpen').onclick=pick;
$('#file').onchange=e=>{openFile(e.target.files[0]);e.target.value=''};
addEventListener('dragover',e=>{e.preventDefault();document.body.classList.add('drag')});
addEventListener('dragleave',e=>{if(!e.relatedTarget)document.body.classList.remove('drag')});
addEventListener('drop',e=>{e.preventDefault();document.body.classList.remove('drag');openFile(e.dataTransfer.files[0])});

/* navigation */
function go(i){
  if(!P.length)return;i=clamp(i,0,P.length-1);
  viewer.scrollTo({top:P[i].el.offsetTop-14});
  if(matchMedia('(max-width:700px)').matches)side.classList.remove('on');
}
function sync(){
  if(!P.length)return;
  const y=viewer.scrollTop+viewer.clientHeight*.35;let c=0,lo=0,hi=P.length-1;
  while(lo<=hi){const m=(lo+hi)>>1;if(P[m].el.offsetTop<=y){c=m;lo=m+1}else hi=m-1}
  if(c===curPage)return;
  const old=thEl.children[curPage];old&&old.classList.remove('cur');
  curPage=c;const t=thEl.children[c];if(t){t.classList.add('cur');if(side.classList.contains('on')&&!thEl.hidden)t.scrollIntoView({block:'nearest'})}
  if(document.activeElement!==pgIn)pgIn.value=c+1;
  bmMark();
}
let raf=0;viewer.addEventListener('scroll',()=>{raf||(raf=requestAnimationFrame(()=>{raf=0;sync();savePos()}))},{passive:true});
pgIn.onchange=()=>{go((parseInt(pgIn.value)||1)-1)};
pgIn.onfocus=()=>pgIn.select();
pgIn.onkeydown=e=>{if(e.key==='Enter'){pgIn.blur();go((parseInt(pgIn.value)||1)-1)}};
$('#bSide').onclick=()=>{side.classList.toggle('on');$('#bSide').classList.toggle('on');if(side.classList.contains('on')&&!thEl.hidden){const t=thEl.children[curPage];t&&t.scrollIntoView({block:'center'})}};
$('#bNight').onclick=()=>{document.body.classList.toggle('night');$('#bNight').classList.toggle('on')};

/* zoom */
const zlabel=()=>{const v=Math.round(scale*75),c=clamp(v,20,375),z=$('#zr');$('#zl').textContent=v+'%';z.value=c;z.style.setProperty('--p',(c-20)/355*100+'%')};
function setScale(ns,ax=viewer.clientWidth/2,ay=viewer.clientHeight/2){
  ns=clamp(ns,.25,5);if(!doc||Math.abs(ns-scale)<.001)return;
  const r=ns/scale,px=viewer.scrollLeft+ax,py=viewer.scrollTop+ay;
  scale=ns;P.forEach(p=>size(p));
  viewer.scrollLeft=px*r-ax;viewer.scrollTop=py*r-ay;
  P.forEach(p=>p.vis&&render(p.i));zlabel();sync();schedSel();savePos();
}
$('#zi').onclick=()=>{fit=false;setScale(scale*1.2)};
$('#zo').onclick=()=>{fit=false;setScale(scale/1.2)};
$('#bFit').onclick=()=>{fit=true;setScale(fitScale())};
let rt;new ResizeObserver(()=>{clearTimeout(rt);rt=setTimeout(()=>{if(fit&&doc)setScale(fitScale())},120)}).observe(viewer);
viewer.addEventListener('wheel',e=>{
  if(!e.ctrlKey)return;e.preventDefault();
  const rc=viewer.getBoundingClientRect();fit=false;
  setScale(scale*Math.exp(-clamp(e.deltaY,-40,40)*.01),e.clientX-rc.left,e.clientY-rc.top);
},{passive:false});

/* pinch to zoom (touch) */
let pin=null,inkAbort=null;
const dist=t=>Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY);
const ctr=(t,rc)=>[(t[0].clientX+t[1].clientX)/2-rc.left,(t[0].clientY+t[1].clientY)/2-rc.top];
viewer.addEventListener('touchstart',e=>{
  if(e.touches.length!==2||!doc)return;
  inkAbort&&inkAbort();
  const [cx,cy]=ctr(e.touches,viewer.getBoundingClientRect());
  pin={d:dist(e.touches),r:1,cx,cy,x:cx,y:cy,px:viewer.scrollLeft+cx,py:viewer.scrollTop+cy};
  pagesEl.style.transformOrigin='0 0';
},{passive:true});
viewer.addEventListener('touchmove',e=>{
  if(!pin||e.touches.length!==2)return;e.preventDefault();
  const [x,y]=ctr(e.touches,viewer.getBoundingClientRect());
  pin.r=clamp(dist(e.touches)/pin.d,.25/scale,5/scale);pin.x=x;pin.y=y;
  pagesEl.style.transform='translate('+(x+viewer.scrollLeft-pin.px*pin.r)+'px,'+(y+viewer.scrollTop-pin.py*pin.r)+'px) scale('+pin.r+')';
},{passive:false});
const pinEnd=e=>{
  if(!pin||e.touches.length>1)return;
  const q=pin;pin=null;pagesEl.style.transform='';pagesEl.style.transformOrigin='';
  if(Math.abs(q.r-1)>.02){fit=false;setScale(scale*q.r,q.cx,q.cy)}
  viewer.scrollLeft+=q.cx-q.x;viewer.scrollTop+=q.cy-q.y;
};
viewer.addEventListener('touchend',pinEnd);viewer.addEventListener('touchcancel',pinEnd);

/* smoother selection across gaps (same trick as Edge / pdf.js) */
viewer.addEventListener('pointerdown',e=>{if(e.target.closest&&e.target.closest('.textLayer'))viewer.classList.add('selecting')});
addEventListener('pointerup',()=>viewer.classList.remove('selecting'));
addEventListener('pointercancel',()=>viewer.classList.remove('selecting'));

/* search */
const idxs=(s,q)=>{const r=[],l=s.toLowerCase();let k=0;while((k=l.indexOf(q,k))>-1){r.push(k);k+=q.length}return r};
async function getText(i){
  if(!texts[i]){const pg=await doc.getPage(i+1),tc=await pg.getTextContent();texts[i]=tc.items.map(x=>x.str)}
  return texts[i];
}
function upd(){$('#sc').textContent=!sq?'':sres.length?(si+1)+' of '+sres.length:sdone?'No results':'Searching...'}
function clearMarks(){P.forEach(p=>p.divs&&p.divs.forEach(d=>{if(d.querySelector('mark'))d.textContent=d.textContent}))}
function highlight(p){
  if(!sq||!p.divs)return;let n=0;
  for(const d of p.divs){
    const s=d.textContent,ix=idxs(s,sq);if(!ix.length)continue;
    d.textContent='';let k=0;
    for(const x of ix){
      if(x>k)d.append(s.slice(k,x));
      const m=document.createElement('mark');m.textContent=s.substr(x,sq.length);d.append(m);k=x+sq.length;n++;
    }
    if(k<s.length)d.append(s.slice(k));
  }
  const r=sres[si];if(r&&r.i===p.i){const m=p.el.querySelectorAll('mark')[r.n];m&&m.classList.add('cur')}
}
async function search(q){
  q=q.trim().toLowerCase();const t=++stok;
  sq=q;sres=[];si=-1;sdone=false;clearMarks();upd();
  if(!q||!doc)return;
  P.forEach(p=>highlight(p));
  for(let i=0;i<doc.numPages;i++){
    const strs=await getText(i);if(t!==stok)return;
    let n=0;for(const s of strs){const k=idxs(s,q).length;for(let j=0;j<k;j++)sres.push({i,n:n++})}
    if(si<0&&sres.length)show(0);else upd();
  }
  sdone=true;upd();
}
async function show(k){
  si=k;upd();const r=sres[k],p=P[r.i];
  document.querySelectorAll('mark.cur').forEach(m=>m.classList.remove('cur'));
  if(p.rs!==scale||!p.divs)viewer.scrollTop=p.el.offsetTop-14;
  await render(r.i);if(si!==k)return;
  const m=p.el.querySelectorAll('mark')[r.n];
  if(m){m.classList.add('cur');m.scrollIntoView({block:'center',inline:'center'})}
}
const nav=d=>{if(sres.length)show((si+d+sres.length)%sres.length)};
function openSearch(){$('#sb').classList.add('on');$('#bSearch').classList.add('on');qIn.focus();qIn.select()}
function closeSearch(){$('#sb').classList.remove('on');$('#bSearch').classList.remove('on');qIn.value='';search('')}
let qt;qIn.oninput=()=>{clearTimeout(qt);qt=setTimeout(()=>search(qIn.value),220)};
qIn.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();if(qIn.value.trim().toLowerCase()!==sq)search(qIn.value);else nav(e.shiftKey?-1:1)}else if(e.key==='Escape')closeSearch()};
$('#bSearch').onclick=()=>$('#sb').classList.contains('on')?closeSearch():openSearch();
$('#sNext').onclick=()=>nav(1);$('#sPrev').onclick=()=>nav(-1);$('#sClose').onclick=closeSearch;

/* ---------- document links: internal page jumps + external URLs ---------- */
async function loadLinks(){
  await Promise.all(P.map(async p=>{
    try{
      const pg=await doc.getPage(p.i+1),anns=await pg.getAnnotations({intent:'display'}),vp=pg.getViewport({scale:1});
      const L=[];
      for(const a of anns){
        if(a.subtype!=='Link'||!a.rect)continue;
        const url=a.url||(a.unsafeUrl&&/^(https?|mailto):/i.test(a.unsafeUrl)?a.unsafeUrl:null);
        const dest=a.dest||null;
        if(!url&&!dest)continue;
        const [x1,y1]=vp.convertToViewportPoint(a.rect[0],a.rect[1]);
        const [x2,y2]=vp.convertToViewportPoint(a.rect[2],a.rect[3]);
        const r={x:Math.min(x1,x2),y:Math.min(y1,y2),w:Math.abs(x2-x1),h:Math.abs(y2-y1)};
        if(r.w<1||r.h<1)continue;
        L.push({r,url,dest});
      }
      p.links=L;drawLinks(p);
    }catch(e){}
  }));
}
function drawLinks(p){
  let lk=p.el.querySelector('.lkLayer');
  if(!lk){lk=document.createElement('div');lk.className='lkLayer';p.el.append(lk)}
  lk.textContent='';
  for(const L of p.links||[]){
    const a=document.createElement('a');
    a.style.left=L.r.x+'px';a.style.top=L.r.y+'px';a.style.width=L.r.w+'px';a.style.height=L.r.h+'px';
    if(L.url){a.href=L.url;a.target='_blank';a.rel='noopener noreferrer';a.title=L.url}
    else a.title='Go to another page in this document';
    a.addEventListener('click',e=>{
      if(L.url)return;
      e.preventDefault();e.stopPropagation();gotoLinkDest(L.dest);
    });
    lk.append(a);
  }
}
async function gotoLinkDest(dest){
  try{
    if(typeof dest==='string')dest=await doc.getDestination(dest);
    if(!Array.isArray(dest)||!dest.length)return;
    const i=await doc.getPageIndex(dest[0]);
    if(i>=0&&i<P.length){go(i);toast('Jumped to page '+(i+1))}
  }catch(e){}
}
