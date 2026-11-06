import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import ts from 'typescript';
import {createServer} from 'vite';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {parsePreferences,setPreferences,getPreferences,subscribePreferences,locale} from '../src/lib/preferences.ts';
import {t} from '../src/lib/i18n.ts';
import {english} from '../src/lib/translations.ts';
import {formatRange} from '../src/lib/plantbook.ts';
assert.deepEqual(parsePreferences(null),{language:'hu',theme:'system'});
assert.deepEqual(parsePreferences({language:'bad',theme:'unknown'}),{language:'hu',theme:'system'});
assert.deepEqual(parsePreferences({language:'en',theme:'dark'}),{language:'en',theme:'dark'});
let notifications=0;const stop=subscribePreferences(()=>notifications++);
setPreferences({language:'en',theme:'dark'});
assert.equal(locale(),'en-GB');assert.equal(getPreferences().theme,'dark');assert.equal(notifications,1);
assert.equal(t('Beállítások'),'Settings');
assert.equal(t('Tápoldatozás {0} naponta',30),'Feed every 30 days');
assert.equal(t('Szia,'),'Hi,');assert.equal(t('Custom user content'),'Custom user content');
assert.equal(formatRange(null,80,'%'),'up to 80 %');
assert.equal(formatRange(1200,6000,'lux'),'1,200–6,000 lux');
stop();setPreferences({language:'hu',theme:'light'});
assert.equal(t('Beállítások'),'Beállítások');assert.equal(notifications,1);
// Every explicit app translation key has an English entry.
function check(path){const text=readFileSync(path,'utf8');const ast=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true,path.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);function visit(n){if(ts.isCallExpression(n)&&n.expression.getText(ast)==='t'&&ts.isStringLiteral(n.arguments[0]))assert.ok(Object.hasOwn(english,n.arguments[0].text),'Missing translation: '+n.arguments[0].text);ts.forEachChild(n,visit)}visit(ast)}
for(const dir of ['src','src/lib'])for(const f of readdirSync(dir))if(/\.tsx?$/.test(f)&&f!=='translations.ts')check(dir+'/'+f);
const server=await createServer({server:{middlewareMode:true},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
try{
 const prefs=await server.ssrLoadModule('/src/lib/preferences.ts');const {default:Settings}=await server.ssrLoadModule('/src/AppearanceSettings.tsx');const {default:App}=await server.ssrLoadModule('/src/App.tsx');
 prefs.setPreferences({language:'en',theme:'dark'});
 const panel=renderToStaticMarkup(createElement(Settings));assert.match(panel,/Appearance and language/);assert.match(panel,/Dark/);assert.match(panel,/English/);
 const page=renderToStaticMarkup(createElement(App));assert.match(page,/My plants/);assert.match(page,/A good place to grow/);assert.doesNotMatch(page,/Jó itt növekedni|Növényeim|Beállítások/);
 prefs.setPreferences({language:'hu',theme:'light'});assert.match(renderToStaticMarkup(createElement(App)),/Jó itt növekedni/);
}finally{await server.close()}
console.log('Preferences checks passed: validation, reactive updates, fallback, interpolation, locale formatting, translation coverage and English/Hungarian app rendering.');
