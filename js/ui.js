/* ---------- bottom bar ---------- */
$('#pPrev').onclick=()=>go(curPage-1);$('#pNext').onclick=()=>go(curPage+1);
let zq=0;$('#zr').oninput=e=>{const v=+e.target.value;cancelAnimationFrame(zq);zq=requestAnimationFrame(()=>{fit=false;setScale(v/75)})};

/* ---------- signature ---------- */
const SIGC=['#1c1c1e','#1d4ed8','#dc2626'],SFONTS=[['Dancing Script','Signature'],['Caveat','Casual'],['Brush Script MT','Classic']];
const sg={tab:'draw',col:SIGC[0],font:0,up:null},sgEl=$('#sg'),sc=$('#sgc'),sx=sc.getContext('2d'),sigImgs={};
let strokes=[],sgk=1,sigPlace=null;
const sfont=px=>px+'px "'+SFONTS[sg.font][0]+'",cursive';
const imgOf=async src=>{if(!sigImgs[src]){const im=new Image();im.src=src;await im.decode();sigImgs[src]=im}return sigImgs[src]};
function trimPng(cv){
  const x=cv.getContext('2d'),w=cv.width,h=cv.height,d=x.getImageData(0,0,w,h).data;
  let x0=w,y0=h,x1=-1,y1=-1;
  for(let y=0;y<h;y++)for(let i=0;i<w;i++)if(d[(y*w+i)*4+3]>10){if(i<x0)x0=i;if(i>x1)x1=i;if(y<y0)y0=y;if(y>y1)y1=y}
  if(x1<0)return null;
  const p=6,o=document.createElement('canvas'),cw=x1-x0+1,ch=y1-y0+1;o.width=cw+p*2;o.height=ch+p*2;
  o.getContext('2d').drawImage(cv,x0,y0,cw,ch,p,p,cw,ch);
  return{png:o.toDataURL('image/png'),ar:o.width/o.height};
}
function redrawSg(){
  sx.clearRect(0,0,sc.width,sc.height);sx.strokeStyle=sx.fillStyle=sg.col;sx.lineCap=sx.lineJoin='round';sx.lineWidth=3.4*sgk;
  for(const s of strokes){
    if(s.length<2){sx.beginPath();sx.arc(s[0][0],s[0][1],1.7*sgk,0,7);sx.fill();continue}
    sx.beginPath();sx.moveTo(s[0][0],s[0][1]);
    for(let k=1;k<s.length-1;k++)sx.quadraticCurveTo(s[k][0],s[k][1],(s[k][0]+s[k+1][0])/2,(s[k][1]+s[k+1][1])/2);
    const l=s[s.length-1];sx.lineTo(l[0],l[1]);sx.stroke();
  }
}
function sizeSg(){
  const r=sc.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2),w=Math.round(r.width*d),h=Math.round(r.height*d);
  if(!w)return;if(sc.width!==w||sc.height!==h){sc.width=w;sc.height=h;strokes=[]}
  sgk=w/r.width;redrawSg();
}
sc.addEventListener('pointerdown',e=>{
  e.preventDefault();sc.setPointerCapture(e.pointerId);
  const r=sc.getBoundingClientRect(),pt=ev=>[(ev.clientX-r.left)*sgk,(ev.clientY-r.top)*sgk],s=[pt(e)];strokes.push(s);redrawSg();
  const mv=ev=>{for(const c of(ev.getCoalescedEvents?ev.getCoalescedEvents():[ev]))s.push(pt(c));redrawSg()};
  const up=()=>{sc.removeEventListener('pointermove',mv);sc.removeEventListener('pointerup',up);sc.removeEventListener('pointercancel',up)};
  sc.addEventListener('pointermove',mv);sc.addEventListener('pointerup',up);sc.addEventListener('pointercancel',up);
});
$('#sgClr').onclick=()=>{strokes=[];redrawSg()};
function typePrev(){const p=$('#sgPrev');p.textContent=$('#sgName').value;p.style.fontFamily='"'+SFONTS[sg.font][0]+'",cursive';p.style.color=sg.col}
$('#sgName').oninput=typePrev;
const dots=$('#sgDots');
SIGC.forEach(c=>{
  const b=document.createElement('button');b.className='dot'+(c===sg.col?' on':'');b.style.background=c;b.setAttribute('aria-label','Ink color '+c);
  b.innerHTML='<svg viewBox="0 0 24 24"><use href="#i-check"/></svg>';
  b.onclick=()=>{sg.col=c;dots.querySelectorAll('.dot').forEach(d=>d.classList.toggle('on',d===b));redrawSg();typePrev()};dots.append(b);
});
const chips=$('#sgFonts');
SFONTS.forEach((f,k)=>{
  const b=document.createElement('button');b.className='chip'+(k===0?' on':'');b.textContent='Aa';b.title=f[1];b.style.fontFamily='"'+f[0]+'",cursive';
  b.onclick=()=>{sg.font=k;chips.querySelectorAll('.chip').forEach((d,j)=>d.classList.toggle('on',j===k));typePrev()};chips.append(b);
});
function setTab(t){
  sg.tab=t;document.querySelectorAll('#sg .tab').forEach(b=>b.classList.toggle('on',b.dataset.p===t));
  for(const p of['draw','type','up'])$('#p-'+p).hidden=p!==t;
  dots.hidden=t==='up';if(t==='draw')sizeSg();
}
document.querySelectorAll('#sg .tab').forEach(b=>b.onclick=()=>setTab(b.dataset.p));
$('#sgPick').onclick=()=>$('#sgFile').click();
$('#sgFile').onchange=async e=>{
  const f=e.target.files[0];e.target.value='';if(!f)return;
  const url=URL.createObjectURL(f),im=new Image();im.src=url;
  try{await im.decode()}catch(x){toast('Could not read that image');return}
  const k=Math.min(1,900/im.width),cv=document.createElement('canvas');cv.width=Math.round(im.width*k);cv.height=Math.round(im.height*k);
  const x=cv.getContext('2d');x.drawImage(im,0,0,cv.width,cv.height);URL.revokeObjectURL(url);
  const d=x.getImageData(0,0,cv.width,cv.height),p=d.data;
  for(let i=0;i<p.length;i+=4){const l=.3*p[i]+.59*p[i+1]+.11*p[i+2];p[i+3]=Math.min(p[i+3],l>=235?0:l>190?Math.round((235-l)/45*255):255)}
  x.putImageData(d,0,0);sg.up=cv;$('#sgImg').src=cv.toDataURL();$('#sgImg').hidden=false;$('#sgPick').textContent='Choose another image';
};
async function typedSig(){
  const t=$('#sgName').value.trim();if(!t)return null;
  try{await document.fonts.load(sfont(120))}catch(e){}
  const cv=document.createElement('canvas'),x=cv.getContext('2d');x.font=sfont(120);
  cv.width=Math.ceil(x.measureText(t).width)+40;cv.height=240;
  x.font=sfont(120);x.fillStyle=sg.col;x.textBaseline='middle';x.fillText(t,20,120);return trimPng(cv);
}
function openSg(){
  if(!doc){toast('Open a PDF first');return}
  strokes=[];sg.up=null;$('#sgImg').hidden=true;$('#sgPick').textContent='Choose image';$('#sgName').value='';typePrev();
  sgEl.classList.add('on');setTab('draw');
}
const closeSg=()=>sgEl.classList.remove('on');
async function acceptSig(){
  const r=sg.tab==='draw'?(strokes.length?trimPng(sc):null):sg.tab==='type'?await typedSig():(sg.up?trimPng(sg.up):null);
  if(!r){toast('Add your signature first');return}
  closeSg();setTool('sel');sigPlace=r;document.body.classList.add('placing');$('#hint span').textContent='Tap where the signature should go';
}
function endPlace(){sigPlace=null;cmtPlace=false;document.body.classList.remove('placing')}
pagesEl.addEventListener('click',e=>{
  if(cmtPlace){
    const sv=e.target.closest&&e.target.closest('svg.an');if(!sv)return;
    const i=+sv.dataset.i,[x,y]=ptr(e,sv,i),na={t:'cmt',x:+clamp(x-4,0,P[i].w-22).toFixed(1),y:+clamp(y-17,0,P[i].h-22).toFixed(1),s:''};
    addAnn(i,na);endPlace();openCmts(na.id);return;
  }
  if(!sigPlace)return;const sv=e.target.closest&&e.target.closest('svg.an');if(!sv)return;
  const i=+sv.dataset.i,[x,y]=ptr(e,sv,i),w=Math.min(170,P[i].w*.45),h=w/sigPlace.ar;
  const na={t:'sig',src:sigPlace.png,x:+clamp(x-w/2,0,P[i].w-w).toFixed(1),y:+clamp(y-h/2,0,P[i].h-h).toFixed(1),w:+w.toFixed(1),h:+h.toFixed(1)};
  addAnn(i,na);endPlace();selSig={i,id:na.id};showBox();
});
$('#hintX').onclick=endPlace;$('#bSign').onclick=openSg;$('#sgX').onclick=$('#sgCancel').onclick=closeSg;$('#sgOk').onclick=acceptSig;
sgEl.addEventListener('pointerdown',e=>{if(e.target===sgEl)closeSg()});

/* ---------- signature controller (box with 4 corner dots) ---------- */
let selSig=null,sbox=null;
const sigOf=(i,id)=>(A[i]||[]).find(a=>a.id===id);
const setBoxGeom=(b,a,p)=>{b.style.left=a.x/p.w*100+'%';b.style.top=a.y/p.h*100+'%';b.style.width=a.w/p.w*100+'%';b.style.height=a.h/p.h*100+'%'};
function showBox(){
  if(sbox){sbox.remove();sbox=null}
  if(!selSig)return;
  const a=sigOf(selSig.i,selSig.id),p=P[selSig.i];
  if(!a||!p){selSig=null;return}
  const b=document.createElement('div');b.className='sbox'+(a.t==='hl'?' nb':'');setBoxGeom(b,geom(a),p);
  for(const c of['nw','ne','sw','se']){const h=document.createElement('i');h.className='hd '+c;h.dataset.c=c;b.append(h)}
  p.el.append(b);sbox=b;
}
function pageAt(cx,cy){
  for(const p of P){if(!p.vis)continue;const r=p.el.getBoundingClientRect();
    if(cx>=r.left&&cx<=r.right&&cy>=r.top&&cy<=r.bottom)return{p,i:p.i,x:(cx-r.left)*p.w/r.width,y:(cy-r.top)*p.h/r.height}}
  return null;
}
function segDist(x,y,p,q){const dx=q[0]-p[0],dy=q[1]-p[1],l=dx*dx+dy*dy;let t=l?((x-p[0])*dx+(y-p[1])*dy)/l:0;t=clamp(t,0,1);return Math.hypot(x-p[0]-t*dx,y-p[1]-t*dy)}
function hitAnn(i,x,y,only){
  const L=A[i]||[];
  for(let k=L.length-1;k>=0;k--){
    const a=L[k];
    if(only&&!only.includes(a.t))continue;
    if(a.t==='sig'){if(x>=a.x&&x<=a.x+a.w&&y>=a.y&&y<=a.y+a.h)return a;continue}
    if(a.t==='hl'){if(a.r.some(r=>x>=r[0]&&x<=r[0]+r[2]&&y>=r[1]&&y<=r[1]+r[3]))return a}
    else if(a.t==='txt'){if(x>=a.x&&x<=a.x+txtW(a)&&y>=a.y&&y<=a.y+a.f*1.15)return a}
    else if(a.t==='cmt'){if(x>=a.x&&x<=a.x+22&&y>=a.y&&y<=a.y+20)return a}
    else if(a.t==='ink'){for(let n=1;n<a.p.length;n++)if(segDist(x,y,a.p[n-1],a.p[n])<6)return a}
  }
  return null;
}
const clone=o=>JSON.parse(JSON.stringify(o));
const mctx=document.createElement('canvas').getContext('2d');
const txtW=a=>{mctx.font=a.f+'px Helvetica,Arial,sans-serif';return Math.max(8,mctx.measureText(a.s).width)};
const snap=a=>a.t==='hl'?{r:a.r.map(r=>r.slice())}:a.t==='txt'?{x:a.x,y:a.y,f:a.f,s:a.s}:{x:a.x,y:a.y,w:a.w,h:a.h};
function geom(a){
  if(a.t==='hl'){let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const r of a.r){x0=Math.min(x0,r[0]);y0=Math.min(y0,r[1]);x1=Math.max(x1,r[0]+r[2]);y1=Math.max(y1,r[1]+r[3])}return{x:x0,y:y0,w:x1-x0,h:y1-y0}}
  if(a.t==='txt')return{x:a.x,y:a.y,w:txtW(a),h:a.f*1.15};
  return{x:a.x,y:a.y,w:a.w,h:a.h};
}
function applyGeom(a,from,g0,g1){
  if(a.t==='hl'){const sx=g1.w/g0.w,sy=g1.h/g0.h;a.r=from.r.map(r=>[g1.x+(r[0]-g0.x)*sx,g1.y+(r[1]-g0.y)*sy,r[2]*sx,r[3]*sy])}
  else if(a.t==='txt'){a.x=g1.x;a.y=g1.y;a.f=Math.max(6,from.f*g1.w/g0.w)}
  else{a.x=g1.x;a.y=g1.y;a.w=g1.w;a.h=g1.h}
}
function roundAnn(a){
  if(a.t==='hl')a.r=a.r.map(r=>r.map(v=>+v.toFixed(2)));
  else{a.x=+a.x.toFixed(1);a.y=+a.y.toFixed(1);if(a.t==='txt')a.f=+a.f.toFixed(2);else{a.w=+a.w.toFixed(1);a.h=+a.h.toFixed(1)}}
}
function liveGeom(a,p){
  if(a.t==='sig'){const im=p.el.querySelector('svg.an [data-a="'+a.id+'"]');if(im){im.setAttribute('x',a.x);im.setAttribute('y',a.y);im.setAttribute('width',a.w);im.setAttribute('height',a.h)}}
  else drawAnn(p.i);
  if(sbox)setBoxGeom(sbox,geom(a),p);
}
function startDrag(e,b,c){
  const {i,id}=selSig,a=sigOf(i,id),p=P[i];if(!a)return;
  const rect=p.el.getBoundingClientRect(),kx=p.w/rect.width,ky=p.h/rect.height,pt=ev=>[(ev.clientX-rect.left)*kx,(ev.clientY-rect.top)*ky];
  const from=clone(snap(a)),g0=geom(a),[x0,y0]=pt(e),free=a.t==='hl',ar=g0.w/Math.max(g0.h,.1);
  const ax=(c==='nw'||c==='sw')?g0.x+g0.w:g0.x,ay=(c==='nw'||c==='ne')?g0.y+g0.h:g0.y;
  b.setPointerCapture(e.pointerId);
  const mv=ev=>{
    const [x,y]=pt(ev);let g1;
    if(c){
      let w,h;
      if(free){w=Math.max(8,Math.abs(x-ax));h=Math.max(4,Math.abs(y-ay))}
      else{w=Math.min(Math.max(a.t==='txt'?16:24,Math.abs(x-ax),Math.abs(y-ay)*ar),p.w*1.2);h=w/ar}
      g1={x:(c==='nw'||c==='sw')?ax-w:ax,y:(c==='nw'||c==='ne')?ay-h:ay,w,h};
    }else g1={x:clamp(g0.x+x-x0,-g0.w*.5,p.w-g0.w*.5),y:clamp(g0.y+y-y0,-g0.h*.5,p.h-g0.h*.5),w:g0.w,h:g0.h};
    applyGeom(a,from,g0,g1);liveGeom(a,p);
  };
  const up=()=>{
    b.removeEventListener('pointermove',mv);b.removeEventListener('pointerup',up);b.removeEventListener('pointercancel',up);
    roundAnn(a);const to=clone(snap(a));
    if(JSON.stringify(to)!==JSON.stringify(from)){H.push({k:'mod',i,id,from,to});R=[];hui();persist()}
    liveGeom(a,p);
  };
  b.addEventListener('pointermove',mv);b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);
}
/* double-click a selected text note to edit it */
pagesEl.addEventListener('dblclick',e=>{
  if(!selSig||!e.target.closest('.sbox'))return;
  const a=sigOf(selSig.i,selSig.id);if(!a||a.t!=='txt')return;
  const i=selSig.i,p=P[i],from=clone(snap(a)),inp=document.createElement('input');
  inp.className='ti';inp.value=a.s;inp.style.cssText='left:'+a.x*scale+'px;top:'+a.y*scale+'px;font-size:'+a.f*scale+'px;color:'+a.c;
  const el=p.el.querySelector('svg.an [data-a="'+a.id+'"]');el&&(el.style.visibility='hidden');sbox.style.visibility='hidden';
  p.el.append(inp);inp.focus();inp.select();
  let done=0;
  const fin=ok=>{
    if(done)return;done=1;const t=inp.value.trim();inp.remove();
    if(ok&&t&&t!==a.s){a.s=t;H.push({k:'mod',i,id:a.id,from,to:clone(snap(a))});R=[];hui();persist()}
    drawAnn(i);showBox();
  };
  inp.onkeydown=ev=>{ev.stopPropagation();if(ev.key==='Enter')fin(1);else if(ev.key==='Escape')fin(0)};inp.onblur=()=>fin(1);
});
pagesEl.addEventListener('pointerdown',e=>{
  const b=e.target.closest&&e.target.closest('.sbox');if(!b||e.button||!selSig)return;
  e.preventDefault();e.stopPropagation();startDrag(e,b,e.target.dataset.c||null);
});
viewer.addEventListener('pointerdown',e=>{
  if(e.button||tool!=='sel'||sigPlace||cmtPlace||e.target.closest('.sbox'))return;
  const h=pageAt(e.clientX,e.clientY),a=h&&hitAnn(h.i,h.x,h.y,['sig','txt','hl']),c=!a&&h&&hitCmt(h.i,h.x,h.y);
  if(a){selSig={i:h.i,id:a.id};showBox();if(a.t!=='hl'){e.preventDefault();startDrag(e,sbox,null)}}
  else if(c){e.preventDefault();if(selSig){selSig=null;showBox()}openCmts(c.id)}
  else if(selSig){selSig=null;showBox()}
},true);
addEventListener('keydown',e=>{
  if(selSig&&(e.key==='Delete'||e.key==='Backspace')&&!/INPUT|TEXTAREA/.test(e.target.tagName)){e.preventDefault();delAnn(selSig.i,selSig.id);selSig=null;showBox()}
});

/* ---------- right-click menu (desktop) ---------- */
const ctx=$('#ctx');
const closeCtx=()=>ctx.classList.remove('on');
function copySel(){const t=getSelection().toString();(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).catch(()=>document.execCommand('copy'));toast('Copied')}
function ctxItem(label,icon,key,fn,dis){
  const b=document.createElement('button');b.className='mi';b.disabled=!!dis;b.setAttribute('role','menuitem');
  b.innerHTML='<svg viewBox="0 0 24 24"><use href="#i-'+icon+'"/></svg><span>'+label+'</span>'+(key?'<span class="k">'+key+'</span>':'');
  b.onclick=()=>{closeCtx();fn()};return b;
}
viewer.addEventListener('contextmenu',e=>{
  if(coarse()||!doc||e.target.closest('input'))return;
  e.preventDefault();
  const h=pageAt(e.clientX,e.clientY),a=h&&hitAnn(h.i,h.x,h.y),s=getSelection(),hasSel=s.rangeCount&&!s.isCollapsed&&viewer.contains(s.anchorNode);
  if(a&&['sig','txt','hl'].includes(a.t)&&tool==='sel'){selSig={i:h.i,id:a.id};showBox()}
  const G=[];
  if(hasSel)G.push([ctxItem('Copy','copy','Ctrl+C',copySel),ctxItem('Highlight','hl','',()=>hlSel(col.hl))]);
  if(a)G.push([ctxItem(a.t==='sig'?'Delete signature':'Delete annotation','trash','Del',()=>{delAnn(h.i,a.id);if(selSig&&selSig.id===a.id){selSig=null;showBox()}})]);
  G.push([ctxItem('Undo','undo','Ctrl+Z',undo,!H.length),ctxItem('Redo','redo','Ctrl+Shift+Z',redo,!R.length)]);
  G.push([ctxItem('Zoom in','plus','Ctrl +',()=>$('#zi').click()),ctxItem('Zoom out','minus','Ctrl -',()=>$('#zo').click()),ctxItem('Fit to width','fit','Ctrl 0',()=>$('#bFit').click())]);
  G.push([ctxItem('Sign document','sign','',openSg),ctxItem('Print...','print','Ctrl+P',openPrint),ctxItem('Save copy','save','Ctrl+S',savePdf)]);
  ctx.textContent='';
  G.forEach((g,n)=>{if(n){const i=document.createElement('i');i.className='msep';ctx.append(i)}g.forEach(b=>ctx.append(b))});
  ctx.classList.add('on');
  ctx.style.left=Math.max(8,Math.min(e.clientX,innerWidth-ctx.offsetWidth-8))+'px';
  ctx.style.top=Math.max(8,Math.min(e.clientY,innerHeight-ctx.offsetHeight-8))+'px';
});
ctx.addEventListener('pointerdown',e=>e.preventDefault());
document.addEventListener('pointerdown',e=>{if(!ctx.contains(e.target))closeCtx()},true);
viewer.addEventListener('scroll',closeCtx,{passive:true});addEventListener('resize',closeCtx);addEventListener('blur',closeCtx);

/* ---------- accurate text selection (Edge style) ---------- */
let selRaf=0;
const schedSel=()=>{selRaf||(selRaf=requestAnimationFrame(paintSel))};
function lineSegs(p,rg){
  const pr=p.el.getBoundingClientRect(),rs=[];
  for(const d of p.divs){
    if(!rg.intersectsNode(d))continue;
    const r2=document.createRange();r2.selectNodeContents(d);
    if(rg.compareBoundaryPoints(Range.START_TO_START,r2)>0)r2.setStart(rg.startContainer,rg.startOffset);
    if(rg.compareBoundaryPoints(Range.END_TO_END,r2)<0)r2.setEnd(rg.endContainer,rg.endOffset);
    const b=r2.getBoundingClientRect();
    if(b.width>.5&&b.height>.5)rs.push({l:b.left-pr.left,t:b.top-pr.top,r:b.right-pr.left,b:b.bottom-pr.top});
  }
  if(!rs.length)return [];
  const lines=[];
  for(const r of rs){
    const cy=(r.t+r.b)/2,L=lines.find(l=>Math.abs((l.t+l.b)/2-cy)<Math.min(l.b-l.t,r.b-r.t)*.5);
    if(L){L.t=Math.min(L.t,r.t);L.b=Math.max(L.b,r.b);L.items.push(r)}else lines.push({t:r.t,b:r.b,items:[r]});
  }
  lines.sort((a,b)=>a.t-b.t);
  for(let k=1;k<lines.length;k++){const a=lines[k-1],b=lines[k];if(a.b>b.t&&b.t>a.t){const m=(a.b+b.t)/2;a.b=m;b.t=m}}
  const out=[];
  for(const L of lines){
    L.items.sort((a,b)=>a.l-b.l);
    const gap=(L.b-L.t)*.6,segs=[];
    for(const r of L.items){const c=segs[segs.length-1];if(c&&r.l-c.r<=gap)c.r=Math.max(c.r,r.r);else segs.push({l:r.l,r:r.r})}
    for(const g of segs)out.push({l:g.l,t:L.t,w:g.r-g.l,h:L.b-L.t});
  }
  return out;
}
function paintSel(){
  selRaf=0;
  for(const p of P)if(p.sl&&p.sl.firstChild)p.sl.textContent='';
  const s=getSelection();
  if(!doc||!s.rangeCount||s.isCollapsed||!viewer.contains(s.anchorNode))return;
  const rg=s.getRangeAt(0);
  for(const p of P){
    if(!p.vis||!p.divs||!p.sl)continue;
    const frag=document.createDocumentFragment();
    for(const g of lineSegs(p,rg)){const e=document.createElement('i');e.style.cssText='left:'+g.l+'px;top:'+g.t+'px;width:'+g.w+'px;height:'+g.h+'px';frag.append(e)}
    p.sl.append(frag);
  }
}
document.addEventListener('selectionchange',schedSel);

/* ---------- comments (arrow menu) ---------- */
let cmtPlace=false,cmtsOpen=false;
const cmP=$('#cmts'),cmL=$('#cmtList'),narrow=()=>matchMedia('(max-width:700px)').matches;
function listCmts(){const o=[];for(const i of Object.keys(A).map(Number).sort((a,b)=>a-b))for(const a of A[i])if(a.t==='cmt')o.push({i,a});return o}
function cmtBadge(){const n=listCmts().length;$('#cmtBadge').textContent=n||''}
function hitCmt(i,x,y){const L=A[i]||[];for(let k=L.length-1;k>=0;k--){const a=L[k];if(a.t==='cmt'&&x>=a.x&&x<=a.x+22&&y>=a.y&&y<=a.y+20)return a}return null}
function renderCmts(focusId){
  const L=listCmts();$('#cmtCount').textContent=L.length;cmL.textContent='';
  if(!L.length){cmL.innerHTML='<p class="cmtEmpty">No comments yet.<br>Tap <b>Add comment</b>, then tap the page where it belongs.</p>';return}
  for(const {i,a} of L){
    const card=document.createElement('div');card.className='cmt';card.dataset.id=a.id;
    card.innerHTML='<div class="ch"><button class="cgo" title="Go to comment"></button><button class="b cdel" aria-label="Delete comment"><svg><use href="#i-trash"/></svg></button></div><textarea rows="3" placeholder="Write a comment..." aria-label="Comment"></textarea>';
    card.querySelector('.cgo').textContent='Page '+(i+1);
    const ta=card.querySelector('textarea');ta.value=a.s||'';
    ta.oninput=()=>{a.s=ta.value;persist()};
    card.querySelector('.cgo').onclick=()=>jumpCmt(i,a);
    card.querySelector('.cdel').onclick=()=>delAnn(i,a.id);
    cmL.append(card);
  }
  if(focusId){const t=cmL.querySelector('.cmt[data-id="'+focusId+'"] textarea');if(t){t.focus();t.closest('.cmt').scrollIntoView({block:'nearest'})}}
}
function openCmts(focusId){
  if(!doc){toast('Open a PDF first');return}
  if(narrow()){side.classList.remove('on');$('#bSide').classList.remove('on')}
  cmtsOpen=true;cmP.classList.add('on');renderCmts(focusId);
}
function closeCmts(){cmtsOpen=false;cmP.classList.remove('on')}
function jumpCmt(i,a){
  if(narrow())closeCmts();
  viewer.scrollTo({top:Math.max(0,P[i].el.offsetTop+a.y*scale-90),behavior:'smooth'});
  setTimeout(()=>{const el=P[i].el.querySelector('svg.an [data-a="'+a.id+'"] .pin');if(el){el.classList.remove('flash');void el.getBoundingClientRect();el.classList.add('flash')}},450);
}
$('#bCmt').onclick=()=>openCmts();$('#cmtX').onclick=closeCmts;
$('#cmtAdd').onclick=()=>{
  if(!doc)return;setTool('sel');cmtPlace=true;document.body.classList.add('placing');
  $('#hint span').textContent='Tap where the comment should go';if(narrow())closeCmts();
};
viewer.addEventListener('pointerdown',()=>{if(cmtsOpen&&narrow())closeCmts()});

/* ---------- sidebar: tabs, outline, bookmarks ---------- */
let BM=[],peeking=false;
const fpOf=d=>(d.fingerprints&&d.fingerprints[0])||srcName;
const bkey=d=>'leaf-bm:'+fpOf(d),pkey=d=>'leaf-pos:'+fpOf(d);
function setSide(t){
  document.querySelectorAll('.sdt').forEach(b=>b.classList.toggle('on',b.dataset.s===t));
  $('#sdTh').hidden=t!=='th';$('#sdOl').hidden=t!=='ol';$('#sdBm').hidden=t!=='bm';
  if(t==='bm')renderBM();
  if(t==='th'){const c=thEl.children[curPage];c&&c.scrollIntoView({block:'center'})}
}
document.querySelectorAll('.sdt').forEach(b=>b.onclick=()=>setSide(b.dataset.s));

async function loadOutline(d){
  const el=$('#sdOl');el.textContent='';
  let o=null;try{o=await d.getOutline()}catch(e){}
  if(d!==doc)return;
  if(!o||!o.length){el.innerHTML='<p class="sdEmpty">This PDF has no outline.</p>';return}
  el.append(buildOl(o,0));
}
function buildOl(items,lv){
  const ul=document.createElement('ul');ul.className='ol';
  for(const it of items){
    const li=document.createElement('li'),row=document.createElement('div'),has=it.items&&it.items.length;
    row.className='oi';if(it.bold)row.style.fontWeight='600';if(it.italic)row.style.fontStyle='italic';
    const t=document.createElement('button');t.className='otg';t.tabIndex=has?0:-1;t.setAttribute('aria-label','Expand');
    if(has)t.innerHTML='<svg viewBox="0 0 24 24"><use href="#i-chev"/></svg>';
    const lab=document.createElement('span');lab.textContent=it.title||'(untitled)';
    row.append(t,lab);li.append(row);
    row.onclick=ev=>{if(has&&ev.target.closest('.otg')){li.classList.toggle('open');return}gotoDest(it)};
    if(has){li.append(buildOl(it.items,lv+1));if(lv===0&&items.length<=12)li.classList.add('open')}
    ul.append(li);
  }
  return ul;
}
async function gotoDest(it){
  try{
    if(it.url){if(/^https?:/i.test(it.url))window.open(it.url,'_blank','noopener');return}
    let d=it.dest;if(typeof d==='string')d=await doc.getDestination(d);
    if(!Array.isArray(d))return;
    const ref=d[0],idx=(ref&&typeof ref==='object')?await doc.getPageIndex(ref):ref;
    if(idx==null||!P[idx])return;
    const y=(d[1]&&d[1].name==='XYZ'&&d[3]!=null)?Math.max(0,(P[idx].h-d[3])*scale-20):0;
    viewer.scrollTo({top:P[idx].el.offsetTop-14+y});
    if(narrow())side.classList.remove('on');
  }catch(e){toast('Could not open that link')}
}

function bmMark(){
  $('#bBm').classList.toggle('on',BM.some(b=>b.p===curPage));
  const b=$('#sdBm .bmadd');if(b)b.textContent=BM.some(x=>x.p===curPage)?'Remove bookmark (page '+(curPage+1)+')':'Bookmark page '+(curPage+1);
}
function refreshBM(){
  const set=new Set(BM.map(b=>b.p));
  thEl.querySelectorAll('.tw.bm').forEach(t=>{if(!set.has(+t.dataset.i))t.classList.remove('bm')});
  set.forEach(p=>{const t=thEl.children[p];t&&t.classList.add('bm')});
  $('#bmCnt').textContent=BM.length||'';bmMark();
  if(!$('#sdBm').hidden)renderBM();
}
function loadBM(d){try{const o=JSON.parse(localStorage.getItem(bkey(d))||'[]');return Array.isArray(o)?o:[]}catch(e){return[]}}
function saveBM(){try{BM.length?localStorage.setItem(bkey(doc),JSON.stringify(BM)):localStorage.removeItem(bkey(doc))}catch(e){}}
async function snip(i){
  const b=BM.find(x=>x.p===i);if(!b)return;
  try{const t=(await getText(i)).join(' ').replace(/\s+/g,' ').trim().slice(0,80);if(t&&BM.includes(b)){b.t=t;saveBM();if(!$('#sdBm').hidden)renderBM()}}catch(e){}
}
function toggleBM(i=curPage){
  if(!doc||i<0)return;
  const k=BM.findIndex(b=>b.p===i);
  if(k>-1){BM.splice(k,1);toast('Bookmark removed')}
  else{BM.push({p:i,t:''});BM.sort((a,b)=>a.p-b.p);toast('Page '+(i+1)+' bookmarked');snip(i)}
  saveBM();refreshBM();
}
function renderBM(){
  const el=$('#sdBm');el.textContent='';
  const add=document.createElement('button');add.className='pri caps bmadd';add.onclick=()=>toggleBM();el.append(add);bmMark();
  if(!BM.length){const p=document.createElement('p');p.className='sdEmpty';p.innerHTML='No bookmarks yet.<br>Use the button above, the bookmark icon at the bottom, or press <b>Ctrl+D</b>.';el.append(p);return}
  for(const b of BM){
    const r=document.createElement('div');r.className='bi';
    r.innerHTML='<svg viewBox="0 0 24 24"><use href="#i-bm"/></svg><div class="bt"><b></b><span></span></div><button class="b bx" aria-label="Remove bookmark"><svg><use href="#i-x"/></svg></button>';
    r.querySelector('b').textContent='Page '+(b.p+1);r.querySelector('.bt span').textContent=b.t||'';
    r.onclick=ev=>{if(ev.target.closest('.bx')){toggleBM(b.p);return}go(b.p)};
    el.append(r);
  }
}
$('#bBm').onclick=()=>toggleBM();
addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='d'&&doc){e.preventDefault();toggleBM()}});

/* ---------- long-press on a thumbnail: clear page preview ---------- */
let pkTok=0,lpT=0;
async function openPeek(i,tw){
  const my=++pkTok,pk=$('#peek'),body=$('#pkb'),sr=side.getBoundingClientRect(),tr=tw.getBoundingClientRect(),ratio=P[i].h/P[i].w,nr=narrow();
  let w=nr?Math.min(innerWidth-32,380):clamp(innerWidth-sr.right-60,260,440);
  if(w*ratio>innerHeight-32)w=(innerHeight-32)/ratio;
  const h=w*ratio;
  pk.style.width=w+'px';pk.style.height=h+'px';
  pk.style.left=(nr?(innerWidth-w)/2:sr.right+16)+'px';
  pk.style.top=clamp(nr?(innerHeight-h)/2:tr.top+tr.height/2-h/2,12,Math.max(12,innerHeight-h-12))+'px';
  $('#pkn').textContent='Page '+(i+1)+' of '+P.length;body.textContent='';
  if(P[i].lo){const im=new Image();im.src=P[i].lo;body.append(im)}
  pk.classList.add('on');
  try{
    const page=await doc.getPage(i+1),w0=page.getViewport({scale:1}).width,r=Math.min(dpr(),2.5),vp=page.getViewport({scale:w/w0*r});
    const cv=document.createElement('canvas');cv.width=Math.floor(vp.width);cv.height=Math.floor(vp.height);
    const x=cv.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,cv.width,cv.height);
    await page.render({canvasContext:x,viewport:vp}).promise;
    if(my!==pkTok)return;
    cv.style.cssText='display:block;width:100%;height:auto';body.textContent='';body.append(cv);
    pk.style.height='auto';pk.style.top=clamp(parseFloat(pk.style.top),12,Math.max(12,innerHeight-pk.offsetHeight-12))+'px';
  }catch(e){}
}
function closePeek(){pkTok++;$('#peek').classList.remove('on')}
thEl.addEventListener('pointerdown',e=>{
  const tw=e.target.closest('.tw');if(!tw||e.button)return;
  const x=e.clientX,y=e.clientY;clearTimeout(lpT);
  const rm=()=>{removeEventListener('pointermove',mv);removeEventListener('pointerup',end);removeEventListener('pointercancel',end)};
  const mv=ev=>{if(!peeking&&Math.hypot(ev.clientX-x,ev.clientY-y)>8){clearTimeout(lpT);rm()}};
  const end=()=>{clearTimeout(lpT);rm();if(peeking){closePeek();setTimeout(()=>{peeking=false},0)}};
  lpT=setTimeout(()=>{peeking=true;openPeek(+tw.dataset.i,tw)},420);
  addEventListener('pointermove',mv);addEventListener('pointerup',end);addEventListener('pointercancel',end);
});
thEl.addEventListener('contextmenu',e=>e.preventDefault());

/* ---------- continue where you left off ---------- */
let psv=0;
function savePos(now){
  clearTimeout(psv);
  const run=()=>{
    if(!doc||curPage<0)return;const p=P[curPage];
    try{
      localStorage.setItem(pkey(doc),JSON.stringify({p:curPage,o:+((viewer.scrollTop-p.el.offsetTop)/Math.max(1,p.el.offsetHeight)).toFixed(3),s:+scale.toFixed(3),f:fit?1:0}));
      localStorage.setItem('leaf-last',JSON.stringify({n:srcName,p:curPage+1}));
    }catch(e){}
  };
  now===true?run():psv=setTimeout(run,600);
}
addEventListener('pagehide',()=>savePos(true));
document.addEventListener('visibilitychange',()=>{if(document.hidden)savePos(true)});
try{
  const l=JSON.parse(localStorage.getItem('leaf-last')||'null');
  if(l&&l.n){$('#rsm').hidden=false;$('#rsmN').textContent=l.n;$('#rsmP').textContent='Continue from page '+l.p+' - choose the file';}
}catch(e){}
$('#rsm').onclick=()=>$('#file').click();
