import test from "node:test";
import assert from "node:assert/strict";
import cloud,{__testing} from "../src/index.js";
import {bridgeScript} from "../src/bridge.js";

test("the additive cloud sidecar parses", () => {
  assert.doesNotThrow(() => new Function(bridgeScript));
});
test("cloud health identifies separate worker", async () => {
  const result = await cloud.fetch(new Request("https://example.workers.dev/api/health"), {});
  assert.equal(result.status, 200);
  const data = await result.json();
  assert.equal(data.ok, true);
  assert.equal(data.r_unchanged, true);
});
test("API rejects arbitrary page proxy hosts and bad gallery ids", async () => {
  const a = await cloud.fetch(new Request("https://example.workers.dev/api/page?url=https%3A%2F%2Fevil.example%2Fs%2Fa%2F1-2"), {});
  assert.equal(a.status, 400);
  const b = await cloud.fetch(new Request("https://example.workers.dev/api/gallery?gid=hello&token=a"), {});
  assert.equal(b.status, 400);
});
test("cloud bootstrap injects valid bridge script after decompression", async () => {
  const {readFileSync} = await import("node:fs");
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  const start = html.indexOf("<script>") + 8;
  const end = html.indexOf("</script>",start);
  assert.ok(start >= 8 && end > start, "bootstrap inline JS present");
  const script = html.slice(start,end);
  assert.doesNotThrow(() => new Function(script));
  const anchor = script.indexOf('page=page.replace("</body>"');
  assert.ok(anchor >= 0, "cloud bridge loaded from static bootstrap");
  const transform = script.slice(anchor,script.indexOf("document.open();",anchor));
  const result = new Function("page",transform + "return page;")("<html><body>Hello</body></html>");
  assert.ok(result.includes("<script src='/__ehr_cloud.js?v=1404'></script>"), "valid tag emitted");
  assert.equal(result.includes("<\\/script>"),false, "no escaped closing script tag");
});

test("cloud app loader is no longer rewritten at runtime", async () => {
  const fixture = "<!doctype html><html><body>Already instrumented</body></html>";
  const response = await cloud.fetch(new Request("https://example.workers.dev/"), {
    ASSETS: {fetch: async () => new Response(fixture, {headers: {"content-type":"text/html"}})}
  });
  assert.equal(response.status,200);
  assert.equal(await response.text(),fixture);
  assert.ok((response.headers.get("cache-control")||"").includes("no-store"));
});

test("non-home static assets are delegated unchanged", async () => {
  const response = await cloud.fetch(new Request("https://example.workers.dev/assets/part-0.b64"), {
    ASSETS: {fetch: async () => new Response("raw static asset")}
  });
  assert.equal(await response.text(), "raw static asset");
});

test("cloud bridge JavaScript is served directly", async () => {
  const response = await cloud.fetch(new Request("https://example.workers.dev/__ehr_cloud.js"), {});
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /javascript/);
  assert.match(await response.text(), /ehr-cloud/);
});


test("upstream gallery metadata accepts valid JSON even when tagged text/plain", async () => {
  const original=globalThis.fetch;
  globalThis.fetch=async (url,opts) => {
    assert.equal(url,"https://api.e-hentai.org/api.php");
    assert.equal(opts.method,"POST");
    return new Response(JSON.stringify({gmetadata:[{
      gid:123456,token:"abcdef1234",title:"测试作品",category:"Manga",
      filecount:"32",thumb:"https://ehgt.org/covers/123.jpg",tags:["language:chinese"]
    }]}),{status:200,headers:{"content-type":"text/plain; charset=UTF-8"}});
  };
  try {
    const r=await cloud.fetch(new Request("https://example.workers.dev/api/gallery?gid=123456&token=abcdef1234"),{});
    const d=await r.json();
    assert.equal(r.status,200,JSON.stringify(d));
    assert.equal(d.ok,true);
    assert.equal(d.title,"测试作品");
    assert.equal(d.cover,"https://ehgt.org/covers/123.jpg");
    assert.equal(d.pages,32);
  } finally {globalThis.fetch=original;}
});

test("HTML anti-bot challenge disguised as metadata is not treated as JSON", async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async()=>new Response("<html><title>Just a moment...</title></html>",{
    status:200,headers:{"content-type":"text/html"}
  });
  try{
    const result=await __testing.remote("https://api.e-hentai.org/api.php",{method:"gdata",gidlist:[]});
    assert.equal(result.error,"upstream_challenge");
    assert.equal(result.status,403);
  }finally{globalThis.fetch=original;}
});

test("unexpected HTML metadata body is reported explicitly",async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async()=>new Response("<html>not JSON</html>",{
    status:200,headers:{"content-type":"text/html"}
  });
  try{
    const result=await __testing.remote("https://api.e-hentai.org/api.php",{method:"gdata",gidlist:[]});
    assert.equal(result.error,"upstream_not_json");
  }finally{globalThis.fetch=original;}
});

test("thumbnail parser accepts lazy and CSS cover URLs without external tracking domains",()=>{
  const html='<a href="/g/223344/aabbccdd99/"><div class="glthumb"><img data-src="//ehgt.org/t/cover.jpg"></div></a>';
  const rows=__testing.searchEntries(html);
  assert.equal(rows.length,1);
  assert.equal(rows[0].cover,"https://ehgt.org/t/cover.jpg");
  const css='<a href="/g/223345/aabbccdd98/"><div style="background-image:url(https://ehgt.org/t/x.png)"></div></a>';
  assert.equal(__testing.searchEntries(css)[0].cover,"https://ehgt.org/t/x.png");
  assert.equal(__testing.extractCover('<img src="https://example.net/track.jpg">'),"");
});

test("cloud sidecar still offers reading when gallery metadata fails",()=>{
  assert.match(bridgeScript,/元数据获取失败/);
  assert.match(bridgeScript,/在 App 内试读/);
  assert.match(bridgeScript,/封面无法加载/);
  assert.doesNotThrow(()=>new Function(bridgeScript));
});


test("reader can resolve a normal image-page link when the site provides HTML",async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async(url)=>{
    assert.ok(String(url).startsWith("https://e-hentai.org/s/"));
    return new Response('<html><div id="i3"><img id="img" src="https://ehgt.org/images/page001.jpg"></div></html>',{
      status:200,headers:{"content-type":"text/html; charset=UTF-8"}
    });
  };
  try{
    const pageUrl="https://e-hentai.org/s/abcdef1234/123456-1";
    const result=await cloud.fetch(new Request("https://example.workers.dev/api/page?url="+encodeURIComponent(pageUrl)),{});
    const body=await result.json();
    assert.equal(result.status,200,JSON.stringify(body));
    assert.equal(body.image_url,"https://ehgt.org/images/page001.jpg");
    assert.equal(body.proxy,false);
  }finally{globalThis.fetch=original;}
});

test("gallery directory parser extracts only requested gallery pages",()=>{
  const html='<a href="https://e-hentai.org/s/abcdef1234/123456-1">one</a><a href="https://e-hentai.org/s/efghij1234/999999-1">other</a>';
  const p=__testing.catalogEntries(html,123456,"abcdef1234");
  assert.deepEqual(p.pages.map(v=>v.page),[1]);
});


test("gallery browsing keeps two-column portrait-cover cards", () => {
  assert.match(bridgeScript,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(bridgeScript,/const grid=node\('div','ehr-cloud-grid'\)/);
  assert.match(bridgeScript,/grid\.append\(card\)/);
  assert.match(bridgeScript,/aspect-ratio:3\/4/);
  assert.match(bridgeScript,/r\.dir=next/);
});

test("the cloud client waits for its own cooldown then continues loading",async()=>{
  const start=bridgeScript.indexOf('const waitMs=');
  const end=bridgeScript.indexOf('\nfunction term()',start);
  assert.ok(start>0&&end>start);
  const getCall=new Function('fetch','location','setTimeout','URL',
    bridgeScript.slice(start,end)+'\nreturn call;');
  const notices=[];
  let count=0;
  const mockFetch=async()=>{
    count++;
    return count===1?{
      ok:false,status:429,
      headers:new Headers({'retry-after':'4'}),
      json:async()=>({ok:false,error:'cooldown',retry_after:4})
    }:{
      ok:true,status:200,
      json:async()=>({ok:true,image_url:'https://ehgt.org/page.jpg'})
    };
  };
  const call=getCall(mockFetch,{origin:'https://example.workers.dev'},fn=>fn(),URL);
  const data=await call('page',{url:'https://e-hentai.org/s/abcde123/123-1'},text=>notices.push(text));
  assert.equal(count,2);
  assert.equal(data.image_url,'https://ehgt.org/page.jpg');
  assert.equal(notices.length,1);
  assert.match(notices[0],/4 秒/);
});

test("upstream rate limit and challenge are never automatically retried",async()=>{
  const start=bridgeScript.indexOf('const waitMs=');
  const end=bridgeScript.indexOf('\nfunction term()',start);
  const getCall=new Function('fetch','location','setTimeout','URL',
    bridgeScript.slice(start,end)+'\nreturn call;');
  for(const upstreamError of ['upstream_rate_limited','upstream_challenge','upstream_access_denied']){
    let count=0;
    const mockFetch=async()=>{
      count++;
      return {ok:false,status:upstreamError==='upstream_rate_limited'?429:403,json:async()=>({ok:false,error:upstreamError})};
    };
    const call=getCall(mockFetch,{origin:'https://example.workers.dev'},fn=>fn(),URL);
    await assert.rejects(()=>call('page',{url:'https://e-hentai.org/s/testabc/123-1'}));
    assert.equal(count,1,upstreamError+' must be single-shot');
  }
});


test("catalog followed immediately by first image does not produce the old three-second cooldown error",async()=>{
  const oldFetch=globalThis.fetch;
  const gid=734521,token="abcdef1234";
  globalThis.fetch=async url=>{
    if(String(url).includes("/g/734521/"))return new Response(
      '<html><a href="/s/abcdef1234/734521-1">Page 1</a></html>',
      {headers:{"content-type":"text/html"}});
    if(String(url).includes("/s/abcdef1234/734521-1"))return new Response(
      '<html><div id="i3"><img id="img" src="https://ehgt.org/images/page.jpg"></div></html>',
      {headers:{"content-type":"text/html"}});
    throw Error("Unexpected upstream URL: "+url);
  };
  try{
    const catalog=await cloud.fetch(new Request(
      "https://example.workers.dev/api/catalog?gid="+gid+"&token="+token),{});
    assert.equal(catalog.status,200,await catalog.text());
    const page=await cloud.fetch(new Request(
      "https://example.workers.dev/api/page?url="+
      encodeURIComponent("https://e-hentai.org/s/abcdef1234/734521-1")),{});
    const d=await page.json();
    assert.equal(page.status,200,JSON.stringify(d));
    assert.equal(d.image_url,"https://ehgt.org/images/page.jpg");
  }finally{globalThis.fetch=oldFetch;}
});

test("continuous reading and page-swiping controls are both present",()=>{
  assert.match(bridgeScript,/↓ 连续阅读/);
  assert.match(bridgeScript,/⇆ 左右翻页/);
  assert.match(bridgeScript,/ehrweb:v1:readerMode/);
  assert.match(bridgeScript,/function renderContinuous\(r\)/);
  assert.match(bridgeScript,/new IntersectionObserver/);
  assert.match(bridgeScript,/function renderPaged\(r\)/);
  assert.match(bridgeScript,/ontouchstart/);
  assert.match(bridgeScript,/ontouchend/);
  assert.match(bridgeScript,/referrerPolicy='no-referrer'/);
  assert.match(bridgeScript,/Math\.abs\(i-r\.index\)>5/);
  assert.match(bridgeScript,/function saveProgress\(r\)/);
  assert.match(bridgeScript,/function restoredIndex\(x,count\)/);
  assert.doesNotThrow(()=>new Function(bridgeScript));
});

test("remote access denial remains a terminal response",async()=>{
  const oldFetch=globalThis.fetch;
  globalThis.fetch=async()=>new Response("access denied",{status:403,headers:{"content-type":"text/plain"}});
  try{
    const res=await __testing.remote("https://e-hentai.org/s/abcdef1234/734521-1");
    assert.equal(res.error,"upstream_access_denied");
    assert.equal(res.status,403);
  }finally{globalThis.fetch=oldFetch;}
});


test("long-scroll recycling tracks only loaded images and prioritizes visible pages",()=>{
  assert.match(bridgeScript,/loadedSlots:new Set\(\)/);
  assert.match(bridgeScript,/for\(const i of \[\.\.\.r\.loadedSlots\]\)/);
  assert.match(bridgeScript,/Math\.abs\(i-r\.index\)>5/);
  assert.match(bridgeScript,/r\.queue\.sort\(\(a,b\)=>Math\.abs\(a\.index-r\.index\)/);
  assert.match(bridgeScript,/rootMargin:'250px 0px 420px 0px'/);
  assert.doesNotThrow(()=>new Function(bridgeScript));
});
