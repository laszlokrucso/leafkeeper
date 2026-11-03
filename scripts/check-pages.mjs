import {readFileSync,readdirSync,statSync} from 'node:fs';
import assert from 'node:assert/strict';
const html=readFileSync('dist/index.html','utf8');assert.ok(html.includes('/leafkeeper/assets/'));assert.ok(html.includes('/leafkeeper/manifest.webmanifest'));
const m=JSON.parse(readFileSync('dist/manifest.webmanifest','utf8'));assert.equal(m.scope,'./');assert.equal(m.start_url,'./');assert.ok(m.icons.every(i=>!i.src.startsWith('/')));
const js=readdirSync('dist/assets').filter(x=>x.endsWith('.js')).map(x=>readFileSync('dist/assets/'+x,'utf8')).join('');assert.ok(js.includes('/functions/v1/plant-search'));assert.ok(!js.includes('/api/species'));
function check(dir){for(const name of readdirSync(dir)){const p=dir+'/'+name;if(statSync(p).isDirectory())check(p);else if(/\.(tsx?|js|css|html|sql|json)$/.test(name))assert.ok(!/uIF2b1n9|art_v2_[A-Za-z0-9_]+|sb_secret_[A-Za-z0-9_-]{16,}/.test(readFileSync(p,'utf8')),'Unexpected secret in '+p)}}
for(const dir of ['src','public','supabase','dist'])check(dir);
console.log('Pages checks passed: base path, manifest, backend URL and secret scan.');
