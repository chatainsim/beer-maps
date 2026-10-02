#!/usr/bin/env node
// Régénère toutes les pages exports/*.html avec le gabarit actuel de
// lib/sirene-core.js, à partir des données déjà embarquées (aucun appel d'API).
// Met aussi à jour count/geo dans exports/manifest.json (total et dates conservés).
//
//   node scripts/rebuild-exports.mjs [--dir exports]

import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { rowsFromExportHtml, changesFromExportHtml, readMeta, buildExportHtml, sameExport } = createRequire(import.meta.url)('../lib/sirene-core.js');

const i = process.argv.indexOf('--dir');
const dir = resolve(ROOT, i > 0 ? process.argv[i + 1] : 'exports');
const manifestPath = join(dir, 'manifest.json');
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { version: 1, naf: {} };
manifest.naf = manifest.naf || {};

let rebuilt = 0, same = 0, skipped = 0;
for (const f of readdirSync(dir).filter(f => /^sirene-.+\.html$/.test(f)).sort()) {
  const m = f.match(/^sirene-(\d\d)-(\d\d[A-Z]?)-(\w+)\.html$/);
  if (!m) { console.warn('ignoré (nom inattendu) : ' + f); skipped++; continue; }
  const naf = m[1] + '.' + m[2], dept = m[3];
  const path = join(dir, f);
  const old = readFileSync(path, 'utf8');
  const rows = rowsFromExportHtml(old);
  if (!rows) { console.warn('ignoré (données illisibles) : ' + f); skipped++; continue; }

  const entry = manifest.naf[naf]?.depts?.[dept];
  const generated = readMeta(old, 'generated') || entry?.generated;
  // L'évolution déjà calculée (nouveaux / disparus) est conservée telle quelle
  const html = buildExportHtml(rows, readMeta(old, 'naf') || naf, dept, {
    generated: generated ? new Date(generated) : new Date(),
    changes: changesFromExportHtml(old),
  });
  if (sameExport(old, html)) same++;
  else { writeFileSync(path, html); rebuilt++; }

  if (entry) {
    entry.count = rows.length;
    entry.geo = rows.filter(r => r.lat != null).length;
  }
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + '\n');
console.log(`${rebuilt} pages régénérées · ${same} déjà à jour · ${skipped} ignorées`);
