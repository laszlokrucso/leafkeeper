import {t} from './i18n';
import type {Plant} from './care';
import {formatRange, type PlantbookDetails} from './plantbook';

export function displayName(value: unknown): string {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().replace(/\s+/g, ' ').slice(0,40) : '';
}
export const speciesKey = (p: Plant) => (p.openplantbook_pid || p.species).trim().toLowerCase();
export type PersonalTip = {id: string; plantId: string; plantName: string; title: string; text: string};
export function daySeed(date: string): number {
  return Array.from(date).reduce((sum,c) => sum * 31 + c.charCodeAt(0),0) >>> 0;
}
export function buildTips(plants: Plant[], facts: Record<string, PlantbookDetails>): PersonalTip[] {
  const tips: PersonalTip[] = [];
  const seen = new Set<string>();
  for (const p of plants) {
    const key = speciesKey(p), d = facts[key];
    if (p.status === 'archived' || !d || seen.has(key)) continue;
    seen.add(key);
    const add = (kind: string, title: string, text: string) => tips.push({id:key+':'+kind,plantId:p.id,plantName:p.name,title,text});
    const temp = formatRange(d.min_temp,d.max_temp,'°C');
    const humidity = formatRange(d.min_env_humid,d.max_env_humid,'%');
    const light = formatRange(d.min_light_lux,d.max_light_lux,'lux');
    if (temp) add('temp',t("Hőmérséklet"), t("A faj adatbázisban megadott hőmérsékleti tartománya: ")+temp+t(". Érdemes ellenőrizni, milyen meleg van a növényed helyén."));
    if (humidity) add('humidity',t("Páratartalom"),t("A fajhoz megadott levegő-páratartalom: ")+humidity+t(". Egy páramérő segíthet megismerni a helyét."));
    if (light) add('light',t("Fényigény"),t("A fajhoz megadott megvilágítás: ")+light+t(". A helyi fényviszonyok az évszakkal is változnak."));
    if (d.origin?.trim()) add('origin',t("Honnan származik?"), t("Az OpenPlantbook szerinti származása: ")+d.origin.trim()+'.');
    for (const [field,title] of [['watering','Öntözés'],['soil',t("Talaj és közeg")],['sunlight',t("Fény")],['fertilization',t("Tápoldatozás")],['pruning',t("Metszés")]] as const) {
      const value = d[field]?.trim();
      if (value) add(field,title,value.length > 400 ? value.slice(0,397)+'…' : value);
    }
  }
  return tips;
}

