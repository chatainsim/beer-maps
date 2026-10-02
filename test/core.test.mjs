// Tests du module partagé lib/sirene-core.js — sans dépendance, avec node:test.
//   node --test test/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const C = createRequire(import.meta.url)('../lib/sirene-core.js');
C.config.inseeMinInterval = 0; // pas de limitation de débit avec les API simulées

// ── Fabriques ────────────────────────────────────────────────────────────────

function etab(i, over = {}) {
  return {
    siret: String(10000000000000 + i),
    dateCreationEtablissement: '2020-01-0' + ((i % 9) + 1),
    uniteLegale: { denominationUniteLegale: 'ETAB ' + i },
    adresseEtablissement: {
      numeroVoieEtablissement: String(i + 1), typeVoieEtablissement: 'RUE', libelleVoieEtablissement: 'HOCHE',
      codePostalEtablissement: '38000', libelleCommuneEtablissement: 'GRENOBLE', codeCommuneEtablissement: '38185',
      ...over.adresse,
    },
    periodesEtablissement: [{ etatAdministratifEtablissement: 'A', activitePrincipaleEtablissement: '11.05Z', ...over.periode }],
  };
}

function row(i, over = {}) {
  return {
    name: 'ETAB ' + i, siret: String(10000000000000 + i), naf: '11.05Z', etat: 'A', dateCreation: '2020-01-01',
    addr: { line1: i + ' RUE HOCHE', line2: '38000 GRENOBLE' }, lat: 45 + i / 1000, lon: 5.7, ...over,
  };
}

function withFetch(impl, fn) {
  const orig = globalThis.fetch;
  globalThis.fetch = impl;
  return Promise.resolve(fn()).finally(() => { globalThis.fetch = orig; });
}

// ── Référentiels et saisie ───────────────────────────────────────────────────

test('départements : 95 codes triés, une population pour chacun', () => {
  assert.equal(C.DEPT_CODES.length, 95);
  assert.deepEqual(C.DEPT_CODES.slice(0, 3), ['01', '02', '03']);
  assert.deepEqual([...C.DEPT_CODES].sort(), C.DEPT_CODES);
  for (const d of C.DEPT_CODES) assert.ok(C.DEPT_POPULATION[d] > 50000, d);
});

test('resolveNaf : codes, variantes et libellés', () => {
  const cases = {
    '11.05Z': '11.05Z', '11.05z': '11.05Z', '1105Z': '11.05Z', ' 56.10a ': '56.10A',
    'brasserie': '11.05Z', 'Brasseries': '11.05Z', 'bière': '11.05Z', 'cafés': '56.30Z',
    'Débits de boissons': '56.30Z', 'barbier': '', 'zzz': '', '': '',
  };
  for (const [input, expected] of Object.entries(cases)) assert.equal(C.resolveNaf(input), expected, input);
});

test('deptClause / deptQuery : code commune, Corse = 2A + 2B', () => {
  assert.equal(C.deptClause('38'), 'codeCommuneEtablissement:38*');
  assert.equal(C.deptClause('20'), '(codeCommuneEtablissement:2A* OR codeCommuneEtablissement:2B*)');
  assert.match(C.deptQuery('11.05Z', '38'), /^periode\(activitePrincipaleEtablissement:11\.05Z AND etatAdministratifEtablissement:A\) AND codeCommuneEtablissement:38\*$/);
  for (const ok of ['38', '2A', '2B', '971']) assert.ok(C.isDeptCode(ok), ok);
  for (const ko of ['380', '75013', '977', 'AB']) assert.ok(!C.isDeptCode(ko), ko);
});

test('buildAddr : les champs non diffusibles [ND] sont ignorés', () => {
  const nd = etab(1, { adresse: { numeroVoieEtablissement: '[ND]', typeVoieEtablissement: '[ND]', libelleVoieEtablissement: '[ND]', codePostalEtablissement: '[ND]', libelleCommuneEtablissement: 'FARAMANS' } });
  assert.deepEqual(C.buildAddr(nd), { line1: '', line2: 'FARAMANS' });
  assert.deepEqual(C.buildAddr(etab(1)), { line1: '2 RUE HOCHE', line2: '38000 GRENOBLE' });
});

test('getName / cleanName : noms non diffusibles', () => {
  const nd = { uniteLegale: { nomUniteLegale: '[ND]', prenom1UniteLegale: '[ND]' }, periodesEtablissement: [{}] };
  assert.equal(C.getName(nd), C.ND_NAME);
  const enseigne = { uniteLegale: { nomUniteLegale: '[ND]' }, periodesEtablissement: [{ enseigne1Etablissement: 'SALON BELLA' }] };
  assert.equal(C.getName(enseigne), 'SALON BELLA');
  assert.equal(C.getName({ uniteLegale: { denominationUniteLegale: 'BRASSERIE X' } }), 'BRASSERIE X');
  assert.equal(C.getName({ uniteLegale: { prenom1UniteLegale: 'JEAN', nomUniteLegale: 'DUPONT' } }), 'JEAN DUPONT');
  assert.equal(C.getName({ uniteLegale: {} }), '(sans dénomination)');
  assert.equal(C.cleanName('[ND]'), C.ND_NAME);
  assert.equal(C.cleanName('[ND] [ND]'), C.ND_NAME);
  assert.equal(C.cleanName('JEAN [ND]'), 'JEAN');
  assert.equal(C.cleanName('BRASSERIE X'), 'BRASSERIE X');
});

test('rowsFromExportHtml : nettoie les « [ND] » des pages existantes', () => {
  const html = C.buildExportHtml([row(1, { name: '[ND]', addr: { line1: '[ND] [ND]', line2: '[ND] FARAMANS' } })], '86.21Z', '01');
  const [r] = C.rowsFromExportHtml(html);
  assert.equal(r.name, C.ND_NAME);
  assert.deepEqual(r.addr, { line1: '', line2: 'FARAMANS' });
});

test('filterEtabs : NAF et état de la période en cours', () => {
  const list = [etab(1), etab(2, { periode: { activitePrincipaleEtablissement: '56.30Z' } }), etab(3, { periode: { etatAdministratifEtablissement: 'F' } })];
  assert.deepEqual(C.filterEtabs(list, '11.05Z', false).map(e => e.siret), [etab(1).siret]);
  assert.equal(C.filterEtabs(list, '11.05Z', true).length, 2);
});

test('parseCsv : guillemets, virgules, sauts de ligne, BOM, CRLF', () => {
  const rows = C.parseCsv('﻿id,adresse\r\n1,"12 RUE X, BAT ""A"""\r\n2,"sur\ndeux lignes"\r\n');
  assert.deepEqual(rows, [['id', 'adresse'], ['1', '12 RUE X, BAT "A"'], ['2', 'sur\ndeux lignes']]);
  assert.equal(C.csvCell('a,b'), '"a,b"');
  assert.equal(C.csvCell('simple'), 'simple');
});

// ── API (simulées) ───────────────────────────────────────────────────────────

test('fetchAllSirene : pagination par curseur, paramètre date', async () => {
  const calls = [];
  await withFetch(async (url) => {
    const u = new URL(url);
    calls.push(Object.fromEntries(u.searchParams));
    const cur = u.searchParams.get('curseur');
    const start = cur === '*' ? 0 : +cur;
    const n = Math.min(1000, 2500 - start);
    return new Response(JSON.stringify({
      header: { total: 2500, curseurSuivant: String(start + n) },
      etablissements: Array.from({ length: n }, (_, k) => etab(start + k)),
    }));
  }, async () => {
    const res = await C.fetchAllSirene('q', 'cle');
    assert.equal(res.total, 2500);
    assert.equal(res.etablissements.length, 2500);
  });
  assert.deepEqual(calls.map(c => c.curseur), ['*', '1000', '2000']);
  assert.ok(calls.every(c => c.date === C.todayIso() && c.nombre === '1000'));
});

test('fetchSirene : réessaie sur 429 en respectant Retry-After', async () => {
  let n = 0;
  const waits = [];
  await withFetch(async () => {
    n++;
    if (n === 1) return new Response('', { status: 429, headers: { 'Retry-After': '0' } });
    return new Response(JSON.stringify({ header: { total: 0 }, etablissements: [] }));
  }, () => C.fetchSirene({ q: 'q', nombre: 1 }, 'cle', { onRetry: (a, w) => waits.push(w) }));
  assert.equal(n, 2);
  assert.equal(waits.length, 1);
});

test('fetchSirene : erreur explicite sur clé invalide', async () => {
  await withFetch(async () => new Response('', { status: 401 }), () =>
    assert.rejects(C.fetchSirene({ q: 'q', nombre: 1 }, 'cle'), /\(401\)/));
});

test('geocodeEtabs : deux passes, [ND] au centre de la commune, cache', async () => {
  const requests = [];
  const ban = async (url, opts) => {
    const filter = opts.body.has('citycode') ? 'citycode' : 'postcode';
    const rows = C.parseCsv(await opts.body.get('data').text()).slice(1);
    requests.push({ filter, n: rows.length });
    const out = ['id,adresse,postcode,citycode,latitude,longitude,result_score,result_type'];
    for (const [id, adresse, postcode, citycode] of rows) {
      const line = [id, adresse, postcode, citycode].map(C.csvCell).join(',');
      if (adresse.includes('[ND]')) out.push(line + ',,,,');
      else if (adresse.includes('CEDEX') && filter === 'postcode') out.push(line + ',,,,'); // CEDEX : inconnu en passe 1
      else if (/^\d/.test(adresse)) out.push(line + ',45.2,5.7,0.9,housenumber');
      else out.push(line + ',45.1,5.6,0.8,municipality');
    }
    return new Response(out.join('\n'));
  };
  const nd = etab(1, { adresse: { numeroVoieEtablissement: '[ND]', typeVoieEtablissement: '[ND]', libelleVoieEtablissement: '[ND]', codePostalEtablissement: '[ND]' } });
  const cedex = etab(2, { adresse: { codePostalEtablissement: '38042', libelleCommuneEtablissement: 'GRENOBLE CEDEX 9' } });
  const store = new Map();
  const cache = { get: k => store.get(k), set: (k, v) => store.set(k, v) };

  const res = await withFetch(ban, () => C.geocodeEtabs([etab(0), nd, cedex], { cache }));
  assert.deepEqual(res[0], { lat: 45.2, lon: 5.7 });
  assert.deepEqual(res[1], { lat: 45.1, lon: 5.6, approx: true });
  assert.deepEqual(res[2], { lat: 45.2, lon: 5.7 });
  assert.deepEqual(requests, [{ filter: 'postcode', n: 3 }, { filter: 'citycode', n: 1 }]);

  requests.length = 0;
  await withFetch(ban, () => C.geocodeEtabs([etab(0), nd, cedex], { cache }));
  assert.equal(requests.length, 0, 'tout vient du cache');
});

// ── Pages d'export ───────────────────────────────────────────────────────────

test('buildExportHtml / rowsFromExportHtml : aller-retour sans perte', () => {
  const rows = [row(1, { isNew: true }), row(2, { approx: true }), row(3, { lat: null, lon: null, dateCreation: '' })];
  const html = C.buildExportHtml(rows, '11.05Z', '38');
  assert.equal(C.readMeta(html, 'count'), '3');
  assert.equal(C.readMeta(html, 'geo'), '2');
  assert.equal(C.readMeta(html, 'template'), C.TEMPLATE_VERSION);
  assert.deepEqual(C.rowsFromExportHtml(html), rows.map(r => {
    const o = { ...r };
    if (!o.dateCreation) delete o.dateCreation;
    return o;
  }));
});

test('buildExportHtml : contenu échappé et script de page valide', () => {
  const html = C.buildExportHtml([row(1, { name: 'A</script><b>x</b> ' })], '11.05Z', '38', {
    changes: { since: '2026-09-02', opened: 0, closed: [{ name: '</script>', siret: '9', addr: { line1: '', line2: 'X' } }] },
  });
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1, 'aucune balise </script> parasite');
  assert.doesNotThrow(() => new Function(scripts[0][1]));
  assert.equal(C.rowsFromExportHtml(html)[0].name, 'A</script><b>x</b> ');
});

test('sameExport : ignore la date, détecte données, évolution et gabarit', () => {
  const rows = [row(1), row(2)];
  const a = C.buildExportHtml(rows, '11.05Z', '38', { generated: new Date('2026-01-01') });
  const b = C.buildExportHtml(rows, '11.05Z', '38', { generated: new Date('2026-02-01') });
  assert.ok(C.sameExport(a, b));
  assert.ok(!C.sameExport(a, C.buildExportHtml([row(1)], '11.05Z', '38')));
  assert.ok(!C.sameExport(a, C.buildExportHtml(rows, '11.05Z', '38', { changes: { since: '2026-01-01', opened: 0, closed: [] } })));
  assert.ok(!C.sameExport(a, a.replace(/sirene:template" content="\d+/, 'sirene:template" content="0')));
});

test('diffRows : nouveaux et disparus par SIRET', () => {
  const now = [row(1), row(2), row(4)];
  const d = C.diffRows(now, [row(1), row(2), row(3)], '2026-09-02T03:00:00Z');
  assert.equal(d.since, '2026-09-02');
  assert.equal(d.opened, 1);
  assert.deepEqual(d.closed.map(c => c.siret), [row(3).siret]);
  assert.deepEqual(now.map(r => !!r.isNew), [false, false, true]);
  assert.equal(C.diffRows([row(1)], null), null, 'pas de version précédente');
});

test('diffRows : pas de différence calculée sur un changement de périmètre', () => {
  const old = [row(1), row(2), row(3), row(4)];
  assert.equal(C.diffRows([row(1), row(9)], old), null);
});

test('prepareExport : inchangé si rien ne bouge, évolution sinon', () => {
  const first = C.prepareExport([row(1), row(2)], '11.05Z', '38', null);
  assert.equal(first.changes, null);
  assert.equal(first.unchanged, false);

  const second = C.prepareExport([row(1), row(2), row(3)], '11.05Z', '38', first.html);
  assert.equal(second.changes.opened, 1);
  assert.equal(second.unchanged, false);

  // Même contenu deux fois de suite sans changement : la page n'est pas réécrite
  const third = C.prepareExport([row(1), row(2), row(3)], '11.05Z', '38', second.html);
  assert.deepEqual([third.changes.opened, third.changes.closed.length], [0, 0]);
  const fourth = C.prepareExport([row(1), row(2), row(3)], '11.05Z', '38', third.html, { generated: new Date('2030-01-01') });
  assert.equal(fourth.unchanged, true);
  assert.equal(fourth.changes.since, third.changes.since, 'date de référence conservée');
});

test('changesFromExportHtml : relit l\'évolution embarquée', () => {
  const { html } = C.prepareExport([row(1, { isNew: true }), row(2)], '11.05Z', '38',
    C.buildExportHtml([row(2), row(3)], '11.05Z', '38', { generated: new Date('2026-09-02') }));
  const ch = C.changesFromExportHtml(html);
  assert.equal(ch.since, '2026-09-02');
  assert.equal(ch.opened, 1);
  assert.deepEqual(ch.closed.map(c => c.siret), [row(3).siret]);
});

// ── Manifest ─────────────────────────────────────────────────────────────────

test('manifest : entrée, fusion triée, détection des changements', () => {
  const e = C.manifestEntry([row(1), row(2, { lat: null })], 3, 'G', { since: '2026-09-02', opened: 1, closed: [{}] });
  assert.deepEqual(e, { count: 2, geo: 1, total: 3, generated: 'G', opened: 1, closed: 1, since: '2026-09-02' });

  const text = C.mergeManifest(null, '11.05Z', { '38': e, '01': e });
  const m = JSON.parse(text);
  assert.equal(m.naf['11.05Z'].label, 'Fabrication de bière');
  assert.deepEqual(Object.keys(m.naf['11.05Z'].depts).sort(), ['01', '38']);

  assert.ok(!C.manifestChanged(text, '11.05Z', { '38': { ...e, generated: 'autre date' } }));
  assert.ok(C.manifestChanged(text, '11.05Z', { '38': { ...e, count: 9 } }));
  assert.ok(C.manifestChanged(text, '11.05Z', { '69': e }));
});
