const origins=new Set(['https://laszlokrucso.github.io','http://localhost:5173']);
const providerHeaders={'Accept':'application/json','User-Agent':'LeafKeeper/0.2 (+https://laszlokrucso.github.io/leafkeeper/)'};
let cached:{token:string;until:number}|null=null;
const counts=new Map<string,{start:number;count:number}>();
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('Origin');
 const cors:Record<string,string>={'Vary':'Origin','Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Cache-Control':'private, no-store'};
 if(origin&&origins.has(origin))cors['Access-Control-Allow-Origin']=origin;
 const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:cors});
 if(origin&&!origins.has(origin))return reply({error:'Ez a webhely nem engedélyezett.'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='GET')return reply({error:'Csak GET kérés támogatott.'},405);
 const authorization=req.headers.get('Authorization');
 if(!authorization?.startsWith('Bearer '))return reply({error:'Fajkereséshez jelentkezz be.'},401);
 const url=Deno.env.get('SUPABASE_URL')!;
 const publicKeys=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}') as Record<string,string>;
 const key=Object.values(publicKeys)[0]||Deno.env.get('SUPABASE_ANON_KEY')!;
 let user:{id:string};
 try{const r=await fetch(url+'/auth/v1/user',{headers:{apikey:key,Authorization:authorization},signal:AbortSignal.timeout(8000)});if(!r.ok)return reply({error:'A munkamenet lejárt. Jelentkezz be újra.'},401);user=await r.json();}catch{return reply({error:'A bejelentkezés ellenőrzése most nem érhető el.'},503);}
 const now=Date.now();let limit=counts.get(user.id);if(!limit||now-limit.start>60000){limit={start:now,count:0};counts.set(user.id,limit);}if(++limit.count>20)return reply({error:'Túl sok keresés. Próbáld egy perc múlva.'},429);if(counts.size>2000)counts.clear();
 const q=new URL(req.url).searchParams.get('q')?.trim();if(!q||q.length<3||q.length>120)return reply({error:'Legalább 3, legfeljebb 120 karaktert adj meg.'},400);
 const id=Deno.env.get('OPENPLANTBOOK_CLIENT_ID'),secret=Deno.env.get('OPENPLANTBOOK_CLIENT_SECRET');if(!id||!secret)return reply({error:'A fajkereső beállítása még folyamatban van. A fajt kézzel is megadhatod.'},503);
 try{
  if(!cached||cached.until<now){const r=await fetch('https://open.plantbook.io/api/v1/token/',{method:'POST',headers:{...providerHeaders,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',client_id:id,client_secret:secret,scope:'read'}),signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Provider authentication failed');const j=await r.json();if(typeof j.access_token!=='string'||typeof j.expires_in!=='number')throw Error('Invalid provider response');cached={token:j.access_token,until:now+Math.max(0,j.expires_in-60)*1000};}
  const r=await fetch('https://open.plantbook.io/api/v1/plant/search?alias='+encodeURIComponent(q)+'&userplant=false&limit=15',{headers:{...providerHeaders,Authorization:'Bearer '+cached.token},signal:AbortSignal.timeout(10000)});
  if(!r.ok){if(r.status===401)cached=null;return reply({error:r.status===429?'A fajadatbázis keresési kerete elfogyott. Próbáld később.':'A fajadatbázis most nem érhető el. Kézzel is megadhatod a fajt.'},502);}
  const j=await r.json();return reply({results:(j.results||[]).slice(0,15).map((p:{pid:string;display_pid?:string})=>({pid:p.pid,display_pid:p.display_pid||p.pid})),source:'OpenPlantbook'});
 }catch{return reply({error:'Nem sikerült elérni a fajadatbázist. Próbáld később, vagy add meg kézzel.'},502);}
});
