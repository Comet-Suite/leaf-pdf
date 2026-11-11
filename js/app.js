/* toolbar polish */
const bar=$('#bar'),ovf=()=>bar.classList.toggle('ovf',bar.scrollWidth>bar.clientWidth+1);
new ResizeObserver(ovf).observe(bar);new ResizeObserver(ovf).observe($('#dock'));
viewer.addEventListener('pointerdown',()=>{if(side.classList.contains('on')&&matchMedia('(max-width:700px)').matches){side.classList.remove('on');$('#bSide').classList.remove('on')}});

/* keyboard */
addEventListener('keydown',e=>{
  const c=e.ctrlKey||e.metaKey;
  if(c&&e.key.toLowerCase()==='f'){e.preventDefault();openSearch()}
  else if(c&&e.key.toLowerCase()==='o'){e.preventDefault();pick()}
  else if(c&&(e.key==='='||e.key==='+')){e.preventDefault();$('#zi').click()}
  else if(c&&e.key==='-'){e.preventDefault();$('#zo').click()}
  else if(c&&e.key==='0'){e.preventDefault();$('#bFit').click()}
  else if(e.key==='Escape'&&$('#sb').classList.contains('on'))closeSearch();
  else if(e.target===document.body||e.target===viewer){
    if(e.key==='ArrowRight')go(curPage+1);else if(e.key==='ArrowLeft')go(curPage-1);
    else if(e.key==='Home'&&P.length)go(0);else if(e.key==='End'&&P.length)go(P.length-1);
  }
});

/* open a PDF passed as ?src=<url> - used by the Leaf PDF Chrome extension to
   replace Chrome's built-in viewer; also handy for links. Skipped for the
   OAuth popup and for non-network schemes. */
(async()=>{
  const q=new URLSearchParams(location.search),src=q.get('src');
  if(!src||(q.get('state')||'').indexOf('leaf-')===0)return;
  if(!/^https?:|^file:|^blob:/.test(src))return;
  try{
    toast('Downloading the PDF...');
    const r=await fetch(src);
    if(!r.ok)throw new Error('HTTP '+r.status);
    const buf=await r.arrayBuffer();
    let name=src.split(/[?#]/)[0].split('/').pop()||'document';
    try{name=decodeURIComponent(name)}catch(e){}
    if(!/\.pdf$/i.test(name))name+='.pdf';
    $('#toast').classList.remove('on');
    await openBuf(buf,name.replace(/\.pdf$/i,''),new File([buf],name,{type:'application/pdf'}));
  }catch(e){console.error(e);toast('Could not open the PDF from that address');}
})();
