import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createContactHandlers} from '../lib/contact';

const origin='https://qwarter.com';
const request=(body:object, from=origin) => new Request(origin+'/api/contact',{method:'POST',headers:{origin:from,'content-type':'application/json'},body:JSON.stringify(body)});
const fields={name:'Qwarter migration test', email:'test@example.com',message:'Test enquiry, please disregard.',website:''};
const url='https://hooks.airtable.com/workflows/v1/genericWebhook/test';

test('contact fails closed without its activated connection',async()=>{
  const api=createContactHandlers({});
  assert.equal((await api.GET()).status,503);
  assert.equal((await api.POST(request(fields))).status,503);
});
test('contact checks source, signed form age, and fields before forwarding',async()=>{
  let now=100000, calls=0;
  const api=createContactHandlers({url,enabled:'1',now:()=>now,fetcher:async()=>{calls++;return Response.json({success:true});}});
  const {token}=await (await api.GET()).json();
  assert.equal((await api.POST(request({...fields,token},'https://other.test'))).status,403);
  assert.equal((await api.POST(request({...fields,token}))).status,400);
  now+=2000;
  for(const extra of [{token:token+'broken'},{email:'invalid'},{message:'short'},{website:'spam'}]) assert.equal((await api.POST(request({...fields,token,...extra}))).status,400);
  assert.equal(calls,0);
  assert.equal((await api.POST(request({...fields,token}))).status,200);
  assert.equal(calls,1);
  assert.equal((await api.POST(request({...fields,token}))).status,200);
  assert.equal(calls,1);
  now+=3600001;
  assert.equal((await api.POST(request({...fields,token}))).status,400);
});
test('contact forwards only validated fields and never reports upstream failure as success',async()=>{
  let now=100000, sent:Record<string,unknown>|undefined;
  const api=createContactHandlers({url,enabled:'1',now:()=>now,fetcher:async(_url,init)=>{sent=JSON.parse(String(init?.body));return Response.json({success:false},{status:500});}});
  const {token}=await (await api.GET()).json();now+=2000;
  assert.equal((await api.POST(request({...fields,token,recipient:'attacker@example.com'}))).status,503);
  assert.deepEqual(Object.keys(sent!).sort(),['email','id','message','name','submittedAt']);
  assert.match(String(sent!.submittedAt),/Eastern Time$/);
});
