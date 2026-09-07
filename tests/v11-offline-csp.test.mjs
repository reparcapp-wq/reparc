import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

test("offline app-shell cache preserves the response CSP and matching script nonce", async () => {
  const source = await readFile(new URL("../public/sw.js",import.meta.url),"utf8");
  const handlers = {}, entries = new Map(); let online = true;
  const key = input => typeof input === "string" ? new URL(input,"https://fixture.invalid").pathname : new URL(input.url).pathname;
  const cache = {put:async(input,response)=>entries.set(key(input),response.clone()),match:async input=>entries.get(key(input))?.clone()};
  const nonce = "dGVzdC1jYWNoZS1ub25jZQ==", html = `<html><body><script nonce="${nonce}">window.fixture=true</script></body></html>`;
  const response = () => { const value = new Response(html,{headers:{"Content-Type":"text/html","Content-Security-Policy":`script-src 'nonce-${nonce}' 'strict-dynamic'`}}); Object.defineProperty(value,"type",{value:"basic"}); return value; };
  runInNewContext(source,{URL,Response,console,caches:{open:async()=>cache},self:{location:{origin:"https://fixture.invalid"},addEventListener:(name,handler)=>{handlers[name]=handler;}},fetch:async()=>{if(!online) throw new Error("offline");return response();}});
  let installed; handlers.install({waitUntil:promise=>{installed=promise;}}); await installed;
  online = false; let result;
  handlers.fetch({request:{url:"https://fixture.invalid/",method:"GET",mode:"navigate"},respondWith:promise=>{result=promise;}});
  const cached = await result;
  assert.equal(cached.status,200); assert.equal(await cached.text(),html);
  assert.equal(cached.headers.get("content-security-policy"),`script-src 'nonce-${nonce}' 'strict-dynamic'`);
  let intercepted = false;
  handlers.fetch({request:{url:"https://fixture.invalid/api/improvement",method:"GET",mode:"navigate"},respondWith:()=>{intercepted=true;}});
  assert.equal(intercepted,false,"privacy status must not be served from the offline shell cache");
});
