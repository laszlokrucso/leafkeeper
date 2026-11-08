import {MODEL,PROMPT_VERSION,DoctorError,parseInput,buildRequest,normalizeResult,normalizeUsage,fingerprint} from './core.ts';
const origins=new Set(['https://laszlokrucso.github.io','http://localhost:5173']);
const counts=new Map<string,{start:number;n:number}>();
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('Origin');const headers:Record<string,string>={'Vary':'Origin','Cache-Control':'no-store','Access-Control-Allow-Methods':'GET, PUT, DELETE, POST, OPTIONS','Access-Control-Allow-Headers':'authorization, apikey, content-type,x-client-info'};
 if(origin&&origins.has(origin))headers['Access-Control-Allow-Origin']=origin;
 const reply=(data:unknown,status=200)=>Response.json(data,{status,headers});
 if(origin&&!origins.has(origin))return reply({error:'origin_denied'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(!['GET','PUT','DELETE','POST'].includes(req.method))return reply({error:'method_denied'},405);
 const authorization=req.headers.get('Authorization');if(!authorization?.startsWith('Bearer '))return reply({error:'sign_in'},401);
 let analysisId:string|undefined;let owner:string|undefined;
 let admin:(path:string,options?:RequestInit)=>Promise<any>;
 try{
  const base=Deno.env.get('SUPABASE_URL')!;
  const publicKey=Object.values(JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}') as Record<string,string>)[0]||Deno.env.get('SUPABASE_ANON_KEY')!;
  const auth=await fetch(base+'/auth/v1/user',{headers:{apikey:publicKey,Authorization:authorization},signal:AbortSignal.timeout(8000)});if(!auth.ok)throw new DoctorError('sign_in',401);
  const user=await auth.json();if(typeof user.id!=='string')throw new DoctorError('sign_in',401);owner=user.id;
  const now=Date.now();let count=counts.get(owner!);if(!count||now-count.start>60000){count={start:now,n:0};counts.set(owner!,count)}if(++count.n>30)throw new DoctorError('rate_limit',429);if(counts.size>2000)counts.clear();
  const secret=Object.values(JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}') as Record<string,string>)[0]||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!secret)throw new DoctorError('unavailable',503);
  const adminHeaders:Record<string,string>={apikey:secret,'Content-Type':'application/json'};if(secret.startsWith('eyJ'))adminHeaders.Authorization='Bearer '+secret;
  admin=async(path,options={})=>{const r=await fetch(base+'/rest/v1/'+path,{...options,headers:{...adminHeaders,...options.headers},signal:AbortSignal.timeout(10000)});if(!r.ok)throw new DoctorError('storage_failed',503);const text=await r.text();return text?JSON.parse(text):null;};
  const keyRpc=(action:string,key?:string)=>admin('rpc/lk_ai_key',{method:'POST',body:JSON.stringify({p_owner:owner,p_action:action,...(key?{p_secret:key}:{})})});
  if(req.method==='GET')return reply({...await keyRpc('status'),model:MODEL});
  if(req.method==='DELETE')return reply(await keyRpc('delete'));
  const reader=req.body?.getReader();if(!reader)throw new DoctorError('invalid_input');let size=0;const chunks:Uint8Array[]=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1900000){await reader.cancel();throw new DoctorError('invalid_image',413)}chunks.push(value)}
  const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length}
  let body:Record<string,unknown>;try{body=JSON.parse(new TextDecoder().decode(bytes));if(!body||typeof body!=='object'||Array.isArray(body))throw Error()}catch{throw new DoctorError('invalid_input')}
  if(req.method==='PUT'){
   const key=typeof body.key==='string'?body.key.trim():'';if(!/^[A-Za-z0-9_-]{20,200}$/.test(key))throw new DoctorError('invalid_key');
   const check=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+MODEL,{headers:{'x-goog-api-key':key},signal:AbortSignal.timeout(10000)});
   if(!check.ok)throw new DoctorError(check.status===429?'quota':check.status===404?'model_unavailable':'invalid_key',400);
   const info=await check.json();if(!info.supportedGenerationMethods?.includes('generateContent'))throw new DoctorError('model_unavailable',400);
   return reply(await keyRpc('set',key));
  }
  if(body.action==='journal'){
   if(typeof body.analysis_id!=='string'||!/^[0-9a-f-]{36}$/i.test(body.analysis_id))throw new DoctorError('invalid_input');
   const id=await admin('rpc/lk_ai_to_journal',{method:'POST',body:JSON.stringify({p_owner:owner,p_analysis:body.analysis_id})});return reply({event_id:id});
  }
  const input=parseInput(body);
  // Ownership and the compact context come from the database, never from caller-supplied plant data.
  const plants=await admin('lk_plants?id=eq.'+input.plantId+'&owner_id=eq.'+owner+'&select=id,species,pot,soil,status');const plant=plants?.[0];if(!plant)throw new DoctorError('plant_missing',404);
  const events=await admin('lk_events?plant_id=eq.'+input.plantId+'&owner_id=eq.'+owner+'&select=kind,occurred_on&order=occurred_on.desc&limit=3');
  const context={species:String(plant.species||'').slice(0,120),pot:String(plant.pot||'').slice(0,100),soil:String(plant.soil||'').slice(0,120),recent_care:events};
  const hash=await fingerprint({version:PROMPT_VERSION,model:MODEL,category:input.category,language:input.language,symptoms:input.symptoms,image:input.image,context});
  const claim=await admin('rpc/lk_ai_claim',{method:'POST',body:JSON.stringify({p_owner:owner,p_plant:input.plantId,p_request:input.requestId,p_hash:hash,p_category:input.category,p_language:input.language,p_symptoms:input.symptoms,p_model:MODEL})});
  if(claim.state==='ready')return reply({analysis:claim.analysis,cached:true});
  if(claim.state!=='claimed')throw new DoctorError(['daily_limit','rate_limit'].includes(claim.state)?claim.state:claim.state==='failed'?'previous_failed':claim.state==='invalid_input'?'invalid_input':'busy',409);
  analysisId=claim.analysis.id;
  const credential=await keyRpc('get');if(!credential?.key)throw new DoctorError('key_missing',400);
  const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+MODEL+':generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':credential.key},body:JSON.stringify(buildRequest(input,context)),signal:AbortSignal.timeout(45000)});
  if(!r.ok)throw new DoctorError(r.status===429?'quota':r.status===401||r.status===403?'invalid_key':r.status===404?'model_unavailable':'provider_failed',502);
  const generated=await r.json();const candidate=generated.candidates?.[0];if(candidate?.finishReason!=='STOP')throw new DoctorError('incomplete_result',502);
  const text=(candidate.content?.parts||[]).filter((p:{text?:string;thought?:boolean})=>p.text&&!p.thought).map((p:{text:string})=>p.text).join('');
  let parsed:unknown;try{parsed=JSON.parse(text)}catch{throw new DoctorError('incomplete_result',502)}
  const result=normalizeResult(parsed),usage=normalizeUsage(generated.usageMetadata);
  const saved=await admin('lk_ai_analyses?id=eq.'+analysisId+'&owner_id=eq.'+owner,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status:'ready',result,usage,completed_at:new Date().toISOString()})});
  return reply({analysis:saved[0],cached:false});
 }catch(e){
  const code=e instanceof DoctorError?e.code:e instanceof Error&&['TimeoutError','AbortError'].includes(e.name)?'timeout':'unavailable';
  if(analysisId&&owner){try{await admin!('lk_ai_analyses?id=eq.'+analysisId+'&owner_id=eq.'+owner,{method:'PATCH',body:JSON.stringify({status:'failed',error_code:code,completed_at:new Date().toISOString()})})}catch{/* No credentials or provider bodies are logged. */}}
  return reply({error:code},e instanceof DoctorError?e.status:503);
 }
});
