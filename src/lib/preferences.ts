export type Language='hu'|'en';
export type Theme='light'|'dark'|'system';
export type Preferences={language:Language;theme:Theme};
const storageKey='lk-preferences-v1';
export function parsePreferences(value:unknown):Preferences {
 const p=value&&typeof value==='object'?value as Record<string,unknown>:{};
 return {language:p.language==='en'?'en':'hu',theme:p.theme==='light'||p.theme==='dark'?p.theme:'system'};
}
function read():Preferences {try{return parsePreferences(JSON.parse(localStorage.getItem(storageKey)||'{}'))}catch{return parsePreferences(null)}}
let current=typeof window==='undefined'?parsePreferences(null):read();
const listeners=new Set<()=>void>();
export const getPreferences=()=>current;
export const subscribePreferences=(fn:()=>void)=>{listeners.add(fn);return ()=>{listeners.delete(fn)}};
export const locale=()=>current.language==='en'?'en-GB':'hu-HU';
export function applyPreferences(){
 if(typeof document==='undefined')return;
 const dark=current.theme==='dark'||current.theme==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches;
 document.documentElement.dataset.theme=dark?'dark':'light';document.documentElement.lang=current.language;
 document.title=current.language==='en'?"LeafKeeper — Your plants' story":'LeafKeeper — A növényeid története';
 document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark?'#111b16':'#f7f8f3');
}
export function setPreferences(patch:Partial<Preferences>){
 current=parsePreferences({...current,...patch});
 try{localStorage.setItem(storageKey,JSON.stringify(current))}catch{/* The current choice still works if device storage is unavailable. */}
 applyPreferences();listeners.forEach(fn=>fn());
}
if(typeof window!=='undefined'){
 applyPreferences();
 window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',applyPreferences);
 window.addEventListener('storage',e=>{if(e.key===storageKey){current=read();applyPreferences();listeners.forEach(fn=>fn())}});
}
