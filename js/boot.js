(function(){const q=new URLSearchParams(location.search),st=q.get('state')||'';if(window.opener&&st.indexOf('leaf-')===0){try{window.opener.postMessage({leafAuth:1,q:location.search},location.origin)}catch(e){}window.close()}})();
const CDN='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
const $=s=>document.querySelector(s);
function applyTheme(t){document.documentElement.dataset.theme=t;$('#bTheme span').textContent=t==='light'?'Dark mode':'Light mode';$('#bTheme use').setAttribute('href',t==='light'?'#i-moon':'#i-sun')}
{let t;try{t=localStorage.getItem('leaf-theme')}catch(e){}applyTheme(t||(matchMedia('(prefers-color-scheme:light)').matches?'light':'dark'))}
const viewer=$('#viewer'),pagesEl=$('#pages'),side=$('#side'),thEl=$('#sdTh'),pgIn=$('#pg'),qIn=$('#q');
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
let doc=null,P=[],scale=1,fit=true,base={w:612,h:792},curPage=-1;
let sq='',sres=[],si=-1,texts=[],stok=0,sdone=false;

function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('on'),2600)}
LEAF_LIBS.then(()=>{if(!window.pdfjsLib)toast('PDF library could not be loaded - check your connection and reload')});

/* pdf.js worker: verify a candidate exists, then use it. Same-origin files
   (http(s) pages or the Chrome extension's own pages) are handed to pdf.js
   directly - the extension CSP forbids blob: workers. Cross-origin CDN files
   go through a blob URL so a single-file page can still use them. Falling
   through every candidate leaves the CDN path for pdf.js to report. */
const WKS=['lib/pdf.worker.min.js','pdf.worker.min.js',CDN+'pdf.worker.min.js'];
const ready=(async()=>{
  await LEAF_LIBS;
  if(!window.pdfjsLib){toast('Could not load the PDF engine. Check your connection.');return}
  for(const src of WKS){
    try{
      const r=await fetch(src);
      if(!r.ok)throw 0;
      const u=new URL(r.url||src,location.href);
      const sameOrigin=/^https?:$|^chrome-extension:$/.test(u.protocol)&&u.origin===location.origin;
      pdfjsLib.GlobalWorkerOptions.workerSrc=sameOrigin?u.href:URL.createObjectURL(await r.blob());
      return;
    }
    catch(e){}
  }
  pdfjsLib.GlobalWorkerOptions.workerSrc=WKS[WKS.length-1];
})();

const dpr=()=>Math.min(window.devicePixelRatio||1,matchMedia('(pointer:coarse)').matches?2:2.5);
const fitScale=()=>clamp((viewer.clientWidth-28)/base.w,.2,1.75);
const size=p=>{p.el.style.width=p.w*scale+'px';p.el.style.height=p.h*scale+'px'};
