#!/usr/bin/env node
// Régénère les pages exports/sirene-<NAF>-<DEPT>.html et exports/manifest.json
// à partir de l'API SIRENE + géocodage BAN — équivalent du bouton
// « Tous les depts → GitHub » de sirene-explorer.html, sans navigateur.
//
//   INSEE_API_KEY=… node scripts/update-exports.mjs [--naf 11.05Z,56.10A] [--dept 38,69] [--dir exports]
//
// Sans --naf : toutes les activités déjà présentes dans le manifest.
// Sans --dept : les 95 départements métropolitains.
// N'écrit une page que si ses données (ou le gabarit) ont changé ; supprime la page
// d'un département devenu vide. Le commit est laissé à l'appelant (voir le workflow).
// Code de sortie 1 si au moins un département a échoué (les autres sont écrits).

import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, appendFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const core = createRequire(import.meta.url)('../lib/sirene-core.js');
const { DEPT_CODES, DEPT_NAMES, NAF_DICT, resolveNaf, exportFileName, collectDept, manifestEntry, manifestChanged, mergeManifest, prepareExport } = core;

function arg(name) {
  const i = process.argv.indexOf('--' + name);
  return i > 0 ? (process.argv[i + 1] || '') : '';
}
const list = s => s.split(/[,\s]+/).map(x => x.trim()).filter(Boolean);

const apiKey = process.env.INSEE_API_KEY;
if (!apiKey) { console.error('INSEE_API_KEY manquante.'); process.exit(2); }

const dir = resolve(ROOT, arg('dir') || 'exports');
const manifestPath = join(dir, 'manifest.json');
let manifestText = existsSync(manifestPath) ? readFileSync(manifestPath, 'utf8') : null;

let nafs = list(arg('naf')).map(n => {
  const code = resolveNaf(n);
  if (!code) { console.error('Activité inconnue : ' + n); process.exit(2); }
  return code;
});
if (!nafs.length) nafs = Object.keys(JSON.parse(manifestText || '{}').naf || {}).sort();
if (!nafs.length) { console.error('Aucune activité : passez --naf ou créez un manifest.'); process.exit(2); }

const depts = list(arg('dept'));
for (const d of depts) if (!DEPT_NAMES[d]) { console.error('Département inconnu : ' + d); process.exit(2); }
const deptCodes = depts.length ? depts : DEPT_CODES;

// Cache de géocodage persistant entre deux exécutions (.cache/, conservé par actions/cache)
const cachePath = join(ROOT, '.cache', 'geo-cache.json');
let cacheData = {};
try { cacheData = JSON.parse(readFileSync(cachePath, 'utf8')); } catch {}
const cache = {
  get: k => Object.prototype.hasOwnProperty.call(cacheData, k) ? cacheData[k] : undefined,
  set: (k, v) => { cacheData[k] = v; },
};
function saveCache() {
  mkdirSync(dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, JSON.stringify(cacheData));
}

const summary = [];
let failures = 0;
const t0 = Date.now();

for (const naf of nafs) {
  const s = { written: 0, unchanged: 0, removed: 0, empty: 0, errors: [], etabs: 0, opened: 0, closed: 0 };
  const entries = {};
  console.log(`\n== ${naf} — ${NAF_DICT[naf] || ''} ==`);

  for (const dept of deptCodes) {
    const file = join(dir, exportFileName(naf, dept));
    try {
      const { rows, total } = await collectDept(naf, dept, apiKey, {
        cache,
        onRetry: (att, wait) => console.log(`  ${dept} quota INSEE, tentative ${att}, attente ${wait}s`),
      });
      s.etabs += rows.length;
      const geo = rows.filter(r => r.lat != null).length;

      if (!rows.length) {
        entries[dept] = manifestEntry(rows, total);
        s.empty++;
        if (existsSync(file)) { unlinkSync(file); s.removed++; }
        console.log(`  ${dept} ${DEPT_NAMES[dept]} : vide`);
        continue;
      }
      // Évolution par rapport à la page précédente (nouveaux / disparus), puis écriture
      const old = existsSync(file) ? readFileSync(file, 'utf8') : null;
      const { html, changes, unchanged } = prepareExport(rows, naf, dept, old);
      entries[dept] = manifestEntry(rows, total, undefined, changes);
      if (changes) { s.opened += changes.opened; s.closed += changes.closed.length; }
      if (unchanged) s.unchanged++;
      else { writeFileSync(file, html); s.written++; }
      console.log(`  ${dept} ${DEPT_NAMES[dept]} : ${rows.length} (${rows.length - geo} sans position)`
        + (changes ? ` +${changes.opened} / -${changes.closed.length}` : ''));
    } catch (err) {
      // L'entrée du manifest et la page existante sont conservées telles quelles
      s.errors.push(`${dept} : ${err.message}`);
      console.error(`  ${dept} ${DEPT_NAMES[dept]} : ERREUR ${err.message}`);
      if (/\((401|403)\)/.test(err.message)) throw err; // clé invalide : inutile d'insister
    }
  }

  // Le manifest n'est réécrit que si une page ou un décompte a changé (pas pour les seules dates)
  if (Object.keys(entries).length && (s.written || s.removed || manifestChanged(manifestText, naf, entries))) {
    manifestText = mergeManifest(manifestText, naf, entries);
    writeFileSync(manifestPath, manifestText);
  }
  saveCache();
  failures += s.errors.length;
  summary.push(`- **${naf}** ${NAF_DICT[naf] || ''} : ${s.etabs.toLocaleString('fr-FR')} établissements · `
    + `+${s.opened.toLocaleString('fr-FR')} nouveaux / −${s.closed.toLocaleString('fr-FR')} disparus · `
    + `${s.written} pages écrites · ${s.unchanged} inchangées · ${s.empty} vides (${s.removed} supprimées)`
    + (s.errors.length ? ` · **${s.errors.length} erreur(s)** : ${s.errors.join(' ; ')}` : ''));
}

const minutes = Math.round((Date.now() - t0) / 60000);
const text = `Mise à jour des exports SIRENE (${minutes} min)\n\n${summary.join('\n')}\n`;
console.log('\n' + text);
mkdirSync(join(ROOT, '.cache'), { recursive: true });
writeFileSync(join(ROOT, '.cache', 'summary.md'), text);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
if (failures) process.exitCode = 1;
