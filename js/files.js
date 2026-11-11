/* ---------- merge and split ---------- */
const mgEl=$('#mg');
let mItems=[],mUid=0,spSrc=null,lastAutoDoc=null;
const fmt=n=>n+(n===1?' page':' pages');
const safe=t=>(t||'').replace(/[\\/:*?"<>|]+/g,'_').replace(/\s+/g,' ').trim()||'file';
function dl(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),6000)}
function parsePages(t,n){
  t=(t||'').trim().toLowerCase();
  if(!t||t==='all')return[...Array(n).keys()];
  const out=[],num=v=>v==='last'?n:parseInt(v);
  for(const part of t.split(/[,;\s]+/)){
    if(!part)continue;
    if(part==='odd'){for(let k=0;k<n;k+=2)out.push(k);continue}
    if(part==='even'){for(let k=1;k<n;k+=2)out.push(k);continue}
    let m,a,b;
    if(m=part.match(/^(\d+|last)$/)){a=b=num(m[1])}
    else if(m=part.match(/^(\d+|last)-(\d+|last)?$/)){a=num(m[1]);b=m[2]?num(m[2]):n}
    else if(m=part.match(/^-(\d+|last)$/)){a=1;b=num(m[1])}
    else return null;
    if(!(a>=1&&b>=1)||a>n||b>n)return null;
    const st=a<=b?1:-1;for(let k=a;k!==b+st;k+=st)out.push(k-1);
  }
  return out.length?out:null;
}
async function readPdf(file){
  const buf=await file.arrayBuffer(),pd=await PDFLib.PDFDocument.load(buf,{ignoreEncryption:true,updateMetadata:false});
  return{name:file.name.replace(/\.pdf$/i,''),n:pd.getPageCount(),buf,pd};
}
const isPdf=f=>f.type==='application/pdf'||/\.pdf$/i.test(f.name);
function docItem(){return{id:++mUid,kind:'doc',name:srcName,n:doc.numPages,range:'',rot:0,ref:doc}}

/* --- merge --- */
async function addFiles(list){
  if(!window.PDFLib){toast('The PDF editor could not load. Check your connection.');return}
  for(const f of list){
    if(!isPdf(f))continue;
    try{const r=await readPdf(f);mItems.push({id:++mUid,kind:'file',name:r.name,n:r.n,pd:r.pd,range:'',rot:0})}
    catch(e){toast('Could not read '+f.name)}
  }
  renderMerge();
}
function renderMerge(){
  const el=$('#mgList');el.textContent='';
  const hasDoc=mItems.some(i=>i.kind==='doc');
  $('#mgAddCur').hidden=!doc||hasDoc;$('#mgAnnRow').hidden=!hasDoc;
  if(!mItems.length)el.innerHTML='<div class="mgempty">Add two or more PDFs to combine them.</div>';
  mItems.forEach((it,k)=>{
    const r=document.createElement('div');r.className='mf';
    r.innerHTML='<div class="mfi"><svg><use href="#i-doc"/></svg></div><div class="mft"><b></b><small></small></div><input class="mfr" placeholder="All pages" aria-label="Pages to include" autocomplete="off"><select class="mfrot" aria-label="Rotate"><option value="0">0&deg;</option><option value="90">90&deg;</option><option value="180">180&deg;</option><option value="270">270&deg;</option></select><div class="mfb"><button class="b up" aria-label="Move up"><svg><use href="#i-up"/></svg></button><button class="b dn" aria-label="Move down"><svg><use href="#i-down"/></svg></button><button class="b rm" aria-label="Remove"><svg><use href="#i-trash"/></svg></button></div>';
    r.querySelector('b').textContent=it.name+(it.kind==='doc'?' (open document)':'');
    r.querySelector('small').textContent=fmt(it.n);
    const inp=r.querySelector('.mfr');inp.value=it.range;inp.oninput=()=>{it.range=inp.value;updMg()};
    const sel=r.querySelector('.mfrot');sel.value=it.rot;sel.onchange=()=>{it.rot=+sel.value};
    const up=r.querySelector('.up'),dn=r.querySelector('.dn');up.disabled=k===0;dn.disabled=k===mItems.length-1;
    up.onclick=()=>{[mItems[k-1],mItems[k]]=[mItems[k],mItems[k-1]];renderMerge()};
    dn.onclick=()=>{[mItems[k+1],mItems[k]]=[mItems[k],mItems[k+1]];renderMerge()};
    r.querySelector('.rm').onclick=()=>{mItems.splice(k,1);renderMerge()};
    el.append(r);
  });
  updMg();
}
function updMg(){
  if(mgTab!=='merge')return;
  let tot=0,bad=false;
  [...$('#mgList').querySelectorAll('.mf')].forEach((r,k)=>{
    const it=mItems[k],idx=parsePages(it.range,it.n);
    r.querySelector('.mfr').setAttribute('aria-invalid',idx?'false':'true');
    if(idx)tot+=idx.length;else bad=true;
  });
  $('#mgSum').textContent=!mItems.length?'':bad?'Check the highlighted page ranges.':mItems.length+(mItems.length===1?' file':' files')+' - '+fmt(tot)+' in the result';
  $('#mgGo').disabled=!mItems.length||bad;
}
function addOutline(pd,items){
  const L=PDFLib,ctx=pd.context,root=ctx.nextRef(),refs=items.map(()=>ctx.nextRef());
  items.forEach((it,k)=>{
    const d=ctx.obj({Title:L.PDFHexString.fromText(it.title),Parent:root,Dest:[pd.getPage(it.i).ref,L.PDFName.of('Fit')]});
    if(k>0)d.set(L.PDFName.of('Prev'),refs[k-1]);
    if(k<items.length-1)d.set(L.PDFName.of('Next'),refs[k+1]);
    ctx.assign(refs[k],d);
  });
  ctx.assign(root,ctx.obj({Type:'Outlines',First:refs[0],Last:refs[refs.length-1],Count:items.length}));
  pd.catalog.set(L.PDFName.of('Outlines'),root);pd.catalog.set(L.PDFName.of('PageMode'),L.PDFName.of('UseOutlines'));
}
async function deliver(files,openAfter,base,cloud){
  if(files.length===1){
    const f=files[0],blob=new Blob([f.bytes],{type:'application/pdf'});dl(blob,f.name);toast('Saved '+f.name);if(cloud)openCl('save',{name:f.name,blob});
    if(openAfter){closeMg();openBuf(f.bytes.slice().buffer,f.name.replace(/\.pdf$/i,''),new File([blob],f.name,{type:'application/pdf'}))}
    return;
  }
  if(window.JSZip){
    const z=new JSZip();files.forEach(f=>z.file(f.name,f.bytes));
    const zb=await z.generateAsync({type:'blob',compression:'STORE'});dl(zb,safe(base)+'.zip');toast('Saved '+files.length+' files as a ZIP');if(cloud)openCl('save',{name:safe(base)+'.zip',blob:zb});
  }else{files.forEach((f,k)=>setTimeout(()=>dl(new Blob([f.bytes],{type:'application/pdf'}),f.name),k*350));toast('Saved '+files.length+' files')}
}
async function doMerge(){
  if(!window.PDFLib){toast('The PDF editor could not load. Check your connection.');return}
  if(!mItems.length){toast('Add at least one PDF');return}
  const L=PDFLib,plans=[];
  for(const it of mItems){const idx=parsePages(it.range,it.n);if(!idx){toast('Check the pages for '+it.name);return}plans.push(idx)}
  $('#mgGo').disabled=true;
  try{
    const out=await L.PDFDocument.create(),marks=[],blank=$('#mgBlank').checked;
    for(let k=0;k<mItems.length;k++){
      const it=mItems[k];toast('Merging '+(k+1)+' of '+mItems.length+'...');
      const src=it.kind==='doc'?($('#mgAnn').checked?await annotatedDoc():await L.PDFDocument.load(await srcFile.arrayBuffer(),{ignoreEncryption:true})):it.pd;
      const pages=await out.copyPages(src,plans[k]);
      marks.push({title:it.name,i:out.getPageCount()});
      for(const p of pages){if(it.rot)p.setRotation(L.degrees((p.getRotation().angle+it.rot)%360));out.addPage(p)}
      if(blank&&k<mItems.length-1){const z=out.getPage(out.getPageCount()-1).getSize();out.addPage([z.width,z.height])}
    }
    if($('#mgBm').checked)addOutline(out,marks);
    const name=safe($('#mgName').value||'merged').replace(/\.pdf$/i,'');
    out.setTitle(name);out.setProducer('Leaf PDF');
    await deliver([{name:name+'.pdf',bytes:await out.save()}],$('#mgOpen').checked,name,$('#mgCloud').checked);
  }catch(e){toast('Could not merge these PDFs')}
  $('#mgGo').disabled=false;updMg();
}

/* --- split --- */
function setSpSrc(s){
  spSrc=s;
  $('#spName').textContent=s?s.name+(s.kind==='doc'?' (open document)':''):'No PDF selected';
  $('#spInfo').textContent=s?fmt(s.n):'';
  $('#spDoc').hidden=!doc||(!!s&&s.kind==='doc');$('#spAnnRow').hidden=!(s&&s.kind==='doc');
  if(s&&!$('#spPre').dataset.t)$('#spPre').value=s.name;
  updSp();
}
$('#spPre').oninput=()=>{$('#spPre').dataset.t=1};
function planSync(){
  if(!spSrc)return'Choose a PDF first.';
  const n=spSrc.n,m=$('#spMode').value,pre=safe($('#spPre').value||spSrc.name),rt=$('#spRange').value,pad=(k,t)=>String(k).padStart(String(t).length,'0');
  if(m==='extract'){const idx=rt.trim()?parsePages(rt,n):null;return idx?[{name:pre+'_extract.pdf',idx}]:'Enter the pages to extract, like 1-3, 7, 10-';}
  if(m==='delete'){
    const del=rt.trim()?parsePages(rt,n):null;if(!del)return'Enter the pages to delete, like 2, 5-6';
    const s=new Set(del),idx=[...Array(n).keys()].filter(k=>!s.has(k));
    return idx.length?[{name:pre+'_edited.pdf',idx}]:'That would remove every page.';
  }
  if(m==='ranges'){
    const parts=rt.split(/[;,]+/).map(x=>x.trim()).filter(Boolean);if(!parts.length)return'Enter ranges like 1-3, 4-6, 7-';
    const files=[];for(const p of parts){const idx=parsePages(p,n);if(!idx)return'Invalid range: '+p;files.push({name:pre+'_'+safe(p)+'.pdf',idx})}
    return files;
  }
  if(m==='every'){
    const k=Math.max(1,parseInt($('#spN').value)||1),total=Math.ceil(n/k),files=[];
    for(let c=0;c<total;c++){const idx=[];for(let q=c*k;q<Math.min(n,c*k+k);q++)idx.push(q);files.push({name:pre+'_part'+pad(c+1,total)+'.pdf',idx})}
    return files;
  }
  if(m==='single')return[...Array(n).keys()].map(k=>({name:pre+'_page'+pad(k+1,n)+'.pdf',idx:[k]}));
  return'marks';
}
async function outlineStarts(src){
  const own=src.kind!=='doc',pj=own?await pdfjsLib.getDocument({data:new Uint8Array(src.buf.slice(0))}).promise:doc;
  const res=[];
  try{
    const o=await pj.getOutline();
    for(const it of o||[]){
      try{
        let d=it.dest;if(typeof d==='string')d=await pj.getDestination(d);if(!Array.isArray(d))continue;
        const ref=d[0],i=(ref&&typeof ref==='object')?await pj.getPageIndex(ref):ref;
        if(i!=null&&i>=0&&i<src.n)res.push({i,t:it.title||'section'});
      }catch(e){}
    }
  }finally{if(own)pj.destroy()}
  res.sort((a,b)=>a.i-b.i);
  return res.filter((r,k)=>k===0||r.i!==res[k-1].i);
}
async function plan(){
  const p=planSync();if(p!=='marks')return p;
  const st=await outlineStarts(spSrc);if(!st.length)return'This PDF has no bookmarks to split by.';
  if(st[0].i>0)st.unshift({i:0,t:'Start'});
  const n=spSrc.n,pre=safe($('#spPre').value||spSrc.name);
  return st.map((s,k)=>{const end=k+1<st.length?st[k+1].i-1:n-1,idx=[];for(let q=s.i;q<=end;q++)idx.push(q);return{name:pre+'_'+String(k+1).padStart(2,'0')+'_'+safe(s.t).slice(0,40)+'.pdf',idx}});
}
function updSp(){
  if(mgTab!=='split')return;
  const m=$('#spMode').value;
  $('#spRangeRow').hidden=!['extract','ranges','delete'].includes(m);$('#spNRow').hidden=m!=='every';
  $('#spRangeLbl').textContent=m==='ranges'?'Ranges (one file each)':m==='delete'?'Pages to delete':'Pages to extract';
  $('#spRange').placeholder=m==='ranges'?'e.g. 1-3, 4-6, 7-':m==='delete'?'e.g. 2, 5-6':'e.g. 1-3, 7, 10-';
  const p=planSync(),sum=$('#mgSum');
  if(typeof p==='string')sum.textContent=p==='marks'?'Creates one file for each top-level bookmark.':p;
  else{const t=p.reduce((a,f)=>a+f.idx.length,0);sum.textContent=(p.length===1?'1 file':p.length+' files (ZIP)')+' - '+fmt(t)+' in total'}
  $('#mgGo').disabled=!spSrc;
}
async function doSplit(){
  if(!window.PDFLib){toast('The PDF editor could not load. Check your connection.');return}
  $('#mgGo').disabled=true;
  try{
    const L=PDFLib,pl=await plan();if(typeof pl==='string'){toast(pl);return}
    const src=spSrc.kind==='doc'?($('#spAnn').checked?await annotatedDoc():await L.PDFDocument.load(await srcFile.arrayBuffer(),{ignoreEncryption:true})):spSrc.pd;
    const rot=+$('#spRot').value,rev=$('#spRev').checked,files=[],seen={};
    for(const [k,o] of pl.entries()){
      toast('Creating file '+(k+1)+' of '+pl.length+'...');
      const out=await L.PDFDocument.create(),idx=rev?o.idx.slice().reverse():o.idx,pages=await out.copyPages(src,idx);
      for(const p of pages){if(rot)p.setRotation(L.degrees((p.getRotation().angle+rot)%360));out.addPage(p)}
      out.setProducer('Leaf PDF');
      let name=o.name;if(seen[name]){seen[name]++;name=name.replace(/\.pdf$/i,'_'+seen[name]+'.pdf')}else seen[name]=1;
      files.push({name,bytes:await out.save()});
      if(k%5===4)await new Promise(r=>setTimeout(r));
    }
    await deliver(files,$('#spOpen').checked,safe($('#spPre').value||spSrc.name)+'_split',$('#spCloud').checked);
  }catch(e){toast('Could not split this PDF')}finally{$('#mgGo').disabled=!spSrc}
}

/* --- dialog --- */
let mgTab='merge';
function setMgTab(t){
  mgTab=t;document.querySelectorAll('#mg .tab').forEach(b=>b.classList.toggle('on',b.dataset.m===t));
  $('#m-merge').hidden=t!=='merge';$('#m-split').hidden=t!=='split';
  $('#mgGo').textContent=t==='merge'?'Merge and download':'Split and download';
  if(t==='merge')updMg();else updSp();
}
function openMg(t){
  if(!window.PDFLib){toast('The PDF editor could not load. Check your connection.');return}
  mItems=mItems.filter(i=>i.kind!=='doc'||i.ref===doc);
  if(doc&&lastAutoDoc!==doc){mItems.unshift(docItem());lastAutoDoc=doc}
  if(spSrc&&spSrc.kind==='doc'&&spSrc.ref!==doc)spSrc=null;
  if(!spSrc&&doc){$('#spPre').dataset.t='';setSpSrc({kind:'doc',name:srcName,n:doc.numPages,ref:doc})}
  else setSpSrc(spSrc);
  mgEl.classList.add('on');renderMerge();setMgTab(t);
}
const closeMg=()=>mgEl.classList.remove('on');
document.querySelectorAll('#mg .tab').forEach(b=>b.onclick=()=>setMgTab(b.dataset.m));
$('#bMerge').onclick=()=>openMg('merge');$('#bSplit').onclick=()=>openMg('split');
$('#mgX').onclick=$('#mgCancel').onclick=closeMg;
$('#mgGo').onclick=()=>mgTab==='merge'?doMerge():doSplit();
mgEl.addEventListener('pointerdown',e=>{if(e.target===mgEl)closeMg()});
const mgFile=Object.assign(document.createElement('input'),{type:'file',accept:'application/pdf,.pdf',multiple:true});
mgFile.onchange=()=>{addFiles([...mgFile.files]);mgFile.value=''};
$('#mgAdd').onclick=()=>mgFile.click();
$('#mgAddCur').onclick=()=>{if(doc){mItems.unshift(docItem());renderMerge()}};
$('#spPick').onclick=()=>$('#spFile').click();
$('#spFile').onchange=async e=>{
  const f=e.target.files[0];e.target.value='';if(!f||!isPdf(f))return;
  try{const r=await readPdf(f);$('#spPre').dataset.t='';setSpSrc({kind:'file',name:r.name,n:r.n,buf:r.buf,pd:r.pd})}catch(x){toast('Could not read that PDF')}
};
$('#spDoc').onclick=()=>{if(doc){$('#spPre').dataset.t='';setSpSrc({kind:'doc',name:srcName,n:doc.numPages,ref:doc})}};
['#spMode','#spRange','#spN','#spRot'].forEach(q=>{$(q).oninput=updSp;$(q).onchange=updSp});
['dragover','dragenter'].forEach(ev=>mgEl.addEventListener(ev,e=>{e.preventDefault();e.stopPropagation();mgEl.classList.add('drag')}));
mgEl.addEventListener('dragleave',e=>{if(!mgEl.contains(e.relatedTarget))mgEl.classList.remove('drag')});
mgEl.addEventListener('drop',async e=>{
  e.preventDefault();e.stopPropagation();mgEl.classList.remove('drag');
  const fs=[...e.dataTransfer.files].filter(isPdf);if(!fs.length)return;
  if(mgTab==='split'){try{const r=await readPdf(fs[0]);$('#spPre').dataset.t='';setSpSrc({kind:'file',name:r.name,n:r.n,buf:r.buf,pd:r.pd})}catch(x){toast('Could not read that PDF')}}
  else addFiles(fs);
});
addEventListener('keydown',e=>{if(e.key==='Escape')closeMg()});
