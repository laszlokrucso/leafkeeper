import {useEffect,useState} from 'react';
import {ArrowRight,RefreshCw,Sun} from 'lucide-react';
import {db,SUPABASE_KEY,SUPABASE_URL} from './lib/supabase';
import {today,type Plant} from './lib/care';
import type {PlantbookDetails} from './lib/plantbook';
import {buildTips,daySeed,speciesKey,type PersonalTip} from './lib/personal';

const cache = new Map<string,{data:PlantbookDetails;until:number}>();
export default function DailyTip({plants,userId,onOpen}:{plants:Plant[];userId?:string;onOpen:(p:Plant)=>void}) {
  const day=today();
  const signature=JSON.stringify(plants.filter(p=>p.status!=='archived'&&speciesKey(p)).map(p=>[p.id,p.name,p.species,p.openplantbook_pid]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));
  const key=(userId||'demo')+':'+day+':'+signature;
  const [state,setState]=useState<{key:string;tips:PersonalTip[];error:boolean}>({key:'',tips:[],error:false});
  const [step,setStep]=useState(0),[attempt,setAttempt]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();setStep(0);
    if(!userId){setState({key,tips:[],error:false});return ()=>controller.abort()}
    const candidates=plants.filter(p=>p.status!=='archived'&&speciesKey(p));
    const species=Array.from(new Set(candidates.map(speciesKey))).sort();
    if(!species.length){setState({key,tips:[],error:false});return ()=>controller.abort()}
    (async()=>{
      const facts:Record<string,PlantbookDetails>={};let failed=false;
      try {
        const {data:auth}=await db.auth.getSession();
        if(controller.signal.aborted)return;
        if(auth.session?.user.id!==userId)throw Error('Session changed');
        // Rotate through the collection, with at most three provider requests per visit.
        const start=daySeed(day)%species.length;
        for(let i=0;i<Math.min(3,species.length);i++){
          const pid=species[(start+i)%species.length],cacheKey=userId+':'+pid,hit=cache.get(cacheKey);
          if(hit&&hit.until>Date.now()){facts[pid]=hit.data;continue}
          const response=await fetch(SUPABASE_URL+'/functions/v1/plant-search?pid='+encodeURIComponent(pid),{headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+auth.session.access_token},signal:controller.signal});
          if(response.status===404)continue;
          if(!response.ok){failed=true;continue}
          const body=await response.json();
          if(body.plant?.pid!==pid){failed=true;continue}
          facts[pid]=body.plant;
          if(cache.size>=100)cache.delete(cache.keys().next().value!);
          cache.set(cacheKey,{data:body.plant,until:Date.now()+86400000});
        }
      }catch{failed=true}
      if(!controller.signal.aborted)setState({key,tips:buildTips(candidates,facts),error:failed});
    })();
    return ()=>controller.abort();
  },[key,attempt]);
  const loaded=state.key===key;
  const tips=loaded?state.tips:[];
  const tip=tips.length?tips[(daySeed(day)+step)%tips.length]:null;
  const plant=tip?plants.find(p=>p.id===tip.plantId):undefined;
  return <div className="tip-card personal-tip"><span className="eyebrow"><Sun size={16}/> TUDTAD?</span>{tip&&plant?<><span className="tip-plant">{tip.plantName} · {tip.title}</span><h3>Egy érdekesség a növényedről.</h3><p aria-live="polite">{tip.text}</p><small>Forrás: OpenPlantbook · Általános fajadat{['watering','soil','sunlight','fertilization','pruning'].some(k=>tip.id.endsWith(':'+k))?' · Az adatforrás nyelvén':''}</small><div className="tip-actions"><button className="text-link" onClick={()=>onOpen(plant)}>Növény adatlapja <ArrowRight size={15}/></button>{tips.length>1&&<button className="text-link" onClick={()=>setStep(s=>s+1)}><RefreshCw size={14}/>Másik tipp</button>}</div></>:!userId?<><h3>Előbb egy érintés,<br/>aztán az öntözés.</h3><p>A naptár csak emlékeztet. Nézd meg a föld nedvességét, és a növényed igényei szerint dönts az öntözésről.</p><small>Saját fiókkal a saját növényeid fajadataiból kapsz itt érdekességeket.</small></>:!loaded?<p role="status">Érdekességet keresünk a növényeidhez…</p>:state.error?<><h3>Egy kis türelmet.</h3><p>A személyes fajtippeket most nem sikerült betölteni.</p><button className="text-link" onClick={()=>setAttempt(a=>a+1)}>Újrapróbálom <RefreshCw size={14}/></button></>:<><h3>Ismerjük meg a kertedet!</h3><p>{plants.some(p=>p.status!=='archived')?'A faj pontos kiválasztása után az elérhető fajadatokból mutatunk itt érdekességeket. A növény szerkesztésénél kereshetsz az OpenPlantbookban.':'Az első saját növényed és a faj megadása után itt hozzá kapcsolódó érdekességeket találsz.'}</p></>}</div>;
}
