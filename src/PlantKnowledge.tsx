import {useEffect, useState} from 'react';
import {Leaf, Loader2, RefreshCw} from 'lucide-react';
import {db, SUPABASE_KEY, SUPABASE_URL} from './lib/supabase';
import {formatRange, type PlantbookDetails} from './lib/plantbook';

export default function PlantKnowledge({species, pid, demo, onChoose}: {species: string; pid?: string | null; demo: boolean; onChoose?: () => void}) {
  const [data, setData] = useState<PlantbookDetails | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const lookup = pid || species.trim().toLowerCase();
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError(''); setLoading(false);
    if (demo || !lookup) return () => controller.abort();
    setLoading(true);
    (async () => {
      try {
        const {data: auth} = await db.auth.getSession();
        if (controller.signal.aborted) return;
        if (!auth.session) throw Error('A fajadatok megtekintéséhez jelentkezz be.');
        const response = await fetch(SUPABASE_URL + '/functions/v1/plant-search?pid=' + encodeURIComponent(lookup), {
          headers: {apikey: SUPABASE_KEY, Authorization: 'Bearer ' + auth.session.access_token}, signal: controller.signal
        });
        const body = await response.json();
        if (!response.ok) throw Error(body.error || 'A fajadatok most nem érhetők el.');
        if (!body.plant?.pid) throw Error('A fajadatbázis hiányos választ küldött.');
        if (!controller.signal.aborted) setData(body.plant);
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Nem sikerült betölteni a fajadatokat.');
      } finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [lookup, demo, attempt]);
  return <section className="plant-knowledge" aria-label="OpenPlantbook fajismeret">
    <div className="section-heading"><div><span className="eyebrow">ISMERD MEG JOBBAN</span><h2><Leaf size={21}/> Fajismeret</h2></div><a href="https://open.plantbook.io" target="_blank" rel="noreferrer">OpenPlantbook ↗</a></div>
    {demo ? <p className="muted">Saját fiókkal itt láthatod a faj környezeti igényeit és az elérhető gondozási útmutatókat.</p> : !lookup ? <p className="muted">Adj meg egy fajt a növény szerkesztésénél, és válassz az OpenPlantbook találatai közül.</p> : loading ? <p className="knowledge-status" role="status"><Loader2 className="spin" size={18}/> Fajadatok betöltése…</p> : error ? <div role="status"><p>{error}</p><div className="button-row"><button type="button" className="text-link" onClick={() => setAttempt(a => a+1)}><RefreshCw size={15}/> Újrapróbálom</button>{onChoose && <button type="button" className="text-link" onClick={onChoose}>Faj kiválasztása</button>}</div></div> : data && <PlantbookFacts data={data}/>}
  </section>;
}

export function PlantbookFacts({data}: {data: PlantbookDetails}) {
  const ranges = [
    ['Hőmérséklet', formatRange(data.min_temp, data.max_temp, '°C')],
    ['Megvilágítás', formatRange(data.min_light_lux, data.max_light_lux, 'lux')],
    ['Levegő páratartalma', formatRange(data.min_env_humid, data.max_env_humid, '%')]
  ].filter(([, value]) => value);
  const sensorRanges = [
    ['Talajnedvesség', formatRange(data.min_soil_moist, data.max_soil_moist, '%')],
    ['Talaj vezetőképessége (EC)', formatRange(data.min_soil_ec, data.max_soil_ec, 'µS/cm')]
  ].filter(([, value]) => value);
  const guidance = ([['sunlight','Fényigény'],['watering','Öntözés'],['soil','Talaj és közeg'],['fertilization','Tápoldatozás'],['pruning','Metszés']] as const).filter(([key]) => data[key]);
  return <>
      <div className="knowledge-identity"><strong>{data.display_pid}</strong>{data.alias && data.alias.toLowerCase() !== data.display_pid.toLowerCase() && <span>{data.alias}</span>}{data.origin && <p><span>Származás</span> {data.origin}</p>}{data.scientific_synonyms && <p><span>További tudományos nevek</span> {data.scientific_synonyms}</p>}</div>
      {ranges.length > 0 && <dl className="knowledge-ranges">{ranges.map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
      {guidance.length > 0 && <div className="knowledge-guidance">{guidance.map(([key,label]) => <div key={key}><h3>{label}</h3><p>{data[key]}</p></div>)}<p className="field-hint">A szöveges útmutatók az adatforrás nyelvén jelennek meg.</p></div>}
      {!ranges.length && !guidance.length && <p className="muted">Ehhez a fajhoz még nincs kitöltött környezeti vagy gondozási útmutató.</p>}
      {sensorRanges.length > 0 && <details className="knowledge-sensors"><summary>Talajszenzorral mérhető értékek</summary><dl className="knowledge-ranges">{sensorRanges.map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p className="field-hint">Szenzorfüggő irányértékek. A talajnedvesség százaléka nem öntözővíz-mennyiség; az EC nem tápoldat-adagolási javaslat.</p></details>}
      {data.image_url && <details className="knowledge-reference"><summary>Fajfotó az adatbázisból</summary><img loading="lazy" referrerPolicy="no-referrer" src={data.image_url} alt={data.display_pid + ' – OpenPlantbook fajfotó'}/><p className="field-hint">Forrás: {data.image_source || 'OpenPlantbook'}{data.image_license ? ' · ' + data.image_license : ' · A képhasználati feltételeket az adatforrásnál ellenőrizheted.'}</p></details>}
      <p className="knowledge-note">Adatforrás: OpenPlantbook · Általános fajadatok, a lakásod körülményeihez igazítva használd őket. A saját gondozási tervedet ezek az adatok nem módosítják.</p>
  </>;
}
