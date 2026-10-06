import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../cloudflare/worker.js';
const lead={name:'TEST local only',phone:'07700900000',email:'',postcode:'BH1 1AA',service:'General Building',message:'Mock delivery only'};
const request=input=>new Request('https://bryantconstructiongroup.co.uk/api/send-lead',{method:'POST',headers:{Origin:'https://bryantconstructiongroup.co.uk','Content-Type':'application/json'},body:JSON.stringify(input)});
function database(fail=''){return {prepare(sql){return {bind(){return this},async run(){if(fail&&sql.startsWith(fail))throw new Error('simulated failure');return {meta:{last_row_id:1}}}}}}}
test('delivery success survives reporting failures without sending twice',async()=>{
 const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return new Response('{"id":"mock"}',{status:200})};
 try{for(const fail of ['UPDATE leads','INSERT INTO lead_events']){calls=0;const result=await worker.fetch(request(lead),{LEADS_DB:database(fail),RESEND_API_KEY:'test-only'});assert.equal(result.status,200);assert.equal(calls,1)}}finally{globalThis.fetch=original}
});
test('fallback requires explicit success, and failed delivery is recorded',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response('{}',{status:200});try{assert.equal((await worker.fetch(request(lead),{LEADS_DB:database()})).status,502)}finally{globalThis.fetch=original}
});
test('storage outage never sends mail and returns a recoverable error',async()=>{
 const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw new Error('unexpected send')};try{assert.equal((await worker.fetch(request(lead),{LEADS_DB:database('CREATE TABLE')})).status,503);assert.equal(calls,0)}finally{globalThis.fetch=original}
});
test('malformed base64 is rejected before upload or mail',async()=>{
 assert.equal((await worker.fetch(request({...lead,attachments:[{filename:'bad.png',content:'abc'}]}),{LEADS_DB:database()})).status,400)
});
test('unexpected rate storage errors return JSON rather than uncaught exceptions',async()=>{
 const r=request(lead);r.headers.set('CF-Connecting-IP','192.0.2.1');const result=await worker.fetch(r,{LEADS_DB:database('CREATE TABLE')});assert.equal(result.status,503);assert.equal((await result.json()).ok,false)
});
test('private administration routes reject anonymous requests',async()=>{for(const path of ['/api/dashboard','/api/leads/export','/api/lead-events/export'])assert.equal((await worker.fetch(new Request('https://bryantconstructiongroup.co.uk'+path),{})).status,401)});
