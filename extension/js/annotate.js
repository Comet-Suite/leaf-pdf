/* ---------- annotations (desktop) ---------- */
const NS='http://www.w3.org/2000/svg',PAL=['#ffd60a','#30d158','#0a84ff','#ff6bcb','#ff453a','#1c1c1e'];
let A={},H=[],R=[],uid=0,tool='sel',srcBuf=null,srcFile=null,srcName='document',printing=false;
const col={hl:PAL[0],pen:PAL[4]};
const esc=s=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const desk=()=>matchMedia('(pointer:fine) and (min-width:701px)').matches,coarse=()=>matchMedia('(pointer:coarse)').matches;
function mkSvg(i){const s=document.createElementNS(NS,'svg');s.setAttribute('class','an');s.dataset.i=i;return s}
function pathD(p){
  let d='M'+p[0][0].toFixed(1)+' '+p[0][1].toFixed(1);
  for(let k=1;k<p.length-1;k++)d+='Q'+p[k][0].toFixed(1)+' '+p[k][1].toFixed(1)+' '+((p[k][0]+p[k+1][0])/2).toFixed(1)+' '+((p[k][1]+p[k+1][1])/2).toFixed(1);
  const l=p[p.length-1];return d+'L'+l[0].toFixed(1)+' '+l[1].toFixed(1);
}
function drawAnn(i){
  const p=P[i],sv=p&&p.el.querySelector('svg.an');if(!sv)return;
  sv.setAttribute('viewBox','0 0 '+p.w+' '+p.h);
  sv.innerHTML=(A[i]||[]).map(a=>{
    if(a.t==='hl')return '<g data-a="'+a.id+'" fill="'+a.c+'" fill-opacity=".4">'+a.r.map(r=>'<rect x="'+r[0]+'" y="'+r[1]+'" width="'+r[2]+'" height="'+r[3]+'" rx="1.5"/>').join('')+'</g>';
    if(a.t==='red')return '<g data-a="'+a.id+'" fill="#000">'+a.r.map(r=>'<rect x="'+r[0]+'" y="'+r[1]+'" width="'+r[2]+'" height="'+r[3]+'"/>').join('')+'</g>';
    if(a.t==='cmt')return '<g data-a="'+a.id+'"><g transform="translate('+a.x+' '+a.y+')"><g class="pin"><path d="M2 0h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4v-4H2a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2z" fill="#16a34a" stroke="#fff" stroke-width="1.2"/><circle cx="6" cy="6.5" r="1.3" fill="#fff"/><circle cx="10" cy="6.5" r="1.3" fill="#fff"/><circle cx="14" cy="6.5" r="1.3" fill="#fff"/></g></g></g>';
    if(a.t==='sig')return '<image data-a="'+a.id+'" href="'+a.src+'" x="'+a.x+'" y="'+a.y+'" width="'+a.w+'" height="'+a.h+'" preserveAspectRatio="none"/>';
    if(a.t==='ink')return '<path data-a="'+a.id+'" d="'+pathD(a.p)+'" fill="none" stroke="'+a.c+'" stroke-width="'+a.w+'" stroke-linecap="round" stroke-linejoin="round"/>';
    return '<text data-a="'+a.id+'" x="'+a.x+'" y="'+a.y+'" font-size="'+a.f+'" fill="'+a.c+'" dominant-baseline="hanging" font-family="Helvetica,Arial,sans-serif">'+esc(a.s)+'</text>';
  }).join('');
}
const hui=()=>{$('#bUndo').disabled=!H.length;$('#bRedo').disabled=!R.length;cmtBadge();cmtsOpen&&renderCmts()};
const rem=(i,id)=>{const L=A[i]||[],k=L.findIndex(a=>a.id===id);if(k>-1)L.splice(k,1);drawAnn(i);return k};
const ins=(i,a,k)=>{const L=A[i]=A[i]||[];L.splice(k==null?L.length:Math.min(k,L.length),0,a);drawAnn(i)};
function addAnn(i,a){a.id=++uid;ins(i,a);H.push({k:'add',i,a});R=[];hui();persist()}
function delAnn(i,id){const a=(A[i]||[]).find(x=>x.id===id);if(!a)return;const k=rem(i,id);H.push({k:'del',i,a,x:k});R=[];hui();persist()}
function applyMod(o,g){const a=sigOf(o.i,o.id);if(a){Object.assign(a,clone(g));drawAnn(o.i)}}
function undo(){const o=H.pop();if(!o)return;if(o.k==='mod')applyMod(o,o.from);else o.k==='add'?rem(o.i,o.a.id):ins(o.i,o.a,o.x);R.push(o);hui();persist();showBox()}
function redo(){const o=R.pop();if(!o)return;if(o.k==='mod')applyMod(o,o.to);else o.k==='add'?ins(o.i,o.a):(o.x=rem(o.i,o.a.id));H.push(o);hui();persist();showBox()}
$('#bUndo').onclick=undo;$('#bRedo').onclick=redo;

/* annotations are kept on this device, per file */
const akey=d=>'leaf-ann:'+((d.fingerprints&&d.fingerprints[0])||srcName);
function loadAnn(d){try{const o=JSON.parse(localStorage.getItem(akey(d))||'{}');for(const k in o)for(const a of o[k])uid=Math.max(uid,a.id);return o}catch(e){return {}}}
let pst;function persist(){clearTimeout(pst);pst=setTimeout(()=>{try{const has=Object.values(A).some(l=>l.length);has?localStorage.setItem(akey(doc),JSON.stringify(A)):localStorage.removeItem(akey(doc))}catch(e){toast('Annotations could not be stored on this device')}},400)}

/* tools */
function drawSw(){
  const g=tool==='hl'?'hl':'pen',b=$('#clrBtn');
  b.disabled=!['hl','pen','txt'].includes(tool);b.style.setProperty('--cc',col[g]);closePal();
}
function openPal(){
  const g=tool==='hl'?'hl':'pen',pal=$('#pal'),btn=$('#clrBtn');pal.textContent='';
  (g==='hl'?PAL.slice(0,5):PAL).forEach(c=>{
    const b=document.createElement('button');b.className='sw'+(col[g]===c?' on':'');b.style.background=c;b.setAttribute('aria-label','Color '+c);
    b.onclick=()=>{col[g]=c;drawSw()};pal.append(b);
  });
  pal.classList.add('on');btn.classList.add('on');
  const r=btn.getBoundingClientRect(),w=pal.offsetWidth;
  pal.style.left=clamp(r.left+r.width/2-w/2,8,innerWidth-w-8)+'px';pal.style.top=(r.bottom+8)+'px';
}
function closePal(){$('#pal').classList.remove('on');$('#clrBtn').classList.remove('on')}
$('#clrBtn').onclick=()=>$('#pal').classList.contains('on')?closePal():openPal();
document.addEventListener('pointerdown',e=>{if(!e.target.closest('#pal,#clrBtn'))closePal()});
function setTool(t){
  sigPlace=null;cmtPlace=false;document.body.classList.remove('placing');selSig=null;showBox();tool=t;document.body.dataset.tool=t;
  document.querySelectorAll('#dock [data-t]').forEach(b=>b.classList.toggle('on',b.dataset.t===t));
  drawSw();getSelection().removeAllRanges();hidePop();
  if(t==='red')toast('Drag black-out boxes over sensitive content');
}
document.querySelectorAll('#dock [data-t]').forEach(b=>b.onclick=()=>setTool(b.dataset.t));

/* highlight from text selection */
function hlSel(color){
  const s=getSelection();if(!s.rangeCount||s.isCollapsed)return;
  const rg=s.getRangeAt(0);
  P.forEach(p=>{
    if(!p.vis||!p.divs)return;
    const k=p.w/p.el.getBoundingClientRect().width,L=lineSegs(p,rg).map(g=>[+(g.l*k).toFixed(2),+(g.t*k).toFixed(2),+(g.w*k).toFixed(2),+(g.h*k).toFixed(2)]);
    if(L.length)addAnn(p.i,{t:'hl',c:color,r:L});
  });
  s.removeAllRanges();hidePop();
}
/* floating selection menu */
const pop=$('#pop');
PAL.slice(0,5).forEach(c=>{
  const b=document.createElement('button');b.className='sw';b.style.background=c;b.title='Highlight';b.setAttribute('aria-label','Highlight '+c);
  b.onclick=()=>{col.hl=c;hlSel(c);drawSw()};pop.append(b);
});
const cp=document.createElement('button');cp.className='b';cp.title='Copy';cp.setAttribute('aria-label','Copy');cp.innerHTML='<svg><use href="#i-copy"/></svg>';
cp.onclick=()=>{const t=getSelection().toString();(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).catch(()=>document.execCommand('copy'));toast('Copied');hidePop()};
pop.append(cp);pop.addEventListener('pointerdown',e=>e.preventDefault());
function hidePop(){pop.classList.remove('on')}
function showPop(){
  const s=getSelection();
  if((tool!=='sel'&&!(coarse()&&tool==='hl'))||!s.rangeCount||s.isCollapsed||!viewer.contains(s.anchorNode))return hidePop();
  let last=null;for(const r of s.getRangeAt(0).getClientRects())if(r.width>2&&r.height>2&&r.height<150*scale)last=r;
  if(!last)return hidePop();
  pop.classList.add('on');const w=pop.offsetWidth;
  if(coarse()){pop.style.left=(innerWidth-w)/2+'px';pop.style.top='auto';pop.style.bottom='calc(54px + env(safe-area-inset-bottom))'}
  else{pop.style.bottom='auto';pop.style.left=clamp(last.right-w/2,8,innerWidth-w-8)+'px';pop.style.top=Math.max(60,last.top-pop.offsetHeight-8)+'px'}
}
viewer.addEventListener('pointerdown',hidePop);
viewer.addEventListener('scroll',hidePop,{passive:true});
addEventListener('pointerup',()=>setTimeout(()=>{
  if(coarse())return;
  const s=getSelection();
  if(tool==='hl'&&s.rangeCount&&!s.isCollapsed&&viewer.contains(s.anchorNode))hlSel(col.hl);else showPop();
},10));

let st;document.addEventListener('selectionchange',()=>{if(!coarse())return;clearTimeout(st);st=setTimeout(showPop,250)});

/* ink, text, eraser */
const ptr=(e,sv,i)=>{const r=sv.getBoundingClientRect(),k=P[i].w/r.width;return[(e.clientX-r.left)*k,(e.clientY-r.top)*k]};
pagesEl.addEventListener('pointerdown',e=>{
  const sv=e.target.closest&&e.target.closest('svg.an');if(!sv||e.button)return;
  const i=+sv.dataset.i;
  if(tool==='pen')startInk(e,sv,i);else if(tool==='txt')startText(e,sv,i);else if(tool==='er')startErase(e);else if(tool==='red')startRed(e,sv,i);
});
function startInk(e,sv,i){
  e.preventDefault();sv.setPointerCapture(e.pointerId);
  const pts=[ptr(e,sv,i)],path=document.createElementNS(NS,'path');
  for(const [k,v] of Object.entries({fill:'none',stroke:col.pen,'stroke-width':2.2,'stroke-linecap':'round','stroke-linejoin':'round'}))path.setAttribute(k,v);
  sv.append(path);
  const mv=ev=>{for(const c of (ev.getCoalescedEvents?ev.getCoalescedEvents():[ev]))pts.push(ptr(c,sv,i));path.setAttribute('d',pathD(pts))};
  const stop=()=>{sv.removeEventListener('pointermove',mv);sv.removeEventListener('pointerup',up);sv.removeEventListener('pointercancel',up);path.remove();inkAbort=null};
  const up=()=>{
    stop();
    if(pts.length<2)pts.push([pts[0][0]+.1,pts[0][1]]);
    addAnn(i,{t:'ink',c:col.pen,w:2.2,p:pts.map(q=>[+q[0].toFixed(1),+q[1].toFixed(1)])});
  };
  inkAbort=stop;sv.addEventListener('pointermove',mv);sv.addEventListener('pointerup',up);sv.addEventListener('pointercancel',up);
}
function startText(e,sv,i){
  e.preventDefault();if(selSig){selSig=null;showBox()}const [x,y]=ptr(e,sv,i);
  const inp=document.createElement('input');inp.className='ti';inp.style.cssText='left:'+x*scale+'px;top:'+y*scale+'px;font-size:'+14*scale+'px;color:'+col.pen;
  inp.setAttribute('aria-label','Text note');P[i].el.append(inp);
  let done=0;const fin=ok=>{if(done)return;done=1;const t=inp.value.trim();inp.remove();if(ok&&t){const na={t:'txt',c:col.pen,x:+x.toFixed(1),y:+y.toFixed(1),s:t,f:14};addAnn(i,na);selSig={i,id:na.id};showBox()}};
  inp.onkeydown=ev=>{ev.stopPropagation();if(ev.key==='Enter')fin(1);else if(ev.key==='Escape')fin(0)};
  inp.onblur=()=>fin(1);setTimeout(()=>inp.focus(),0);
}
function startErase(e){
  e.preventDefault();
  const hit=ev=>{
    for(const [dx,dy] of (d=>[[0,0],[d,0],[-d,0],[0,d],[0,-d]])(coarse()?12:6))
      for(const el of document.elementsFromPoint(ev.clientX+dx,ev.clientY+dy)){
        const a=el.closest&&el.closest('[data-a]');
        if(a){const sv=a.closest('svg.an');delAnn(+sv.dataset.i,+a.dataset.a);return}
      }
  };
  const up=()=>{removeEventListener('pointermove',hit);removeEventListener('pointerup',up)};
  hit(e);addEventListener('pointermove',hit);addEventListener('pointerup',up);
}
function startRed(e,sv,i){
  e.preventDefault();sv.setPointerCapture(e.pointerId);
  const [x0,y0]=ptr(e,sv,i);
  const box=document.createElementNS(NS,'rect');box.setAttribute('fill','#000');sv.append(box);
  let cur=null;
  const mv=ev=>{
    const [x,y]=ptr(ev,sv,i);
    cur={x:Math.min(x0,x),y:Math.min(y0,y),w:Math.abs(x-x0),h:Math.abs(y-y0)};
    box.setAttribute('x',cur.x);box.setAttribute('y',cur.y);box.setAttribute('width',cur.w);box.setAttribute('height',cur.h);
  };
  const stop=()=>{sv.removeEventListener('pointermove',mv);sv.removeEventListener('pointerup',up);sv.removeEventListener('pointercancel',up);box.remove();inkAbort=null};
  const up=()=>{
    stop();
    if(cur&&cur.w>1&&cur.h>1)addAnn(i,{t:'red',c:'#000000',r:[[+cur.x.toFixed(1),+cur.y.toFixed(1),+cur.w.toFixed(1),+cur.h.toFixed(1)]]});
    else if(cur)toast('Drag a box over the content to redact');
  };
  inkAbort=stop;sv.addEventListener('pointermove',mv);sv.addEventListener('pointerup',up);sv.addEventListener('pointercancel',up);
}
