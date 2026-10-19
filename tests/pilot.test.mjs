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
  assert.ok(result.includes("<script src='/__ehr_cloud.js?v=1403'></script>"), "valid tag emitted");
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
