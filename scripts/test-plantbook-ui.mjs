import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const server = await createServer({server: {middlewareMode: true}, appType: 'custom', optimizeDeps: {noDiscovery: true, include: []}});
try {
  const {PlantbookFacts} = await server.ssrLoadModule('/src/PlantKnowledge.tsx');
  const html = renderToStaticMarkup(createElement(PlantbookFacts, {data: {
    pid: 'test', display_pid: 'Test plant', alias: null, origin: 'Central America',
    min_temp: 0, max_temp: 30, min_env_humid: null, max_env_humid: 80,
    watering: '<script>unsafe</script>', soil: 'Airy potting mix',
    min_soil_ec: 350, max_soil_ec: 2000,
    image_url: 'https://example.com/plant.jpg', image_source: 'Author', image_license: 'CC BY'
  }}));
  assert.match(html, /0–30 °C/);
  assert.match(html, /legfeljebb 80 %/);
  assert.match(html, /Származás/);
  assert.match(html, /Talaj és közeg/);
  assert.match(html, /&lt;script&gt;unsafe&lt;\/script&gt;/, 'Provider text stays escaped');
  assert.doesNotMatch(html, /<dt>Megvilágítás<\/dt>/, 'Missing light data omitted');
  assert.match(html, /Talajszenzorral mérhető értékek/);
  assert.match(html, /Author · CC BY/);
  const empty = renderToStaticMarkup(createElement(PlantbookFacts, {data: {pid: 'empty', display_pid: 'Empty'}}));
  assert.match(empty, /még nincs kitöltött/);
  assert.doesNotMatch(empty, /knowledge-ranges|knowledge-sensors|knowledge-reference/);
  console.log('Species UI checks passed: real fields, missing-data states, escaped text, sensor guidance and image attribution.');
} finally { await server.close(); }
