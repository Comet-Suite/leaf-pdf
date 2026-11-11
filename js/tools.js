/* ---------- redact ---------- */
function redCount(){let n=0;for(const k in A)for(const a of A[k])if(a.t==='red')n++;return n}
function openRd(){
  if(!doc)return;
  const n=redCount(),pages=new Set();
  for(const k in A)for(const a of A[k])if(a.t==='red')pages.add(+k);
  $('#rdStat').textContent=n?n+(n===1?' redaction box':' redaction boxes')+' on '+pages.size+(pages.size===1?' page.':' pages.'):'No redaction boxes yet. Use Draw boxes to add them.';
  $('#rdGo').disabled=!n;
  $('#rd').classList.add('on');
}
const closeRd=()=>$('#rd').classList.remove('on');
async function applyRedact(){
  if(!doc||!redCount())return;
  const flat=$('#rdFlat').checked,btn=$('#rdGo');btn.disabled=true;toast('Applying redactions...');
  try{
    const pd=await annotatedDoc();
    if(flat){
      const L=PDFLib,pgs=pd.getPages();
      for(const k of Object.keys(A)){
        const list=A[k];if(!list||!list.some(a=>a.t==='red'))continue;
        const i=+k,page=pgs[i];if(!page)continue;
        const jp=await doc.getPage(i+1),vp=jp.getViewport({scale:2});
        const cv=document.createElement('canvas');cv.width=vp.width;cv.height=vp.height;
        const cx=cv.getContext('2d');
        cx.fillStyle='#fff';cx.fillRect(0,0,cv.width,cv.height);
        await jp.render({canvasContext:cx,viewport:vp}).promise;
        for(const a of list)if(a.t==='sig')await imgOf(a.src);
        paintAnn(cx,i,2);
        const png=await new Promise(r=>cv.toBlob(r,'image/png'));cv.width=0;
        if(!png)throw new Error('render');
        const img=await pd.embedPng(await png.arrayBuffer());
        const TL=vp.convertToPdfPoint(0,0),TR=vp.convertToPdfPoint(vp.width,0),BL=vp.convertToPdfPoint(0,vp.height);
        const H=Math.hypot(TL[0]-BL[0],TL[1]-BL[1])||1,W=Math.hypot(TR[0]-TL[0],TR[1]-TL[1])||1;
        const rot=Math.round(Math.atan2(-(TL[0]-BL[0])/H,(TL[1]-BL[1])/H)*180/Math.PI/90)*90;
        /* drop the page's old content streams AND remove those objects from the
           file: pdf-lib keeps unreferenced objects on save, which would leave
           the redacted text recoverable in the bytes */
        const oldC=page.node.get(L.PDFName.Contents);
        const oldRefs=oldC&&typeof oldC.asArray==='function'?oldC.asArray():(oldC?[oldC]:[]);
        page.node.delete(L.PDFName.Contents);page.contentStream=null;page.contentStreamRef=null;
        oldRefs.forEach(r=>{try{pd.context.delete(r)}catch(e){}});
        page.drawImage(img,{x:BL[0],y:BL[1],width:W,height:H,rotate:L.degrees(rot)});
      }
    }
    dl(new Blob([await pd.save()],{type:'application/pdf'}),srcName+'-redacted.pdf');
    toast('Redactions applied');closeRd();
  }catch(e){console.error(e);toast('Could not apply redactions')}
  btn.disabled=false;
}
$('#bRedact').onclick=openRd;
$('#rdX').onclick=closeRd;
$('#rd').addEventListener('pointerdown',e=>{if(e.target.id==='rd')closeRd()});
$('#rdDraw').onclick=()=>{closeRd();setTool('red')};
$('#rdGo').onclick=applyRedact;

/* ---------- protect (AES encryption via a lazily loaded library) ---------- */
let ENC=null,encP=null;
function loadEnc(){
  if(ENC)return Promise.resolve(ENC);
  if(encP)return encP;
  const prev=window.PDFLib;
  encP=(async()=>{
    const srcs=['lib/pdf-lib-enc.min.js','pdf-lib-enc.min.js','https://cdn.jsdelivr.net/npm/@cantoo/pdf-lib@2.11.1/dist/pdf-lib.min.js'];
    for(const src of srcs){
      const ok=await new Promise(res=>{const s=document.createElement('script');s.src=src;s.onload=()=>res(true);s.onerror=()=>res(false);document.head.append(s)});
      const lib=window.PDFLib;
      if(ok&&lib&&lib!==prev&&lib.PDFDocument&&typeof lib.PDFDocument.prototype.encrypt==='function'){ENC=lib;break}
    }
    if(prev)window.PDFLib=prev;
    if(!ENC)throw new Error('The encryption library could not be loaded. Check your connection.');
    return ENC;
  })().catch(e=>{encP=null;throw e});
  return encP;
}
async function protectPdf(){
  if(!doc)return;
  const u=($('#ptUser').value||'').trim();
  if(!u){toast('Enter a password to open the file');$('#ptUser').focus();return}
  const btn=$('#ptGo');btn.disabled=true;toast('Protecting the PDF...');
  try{
    const lib=await loadEnc();
    const bytes=await (await annotatedDoc()).save();
    const enc=await lib.PDFDocument.load(bytes);
    enc.encrypt({userPassword:u,ownerPassword:($('#ptOwner').value||'').trim()||u,permissions:{
      printing:$('#ptPrint').checked?'highResolution':false,
      copying:$('#ptCopy').checked,
      modifying:$('#ptEdit').checked,
      annotating:$('#ptEdit').checked,
      fillingForms:$('#ptEdit').checked,
      documentAssembly:$('#ptEdit').checked,
      contentAccessibility:true
    }});
    dl(new Blob([await enc.save()],{type:'application/pdf'}),srcName+'-protected.pdf');
    $('#ptUser').value='';$('#ptOwner').value='';
    toast('Protected copy downloaded');closePt();
  }catch(e){console.error(e);toast(e.message||'Could not protect this PDF')}
  btn.disabled=false;
}
function openPt(){if(!doc)return;$('#pt').classList.add('on');setTimeout(()=>$('#ptUser').focus(),0)}
const closePt=()=>$('#pt').classList.remove('on');
$('#bProtect').onclick=openPt;
$('#ptX').onclick=closePt;
$('#pt').addEventListener('pointerdown',e=>{if(e.target.id==='pt')closePt()});
$('#ptGo').onclick=protectPdf;
[$('#ptUser'),$('#ptOwner')].forEach(inp=>inp.onkeydown=e=>{e.stopPropagation();if(e.key==='Enter')protectPdf();else if(e.key==='Escape')closePt()});

/* ---------- screenshot (snipping tool) ---------- */
const snipEl=$('#snip');let snipSt=null,snipCv=null;
function openSnip(){
  if(!doc){toast('Open a PDF first');return}
  snipEl.hidden=false;snipSt=null;snipCv=null;
  $('#snipSel').hidden=true;$('#snipBar').hidden=true;$('#snipMsg').hidden=false;
}
function closeSnip(){snipEl.hidden=true;snipSt=null;snipCv=null}
async function captureSnip(){
  const s=snipSt,k=dpr();
  const cv=document.createElement('canvas');
  cv.width=Math.max(1,Math.round(s.w*k));cv.height=Math.max(1,Math.round(s.h*k));
  const x=cv.getContext('2d');if(!x){toast('Screenshots are not supported here');return}
  x.fillStyle=getComputedStyle(viewer).backgroundColor||'#0d0e11';
  x.fillRect(0,0,cv.width,cv.height);
  for(const p of P){
    if(!p.el)continue;
    const r=p.el.getBoundingClientRect();
    const ix=Math.max(r.left,s.x),iy=Math.max(r.top,s.y),ax=Math.min(r.right,s.x+s.w),ay=Math.min(r.bottom,s.y+s.h);
    if(ax<=ix||ay<=iy)continue;
    const base=p.el.querySelector('canvas');
    x.save();
    x.beginPath();x.rect((ix-s.x)*k,(iy-s.y)*k,(ax-ix)*k,(ay-iy)*k);x.clip();
    x.translate((r.left-s.x)*k,(r.top-s.y)*k);
    if(base&&base.width&&r.width>0){
      const sx=(ix-r.left)/r.width*base.width,sy=(iy-r.top)/r.height*base.height;
      const sw=(ax-ix)/r.width*base.width,sh=(ay-iy)/r.height*base.height;
      try{x.drawImage(base,sx,sy,sw,sh,0,0,r.width*k,r.height*k)}catch(e){}
    }
    for(const a of A[p.i]||[])if(a.t==='sig')await imgOf(a.src);
    paintAnn(x,p.i,(r.width/Math.max(1,p.w))*k);
    x.restore();
  }
  snipCv=cv;snipSt=null;
  $('#snipSel').hidden=true;$('#snipMsg').hidden=true;
  $('#snipInfo').textContent=cv.width+'×'+cv.height+' px';
  $('#snipBar').hidden=false;
}
snipEl.addEventListener('pointerdown',e=>{
  if(e.target.closest('#snipBar'))return;
  e.preventDefault();
  const sel=$('#snipSel');sel.hidden=false;$('#snipBar').hidden=true;$('#snipMsg').hidden=false;snipCv=null;
  const x0=e.clientX,y0=e.clientY;
  const mv=ev=>{
    snipSt={x:Math.min(x0,ev.clientX),y:Math.min(y0,ev.clientY),w:Math.abs(ev.clientX-x0),h:Math.abs(ev.clientY-y0)};
    sel.style.left=snipSt.x+'px';sel.style.top=snipSt.y+'px';sel.style.width=snipSt.w+'px';sel.style.height=snipSt.h+'px';
  };
  const up=()=>{
    removeEventListener('pointermove',mv);removeEventListener('pointerup',up);removeEventListener('pointercancel',up);
    if(snipSt&&snipSt.w>4&&snipSt.h>4)captureSnip();else{sel.hidden=true;snipSt=null}
  };
  addEventListener('pointermove',mv);addEventListener('pointerup',up);addEventListener('pointercancel',up);
  mv(e);
});
snipEl.addEventListener('wheel',e=>e.preventDefault(),{passive:false});
$('#bSnip').onclick=openSnip;
$('#snipX').onclick=closeSnip;
$('#snipAgain').onclick=()=>{snipCv=null;$('#snipBar').hidden=true;$('#snipSel').hidden=true;$('#snipMsg').hidden=false};
$('#snipSave').onclick=()=>{
  if(!snipCv)return;
  const t=new Date(),p=n=>String(n).padStart(2,'0');
  snipCv.toBlob(b=>{if(!b){toast('Could not save the screenshot');return}dl(b,'Leaf-PDF-snip-'+t.getFullYear()+p(t.getMonth()+1)+p(t.getDate())+'-'+p(t.getHours())+p(t.getMinutes())+p(t.getSeconds())+'.png');toast('Screenshot saved')},'image/png');
};
$('#snipCopy').onclick=async()=>{
  if(!snipCv)return;
  try{
    if(!navigator.clipboard||!window.ClipboardItem)throw 0;
    const b=await new Promise(r=>snipCv.toBlob(r,'image/png'));
    await navigator.clipboard.write([new ClipboardItem({'image/png':b})]);
    toast('Copied to clipboard');
  }catch(e){toast('Could not copy - use Save PNG')}
};
addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    if(!snipEl.hidden)closeSnip();
    if($('#rd').classList.contains('on'))closeRd();
    if($('#pt').classList.contains('on'))closePt();
  }
});

/* about */
const abEl=$('#ab'),openAb=()=>abEl.classList.add('on'),closeAb=()=>abEl.classList.remove('on');
$('#bAbout').onclick=openAb;$('#abX').onclick=$('#abOk').onclick=closeAb;
abEl.addEventListener('pointerdown',e=>{if(e.target===abEl)closeAb()});
addEventListener('keydown',e=>{if(e.key==='Escape')closeAb()});
