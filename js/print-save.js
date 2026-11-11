/* print (annotations included) */
function paintAnn(ctx,i,k){
  for(const a of A[i]||[]){
    ctx.save();
    if(a.t==='hl'){ctx.globalAlpha=.4;ctx.globalCompositeOperation='multiply';ctx.fillStyle=a.c;for(const r of a.r)ctx.fillRect(r[0]*k,r[1]*k,r[2]*k,r[3]*k)}
    else if(a.t==='red'){ctx.fillStyle='#000';for(const r of a.r)ctx.fillRect(r[0]*k,r[1]*k,r[2]*k,r[3]*k)}
    else if(a.t==='ink'){ctx.strokeStyle=a.c;ctx.lineWidth=a.w*k;ctx.lineCap=ctx.lineJoin='round';ctx.beginPath();a.p.forEach((q,n)=>n?ctx.lineTo(q[0]*k,q[1]*k):ctx.moveTo(q[0]*k,q[1]*k));ctx.stroke()}
    else if(a.t==='cmt'){ctx.translate(a.x*k,a.y*k);ctx.scale(k,k);ctx.fillStyle='#16a34a';ctx.fill(new Path2D('M2 0h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4v-4H2a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2z'));ctx.fillStyle='#fff';for(const cx of[6,10,14]){ctx.beginPath();ctx.arc(cx,6.5,1.3,0,7);ctx.fill()}}
    else if(a.t==='sig'){ctx.drawImage(sigImgs[a.src],a.x*k,a.y*k,a.w*k,a.h*k)}
    else{ctx.fillStyle=a.c;ctx.font=a.f*k+'px Helvetica,Arial,sans-serif';ctx.textBaseline='top';ctx.fillText(a.s,a.x*k,a.y*k)}
    ctx.restore();
  }
}
async function doPrint(list){
  if(!doc||printing)return;printing=true;
  const root=$('#printRoot');root.textContent='';
  try{
    for(const [c,i] of list.entries()){
      toast('Preparing page '+(c+1)+' of '+list.length+'...');
      const pg=await doc.getPage(i+1),vp=pg.getViewport({scale:2}),cv=document.createElement('canvas');
      cv.width=vp.width;cv.height=vp.height;const ctx=cv.getContext('2d');
      ctx.fillStyle='#fff';ctx.fillRect(0,0,cv.width,cv.height);
      await pg.render({canvasContext:ctx,viewport:vp}).promise;for(const a of A[i]||[])if(a.t==='sig')await imgOf(a.src);paintAnn(ctx,i,2);
      const b=await new Promise(r=>cv.toBlob(r,'image/jpeg',.92));cv.width=0;
      const im=new Image();im.src=URL.createObjectURL(b);root.append(im);await im.decode().catch(()=>{});
    }
    $('#toast').classList.remove('on');print();
  }catch(e){toast('Could not prepare the print job')}
  printing=false;
}
addEventListener('afterprint',()=>{const r=$('#printRoot');r.querySelectorAll('img').forEach(i=>URL.revokeObjectURL(i.src));r.textContent=''});
/* print goes straight to the browser's own print dialog (no range prompt) */
function openPrint(){if(!doc||printing)return;doPrint([...Array(doc.numPages).keys()])}
$('#bPrint').onclick=openPrint;

/* save a copy with annotations baked in */
async function annotatedDoc(){
  if(!window.PDFLib)throw new Error('pdf-lib');
    const L=PDFLib,pd=await L.PDFDocument.load(await srcFile.arrayBuffer(),{ignoreEncryption:true}),font=await pd.embedFont(L.StandardFonts.Helvetica),pgs=pd.getPages();
    const rgbOf=h=>{const n=parseInt(h.slice(1),16);return L.rgb((n>>16&255)/255,(n>>8&255)/255,(n&255)/255)};
    for(const i in A){
      if(!A[i].length)continue;
      const pg=pgs[i],vp=(await doc.getPage(+i+1)).getViewport({scale:1}),T=(x,y)=>vp.convertToPdfPoint(x,y),rot=L.degrees(vp.rotation);
      for(const a of A[i]){
        const c=rgbOf(a.c);
        if(a.t==='hl')for(const r of a.r){
          const p=T(r[0],r[1]),q=T(r[0]+r[2],r[1]+r[3]);
          pg.drawRectangle({x:Math.min(p[0],q[0]),y:Math.min(p[1],q[1]),width:Math.abs(q[0]-p[0]),height:Math.abs(q[1]-p[1]),color:c,opacity:.4,blendMode:L.BlendMode.Multiply});
        }
        else if(a.t==='red')for(const r of a.r){
          const p=T(r[0],r[1]),q=T(r[0]+r[2],r[1]+r[3]);
          pg.drawRectangle({x:Math.min(p[0],q[0]),y:Math.min(p[1],q[1]),width:Math.abs(q[0]-p[0]),height:Math.abs(q[1]-p[1]),color:L.rgb(0,0,0)});
        }
        else if(a.t==='ink')for(let k=1;k<a.p.length;k++){
          const p=T(a.p[k-1][0],a.p[k-1][1]),q=T(a.p[k][0],a.p[k][1]);
          pg.drawLine({start:{x:p[0],y:p[1]},end:{x:q[0],y:q[1]},thickness:a.w,color:c,lineCap:L.LineCapStyle.Round});
        }
        else if(a.t==='cmt'){
          const p=T(a.x,a.y),q=T(a.x+20,a.y+17);
          const ref=pd.context.register(pd.context.obj({Type:'Annot',Subtype:'Text',Rect:[Math.min(p[0],q[0]),Math.min(p[1],q[1]),Math.max(p[0],q[0]),Math.max(p[1],q[1])],Contents:L.PDFHexString.fromText(a.s||''),T:L.PDFHexString.fromText('Leaf PDF'),Name:'Comment',C:[.09,.64,.29],F:4}));
          pg.node.addAnnot(ref);
        }
        else if(a.t==='sig'){const img=await pd.embedPng(a.src),p=T(a.x,a.y+a.h);pg.drawImage(img,{x:p[0],y:p[1],width:a.w,height:a.h,rotate:rot})}
        else if(/[^\x20-\xFF]/.test(a.s)){
          const k=3,cv=document.createElement('canvas'),x=cv.getContext('2d'),fs=a.f*k+'px Helvetica,Arial,sans-serif';
          x.font=fs;cv.width=Math.ceil(x.measureText(a.s).width)+4;cv.height=Math.ceil(a.f*k*1.3);
          x.font=fs;x.fillStyle=a.c;x.textBaseline='top';x.fillText(a.s,2,0);
          const img=await pd.embedPng(cv.toDataURL('image/png')),p=T(a.x,a.y+cv.height/k);
          pg.drawImage(img,{x:p[0],y:p[1],width:cv.width/k,height:cv.height/k,rotate:rot});
        }
        else{const p=T(a.x,a.y+a.f*.85);pg.drawText(a.s,{x:p[0],y:p[1],size:a.f,font,color:c,rotate:rot})}
      }
    }
    return pd;
}
async function savePdf(){
  if(!doc)return;if(!window.PDFLib){toast('The PDF editor could not load. Check your connection.');return}
  toast('Saving...');
  try{
    const pd=await annotatedDoc();
    const url=URL.createObjectURL(new Blob([await pd.save()],{type:'application/pdf'})),a=document.createElement('a');
    a.href=url;a.download=srcName+'-annotated.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),4000);toast('Saved a copy with your annotations');
  }catch(e){toast('Could not save this PDF')}
}
$('#bSave').onclick=savePdf;
const menu=$('#menu'),more=$('#bMore');
const setMenu=on=>{menu.classList.toggle('on',on);more.classList.toggle('on',on);more.setAttribute('aria-expanded',on)};
more.onclick=()=>setMenu(!menu.classList.contains('on'));
menu.addEventListener('click',e=>{const b=e.target.closest('button.mi');if(b)setMenu(false)});
document.addEventListener('pointerdown',e=>{if(!menu.contains(e.target)&&!more.contains(e.target))setMenu(false)});
addEventListener('keydown',e=>{if(e.key==='Escape'){setMenu(false);endPlace();closeSg();closePal();closeCtx();if(selSig){selSig=null;showBox()}}});
$('#bTheme').onclick=()=>{const t=document.documentElement.dataset.theme==='light'?'dark':'light';applyTheme(t);try{localStorage.setItem('leaf-theme',t)}catch(e){}};
addEventListener('keydown',e=>{
  const c=e.ctrlKey||e.metaKey,k=e.key.toLowerCase(),typing=/INPUT|TEXTAREA/.test(e.target.tagName);
  if(c&&k==='p'){e.preventDefault();openPrint()}
  else if(c&&k==='s'){e.preventDefault();savePdf()}
  else if(c&&k==='z'&&!typing){e.preventDefault();e.shiftKey?redo():undo()}
  else if(c&&k==='y'&&!typing){e.preventDefault();redo()}
  else if(!c&&!e.altKey&&!typing&&doc&&desk()){const t={v:'sel',h:'hl',d:'pen',t:'txt',e:'er'}[k];if(t)setTool(t);else if(k==='escape'&&!document.querySelector('[role=dialog].on,#snip:not([hidden])'))setTool('sel')}
});
