/* ---------- cloud: settings, sign-in, open and save ---------- */
const isFile=location.protocol==='file:';
const FNAME=decodeURIComponent(location.pathname.split('/').pop()||'leaf-pdf-viewer.html');
const ORI=isFile?'http://localhost:8080':location.origin,RED=isFile?ORI+'/'+FNAME:location.origin+location.pathname;
let CFG={};try{CFG=JSON.parse(localStorage.getItem('leaf-cloud')||'{}')}catch(e){}
const saveCfg=()=>{try{localStorage.setItem('leaf-cloud',JSON.stringify(CFG))}catch(e){toast('Could not store the settings on this device')}};
const tok={},SC={};
const loadScript=src=>SC[src]||(SC[src]=new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.async=true;s.onload=res;s.onerror=()=>{delete SC[src];rej(new Error('Could not load '+src))};document.head.append(s)}));
const preloadG=()=>{if((CFG.gdrive||{}).clientId){loadScript('https://accounts.google.com/gsi/client').catch(()=>{});loadScript('https://apis.google.com/js/api.js').catch(()=>{})}};
const b64u=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const hdrJson=o=>JSON.stringify(o).replace(/[\u007f-\uffff]/g,c=>'\\u'+('0000'+c.charCodeAt(0).toString(16)).slice(-4));

/* OAuth 2.0 authorization code + PKCE in a popup */
async function oauthCode(o){
  const w=window.open('about:blank','leafauth','width=520,height=700');
  if(!w)throw new Error('The sign-in window was blocked. Allow pop-ups for this page and try again.');
  try{
    const v=b64u(crypto.getRandomValues(new Uint8Array(32))),ch=b64u(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)));
    const state='leaf-'+b64u(crypto.getRandomValues(new Uint8Array(12))),redir=location.origin+location.pathname;
    const q=new URLSearchParams({response_type:'code',client_id:o.clientId,redirect_uri:redir,state,code_challenge:ch,code_challenge_method:'S256',...(o.params||{})});
    w.location.href=o.authUrl+'?'+q;
    const r=await new Promise((res,rej)=>{
      const h=e=>{if(e.origin!==location.origin||!e.data||!e.data.leafAuth)return;removeEventListener('message',h);clearInterval(iv);res(new URLSearchParams(e.data.q))};
      addEventListener('message',h);
      const iv=setInterval(()=>{if(w.closed){clearInterval(iv);removeEventListener('message',h);rej(new Error('The sign-in window was closed.'))}},500);
    });
    if(r.get('error'))throw new Error(r.get('error_description')||r.get('error'));
    if(r.get('state')!==state)throw new Error('Sign-in could not be verified. Try again.');
    const tr=await fetch(o.tokenUrl,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',code:r.get('code'),client_id:o.clientId,redirect_uri:redir,code_verifier:v,...(o.body||{})})});
    const j=await tr.json().catch(()=>({}));
    if(!tr.ok||!j.access_token)throw new Error(j.error_description||j.error||'The token request failed ('+tr.status+')');
    return{token:j.access_token,exp:Date.now()+(j.expires_in||3600)*1000-60000};
  }finally{try{w.close()}catch(e){}}
}

/* providers */
const GUIDE_SERVER='<b>Before you start:</b> sign-in only works from a web address, not from a file. Run <code>python -m http.server 8080</code> in the folder that holds this file and open <code>{O}/{F}</code>, or host the file on any HTTPS site.';
const PV={
  gdrive:{name:'Google Drive',letter:'G',color:'#1a73e8',where:'My Drive',
    fields:[['clientId','OAuth Client ID','1234567890-abc.apps.googleusercontent.com'],['apiKey','API key','AIza...'],['appId','Project number (optional)','123456789012'],['token','Access token (optional, quick test)','ya29...',1]],
    need:c=>c.apiKey&&(c.clientId||c.token),
    guide:['Open <a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noopener">Google Cloud Console &rarr; New project</a>, name it <b>Leaf PDF</b> and press <b>Create</b>.',
      'Open <a href="https://console.cloud.google.com/apis/library/drive.googleapis.com" target="_blank" rel="noopener">Google Drive API</a> and press <b>Enable</b>. Then open <a href="https://console.cloud.google.com/apis/library/picker.googleapis.com" target="_blank" rel="noopener">Google Picker API</a> and press <b>Enable</b>.',
      'Go to <b>APIs &amp; Services &rarr; OAuth consent screen</b> (also called <b>Google Auth Platform</b>). Choose <b>External</b>, enter an app name and your email, and save. Under <b>Audience</b> add your own Google account as a <b>Test user</b>.',
      'Open <b>Data Access</b> (Scopes), add the scope <code>https://www.googleapis.com/auth/drive.file</code> and save. This scope only lets Leaf see files you pick or create, so Google does not need to verify the app.',
      'Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener">Credentials</a> &rarr; <b>Create credentials &rarr; OAuth client ID</b> &rarr; type <b>Web application</b>. Under <b>Authorized JavaScript origins</b> add <code>{O}</code>. Create it and copy the <b>Client ID</b>.',
      'Press <b>Create credentials &rarr; API key</b> and copy the key. Recommended: restrict it to the <b>Google Picker API</b>.',
      'Optional: copy the <b>Project number</b> from the project Dashboard into the box above.',
      'Paste the Client ID and API key above, press <b>Save</b>, then <b>Connect</b>.']},
  onedrive:{name:'Microsoft OneDrive',letter:'O',color:'#0078d4',where:'OneDrive / Leaf PDF',
    fields:[['clientId','Application (client) ID','00000000-0000-0000-0000-000000000000'],['tenant','Tenant (optional, default "common")','common'],['token','Access token (optional, quick test)','eyJ0...',1]],
    need:c=>c.clientId||c.token,
    guide:['Open <a href="https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" target="_blank" rel="noopener">Microsoft Entra &rarr; App registrations</a> (or the Azure portal) and press <b>New registration</b>.',
      'Name it <b>Leaf PDF</b>. For <b>Supported account types</b> choose <b>Accounts in any organizational directory and personal Microsoft accounts</b> (needed for a personal OneDrive).',
      'Under <b>Redirect URI</b> choose the platform <b>Single-page application (SPA)</b> and enter <code>{R}</code>. Press <b>Register</b>.',
      'Copy the <b>Application (client) ID</b> from the Overview page.',
      'Open <b>API permissions &rarr; Add a permission &rarr; Microsoft Graph &rarr; Delegated permissions</b> and add <code>Files.ReadWrite</code> and <code>User.Read</code>. Work or school accounts may need an admin to approve them.',
      'No client secret is needed. Paste the Client ID above, press <b>Save</b>, then <b>Connect</b>.']},
  box:{name:'Box',letter:'b',color:'#0061d5',where:'Box (top-level folder)',
    fields:[['clientId','Client ID','abcd1234...'],['clientSecret','Client Secret','',1],['token','Developer token (optional, quick test)','',1]],
    need:c=>c.clientId||c.token,
    guide:['Open the <a href="https://app.box.com/developers/console" target="_blank" rel="noopener">Box Developer Console</a>, press <b>Create New App</b>, choose <b>Custom App</b>, then <b>User Authentication (OAuth 2.0)</b>.',
      'Open the app&#39;s <b>Configuration</b> tab. Under <b>OAuth 2.0 Redirect URI</b> add <code>{R}</code>.',
      'Under <b>Application Scopes</b> tick <b>Read all files and folders</b> and <b>Write all files and folders</b>.',
      'Under <b>CORS Domains</b> add <code>{O}</code>. Browser requests are blocked without this. Save the changes.',
      'Copy the <b>Client ID</b> and <b>Client Secret</b>. The secret is stored only in this browser, so use it for personal use only.',
      'Quick test: <b>Configuration &rarr; Developer Token &rarr; Generate</b> gives a token that works for 60 minutes. Paste it into the token box instead.',
      'Paste your keys above, press <b>Save</b>, then <b>Connect</b>. Company accounts may need an admin to authorize the app.']},
  dropbox:{name:'Dropbox',letter:'D',color:'#0061ff',where:'Dropbox / Leaf PDF',
    fields:[['appKey','App key','abcd1234efgh5678'],['token','Access token (optional, quick test)','sl.B...',1]],
    need:c=>c.appKey||c.token,
    guide:['Open the <a href="https://www.dropbox.com/developers/apps/create" target="_blank" rel="noopener">Dropbox App Console</a>, press <b>Create app</b>, choose <b>Scoped access</b>, then <b>Full Dropbox</b> (or <b>App folder</b>), and name it.',
      'Open the <b>Permissions</b> tab, tick <code>files.metadata.read</code>, <code>files.content.read</code> and <code>files.content.write</code>, then press <b>Submit</b>.',
      'Open the <b>Settings</b> tab. Under <b>Redirect URIs</b> add <code>{R}</code> and press <b>Add</b>.',
      'Copy the <b>App key</b>. No secret is needed.',
      'Quick test: on the Settings tab press <b>Generate</b> under <b>Generated access token</b> and paste it into the token box.',
      'Paste the App key above, press <b>Save</b>, then <b>Connect</b>.']}
};
const isReady=p=>!!PV[p].need(CFG[p]||{});
const readyProvs=()=>Object.keys(PV).filter(isReady);
const hasTok=p=>!!((CFG[p]||{}).token||(tok[p]&&tok[p].exp>Date.now()));

PV.gdrive.signIn=async c=>{
  await loadScript('https://accounts.google.com/gsi/client');
  return new Promise((res,rej)=>{
    const tc=google.accounts.oauth2.initTokenClient({client_id:c.clientId,scope:'https://www.googleapis.com/auth/drive.file',
      callback:r=>r.error?rej(new Error(r.error_description||r.error)):res({token:r.access_token,exp:Date.now()+(r.expires_in||3600)*1000-60000}),
      error_callback:e=>rej(new Error('Google sign-in: '+(e.type||'blocked')))});
    tc.requestAccessToken({prompt:''});
  });
};
PV.onedrive.signIn=c=>{const t='https://login.microsoftonline.com/'+(c.tenant||'common')+'/oauth2/v2.0/';return oauthCode({authUrl:t+'authorize',tokenUrl:t+'token',clientId:c.clientId,params:{scope:'Files.ReadWrite User.Read',prompt:'select_account'}})};
PV.dropbox.signIn=c=>oauthCode({authUrl:'https://www.dropbox.com/oauth2/authorize',tokenUrl:'https://api.dropboxapi.com/oauth2/token',clientId:c.appKey,params:{token_access_type:'online'}});
PV.box.signIn=c=>oauthCode({authUrl:'https://account.box.com/api/oauth2/authorize',tokenUrl:'https://api.box.com/oauth2/token',clientId:c.clientId,body:c.clientSecret?{client_secret:c.clientSecret}:{}});

async function getToken(p){
  const c=CFG[p]||{};
  if(c.token)return c.token;
  const t=tok[p];if(t&&t.exp>Date.now())return t.t;
  if(isFile)throw new Error('Sign-in needs http://localhost or https. Open Settings > Cloud for the steps, or paste an access token.');
  const r=await PV[p].signIn(c);tok[p]={t:r.token,exp:r.exp};return r.token;
}
async function api(p,url,opt={}){
  const t=await getToken(p),r=await fetch(url,{...opt,headers:{Authorization:'Bearer '+t,...(opt.headers||{})}});
  if(!r.ok){
    let m=r.statusText;try{const j=await r.clone().json();m=j.error_description||(j.error&&(j.error.message||(typeof j.error==='string'?j.error:j.error_summary)))||j.message||j.error_summary||m}catch(e){}
    if(r.status===401)delete tok[p];
    throw new Error(PV[p].name+': '+r.status+' '+m);
  }
  return r;
}
const jpost=(p,url,body)=>api(p,url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json());

/* Google Drive: Picker to open, multipart upload to save */
PV.gdrive.pick=async()=>{
  const c=CFG.gdrive,t=await getToken('gdrive');
  await loadScript('https://apis.google.com/js/api.js');await new Promise(r=>gapi.load('picker',r));
  return new Promise(res=>{
    const v=new google.picker.DocsView(google.picker.ViewId.DOCS).setMimeTypes('application/pdf').setIncludeFolders(true);
    const b=new google.picker.PickerBuilder().addView(v).addView(new google.picker.DocsUploadView()).setOAuthToken(t).setDeveloperKey(c.apiKey).setCallback(d=>{if(d.action==='picked')res(d.docs[0]);else if(d.action==='cancel')res(null)});
    if(c.appId)b.setAppId(c.appId);
    b.build().setVisible(true);
  });
};
PV.gdrive.get=async d=>(await api('gdrive','https://www.googleapis.com/drive/v3/files/'+d.id+'?alt=media&supportsAllDrives=true')).arrayBuffer();
PV.gdrive.put=async(name,blob)=>{
  const fd=new FormData();fd.append('metadata',new Blob([JSON.stringify({name,mimeType:blob.type||'application/pdf'})],{type:'application/json'}));fd.append('file',blob);
  const j=await(await api('gdrive','https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',{method:'POST',body:fd})).json();
  return{link:j.webViewLink,where:PV.gdrive.where};
};
/* OneDrive (Microsoft Graph) */
PV.onedrive.list=async id=>{
  let url='https://graph.microsoft.com/v1.0/me/drive/'+(id?'items/'+id:'root')+'/children?$select=id,name,size,folder&$top=200';const out=[];
  for(let n=0;url&&n<10;n++){const j=await(await api('onedrive',url)).json();out.push(...j.value.map(i=>({id:i.id,name:i.name,folder:!!i.folder,size:i.size})));url=j['@odata.nextLink']}
  return out;
};
PV.onedrive.get=async it=>(await api('onedrive','https://graph.microsoft.com/v1.0/me/drive/items/'+it.id+'/content')).arrayBuffer();
PV.onedrive.put=async(name,blob)=>{
  const j=await(await api('onedrive','https://graph.microsoft.com/v1.0/me/drive/root:/'+encodeURIComponent('Leaf PDF')+'/'+encodeURIComponent(name)+':/content?@microsoft.graph.conflictBehavior=rename',{method:'PUT',headers:{'Content-Type':blob.type||'application/octet-stream'},body:blob})).json();
  return{link:j.webUrl,where:PV.onedrive.where};
};
/* Box */
PV.box.list=async id=>{
  const out=[];
  for(let off=0,n=0;n<10;n++){
    const j=await(await api('box','https://api.box.com/2.0/folders/'+(id||'0')+'/items?fields=id,name,type,size&limit=500&offset='+off)).json();
    out.push(...j.entries.filter(e=>e.type==='folder'||e.type==='file').map(e=>({id:e.id,name:e.name,folder:e.type==='folder',size:e.size})));
    off+=j.entries.length;if(!j.entries.length||off>=j.total_count)break;
  }
  return out;
};
PV.box.get=async it=>(await api('box','https://api.box.com/2.0/files/'+it.id+'/content')).arrayBuffer();
PV.box.put=async(name,blob)=>{
  const send=async nm=>{const fd=new FormData();fd.append('attributes',JSON.stringify({name:nm,parent:{id:'0'}}));fd.append('file',blob,nm);return api('box','https://upload.box.com/api/2.0/files/content',{method:'POST',body:fd})};
  let r;try{r=await send(name)}catch(e){if(/\b409\b/.test(e.message))r=await send(name.replace(/(\.[^.]+)?$/,' '+new Date().toISOString().slice(0,16).replace(/[:T]/g,'-')+'$1'));else throw e}
  const j=await r.json();return{link:j.entries&&j.entries[0]?'https://app.box.com/file/'+j.entries[0].id:'',where:PV.box.where};
};
/* Dropbox */
PV.dropbox.list=async id=>{
  let r=await jpost('dropbox','https://api.dropboxapi.com/2/files/list_folder',{path:id||'',limit:1000});const out=[];
  for(let n=0;;n++){
    out.push(...r.entries.map(e=>({id:e.path_lower,name:e.name,folder:e['.tag']==='folder',size:e.size})));
    if(!r.has_more||n>8)break;r=await jpost('dropbox','https://api.dropboxapi.com/2/files/list_folder/continue',{cursor:r.cursor});
  }
  return out;
};
PV.dropbox.get=async it=>(await api('dropbox','https://content.dropboxapi.com/2/files/download',{method:'POST',headers:{'Dropbox-API-Arg':hdrJson({path:it.id})}})).arrayBuffer();
PV.dropbox.put=async(name,blob)=>{
  const j=await(await api('dropbox','https://content.dropboxapi.com/2/files/upload',{method:'POST',headers:{'Dropbox-API-Arg':hdrJson({path:'/Leaf PDF/'+name,mode:'add',autorename:true}),'Content-Type':'application/octet-stream'},body:blob})).json();
  return{link:'',where:PV.dropbox.where+(j.path_display?' ('+j.path_display+')':'')};
};

/* --- settings window --- */
const stEl=$('#st');
function pill(p){const el=document.createElement('span');el.className='pill'+(hasTok(p)?' ok':isReady(p)?' rd':'');el.textContent=hasTok(p)?'Connected':isReady(p)?'Ready':'Not set up';return el}
function copyBtn(v){const b=document.createElement('button');b.textContent='Copy';b.onclick=()=>{(navigator.clipboard?navigator.clipboard.writeText(v):Promise.reject()).then(()=>toast('Copied'),()=>toast('Press Ctrl+C to copy'))};return b}
function renderGeneral(el){
  const th=document.documentElement.dataset.theme;
  el.innerHTML='<div class="stsec"><h3>General</h3><p>Look and local data.</p><div class="stgrid"><button class="stbtn" data-th="dark">Dark theme</button><button class="stbtn" data-th="light">Light theme</button></div><p>Your annotations, bookmarks, reading positions, cloud keys and settings are stored only in this browser.</p><button class="stbtn" id="stClear">Clear saved reading data</button></div>';
  el.querySelectorAll('[data-th]').forEach(b=>{if(b.dataset.th===th)b.classList.add('pr');b.onclick=()=>{applyTheme(b.dataset.th);try{localStorage.setItem('leaf-theme',b.dataset.th)}catch(e){}renderGeneral(el)}});
  $('#stClear').onclick=()=>{
    if(!confirm('Remove all saved annotations, bookmarks and reading positions from this browser? Cloud keys are kept.'))return;
    try{Object.keys(localStorage).filter(k=>/^leaf-(ann|bm|pos):|^leaf-last$/.test(k)).forEach(k=>localStorage.removeItem(k))}catch(e){}
    toast('Saved reading data cleared');
  };
}
function renderCloud(el,open){
  el.textContent='';
  const sec=document.createElement('div');sec.className='stsec';
  sec.innerHTML='<h3>Cloud</h3><p>Connect your cloud storage to open PDFs from it and save copies back. Your keys never leave this browser, and nothing is sent anywhere except the cloud service you choose.</p>';
  const env=document.createElement('div');env.className='stenv'+(isFile?' warn':'');
  env.innerHTML=(isFile?'<b>You opened Leaf PDF as a file.</b> Google, Microsoft, Box and Dropbox do not accept a file as a sign-in address. Run <code>python -m http.server 8080</code> in the folder that holds <code>'+esc(FNAME)+'</code> and open <code>'+esc(ORI+'/'+FNAME)+'</code>, or host the file on any HTTPS site. Until then you can still test with a pasted access token.':'<b>Your sign-in address.</b> Use these exact values when you register the app with each service.')
    +'<div class="cpy"><span>Origin</span><code>'+esc(ORI)+'</code></div><div class="cpy"><span>Redirect URI</span><code>'+esc(RED)+'</code></div>';
  env.querySelectorAll('.cpy').forEach((r,k)=>r.append(copyBtn(k?RED:ORI)));
  sec.append(env);
  for(const p of Object.keys(PV)){
    const P=PV[p],c=CFG[p]||{},d=document.createElement('details');d.className='pvc';if(open===p)d.open=true;
    const sm=document.createElement('summary');sm.innerHTML='<span class="pv"></span><span class="pvn"></span>';sm.firstChild.style.background=P.color;sm.firstChild.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#pi-'+p+'"/></svg>';sm.children[1].textContent=P.name;sm.append(pill(p));d.append(sm);
    const b=document.createElement('div');b.className='pvb';
    for(const [k,l,ph,sec2] of P.fields){
      const lb=document.createElement('label');lb.textContent=l;const i=document.createElement('input');i.type=sec2?'password':'text';i.placeholder=ph;i.value=c[k]||'';i.dataset.k=k;i.autocomplete='off';i.spellcheck=false;lb.append(i);b.append(lb);
    }
    const act=document.createElement('div');act.className='pvact';
    const sv=document.createElement('button');sv.className='stbtn pr';sv.textContent='Save';
    const cn=document.createElement('button');cn.className='stbtn';cn.textContent=hasTok(p)?'Reconnect':'Connect';
    const rm=document.createElement('button');rm.className='stbtn';rm.textContent='Remove keys';
    const collect=()=>{const o={};b.querySelectorAll('input').forEach(i=>{if(i.value.trim())o[i.dataset.k]=i.value.trim()});CFG[p]=o;delete tok[p];saveCfg();preloadG()};
    sv.onclick=()=>{collect();toast(P.name+' settings saved');sm.lastChild.replaceWith(pill(p))};
    cn.onclick=async()=>{
      collect();if(!isReady(p)){toast('Fill in the required keys first');return}
      cn.disabled=true;
      try{await getToken(p);toast('Connected to '+P.name)}catch(e){toast(e.message)}
      cn.disabled=false;cn.textContent='Reconnect';sm.lastChild.replaceWith(pill(p));
    };
    rm.onclick=()=>{delete CFG[p];delete tok[p];saveCfg();toast(P.name+' keys removed');renderCloud(el,p)};
    act.append(sv,cn,rm);b.append(act);
    const g=document.createElement('details');g.className='guide';
    g.innerHTML='<summary>How to get your keys</summary><p style="margin:10px 0 0;font-size:13px;line-height:1.55">'+GUIDE_SERVER.replace(/\{O\}/g,esc(ORI)).replace(/\{F\}/g,esc(FNAME))+'</p><ol></ol>';
    g.querySelector('ol').innerHTML=P.guide.map(x=>'<li>'+x.replace(/\{O\}/g,esc(ORI)).replace(/\{R\}/g,esc(RED))+'</li>').join('');
    b.append(g);d.append(b);sec.append(d);
  }
  el.append(sec);
}
function setStTab(t,open){
  document.querySelectorAll('#st .sti').forEach(b=>b.classList.toggle('on',b.dataset.s===t));
  const el=$('#stMain');t==='cloud'?renderCloud(el,open):renderGeneral(el);
}
function openSt(t,open){stEl.classList.add('on');setStTab(t||'general',open);preloadG()}
const closeSt=()=>stEl.classList.remove('on');
document.querySelectorAll('#st .sti').forEach(b=>b.onclick=()=>setStTab(b.dataset.s));
$('#stX').onclick=closeSt;stEl.addEventListener('pointerdown',e=>{if(e.target===stEl)closeSt()});
$('#bSettings').onclick=()=>openSt('general');

/* --- open from / save to cloud --- */
const clEl=$('#cl');let cl={mode:'open',prov:null,stack:[],blob:null,name:''},clTok=0;
const kb=n=>n>=1048576?(n/1048576).toFixed(1)+' MB':n>=1024?Math.round(n/1024)+' KB':(n||0)+' B';
function openCl(mode,pre){
  cl={mode,prov:null,stack:[],blob:pre?pre.blob:null,name:pre?pre.name:(srcName||'document')+'-annotated.pdf'};
  clEl.classList.add('on');preloadG();renderCl();
}
const closeCl=()=>{clEl.classList.remove('on');clTok++};
function clFail(e){const m=(e&&e.message)||'Something went wrong';toast(m);return m}
function renderCl(){
  const rp=readyProvs();if(!cl.prov||!isReady(cl.prov))cl.prov=rp[0]||null;
  document.querySelectorAll('#cl .tab').forEach(b=>b.classList.toggle('on',b.dataset.c===cl.mode));
  const pr=$('#clProv');pr.textContent='';
  for(const p of Object.keys(PV)){
    const ok=isReady(p),b=document.createElement('button');b.className='chipp'+(cl.prov===p?' on':'')+(ok?'':' off');
    b.innerHTML='<span class="pv"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#pi-'+p+'"/></svg></span><span></span>';b.firstChild.style.background=PV[p].color;b.lastChild.textContent=PV[p].name;b.title=ok?'':'Not set up yet - tap to set it up';
    b.onclick=()=>{if(!ok){closeCl();openSt('cloud',p);return}cl.prov=p;cl.stack=[];renderCl()};pr.append(b);
  }
  const body=$('#clBody'),crumb=$('#clCrumb'),go=$('#clGo');body.textContent='';crumb.textContent='';go.hidden=!(cl.mode==='save'&&(cl.blob||doc));
  if(!cl.prov){body.innerHTML='<div class="clmsg">No cloud account is set up yet.<br>Add your keys in Settings to connect Google Drive, OneDrive, Box or Dropbox.<br><br><button class="pri caps" id="clSet">Open Settings</button></div>';go.hidden=true;$('#clSet').onclick=()=>{closeCl();openSt('cloud')};return}
  const p=cl.prov;
  if(cl.mode==='save'){
    if(!cl.blob&&!doc){body.innerHTML='<div class="clmsg">Open a PDF first, then come back to this tab to save a copy to the cloud.</div>';go.hidden=true;return}
    body.innerHTML='<div class="clsave"><label>File name<input id="clName" autocomplete="off"></label>'+(cl.blob?'':'<label class="ck"><input type="checkbox" id="clAnn" checked><span>Include my annotations</span></label>')+'<p class="mgtip">Saved to <b>'+esc(PV[p].where)+'</b>.'+(p==='gdrive'?' Google only lets Leaf see files it creates or that you pick.':'')+'</p><div id="clRes"></div></div>';
    $('#clName').value=cl.name;return;
  }
  if(p==='gdrive'){
    body.innerHTML='<div class="clmsg">Google Drive opens its own file picker.<br><br><button class="pri caps" id="clPick">Choose from Google Drive</button></div>';
    $('#clPick').onclick=async()=>{try{const d=await PV.gdrive.pick();if(d){toast('Downloading...');await openCloudBuf(d.name,await PV.gdrive.get(d))}}catch(e){clFail(e)}};
    return;
  }
  loadList();
}
async function loadList(){
  const my=++clTok,p=cl.prov,body=$('#clBody'),crumb=$('#clCrumb');
  crumb.textContent='';
  const root=document.createElement('button');root.textContent='All files';root.onclick=()=>{cl.stack=[];loadList()};crumb.append(root);
  cl.stack.forEach((s,i)=>{crumb.append(' / ');const b=document.createElement('button');b.textContent=s.name;b.onclick=()=>{cl.stack=cl.stack.slice(0,i+1);loadList()};crumb.append(b)});
  body.innerHTML='<div class="clmsg">Loading...</div>';
  try{
    const items=(await PV[p].list(cl.stack.length?cl.stack[cl.stack.length-1].id:'')).filter(i=>i.folder||/\.pdf$/i.test(i.name)).sort((a,b)=>(b.folder-a.folder)||a.name.localeCompare(b.name));
    if(my!==clTok)return;
    body.textContent='';
    if(!items.length){body.innerHTML='<div class="clmsg">No folders or PDF files here.</div>';return}
    for(const it of items){
      const b=document.createElement('button');b.className='cli'+(it.folder?' f':'');
      b.innerHTML='<svg viewBox="0 0 24 24"><use href="#i-'+(it.folder?'folder':'doc')+'"/></svg><span></span><small></small>';
      b.children[1].textContent=it.name;b.lastChild.textContent=it.folder?'':kb(it.size);
      b.onclick=async()=>{
        if(it.folder){cl.stack.push({id:it.id,name:it.name});loadList();return}
        try{toast('Downloading '+it.name+'...');await openCloudBuf(it.name,await PV[p].get(it))}catch(e){clFail(e)}
      };
      body.append(b);
    }
  }catch(e){
    if(my!==clTok)return;
    body.innerHTML='<div class="clmsg"></div>';body.firstChild.textContent=clFail(e);
    const r=document.createElement('button');r.className='stbtn';r.textContent='Try again';r.onclick=loadList;body.firstChild.append(document.createElement('br'),document.createElement('br'),r);
  }
}
async function openCloudBuf(name,buf){
  const f=new File([buf.slice(0)],name,{type:'application/pdf'});
  closeCl();await openBuf(buf,name.replace(/\.pdf$/i,''),f);
}
async function clUpload(){
  const p=cl.prov;if(!p)return;
  let nm=safe($('#clName').value||'document.pdf');if(!/\.(pdf|zip)$/i.test(nm))nm+='.pdf';
  const go=$('#clGo');go.disabled=true;
  try{
    let blob=cl.blob;
    if(!blob){
      if(!window.PDFLib)throw new Error('The PDF editor could not load. Check your connection.');
      blob=$('#clAnn')&&$('#clAnn').checked?new Blob([await(await annotatedDoc()).save()],{type:'application/pdf'}):new Blob([await srcFile.arrayBuffer()],{type:'application/pdf'});
    }
    toast('Uploading to '+PV[p].name+'...');
    const r=await PV[p].put(nm,blob);
    $('#clRes').innerHTML='<p class="okm">Saved to '+esc(r.where)+(r.link?' - <a href="'+esc(r.link)+'" target="_blank" rel="noopener">Open</a>':'')+'</p>';
    toast('Uploaded to '+PV[p].name);
  }catch(e){clFail(e)}
  go.disabled=false;
}
$('#bCloud').onclick=()=>openCl('open');$('#eCloud').onclick=()=>openCl('open');
document.querySelectorAll('#cl .tab').forEach(b=>b.onclick=()=>{if(cl.mode!==b.dataset.c){cl.mode=b.dataset.c;renderCl()}});
$('#clX').onclick=$('#clCancel').onclick=closeCl;$('#clGo').onclick=clUpload;
clEl.addEventListener('pointerdown',e=>{if(e.target===clEl)closeCl()});
addEventListener('keydown',e=>{if(e.key==='Escape'){closeCl();closeSt()}});
