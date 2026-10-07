import test from 'node:test';
import assert from 'node:assert/strict';
import { readJson, rateAllowed } from '../cloudflare/request-safety.js';
import worker from '../cloudflare/worker.js';

test('rejects oversized bodies even when Content-Length is missing', async () => {
  const req = new Request('https://example.com', { method:'POST', body:JSON.stringify({ message:'x'.repeat(80) }) });
  await assert.rejects(readJson(req, 32), RangeError);
});
test('parses bounded JSON and rejects malformed JSON', async () => {
  assert.deepEqual(await readJson(new Request('https://example.com', { method:'POST', body:'{"name":"QA"}' }), 100), { name:'QA' });
  await assert.rejects(readJson(new Request('https://example.com', { method:'POST', body:'not-json' }), 100), SyntaxError);
});
test('rate counters persist across requests and use a hashed IP key', async () => {
  let count = 0; let key = '';
  const db = { prepare(sql) { return { bind(...args) { if(sql.includes('INSERT')) key=args[0]; return this; }, async run(){}, async first(){ return { attempts:++count }; } }; } };
  const req = new Request('https://example.com', { headers:{'CF-Connecting-IP':'192.0.2.1'} });
  for(let i=0;i<10;i++) assert(await rateAllowed(req,db,'lead',10,600));
  assert.equal(await rateAllowed(req,db,'lead',10,600),false);
  assert(!key.includes('192.0.2.1'));
});
test('quote spam trap returns without touching storage or delivery', async () => {
  const response=await worker.fetch(new Request('https://bryantconstructiongroup.co.uk/api/send-lead', {method:'POST',body:JSON.stringify({website:'bot-filled'})}),{});
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true});
});
test('oversized review request and non-object lead data are rejected',async()=>{
  const huge=await worker.fetch(new Request('https://bryantconstructiongroup.co.uk/api/submit-review',{method:'POST',body:JSON.stringify({message:'x'.repeat(33000)})}),{});
  assert.equal(huge.status,413);
  const invalid=await worker.fetch(new Request('https://bryantconstructiongroup.co.uk/api/send-lead',{method:'POST',body:'null'}),{});
  assert.equal(invalid.status,400);
});
test('attachment responses cannot execute same-origin uploaded content',async()=>{
  const response=await worker.fetch(new Request('https://bryantconstructiongroup.co.uk/api/contact-upload/test/file.svg'),{CONTACT_UPLOADS:{async get(){return {body:'<svg/>',customMetadata:{filename:'file.svg'},writeHttpMetadata(headers){headers.set('Content-Type','image/svg+xml')}}}}});
  assert.equal(response.status,200);assert(response.headers.get('Content-Disposition').startsWith('attachment;'));assert(response.headers.get('Content-Security-Policy').includes('sandbox'));assert.equal(response.headers.get('X-Content-Type-Options'),'nosniff');
});
