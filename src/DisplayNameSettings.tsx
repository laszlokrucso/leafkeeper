import {useEffect,useState} from 'react';
import {Check,Loader2} from 'lucide-react';
import {db} from './lib/supabase';
import {displayName} from './lib/personal';

export default function DisplayNameSettings({userId,value,onSaved}:{userId:string;value:string;onSaved:(name:string)=>void}) {
  const [name,setName]=useState(value),[pending,setPending]=useState(false),[error,setError]=useState('');
  useEffect(()=>{setName(value);setError('')},[value,userId]);
  async function save(e:React.FormEvent) {
    e.preventDefault(); if(pending)return;
    const normalized=displayName(name);setPending(true);setError('');
    try {
      const {data:auth}=await db.auth.getSession();
      if(auth.session?.user.id!==userId)throw Error('A munkamenet megváltozott. Jelentkezz be újra.');
      const {data,error}=await db.auth.updateUser({data:{display_name:normalized}});
      if(error)throw error;
      if(data.user.id===userId){setName(normalized);onSaved(normalized)}
    } catch {setError('A nevet nem sikerült elmenteni. Ellenőrizd a kapcsolatot, majd próbáld újra.')}
    finally {setPending(false)}
  }
  return <form className="form name-settings" onSubmit={save}><h3>Hogyan szólíthatunk?</h3><label>Felhasználói név<input autoComplete="nickname" maxLength={40} value={name} onChange={e=>setName(e.target.value)} placeholder="Például: Laci" disabled={pending}/></label><p className="field-hint">Ezzel a névvel köszöntünk. Bármikor átírhatod; az üres mező visszaállítja az általános köszöntést.</p>{error&&<p className="form-error" role="alert">{error}</p>}<button className="secondary" disabled={pending||displayName(name)===value}>{pending?<Loader2 className="spin" size={16}/>:<Check size={16}/>}Név mentése</button></form>;
}
