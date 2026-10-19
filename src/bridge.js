/* Additive cloud sidecar for the established v1.3.2 PWA UI. */
export const bridgeScript=String.raw`(()=>{'use strict';
let panel=null,reader=null;
const tags={'中文':'language:chinese$','日文':'language:japanese$','英文':'language:english$','全彩':'other:full_color$','黑白':'-other:full_color$'};
const categories={'同人志':2,'漫画':4,'画师CG':8,'游戏CG':16,'图集':32,'Cosplay':64,'亚洲影像':128,'非成人':256};
const st=document.createElement('style');st.textContent='.ehr-cloud{position:fixed;inset:0;z-index:90;background:var(--bg,#101016);color:var(--fg,#f6f4ff);overflow:auto;padding:calc(env(safe-area-inset-top) + 15px) 18px calc(env(safe-area-inset-bottom) + 24px);font-family:-apple-system,sans-serif}.ehr-cloud-head{position:sticky;top:0;background:var(--bg,#101016);display:flex;gap:12px;align-items:center;padding:8px 0 16px;z-index:2}.ehr-cloud-head h2{font-size:18px;flex:1}.ehr-cloud-back,.ehr-cloud-go{border:1px solid var(--stroke,#555);border-radius:12px;background:var(--panel,#222);color:inherit;min-height:48px;min-width:48px;padding:0 14px;font-size:14px}.ehr-cloud-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:14px 0;align-items:stretch}.ehr-cloud-card{width:100%;min-width:0;min-height:240px;display:flex;flex-direction:column;align-items:stretch;text-align:left;padding:0;margin:0;overflow:hidden;touch-action:manipulation;border:1px solid var(--stroke,#555);border-radius:17px;background:var(--panel,#222);color:inherit}.ehr-cloud-card img,.ehr-cloud-thumb-empty{display:block;width:100%;height:auto;aspect-ratio:3/4;object-fit:cover;background:#51437c}.ehr-cloud-thumb-empty{display:flex;align-items:center;justify-content:center;text-align:center;font-size:12px;color:#e2d4ff;padding:9px;box-sizing:border-box}.ehr-cloud-info{display:block;min-width:0;padding:10px}.ehr-cloud-card strong{font-size:13px;line-height:1.45;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden;overflow-wrap:anywhere}.ehr-cloud-card small{display:block;font-size:11px;color:var(--sub,#bbb);margin-top:7px}.ehr-cloud-hint{font-size:12px;line-height:1.7;color:var(--sub,#bbb)}.ehr-cloud-msg{padding:18px;background:var(--panel,#222);border:1px solid var(--stroke,#555);border-radius:15px;font-size:13px;line-height:1.7}.ehr-cloud-actions{display:flex;gap:8px;flex-wrap:wrap;margin:15px 0}.ehr-cloud-image{display:block;max-width:100%;height:auto;margin:12px auto;background:#252035}';st.textContent+=' .ehr-reader-toolbar{position:sticky;top:64px;z-index:3;display:flex;align-items:center;gap:8px;padding:8px 0 12px;background:var(--bg,#101016)}.ehr-reader-toolbar button{flex:1;min-height:46px;font-size:13px}.ehr-reader-toolbar button[aria-pressed=true]{background:#6b4cb8;border-color:#9b81e5;color:#fff}.ehr-reader-counter{font-size:12px;text-align:center;color:var(--sub,#bbb);padding:4px 0}.ehr-reader-stage{min-height:200px}.ehr-reader-paged{touch-action:pan-y;text-align:center;min-height:65vh;display:flex;flex-direction:column;justify-content:flex-start}.ehr-reader-paged img{display:block;max-width:100%;max-height:calc(100dvh - 210px);width:auto;height:auto;margin:0 auto;object-fit:contain}.ehr-reader-scroll{display:block}.ehr-reader-scroll .ehr-reader-slot{margin:0;padding:0;position:relative}.ehr-reader-scroll .ehr-reader-slot img{width:100%;height:auto;display:block;margin:0;border:0}.ehr-reader-slot .ehr-reader-placeholder{min-height:180px;display:flex;align-items:center;justify-content:center;color:var(--sub,#bbb);font-size:12px;background:#1c1925}.ehr-reader-paged .ehr-reader-placeholder{min-height:45vh}.ehr-reader-error{padding:20px 14px;text-align:center;font-size:13px;color:#efc6ca;background:#262028;line-height:1.6}.ehr-reader-nav{display:flex;gap:10px;margin:16px 0}.ehr-reader-nav button{flex:1;min-height:48px}@media(min-width:700px){.ehr-reader-stage{max-width:720px;margin:auto}}';document.head.append(st);
const node=(tag,className='',text='')=>{const n=document.createElement(tag);n.className=className;n.textContent=text;return n;};
function close(){if(reader){stopReader(reader);reader=null;}if(panel)panel.remove();panel=null;}
function open(title){if(!panel){panel=node('div','ehr-cloud');document.body.append(panel);}panel.replaceChildren();panel.scrollTop=0;const head=node('div','ehr-cloud-head');const back=node('button','ehr-cloud-back','←');back.type='button';back.onclick=close;head.append(back,node('h2','',title));panel.append(head);return panel;}
function message(text){const n=node('p','ehr-cloud-msg',text);panel.append(n);return n;}
const waitMs=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function call(name,params={},onWait){
  const u=new URL('/api/'+name,location.origin);
  for(const [k,v] of Object.entries(params))u.searchParams.set(k,String(v));
  // Only retry the gateway's *own* cooldown. Never retry upstream 429,
  // access-denied responses or anti-bot challenges.
  for(let attempt=0;attempt<3;attempt++){
    const r=await fetch(u,{cache:'no-store'});
    let d;try{d=await r.json();}catch{throw new Error('云端接口返回无效内容');}
    if(r.ok&&d.ok)return d;
    if(r.status===429&&d.error==='cooldown'&&attempt<2){
      const seconds=Number(d.retry_after||r.headers.get('retry-after'));
      if(Number.isFinite(seconds)&&seconds>=1&&seconds<=8){
        if(onWait)onWait('正在等待正常请求间隔，约 '+seconds+' 秒后继续…');
        await waitMs(seconds*1000+250);
        continue;
      }
    }
    const names={cooldown:'正在等待请求间隔，请稍后重试',upstream_rate_limited:'原网站限制请求频率，已停止请求',upstream_access_denied:'原站拒绝云端访问',upstream_challenge:'网站要求额外验证，已停止访问',upstream_not_json:'元数据接口返回的不是 JSON',upstream_metadata_error:'原站元数据接口报告错误',bad_metadata:'原站元数据内容不可用',upstream_content_type:'原站返回了意外格式的页面',upstream_network_error:'云端网络暂时无法连接站点',catalog_unavailable:'未找到可阅读的目录',image_not_found:'图片地址解析失败'};
    throw new Error(names[d.error]||d.error||'网络请求失败');
  }
  throw new Error('本地请求等待次数已达上限，请稍后再试');
}
function term(){const q=document.querySelector('#searchInput')?.value||'';const active=[...document.querySelectorAll('.chip.tag.active')].map(n=>tags[n.textContent.trim()]||'').filter(Boolean);return [q.trim().replace(/#中文/g,'language:chinese$').replace(/#全彩/g,'other:full_color$'),...active].filter(Boolean).join(' ');}
async function search(q,category=0,page=1){
  open('云端发现');const active=panel;const m=message('正在搜索…');
  try{
    const data=await call('search',{q,category,page},txt=>m.textContent=txt);
    if(panel!==active||!m.isConnected)return;
    m.remove();
    panel.append(node('p','ehr-cloud-hint','云端试验版 · 双列封面 · '+data.count+' 条结果'));
    if(data.warnings?.length)panel.append(node('p','ehr-cloud-msg','部分封面/标签信息未能从原站获取：'+data.warnings.join('、')+'。可以继续打开作品试读。'));
    const grid=node('div','ehr-cloud-grid');
    for(const x of data.items){
      const card=node('button','ehr-cloud-card');card.type='button';
      if(x.cover){
        const img=node('img');img.src=x.cover;img.loading='lazy';img.referrerPolicy='no-referrer';img.alt='漫画封面';
        img.onerror=()=>img.replaceWith(node('span','ehr-cloud-thumb-empty','封面无法加载'));
        card.append(img);
      }else card.append(node('span','ehr-cloud-thumb-empty','暂无封面'));
      const info=node('span','ehr-cloud-info');
      info.append(node('strong','',x.title||'无标题作品'),node('small','',(x.category||'漫画')+(x.pages?' · '+x.pages+' 页':'')));
      card.append(info);card.onclick=()=>detail(x);grid.append(card);
    }
    panel.append(grid);
    if(!data.count)message('没有匹配结果，或者网站页面结构发生变化。');
    const next=node('button','ehr-cloud-go','下一页 →');next.onclick=()=>search(q,category,page+1);panel.append(next);
  }catch(e){if(m.isConnected)m.textContent='搜索失败：'+e.message;}
}
async function detail(x){
  open('作品详情');const active=panel;const m=message('正在加载作品信息…');
  let d={...x,cover:x.cover||'',tags:Array.isArray(x.tags)?x.tags:[],pages:x.pages||0};
  let warning='';
  try{const fetched=await call('gallery',{gid:x.gid,token:x.token});d={...d,...fetched};if(fetched.warnings?.length)warning='元数据暂不完整，已使用搜索结果。';}
  catch(e){warning='元数据获取失败：'+e.message+'；仍可尝试打开阅读目录。';}
  if(panel!==active)return;
  m.remove();
  panel.append(node('h2','',d.title||x.title||'作品'),node('p','ehr-cloud-hint',(d.category||'漫画')+' · '+(d.pages||'?')+' 页'));
  if(d.cover){
    const img=node('img','ehr-cloud-image');img.src=d.cover;img.referrerPolicy='no-referrer';img.alt='作品封面';img.style.maxHeight='230px';
    img.onerror=()=>img.replaceWith(node('p','ehr-cloud-msg','封面图片源站不允许显示，或链接已失效。'));
    panel.append(img);
  }else panel.append(node('p','ehr-cloud-hint','暂无可显示的封面。'));
  if(warning)panel.append(node('p','ehr-cloud-msg',warning));
  if(d.tags.length)panel.append(node('p','ehr-cloud-hint',d.tags.slice(0,15).join(' · ')));
  const actions=node('div','ehr-cloud-actions');
  const view=node('button','ehr-cloud-go','在 App 内试读');
  view.onclick=()=>read({...x,...d,url:x.url||d.url});
  const shelf=node('button','ehr-cloud-go','收藏');
  shelf.onclick=()=>{try{
    const key='ehrweb:v1:shelf',saved=JSON.parse(localStorage.getItem(key)||'[]');
    const row={url:x.url,title:d.title||x.title||'',cover:d.cover||'',category:d.category||'',tags:d.tags||[],savedAt:Date.now()};
    localStorage.setItem(key,JSON.stringify([row,...saved.filter(a=>a.url!==row.url)].slice(0,100)));shelf.textContent='已收藏 ✓';
  }catch{shelf.textContent='收藏失败';}};
  actions.append(view,shelf);panel.append(actions,node('p','ehr-cloud-hint','漫画目录和图片加载需要另外验证；如网站限制直接访问，将提示错误，不会绕过限制。'));
}

const MODE_KEY='ehrweb:v1:readerMode';
function readingMode(){try{return localStorage.getItem(MODE_KEY)==='paged'?'paged':'scroll';}catch{return 'scroll';}}
function saveMode(mode){try{localStorage.setItem(MODE_KEY,mode);}catch{}}
function progressKey(x){try{const u=new URL(x.url);return 'ehr:v1:progress:'+u.host+u.pathname;}catch{return 'ehr:v1:progress:'+x.gid;}}
function remember(x){
 try{const key='ehrweb:v1:history',saved=JSON.parse(localStorage.getItem(key)||'[]');
 const row={url:x.url,title:x.title||'作品',cover:x.cover||'',category:x.category||'漫画',savedAt:Date.now()};
 localStorage.setItem(key,JSON.stringify([row,...saved.filter(a=>a.url!==row.url)].slice(0,100)));
 }catch{}
}
function saveProgress(r){
 if(!r||r.stopped)return;
 try{const key='ehrweb:v1:progress',data=JSON.parse(localStorage.getItem(key)||'{}');
 data[progressKey(r.x)]=r.index;localStorage.setItem(key,JSON.stringify(data));}catch{}
}
function restoredIndex(x,count){
 try{const data=JSON.parse(localStorage.getItem('ehrweb:v1:progress')||'{}');
 const num=Number(data[progressKey(x)]);return Number.isInteger(num)&&num>=0&&num<count?num:0;
 }catch{return 0;}
}
function stopReader(r){
 r.stopped=true;
 if(r.observer){r.observer.disconnect();r.observer=null;}
 if(r.scrollListener&&panel)panel.removeEventListener('scroll',r.scrollListener);
 r.scrollListener=null;r.queue.length=0;
}
function setCurrent(r,index){
 if(r.stopped||reader!==r||!Number.isInteger(index)||index<0||index>=r.pages.length||r.index===index)return;
 r.index=index;saveProgress(r);
 if(r.counter)r.counter.textContent='第 '+(index+1)+' / '+r.pages.length+' 页';
}
// The queue resolves one normal image-page URL at a time. The Worker reserves
// short upstream slots, while this client only preloads a small window.
function queueImageUrl(r,index,urgent=false){
 if(!r||r.stopped||index<0||index>=r.pages.length)return Promise.reject(Error('页面不存在'));
 if(r.urls.has(index))return Promise.resolve(r.urls.get(index));
 if(r.pending.has(index)){
   if(urgent){const pos=r.queue.findIndex(j=>j.index===index);if(pos>0){const [j]=r.queue.splice(pos,1);r.queue.unshift(j);}}
   return r.pending.get(index);
 }
 if(r.blocked)return Promise.reject(Error(r.blocked));
 let resolveJob,rejectJob;
 const promise=new Promise((resolve,reject)=>{resolveJob=resolve;rejectJob=reject;});
 r.pending.set(index,promise);
 const job={index,resolve:resolveJob,reject:rejectJob};
 if(urgent)r.queue.unshift(job);else r.queue.push(job);
 pumpImageQueue(r);
 return promise;
}
function pumpImageQueue(r){
 if(r.stopped||r.running||!r.queue.length||r.blocked)return;
 const job=r.queue.shift();r.running=true;
 (async()=>{
   try{
     const result=await call('page',{url:r.pages[job.index].url});
     if(r.stopped)throw Error('阅读已结束');
     r.urls.set(job.index,result.image_url);
     if(r.urls.size>90)r.urls.delete(r.urls.keys().next().value);
     job.resolve(result.image_url);
   }catch(e){
     const reason=e.message||'图片地址获取失败';
     if(/原站拒绝|原网站限制请求频率|额外验证|网站限制了请求频率/.test(reason))r.blocked=reason;
     job.reject(e);
   }finally{
     r.pending.delete(job.index);r.running=false;
     if(r.blocked){
       for(const j of r.queue.splice(0))j.reject(Error(r.blocked));
     }else pumpImageQueue(r);
   }
 })();
}
function preloadNear(r,index){
 if(r.stopped||r.blocked)return;
 // Only keep two ahead and one behind in flight; long books do not burst fetch.
 for(const i of [index+1,index+2,index-1]){
   if(i>=0&&i<r.pages.length&&!r.urls.has(i)&&!r.pending.has(i))
     queueImageUrl(r,i).catch(()=>{});
 }
}
function slotError(slot,r,index,text){
 if(slot.dataset.index!==String(index)||r.stopped||reader!==r)return;
 slot.replaceChildren();
 const p=node('div','ehr-reader-error',text);slot.append(p);
 const retry=node('button','ehr-cloud-go','重试本页');retry.type='button';
 retry.onclick=()=>{slot.dataset.loading='';paintSlot(r,slot,index);};
 p.append(node('br'),retry);slot.dataset.loading='error';
}
async function paintSlot(r,slot,index){
 if(r.stopped||reader!==r||!slot||slot.dataset.loading==='loading'||slot.querySelector('img'))return;
 slot.dataset.index=String(index);
 slot.dataset.loading='loading';
 slot.replaceChildren(node('div','ehr-reader-placeholder','第 '+(index+1)+' 页 · 加载中…'));
 try{
   const url=await queueImageUrl(r,index,true);
   if(r.stopped||reader!==r||!slot.isConnected||slot.dataset.index!==String(index))return;
   const img=node('img');img.alt='漫画第 '+(index+1)+' 页';img.decoding='async';
   img.referrerPolicy='no-referrer';img.loading='eager';
   img.onload=()=>{
     if(!img.isConnected)return;
     slot.dataset.loading='ready';
     slot.style.minHeight='';
     if(index===r.index)preloadNear(r,index);
   };
   img.onerror=()=>slotError(slot,r,index,'图片资源加载失败，可能是原站不允许直链，或资源已失效。');
   slot.replaceChildren(img);
   img.src=url;
 }catch(e){slotError(slot,r,index,'第 '+(index+1)+' 页加载失败：'+e.message);}
}
function renderReaderShell(r){
 if(r.stopped||reader!==r)return;
 open('阅读 · '+(r.index+1)+' / '+r.pages.length);
 const back=panel.querySelector('.ehr-cloud-back');
 if(back)back.onclick=()=>{stopReader(r);reader=null;detail(r.x);};
 const bar=node('div','ehr-reader-toolbar');
 const scroll=node('button','ehr-cloud-go','↓ 连续阅读');
 const paged=node('button','ehr-cloud-go','⇆ 左右翻页');
 scroll.type='button';paged.type='button';
 scroll.setAttribute('aria-pressed',String(r.mode==='scroll'));
 paged.setAttribute('aria-pressed',String(r.mode==='paged'));
 scroll.onclick=()=>switchMode(r,'scroll');
 paged.onclick=()=>switchMode(r,'paged');
 bar.append(scroll,paged);panel.append(bar);
 r.counter=node('div','ehr-reader-counter','第 '+(r.index+1)+' / '+r.pages.length+' 页');
 panel.append(r.counter);
 r.stage=node('section','ehr-reader-stage');
 panel.append(r.stage);
}
function switchMode(r,mode){
 if(r.stopped||reader!==r||r.mode===mode)return;
 if(r.observer){r.observer.disconnect();r.observer=null;}
 if(r.scrollListener&&panel)panel.removeEventListener('scroll',r.scrollListener);
 r.scrollListener=null;
 r.mode=mode;saveMode(mode);renderReaderShell(r);
 if(mode==='scroll')renderContinuous(r);else renderPaged(r);
}
function renderPaged(r){
 if(r.stopped||reader!==r)return;
 r.stage.className='ehr-reader-stage ehr-reader-paged';
 r.stage.replaceChildren();
 const slot=node('div','ehr-reader-slot');r.stage.append(slot);
 const nav=node('div','ehr-reader-nav');
 const prev=node('button','ehr-cloud-go','← 上一页');
 const next=node('button','ehr-cloud-go','下一页 →');
 prev.disabled=r.index===0;
 prev.onclick=()=>changePage(r,-1);
 next.onclick=()=>changePage(r,1);
 nav.append(prev,next);r.stage.append(nav);
 const i=r.index;paintSlot(r,slot,i);
 // A light swipe in the paged reader works without swallowing vertical scroll.
 let touch=null;
 r.stage.ontouchstart=e=>{if(e.touches.length===1)touch={x:e.touches[0].clientX,y:e.touches[0].clientY};};
 r.stage.ontouchend=e=>{
   if(!touch||!e.changedTouches.length)return;
   const dx=e.changedTouches[0].clientX-touch.x,dy=e.changedTouches[0].clientY-touch.y;
   touch=null;
   if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.5)changePage(r,dx<0?1:-1);
 };
 if(panel)panel.scrollTop=0;
}
async function loadMoreDirectory(r){
 if(r.stopped||r.dir>=r.dirs-1||r.loadingMore)return false;
 r.loadingMore=true;
 const next=r.dir+1;
 try{
   const data=await call('catalog',{gid:r.x.gid,token:r.x.token,p:next});
   if(r.stopped||reader!==r)return false;
   r.dir=next;
   const seen=new Set(r.pages.map(x=>x.page));
   const incoming=(data.pages||[]).filter(x=>!seen.has(x.page));
   r.pages.push(...incoming);
   r.dirs=Math.max(r.dirs,Number(data.directory_pages)||1);
   if(r.mode==='scroll')appendScrollSlots(r);
   if(r.counter)r.counter.textContent='第 '+(r.index+1)+' / '+r.pages.length+' 页';
   return incoming.length>0;
 }catch(e){r.directoryError=e.message;return false;}
 finally{r.loadingMore=false;}
}
async function changePage(r,delta){
 if(r.stopped||reader!==r||r.mode!=='paged')return;
 let target=r.index+delta;
 if(target>=r.pages.length)await loadMoreDirectory(r);
 if(target<0||target>=r.pages.length)return;
 setCurrent(r,target);
 renderPaged(r);
}
function appendScrollSlots(r){
 if(r.stopped||r.mode!=='scroll'||!r.stage)return;
 for(let i=r.slotNodes.size;i<r.pages.length;i++){
   const slot=node('div','ehr-reader-slot');
   slot.dataset.index=String(i);
   slot.append(node('div','ehr-reader-placeholder','第 '+(i+1)+' 页'));
   r.slotNodes.set(i,slot);
   r.stage.append(slot);
   if(r.observer)r.observer.observe(slot);
 }
}
function updateScrollPosition(r){
 if(r.stopped||r.mode!=='scroll'||reader!==r||!panel)return;
 const targetTop=panel.getBoundingClientRect().top+130;
 let current=r.index;
 for(const [i,slot] of r.slotNodes){
   const rect=slot.getBoundingClientRect();
   if(rect.top<=targetTop&&rect.bottom>targetTop){current=i;break;}
 }
 setCurrent(r,current);
 // Release offscreen DOM image elements to bound memory. Their page URL remains
 // in the small per-reader LRU; browser can reuse the cached direct image.
 for(const [i,slot] of r.slotNodes){
   const img=slot.querySelector('img');
   if(img&&Math.abs(i-r.index)>5){
     slot.style.minHeight=Math.max(slot.offsetHeight,170)+'px';
     img.remove();
     slot.replaceChildren(node('div','ehr-reader-placeholder','第 '+(i+1)+' 页'));
     slot.dataset.loading='';
   }
 }
 if(r.index>=r.pages.length-4&&r.dir+1<r.dirs)loadMoreDirectory(r);
}
function renderContinuous(r){
 if(r.stopped||reader!==r)return;
 r.stage.className='ehr-reader-stage ehr-reader-scroll';
 r.stage.replaceChildren();r.slotNodes=new Map();
 r.observer=new IntersectionObserver(entries=>{
   if(r.stopped||r.mode!=='scroll'||reader!==r)return;
   for(const e of entries){
     if(!e.isIntersecting)continue;
     const index=Number(e.target.dataset.index);
     if(!Number.isInteger(index))continue;
     paintSlot(r,e.target,index);
     if(index>=r.pages.length-4&&r.dir+1<r.dirs)loadMoreDirectory(r);
   }
 },{root:panel,rootMargin:'250px 0px 420px 0px',threshold:0});
 appendScrollSlots(r);
 let ticking=false;
 r.scrollListener=()=>{
   if(ticking)return;
   ticking=true;
   requestAnimationFrame(()=>{ticking=false;updateScrollPosition(r);});
 };
 panel.addEventListener('scroll',r.scrollListener,{passive:true});
 const saved=r.slotNodes.get(r.index);
 if(saved)saved.scrollIntoView({block:'start'});
 updateScrollPosition(r);
}
async function read(x){
 if(reader)stopReader(reader);
 const mode=readingMode();
 const r={x,pages:[],index:0,dir:0,dirs:1,mode,queue:[],pending:new Map(),urls:new Map(),running:false,
   blocked:'',stopped:false,observer:null,scrollListener:null,slotNodes:new Map(),stage:null,counter:null,loadingMore:false};
 reader=r;
 open('漫画阅读');const m=message('正在加载漫画目录…');
 try{
   const data=await call('catalog',{gid:x.gid,token:x.token,p:0});
   if(reader!==r||r.stopped)return;
   r.pages=data.pages||[];r.dirs=data.directory_pages||1;
   if(!r.pages.length){m.textContent='目录为空，暂时无法阅读。';return;}
   r.index=restoredIndex(x,r.pages.length);
   remember(x);saveProgress(r);
   renderReaderShell(r);
   if(mode==='scroll')renderContinuous(r);else renderPaged(r);
 }catch(e){
   if(reader!==r||r.stopped)return;
   m.textContent='目录加载失败：'+e.message;
   const retry=node('button','ehr-cloud-go','重试目录');retry.onclick=()=>read(x);
   panel.append(retry);
 }
}
document.addEventListener('submit',e=>{if(!e.target.matches('form.search'))return;e.preventDefault();e.stopImmediatePropagation();search(term());},true);
document.addEventListener('click',e=>{const tile=e.target.closest('button.tile');if(tile){e.preventDefault();e.stopImmediatePropagation();search(term(),categories[tile.querySelector('strong')?.textContent?.trim()]||0);return;}const a=e.target.closest('a.cover');if(a){const m=a.href.match(/^https:\/\/(?:e-hentai\.org|exhentai\.org)\/g\/(\d+)\/([a-z0-9]+)\/?$/i);if(m){e.preventDefault();e.stopImmediatePropagation();detail({gid:Number(m[1]),token:m[2],url:'https://e-hentai.org/g/'+m[1]+'/'+m[2]+'/',title:a.closest('.book')?.querySelector('h3')?.textContent||''});}}if(e.target.closest('nav button[data-tab]')&&panel)close();},true);
const label=node('small','',' · ☁ 云端试验版');label.style.color='#ae9bff';document.querySelector('.brand-name')?.append(label);
})();`;