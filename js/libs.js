/* libraries: copies placed next to this file (lib/ or same folder) are used first so the viewer works offline, CDN as fallback */
const LEAF_LIBS=Promise.all([
 ['pdfjsLib','lib/pdf.min.js','pdf.min.js','https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'],
 ['PDFLib','lib/pdf-lib.min.js','pdf-lib.min.js','https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js'],
 ['JSZip','lib/jszip.min.js','jszip.min.js','https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js']
].map(([g,...srcs])=>(async()=>{
 if(window[g])return;
 for(const src of srcs){
  const ok=await new Promise(res=>{const s=document.createElement('script');s.src=src;s.onload=()=>res(!!window[g]);s.onerror=()=>res(false);document.head.append(s)});
  if(ok)return;
 }
 console.warn('Leaf PDF: '+g+' could not be loaded');
})()));
