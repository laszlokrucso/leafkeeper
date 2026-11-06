import {useSyncExternalStore} from 'react';
import {Sun,Globe} from 'lucide-react';
import {getPreferences,subscribePreferences,setPreferences,type Theme,type Language} from './lib/preferences';
import {t} from './lib/i18n';
export default function AppearanceSettings(){
 const prefs=useSyncExternalStore(subscribePreferences,getPreferences,getPreferences);
 return <section className="settings-card appearance-settings"><span className="settings-icon"><Sun/></span><h2>{t('Megjelenés és nyelv')}</h2><div className="form"><label>{t('Megjelenés')}<select value={prefs.theme} onChange={e=>setPreferences({theme:e.target.value as Theme})}><option value="system">{t('Készülék beállítása')}</option><option value="light">{t('Világos')}</option><option value="dark">{t('Sötét')}</option></select></label><label><span className="language-label"><Globe size={16}/>{t('Nyelv')}</span><select value={prefs.language} onChange={e=>setPreferences({language:e.target.value as Language})}><option value="hu" lang="hu">Magyar</option><option value="en" lang="en">English</option></select></label><p className="muted">{t('A választásaid ezen az eszközön megmaradnak.')}</p></div></section>;
}
