/* EH LightReader Cloud Pilot. No R dependencies, cookies or unrestricted proxy. */
import {bridgeScript} from "./bridge.js";
const SITE="https://e-hentai.org", META="https://api.e-hentai.org/api.php";
// Reserve request slots atomically per Worker isolate; no fixed 3-second error cycle.
// Never retry upstream 403/429/challenges. This is a best-effort local request queue,
// not a guarantee that independent Worker isolates share a rate limit.
let nextSiteAt=0,nextMetaAt=0;const cache=new Map(),detailCache=new Map();
async function pace(kind){
 const now=Date.now(),gap=kind==="site"?950:500;
 const reserved=Math.max(now,kind==="site"?nextSiteAt:nextMetaAt);
 if(kind==="site")nextSiteAt=reserved+gap;else nextMetaAt=reserved+gap;
 const wait=reserved-now;
 if(wait>0)await new Promise(resolve=>setTimeout(resolve,wait));
}
const DETAIL_CACHE_TTL=5*60*1000;
function rememberDetail(x){if(!isGallery(x.gid,x.token))return;detailCache.set(x.gid+":"+x.token.toLowerCase(),{at:Date.now()+DETAIL_CACHE_TTL,item:{...x}});if(detailCache.size>160)detailCache.delete(detailCache.keys().next().value);}
function recalledDetail(gid,token){const c=detailCache.get(Number(gid)+":"+String(token).toLowerCase());if(!c)return null;if(c.at<Date.now()){detailCache.delete(Number(gid)+":"+String(token).toLowerCase());return null;}return {...c.item};}
const json=(x,s=200,h={})=>new Response(JSON.stringify(x),{status:s,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff",...h}});
const error=(name,status=502,wait=0)=>json({ok:false,error:name,retry_after:wait},status,wait?{"retry-after":String(wait)}:{});
const isGallery=(g,t)=>/^\d{1,12}$/.test(String(g))&&/^[a-z0-9]{6,64}$/i.test(String(t));
const clean=s=>String(s||"").replace(/<[^>]+>/g," ").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/\s+/g," ").trim();
const attrs=s=>{let result={};for(let m of String(s||"").matchAll(/([\w-]+)\s*=\s*(["'])(.*?)\2/gs))result[m[1].toLowerCase()]=m[3];return result};
const urlImage=s=>{if(!s)return"";try{const u=new URL(s,SITE);return u.protocol==="https:"&&!u.username&&!u.password&&!u.port?u.href:""}catch{return""}};
async function remote(u,payload){
 let resp;try{resp=await fetch(u,{method:payload?"POST":"GET",headers:{"accept":payload?"application/json":"text/html,application/xhtml+xml",...(payload?{"content-type":"application/json"}:{})},body:payload?JSON.stringify(payload):undefined,redirect:"manual",signal:AbortSignal.timeout(12000)})}catch{return{error:"upstream_network_error",status:502}};
 if(resp.status===429)return{error:"upstream_rate_limited",status:429};
 if([401,403].includes(resp.status))return{error:"upstream_access_denied",status:403};
 if(!resp.ok)return{error:"upstream_unavailable",status:502};
 const length=Number(resp.headers.get("content-length")||0);
 if(length>1500000)return{error:"upstream_too_large",status:502};
 const type=(resp.headers.get("content-type")||"").toLowerCase();
 const body=await resp.text();if(body.length>1500000)return{error:"upstream_too_large",status:502};
 // E-Hentai metadata may be sent as text/plain even when the body is valid JSON.
 // Validate the body instead of trusting its MIME type. Never treat HTML or a challenge as JSON.
 if(/cf-chl-|challenge-platform|just a moment|attention required/i.test(body.slice(0,20000)))return{error:"upstream_challenge",status:403};
 if(payload){
   let parsed;try{parsed=JSON.parse(body);}catch{return{error:"upstream_not_json",status:502};}
   if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))return{error:"bad_metadata",status:502};
   return{body,parsed};
 }
 if(type&&!/text\/html|application\/xhtml\+xml/i.test(type))return{error:"upstream_content_type",status:502};
 return{body};
}
async function apiMeta(items){
 await pace("meta");
 const res=await remote(META,{method:"gdata",gidlist:items.map(x=>[x.gid,x.token]).slice(0,24),namespace:1});if(res.error)return res;
 if(res.parsed?.error)return{error:"upstream_metadata_error",status:502};
 if(!Array.isArray(res.parsed?.gmetadata))return{error:"bad_metadata",status:502};
 return{items:res.parsed.gmetadata};
}
function extractCover(fragment){
 const candidates=[];
 for(const tag of String(fragment||"").match(/<img\b[^>]*>/gi)||[]){
  const a=attrs(tag);candidates.push(a["data-src"],a["data-original"],a.src);
  if(a.srcset)candidates.push(a.srcset.split(",")[0]?.trim().split(/\s+/)[0]);
 }
 for(const m of String(fragment||"").matchAll(/(?:background-image|background)\s*:\s*url\(\s*["']?([^"')]+)["']?\s*\)/gi))candidates.push(m[1]);
 for(let src of candidates){
  if(!src)continue;src=String(src).trim().replace(/&amp;/g,"&");
  if(!src.startsWith("https://")&&!src.startsWith("//"))continue;
  const cover=urlImage(src);
  if(!cover)continue;
  const host=new URL(cover).hostname.toLowerCase();
  if(host==="ehgt.org"||host.endsWith(".ehgt.org")||host==="e-hentai.org"||host.endsWith(".e-hentai.org"))return cover;
 }
 return "";
}
function searchEntries(html){
 const entries=[],seen=new Set();
 for(const m of html.matchAll(/<a\b[^>]*href=["'](?:https:\/\/e-hentai\.org)?\/g\/(\d+)\/([a-z0-9]{6,64})\/?(?:\?[^"']*)?["'][^>]*>[\s\S]*?<\/a>/gi)){
  const gid=Number(m[1]);if(seen.has(gid))continue;seen.add(gid);
  const name=m[0].match(/<div[^>]*class=["'][^"']*glink[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  const coverTag=m[0].match(/<img\b[^>]*>/i);const img=attrs(coverTag?.[0]||"");
  const cover=extractCover(m[0]);
  entries.push({gid,token:m[2],url:SITE+"/g/"+gid+"/"+m[2]+"/",title:clean(name?.[1]||img.alt||"").slice(0,260),cover});
  if(entries.length>=24)break;
 }
 return entries;
}
function catalogEntries(html,gid,token){
 const pages=[],seen=new Set();for(let m of html.matchAll(/(?:https:\/\/e-hentai\.org)?\/s\/([a-z0-9]{6,64})\/(\d+)-(\d+)/gi)){const p=Number(m[3]);if(Number(m[2])!==gid||!p||seen.has(p))continue;seen.add(p);pages.push({page:p,url:SITE+"/s/"+m[1]+"/"+gid+"-"+p})}
 pages.sort((a,b)=>a.page-b.page);
 let dirCount=1;for(let m of html.matchAll(/(?:https:\/\/e-hentai\.org)?\/g\/(\d+)\/([a-z0-9]+)\/\?p=(\d{1,3})/gi)){if(Number(m[1])===gid&&m[2].toLowerCase()===token.toLowerCase())dirCount=Math.max(dirCount,Number(m[3])+1)}
 return{pages,directory_pages:dirCount};
}
async function api(req){
 const u=new URL(req.url),path=u.pathname;
 if(path==="/api/health")return json({ok:true,service:"eh-lightreader-cloud",version:"1.4.0-pilot.5",r_unchanged:true,userscripts_required:false,real_site_tested:false});
 if(req.method!=="GET")return error("method_not_allowed",405);
 if(path==="/api/search"){
  const q=(u.searchParams.get("q")||"").trim(),page=Number(u.searchParams.get("page")||1),cat=Number(u.searchParams.get("category")||0);
  if(q.length>200||/[\x00-\x1f]/.test(q)||!Number.isInteger(page)||page<1||page>500||![0,1,2,4,8,16,32,64,128,256,512].includes(cat))return error("bad_request",400);
  const key=JSON.stringify([q,page,cat]);const cached=cache.get(key);if(cached&&cached.at>Date.now())return json(cached.data);
  await pace("site");
  const query=new URLSearchParams({page:String(page-1)});if(q)query.set("f_search",q);if(cat)query.set("f_cats",String(1023-cat));
  const res=await remote(SITE+"/?"+query);if(res.error)return error(res.error,res.status);
  let items=searchEntries(res.body),warnings=[];
  if(items.length){
   const metadata=await apiMeta(items);
   if(metadata.items){const byId=new Map(metadata.items.map(x=>[Number(x.gid),x]));items=items.map(x=>{const m=byId.get(x.gid)||{};return{...x,title:String(m.title||x.title),cover:urlImage(m.thumb)||x.cover,pages:Number(m.filecount)||0,category:String(m.category||""),tags:Array.isArray(m.tags)?m.tags.slice(0,40):[],metadata_complete:!!m.gid}})}
   else warnings.push(metadata.error||"metadata_unavailable");
  }
  for(const item of items)rememberDetail(item);
  const data={ok:true,query:q,items,page,category:cat,count:items.length,warnings};cache.set(key,{at:Date.now()+30000,data});if(cache.size>50)cache.delete(cache.keys().next().value);return json(data);
 }
 if(path==="/api/gallery"){
  const gid=u.searchParams.get("gid")||"",token=u.searchParams.get("token")||"";if(!isGallery(gid,token))return error("bad_request",400);
  // Results from our own search can still open even when upstream metadata is unavailable.
  // Catalog and image pages are independently validated by their own endpoints.
  const cached=recalledDetail(gid,token);
  if(cached&&cached.metadata_complete)return json({ok:true,...cached});
  const m=await apiMeta([{gid:Number(gid),token}]);
  if(m.error){
    if(cached)return json({ok:true,...cached,metadata_complete:false,warnings:[m.error]});
    return error(m.error,m.status,m.wait);
  }
  const row=m.items.find(x=>Number(x.gid)===Number(gid));
  if(!row){if(cached)return json({ok:true,...cached,metadata_complete:false,warnings:["no_metadata"]});return error("not_found",404);}
  const detail={gid:Number(gid),token,title:String(row.title||cached?.title||""),category:String(row.category||cached?.category||""),cover:urlImage(row.thumb)||cached?.cover||"",pages:Number(row.filecount)||0,tags:Array.isArray(row.tags)?row.tags:[],metadata_complete:true};
  rememberDetail(detail);
  return json({ok:true,...detail});
 }
 if(path==="/api/catalog"||path==="/api/page"){
  if(path==="/api/catalog"){
   const gid=u.searchParams.get("gid")||"",token=u.searchParams.get("token")||"",p=Number(u.searchParams.get("p")||0);
   if(!isGallery(gid,token)||!Number.isInteger(p)||p<0||p>500)return error("bad_request",400);
   await pace("site");
   const res=await remote(SITE+"/g/"+gid+"/"+token+"/"+(p?"?p="+p:""));if(res.error)return error(res.error,res.status);
   const catalog=catalogEntries(res.body,Number(gid),token);if(!catalog.pages.length)return error("catalog_unavailable");
   return json({ok:true,...catalog,gid:Number(gid),token,p});
  }
  const value=u.searchParams.get("url")||"";let target;
  try{target=new URL(value)}catch{return error("bad_request",400)}
  if(target.protocol!=="https:"||target.hostname!=="e-hentai.org"||target.port||target.username||target.password||!/^\/s\/[a-z0-9]{6,64}\/\d{1,12}-\d{1,5}\/?$/i.test(target.pathname))return error("bad_request",400);
  await pace("site");
  const res=await remote(target.href);if(res.error)return error(res.error,res.status);
  const tag=res.body.match(/<img\b[^>]*\bid=["']img["'][^>]*>/i);const a=attrs(tag?.[0]||"");
  const image=urlImage((!a.src||a.src.startsWith("data:"))?a["data-src"]:a.src);if(!image)return error("image_not_found");
  return json({ok:true,image_url:image,proxy:false});
 }
 return error("not_found",404);
}
export default{async fetch(request,env){
 const path=new URL(request.url).pathname;
 if(path.startsWith("/api/"))return api(request);
 if(path==="/__ehr_cloud.js")return new Response(bridgeScript,{headers:{"content-type":"application/javascript; charset=utf-8","cache-control":"no-cache"}});
 if(path==="/sw.js")return new Response('self.addEventListener("install",()=>self.skipWaiting());self.addEventListener("activate",e=>e.waitUntil(self.clients.claim()));',{headers:{"content-type":"application/javascript","cache-control":"no-store"}});
 if(!env.ASSETS)return error("assets_unavailable",503);
 const response=await env.ASSETS.fetch(request);
 if(!["/","/index.html"].includes(path)||!response.ok)return response;
 const headers=new Headers(response.headers);
 headers.delete("content-length");
 headers.set("cache-control","no-store, max-age=0");
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}};
export const __testing={remote,extractCover,searchEntries,catalogEntries};
