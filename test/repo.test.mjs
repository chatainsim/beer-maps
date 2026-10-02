// Cohérence des données publiées dans le dépôt : contours, manifest et pages.
//   node --test test/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const C = createRequire(import.meta.url)('../lib/sirene-core.js');
const EXPORTS = join(ROOT, 'exports');

test('data/departements.geojson : les 95 départements du référentiel', () => {
  const gj = JSON.parse(readFileSync(join(ROOT, 'data', 'departements.geojson'), 'utf8'));
  assert.deepEqual(gj.features.map(f => f.properties.code).sort(), C.DEPT_CODES);
  for (const f of gj.features) assert.match(f.geometry.type, /^(Multi)?Polygon$/);
});

test('manifest et pages d\'export concordent', () => {
  const manifest = JSON.parse(readFileSync(join(EXPORTS, 'manifest.json'), 'utf8'));
  const files = new Set(readdirSync(EXPORTS).filter(f => /^sirene-.+\.html$/.test(f)));
  const listed = new Set();
  for (const [naf, n] of Object.entries(manifest.naf)) {
    assert.ok(C.NAF_DICT[naf] || n.label, naf);
    for (const [dept, d] of Object.entries(n.depts)) {
      assert.ok(C.DEPT_NAMES[dept], `${naf} : département inconnu ${dept}`);
      assert.ok(Number.isInteger(d.count) && d.count >= 0, `${naf}/${dept} : count`);
      const f = C.exportFileName(naf, dept);
      if (d.count > 0) {
        assert.ok(files.has(f), `${f} manquant alors que le manifest annonce ${d.count} établissements`);
        listed.add(f);
      }
    }
  }
  for (const f of files) assert.ok(listed.has(f), `${f} absent du manifest`);
});

test('pages d\'export : lisibles, au gabarit actuel, décomptes exacts', () => {
  const manifest = JSON.parse(readFileSync(join(EXPORTS, 'manifest.json'), 'utf8'));
  const stale = [];
  for (const f of readdirSync(EXPORTS).filter(f => /^sirene-.+\.html$/.test(f))) {
    const html = readFileSync(join(EXPORTS, f), 'utf8');
    const rows = C.rowsFromExportHtml(html);
    assert.ok(rows, `${f} : données illisibles`);
    assert.equal(+C.readMeta(html, 'count'), rows.length, `${f} : sirene:count`);
    const m = f.match(/^sirene-(\d\d)-(\d\d[A-Z]?)-(\w+)\.html$/);
    const entry = manifest.naf[m[1] + '.' + m[2]].depts[m[3]];
    assert.equal(entry.count, rows.length, `${f} : décompte du manifest`);
    if (C.readMeta(html, 'template') !== C.TEMPLATE_VERSION) stale.push(f);
    assert.ok(!html.includes('[ND]'), `${f} : contient encore des marqueurs [ND]`);
  }
  assert.deepEqual(stale, [], 'pages à un ancien gabarit : lancez node scripts/rebuild-exports.mjs');
});

test('index.html et sirene-explorer.html chargent le module partagé', () => {
  for (const page of ['index.html', 'sirene-explorer.html']) {
    const html = readFileSync(join(ROOT, page), 'utf8');
    assert.match(html, /<script src="lib\/sirene-core\.js"><\/script>/, page);
    for (const [, js] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) assert.doesNotThrow(() => new Function(js), page);
  }
  assert.ok(existsSync(join(ROOT, '.nojekyll')), '.nojekyll requis pour GitHub Pages');
});
