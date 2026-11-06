import {getPreferences} from './preferences.ts';
import {english} from './translations.ts';
export function t(key:string,...values:unknown[]):string {
 const template=getPreferences().language==='en'?(english[key]??key):key;
 return template.replace(/\{(\d+)\}/g,(match,i)=>Number(i)<values.length?String(values[Number(i)]):match);
}
