export const BASE_URL=import.meta.env.BASE_URL;
export const asset=(path:string)=>path.startsWith('/')?BASE_URL+path.slice(1):path;
export const appUrl=()=>new URL(BASE_URL,window.location.origin).href;
