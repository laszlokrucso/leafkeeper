import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const server=await createServer({server:{middlewareMode:true},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
try {
 const {default:Panel,DoctorResultView}=await server.ssrLoadModule('/src/DoctorPanel.tsx');
 const {default:Settings}=await server.ssrLoadModule('/src/GeminiSettings.tsx');
 const demo=renderToStaticMarkup(createElement(Panel,{plant:{id:'plant'},onSignIn:()=>{},onJournalSaved:async()=>{}}));
 assert.match(demo,/Bejelentkezés/);assert.doesNotMatch(demo,/type="file"/);
 const form=renderToStaticMarkup(createElement(Panel,{plant:{id:'plant'},ownerId:'user',onSignIn:()=>{},onJournalSaved:async()=>{}}));
 assert.match(form,/maxLength="400"/);assert.match(form,/type="checkbox"/);assert.equal((form.match(/<option /g)||[]).length,3);
 const settings=renderToStaticMarkup(createElement(Settings,{ownerId:'user'}));assert.match(settings,/type="password"/);assert.match(settings,/autoComplete="off"/);
 const result=renderToStaticMarkup(createElement(DoctorResultView,{cached:true,analysis:{result:{summary:'<script>attack</script>',observations:['sign'],possible_causes:[],next_steps:['step'],follow_up:''},usage:{total:700,input:500,output:180,thinking:20}}}));
 assert.match(result,/&lt;script&gt;attack&lt;\/script&gt;/);assert.doesNotMatch(result,/<script>/);assert.match(result,/700/);assert.match(result,/ÚJ API-HÍVÁS NÉLKÜL/);
 console.log('AI UI checks passed: demo gating, categories, consent, password field, escaped results and original token usage.');
}finally{await server.close()}
