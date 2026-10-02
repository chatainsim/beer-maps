/*
 * sirene-core.js — code partagé, sans dépendance ni build.
 *
 * Utilisé par :
 *   - sirene-explorer.html et index.html  (<script src="lib/sirene-core.js">, global `SireneCore`)
 *   - scripts/*.mjs sous Node ≥ 18        (require / createRequire)
 *
 * Les pages d'export générées par buildExportHtml() restent autonomes : leur
 * code (exportPageRuntime) y est recopié, elles ne chargent pas ce fichier.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SireneCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ── Référentiels ───────────────────────────────────────────────────────────

  const DEPT_NAMES = {
    "01":"Ain","02":"Aisne","03":"Allier","04":"Alpes-de-Haute-Provence","05":"Hautes-Alpes",
    "06":"Alpes-Maritimes","07":"Ardèche","08":"Ardennes","09":"Ariège","10":"Aube",
    "11":"Aude","12":"Aveyron","13":"Bouches-du-Rhône","14":"Calvados","15":"Cantal",
    "16":"Charente","17":"Charente-Maritime","18":"Cher","19":"Corrèze","20":"Corse",
    "21":"Côte-d'Or","22":"Côtes-d'Armor","23":"Creuse","24":"Dordogne",
    "25":"Doubs","26":"Drôme","27":"Eure","28":"Eure-et-Loir","29":"Finistère",
    "30":"Gard","31":"Haute-Garonne","32":"Gers","33":"Gironde","34":"Hérault",
    "35":"Ille-et-Vilaine","36":"Indre","37":"Indre-et-Loire","38":"Isère","39":"Jura",
    "40":"Landes","41":"Loir-et-Cher","42":"Loire","43":"Haute-Loire","44":"Loire-Atlantique",
    "45":"Loiret","46":"Lot","47":"Lot-et-Garonne","48":"Lozère","49":"Maine-et-Loire",
    "50":"Manche","51":"Marne","52":"Haute-Marne","53":"Mayenne","54":"Meurthe-et-Moselle",
    "55":"Meuse","56":"Morbihan","57":"Moselle","58":"Nièvre","59":"Nord",
    "60":"Oise","61":"Orne","62":"Pas-de-Calais","63":"Puy-de-Dôme","64":"Pyrénées-Atlantiques",
    "65":"Hautes-Pyrénées","66":"Pyrénées-Orientales","67":"Bas-Rhin","68":"Haut-Rhin","69":"Rhône",
    "70":"Haute-Saône","71":"Saône-et-Loire","72":"Sarthe","73":"Savoie","74":"Haute-Savoie",
    "75":"Paris","76":"Seine-Maritime","77":"Seine-et-Marne","78":"Yvelines","79":"Deux-Sèvres",
    "80":"Somme","81":"Tarn","82":"Tarn-et-Garonne","83":"Var","84":"Vaucluse",
    "85":"Vendée","86":"Vienne","87":"Haute-Vienne","88":"Vosges","89":"Yonne",
    "90":"Territoire de Belfort","91":"Essonne","92":"Hauts-de-Seine","93":"Seine-Saint-Denis",
    "94":"Val-de-Marne","95":"Val-d'Oise"
  };

  // Ordre 01 → 95 (Object.keys mettrait "10".."95" avant "01".."09")
  const DEPT_CODES = Object.keys(DEPT_NAMES).sort();

  // Populations légales INSEE par département (somme des communes ; Corse = 2A + 2B).
  // Source : @etalab/decoupage-administratif 6.0.0 (populations légales INSEE).
  const DEPT_POPULATION = {
    "01":679344,"02":523342,"03":333298,"04":168054,"05":143467,"06":1128418,"07":334231,"08":265893,
    "09":155722,"10":310447,"11":379648,"12":279609,"13":2087658,"14":709441,"15":144196,"16":352683,
    "17":672279,"18":298660,"19":240826,"20":355486,"21":540100,"22":611859,"23":115527,"24":417614,
    "25":547163,"26":524207,"27":602714,"28":433129,"29":933455,"30":770940,"31":1471468,"32":192645,
    "33":1690493,"34":1230289,"35":1120666,"36":216069,"37":619362,"38":1298990,"39":257973,"40":433570,
    "41":328543,"42":774133,"43":228654,"44":1487570,"45":691268,"46":176473,"47":333602,"48":76486,
    "49":833776,"50":497522,"51":563076,"52":168331,"53":305468,"54":732236,"55":180290,"56":783390,
    "57":1051309,"58":201417,"59":2615635,"60":829899,"61":275201,"62":1457905,"63":664453,"64":706564,
    "65":231349,"66":496855,"67":1163810,"68":770738,"69":1914667,"70":233185,"71":550310,"72":566733,
    "73":448226,"74":861158,"75":2103778,"76":1260964,"77":1468108,"78":1485086,"79":375229,"80":565413,
    "81":397352,"82":265817,"83":1119307,"84":572056,"85":713609,"86":438897,"87":373167,"88":357248,
    "89":332267,"90":140255,"91":1338485,"92":1654712,"93":1704316,"94":1426929,"95":1281653,
  };

  const NAF_DICT = {
    '11.05Z': 'Fabrication de bière',
    '56.30Z': 'Débits de boissons',
    '56.10A': 'Restauration traditionnelle',
    '56.10B': 'Cafétérias et libres-services',
    '56.10C': 'Restauration de type rapide',
    '10.71C': 'Boulangerie-pâtisserie',
    '47.61Z': 'Commerce de détail de livres',
    '59.14Z': 'Projection de films cinématographiques',
    '55.10Z': 'Hôtels et hébergement similaire',
    '86.21Z': 'Médecine générale',
    '96.02A': 'Coiffure',
    '93.11Z': 'Gestion d\'installations sportives',
    '47.71Z': 'Commerce de détail habillement',
    '47.73Z': 'Commerce détail produits pharmaceutiques',
    '45.20A': 'Entretien réparation véhicules légers',
    '56.21Z': 'Services traiteurs',
    '10.71A': 'Fab. industrielle pains et viennoiseries',
    '86.90F': 'Activités de santé humaine NCA',
    '85.10Z': 'Enseignement préprimaire',
  };

  // Termes courants → code NAF (clés : mots séparés par |, déjà normalisés)
  const NAF_ALIASES = {
    'brasserie|biere|microbrasserie': '11.05Z',
    'bar|cafe': '56.30Z',
    'restaurant': '56.10A',
    'boulangerie|patisserie': '10.71C',
    'librairie': '47.61Z',
    'cinema': '59.14Z',
    'hotel': '55.10Z',
    'medecin|generaliste': '86.21Z',
    'coiffeur|coiffure': '96.02A',
    'pharmacie': '47.73Z',
    'garage': '45.20A',
    'traiteur': '56.21Z',
  };

  // ── Utilitaires ────────────────────────────────────────────────────────────

  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Minuscules sans accents, pour comparer les libellés
  function normText(s) {
    return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  // Normalise la saisie en code NAF « 11.05Z » : accepte minuscules, absence de point
  // (« 1105z »), un terme courant (« brasseries ») ou un libellé du dictionnaire.
  // Renvoie '' si rien ne correspond.
  function resolveNaf(raw) {
    const trimmed = (raw || '').trim();
    if (!trimmed) return '';
    const m = trimmed.toUpperCase().match(/^(\d{2})\.?(\d{2}[A-Z]?)$/);
    if (m) return m[1] + '.' + m[2];
    const key = normText(trimmed);
    const k = key.replace(/s$/, ''); // pluriel simple : « brasseries » → « brasserie »
    const alias = Object.entries(NAF_ALIASES)
      .find(([words]) => words.split('|').some(w => k === w || k.startsWith(w + ' ')));
    if (alias) return alias[1];
    const found = Object.entries(NAF_DICT).find(([, lib]) => normText(lib).includes(key));
    return found ? found[0] : '';
  }

  function nafSlug(naf) {
    return naf.replace(/[^a-z0-9]/gi, '-');
  }

  function exportFileName(naf, dept) {
    return 'sirene-' + nafSlug(naf) + '-' + dept + '.html';
  }

  // Clause de filtrage par département, sur le code commune INSEE (plus fiable que le
  // code postal, qui peut appartenir à un département voisin). "20" = Corse (2A + 2B).
  function deptClause(dept) {
    if (dept === '20') return '(codeCommuneEtablissement:2A* OR codeCommuneEtablissement:2B*)';
    return 'codeCommuneEtablissement:' + dept + '*';
  }

  function isDeptCode(s) {
    return /^(\d{2}|2A|2B|97[1-6])$/.test(s);
  }

  // Requête « établissements actifs d'une activité dans un département »
  function deptQuery(naf, dept) {
    return 'periode(activitePrincipaleEtablissement:' + naf + ' AND etatAdministratifEtablissement:A) AND ' + deptClause(dept);
  }

  // Champ d'adresse diffusible : l'INSEE remplace par « [ND] » les éléments masqués
  // des établissements en diffusion partielle (entrepreneurs individuels qui l'ont
  // demandé) ; seule la commune reste publique.
  function addrField(v) {
    return v && v !== '[ND]' ? String(v) : '';
  }

  function buildAddr(etab) {
    const a = etab.adresseEtablissement || {};
    const line1 = [a.numeroVoieEtablissement, a.typeVoieEtablissement, a.libelleVoieEtablissement].map(addrField).filter(Boolean).join(' ');
    const line2 = [a.codePostalEtablissement, a.libelleCommuneEtablissement].map(addrField).filter(Boolean).join(' ');
    return { line1, line2 };
  }

  function getName(etab) {
    const ul = etab.uniteLegale || {};
    return ul.denominationUniteLegale
      || [ul.prenom1UniteLegale, ul.nomUniteLegale].filter(Boolean).join(' ')
      || '(sans dénomination)';
  }

  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function abortError() {
    return new DOMException('Aborted', 'AbortError');
  }

  // Parseur CSV RFC 4180 : champs entre guillemets, "" échappés, virgules et sauts
  // de ligne à l'intérieur des guillemets. Renvoie un tableau de lignes (tableaux de cellules).
  function parseCsv(text) {
    const rows = [];
    let row = [], cell = '', inQuotes = false;
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { cell += '"'; i++; }
          else inQuotes = false;
        } else cell += c;
      } else if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); cell = '';
        if (row.length > 1 || row[0] !== '') rows.push(row);
        row = [];
      } else cell += c;
    }
    row.push(cell);
    if (row.length > 1 || row[0] !== '') rows.push(row);
    return rows;
  }

  function csvCell(v) {
    const s = String(v == null ? '' : v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  // ── API SIRENE ─────────────────────────────────────────────────────────────

  // L'API SIRENE accepte 30 requêtes par minute et par clé : on espace les appels
  // d'au moins 2,1 s (partagé par tous les appels de la page ou du processus).
  // Réglages modifiables (les tests mettent l'intervalle à 0).
  const config = { inseeMinInterval: 2100 };
  let inseeNextSlot = 0;
  async function inseeThrottle() {
    const now = Date.now();
    const wait = Math.max(0, inseeNextSlot - now);
    inseeNextSlot = Math.max(now, inseeNextSlot) + config.inseeMinInterval;
    if (wait) await sleep(wait);
  }

  // params : { q, nombre, debut?, curseur? }. Le paramètre date=aujourd'hui fait porter
  // les critères de periode() sur la période en cours uniquement (sans lui, un
  // établissement actif à un moment de son historique remonte aussi).
  async function fetchSirene(params, inseeKey, { onRetry, signal } = {}) {
    let url = 'https://api.insee.fr/api-sirene/3.11/siret?q=' + encodeURIComponent(params.q)
      + '&date=' + todayIso() + '&nombre=' + params.nombre;
    if (params.curseur) url += '&curseur=' + encodeURIComponent(params.curseur);
    else url += '&debut=' + (params.debut || 0);

    const MAX_RETRIES = 6;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      await inseeThrottle();
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json', 'X-INSEE-Api-Key-Integration': inseeKey },
        signal,
      });

      if (res.status === 401) throw new Error('Clé API INSEE invalide ou expirée (401).');
      if (res.status === 403) throw new Error('Accès refusé (403). Vérifiez votre abonnement sur portail-api.insee.fr.');
      if (res.status === 404) return { etablissements: [], header: { total: 0 } };

      if (res.status === 429 || res.status === 503) {
        if (attempt >= MAX_RETRIES) throw new Error('Quota API INSEE dépassé après ' + (MAX_RETRIES + 1) + ' tentatives. Réessayez plus tard.');
        // Attente indiquée par l'API (Retry-After), sinon 4, 8, 16, 32, 60, 60 s :
        // de quoi laisser passer la fenêtre d'une minute du quota.
        const retryAfter = parseInt(res.headers.get('Retry-After'), 10);
        const wait = retryAfter > 0 ? Math.min(retryAfter, 120) : Math.min(60, Math.pow(2, attempt + 2));
        if (onRetry) onRetry(attempt + 1, wait);
        await sleep(wait * 1000);
        continue;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error('Erreur API INSEE ' + res.status + ' : ' + ((body && body.header && body.header.message) || res.statusText));
      }
      return res.json();
    }
  }

  // Récupère tous les résultats d'une requête par pages de 1000, via le curseur
  // (pagination profonde recommandée par l'INSEE). max = plafond de sécurité.
  async function fetchAllSirene(q, inseeKey, { max = Infinity, onPage, onRetry, signal } = {}) {
    const PAGE = 1000;
    let curseur = '*', total = 0, all = [];
    for (;;) {
      if (signal && signal.aborted) throw abortError();
      const data = await fetchSirene({ q, nombre: PAGE, curseur }, inseeKey, { onRetry, signal });
      const header = data.header || {};
      if (header.total != null) total = header.total;
      const page = data.etablissements || [];
      all = all.concat(page);
      if (onPage) onPage(all.length, total);
      const next = header.curseurSuivant;
      if (!page.length || !next || next === curseur || all.length >= Math.min(total, max)) break;
      curseur = next;
    }
    return { etablissements: all.slice(0, max), total };
  }

  // Filet de sécurité : ne garde que les établissements dont la période en cours
  // (periodesEtablissement[0]) correspond bien au NAF et à l'état demandés.
  function filterEtabs(etabs, nafCode, inclureFermes) {
    return etabs.filter(et => {
      const p = (et.periodesEtablissement && et.periodesEtablissement[0]) || {};
      if (nafCode && p.activitePrincipaleEtablissement && p.activitePrincipaleEtablissement !== nafCode) return false;
      return inclureFermes || p.etatAdministratifEtablissement === 'A';
    });
  }

  // ── Géocodage (Base Adresse Nationale, endpoint CSV) ───────────────────────

  const BAN_CSV_URL = 'https://api-adresse.data.gouv.fr/search/csv/';
  const BAN_CHUNK = 500;
  const BAN_MIN_SCORE = 0.3;

  function geoCacheKey(etab) {
    const { line1, line2 } = buildAddr(etab);
    return [line1, line2].filter(Boolean).join(' ').trim().toLowerCase();
  }

  // Une requête CSV. items : [{ id, adresse, postcode, citycode }] ; filter = colonne
  // utilisée comme filtre strict par la BAN ('postcode' ou 'citycode').
  // Renvoie Map<id, {lat, lon, approx}>.
  async function banCsvRequest(items, filter, signal) {
    const csv = ['id,adresse,postcode,citycode']
      .concat(items.map(it => [it.id, it.adresse, it.postcode, it.citycode].map(csvCell).join(',')))
      .join('\n');

    const MAX_RETRIES = 4;
    let lastError = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (signal && signal.aborted) throw abortError();
      const form = new FormData();
      form.append('data', new Blob([csv], { type: 'text/csv' }), 'batch.csv');
      form.append('columns', 'adresse');
      form.append(filter, filter);
      ['latitude', 'longitude', 'result_score', 'result_type'].forEach(c => form.append('result_columns', c));
      try {
        const r = await fetch(BAN_CSV_URL, { method: 'POST', body: form, signal });
        if (r.status === 429 || r.status === 503 || r.status === 502) {
          lastError = new Error('Géocodage BAN : service saturé (' + r.status + ')');
          if (attempt >= MAX_RETRIES) break;
          await sleep(2000 * Math.pow(2, attempt));
          continue;
        }
        if (!r.ok) throw new Error('Géocodage BAN : erreur ' + r.status);

        const rows = parseCsv(await r.text());
        const out = new Map();
        if (rows.length < 2) return out;
        const h = rows[0];
        const idI = h.indexOf('id'), latI = h.indexOf('latitude'), lonI = h.indexOf('longitude');
        const scoreI = h.indexOf('result_score'), typeI = h.indexOf('result_type');
        if (idI < 0 || latI < 0 || lonI < 0) return out;
        for (let li = 1; li < rows.length; li++) {
          const cols = rows[li];
          const id = parseInt(cols[idI], 10);
          const lat = parseFloat(cols[latI]), lon = parseFloat(cols[lonI]);
          const score = scoreI >= 0 ? parseFloat(cols[scoreI]) : 1;
          if (isNaN(id) || isNaN(lat) || isNaN(lon) || !(score > BAN_MIN_SCORE)) continue;
          const coords = { lat, lon };
          if (typeI >= 0 && cols[typeI] === 'municipality') coords.approx = true;
          out.set(id, coords);
        }
        return out;
      } catch (e) {
        if (e.name === 'AbortError') throw e;
        lastError = e;
        if (attempt >= MAX_RETRIES) break;
        await sleep(2000 * Math.pow(2, attempt));
      }
    }
    throw lastError;
  }

  // Géocode une liste d'établissements, par lots de 500, en deux passes :
  //   1. adresse complète, filtrée sur le code postal ;
  //   2. pour les échecs : adresse sans code postal ni CEDEX, filtrée sur le code
  //      commune INSEE (rattrape notamment les codes postaux CEDEX, inconnus de la BAN).
  // cache (facultatif) : { get(key) → coords | null | undefined, set(key, value) }.
  // Renvoie un tableau aligné sur etabs : {lat, lon, approx?} ou null.
  async function geocodeEtabs(etabs, { cache, signal, onProgress } = {}) {
    const result = new Array(etabs.length).fill(null);
    const todo = [];
    etabs.forEach((etab, i) => {
      const key = geoCacheKey(etab);
      const cached = key && cache ? cache.get(key) : undefined;
      if (cached !== undefined) result[i] = cached;
      else todo.push({ i, key, etab });
    });

    const total = todo.length;
    let done = 0;
    for (let ci = 0; ci < todo.length; ci += BAN_CHUNK) {
      const chunk = todo.slice(ci, ci + BAN_CHUNK);
      const items = chunk.map(({ i, etab }) => {
        const a = etab.adresseEtablissement || {};
        const { line1, line2 } = buildAddr(etab);
        return {
          id: i,
          adresse: [line1, line2].filter(Boolean).join(' '),
          adresse2: [line1, addrField(a.libelleCommuneEtablissement).replace(/\s+CEDEX.*$/i, '')].filter(Boolean).join(' '),
          postcode: addrField(a.codePostalEtablissement),
          citycode: addrField(a.codeCommuneEtablissement),
        };
      });

      const pass1 = await banCsvRequest(items, 'postcode', signal);
      const retry = items.filter(it => !pass1.has(it.id) && it.citycode && it.adresse2)
        .map(it => Object.assign({}, it, { adresse: it.adresse2 }));
      const pass2 = retry.length ? await banCsvRequest(retry, 'citycode', signal) : new Map();

      chunk.forEach(({ i, key }) => {
        const c = pass1.get(i) || pass2.get(i) || null;
        result[i] = c;
        if (key && cache) cache.set(key, c);
      });
      done += chunk.length;
      if (onProgress) onProgress(done, total);
    }
    return result;
  }

  // Ligne de données d'un export (format embarqué dans les pages : voir buildExportHtml)
  function toExportRow(etab, coords, nafFallback) {
    const p = (etab.periodesEtablissement && etab.periodesEtablissement[0]) || {};
    const row = {
      name: getName(etab),
      siret: etab.siret || '',
      naf: p.activitePrincipaleEtablissement || nafFallback || '',
      etat: p.etatAdministratifEtablissement || '',
      dateCreation: etab.dateCreationEtablissement || '',
      addr: buildAddr(etab),
      lat: coords ? coords.lat : null,
      lon: coords ? coords.lon : null,
    };
    if (coords && coords.approx) row.approx = true;
    return row;
  }

  // Requête + géocodage + mise en forme pour un département complet.
  async function collectDept(naf, dept, inseeKey, { cache, signal, onRetry, onPage, onGeoProgress } = {}) {
    const res = await fetchAllSirene(deptQuery(naf, dept), inseeKey, { signal, onRetry, onPage });
    const etabs = filterEtabs(res.etablissements, naf, false);
    const coords = await geocodeEtabs(etabs, { cache, signal, onProgress: onGeoProgress });
    const rows = etabs.map((etab, i) => toExportRow(etab, coords[i], naf));
    return { rows, total: res.total };
  }

  // ── Manifest ───────────────────────────────────────────────────────────────
  // { version, updated, naf: { "11.05Z": { label, depts: { "38": { count, geo, total, generated } } } } }
  // count = établissements dans la page, geo = dont géolocalisés, total = résultats SIRENE.

  // changes (facultatif, voir diffRows) ajoute opened / closed / since : évolution
  // depuis la mise à jour précédente.
  function manifestEntry(rows, total, generated, changes) {
    const e = {
      count: rows.length,
      geo: rows.filter(r => r.lat != null).length,
      total: total == null ? rows.length : total,
      generated: generated || new Date().toISOString(),
    };
    if (changes) {
      e.opened = changes.opened;
      e.closed = changes.closed.length;
      e.since = changes.since;
    }
    return e;
  }

  // ── Évolution d'une mise à jour à l'autre ──────────────────────────────────

  // Compare les établissements d'une page à ceux de sa version précédente, par SIRET.
  // Marque les nouveaux (row.isNew) et renvoie { since, opened, closed: [lignes disparues] },
  // ou null s'il n'y a pas de version précédente comparable : page absente, ou plus
  // de la moitié des établissements disparus d'un coup (changement de périmètre,
  // pas une évolution réelle).
  function diffRows(newRows, oldRows, since) {
    newRows.forEach(r => { delete r.isNew; });
    if (!oldRows || !oldRows.length) return null;
    const newIds = new Set(newRows.map(r => r.siret));
    const closed = oldRows.filter(r => r.siret && !newIds.has(r.siret));
    if (closed.length > oldRows.length / 2) return null;
    const oldIds = new Set(oldRows.map(r => r.siret));
    let opened = 0;
    newRows.forEach(r => { if (r.siret && !oldIds.has(r.siret)) { r.isNew = true; opened++; } });
    return {
      since: since ? String(since).slice(0, 10) : null,
      opened,
      closed: closed.map(r => ({ name: r.name, siret: r.siret, addr: r.addr })),
    };
  }

  // Vrai si les entrées changent un décompte du manifest (les dates seules ne comptent pas).
  function manifestChanged(existing, nafCode, entries) {
    let m = existing;
    if (typeof m === 'string') { try { m = JSON.parse(m); } catch (e) { m = null; } }
    const old = (m && m.naf && m.naf[nafCode] && m.naf[nafCode].depts) || {};
    return Object.keys(entries).some(k => {
      const a = old[k], b = entries[k];
      return !a || a.count !== b.count || a.geo !== b.geo || a.total !== b.total
        || a.opened !== b.opened || a.closed !== b.closed;
    });
  }

  // Fusionne des entrées dans un manifest (objet ou texte JSON) et renvoie le nouveau texte.
  function mergeManifest(existing, nafCode, entries) {
    let m = existing;
    if (typeof m === 'string') { try { m = JSON.parse(m); } catch (e) { m = null; } }
    if (!m || typeof m !== 'object') m = { version: 1 };
    m.naf = m.naf || {};
    const n = m.naf[nafCode] = m.naf[nafCode] || {};
    n.label = NAF_DICT[nafCode] || n.label || nafCode;
    const depts = Object.assign({}, n.depts || {}, entries);
    n.depts = {};
    Object.keys(depts).sort().forEach(k => { n.depts[k] = depts[k]; });
    m.updated = new Date().toISOString();
    return JSON.stringify(m, null, 1) + '\n';
  }

  // ── Pages d'export ─────────────────────────────────────────────────────────

  // Jeu de données embarqué (const D=[...]) : sert à comparer deux exports en
  // ignorant les tampons de date, et à régénérer une page avec un nouveau gabarit.
  function extractDataset(html) {
    const m = html.match(/const D=(\[[\s\S]*?\]);\s*(?:\n|<\/script>|\(function|function|const |var )/);
    return m ? m[1] : null;
  }

  // Évolution embarquée (const X={since, closed}) — absente des pages sans comparaison
  function extractChanges(html) {
    const m = html.match(/\nconst X=(\{[\s\S]*?\});\n/);
    return m ? m[1] : null;
  }

  // Version du gabarit des pages : l'incrémenter force la régénération des pages
  // même quand leurs données n'ont pas changé.
  const TEMPLATE_VERSION = '3';

  // Deux exports sont équivalents s'ils ont les mêmes données, la même évolution et
  // le même gabarit (les tampons de date sont ignorés).
  function sameExport(a, b) {
    const da = extractDataset(a), db = extractDataset(b);
    return da !== null && da === db && extractChanges(a) === extractChanges(b)
      && readMeta(a, 'template') === readMeta(b, 'template');
  }

  // Relit l'évolution embarquée d'une page : { since, opened, closed } ou null.
  function changesFromExportHtml(html) {
    const x = extractChanges(html);
    if (!x) return null;
    const o = JSON.parse(x);
    const rows = rowsFromExportHtml(html) || [];
    return {
      since: o.since || null,
      opened: rows.filter(r => r.isNew).length,
      closed: (o.closed || []).map(c => ({ name: c.n, siret: c.s, addr: { line1: c.a1 || '', line2: c.a2 || '' } })),
    };
  }

  function readMeta(html, name) {
    const m = html.match(new RegExp('<meta name="sirene:' + name + '" content="([^"]*)"'));
    return m ? m[1] : null;
  }

  // Code exécuté dans la page d'export (sérialisé tel quel par buildExportHtml) :
  // carte + liste virtualisée (seules les cartes visibles sont dans le DOM).
  function exportPageRuntime(D, X) {
    var ROW = 86;
    var esc = function (s) {
      return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
      });
    };
    var map = L.map('map');
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '\u00a9 <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> \u00b7 donn\u00e9es INSEE SIRENE',
      maxZoom: 19
    }).addTo(map);
    var cg = L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: 45 });
    map.addLayer(cg);

    function pin(color) {
      return L.divIcon({
        html: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="32" viewBox="0 0 24 32"><path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 20 12 20S24 21 24 12C24 5.37 18.63 0 12 0z" fill="' + color + '"/><circle cx="12" cy="12" r="4.5" fill="#fff"/></svg>',
        className: '', iconSize: [24, 32], iconAnchor: [12, 32], popupAnchor: [0, -34]
      });
    }
    var ICON = pin('#1a3a6b'), ICON_APPROX = pin('#8a96a8'), ICON_NEW = pin('#2d7a50'), ICON_ACTIVE = pin('#c8342a');
    function iconOf(d) { return d.nw ? ICON_NEW : d.ap ? ICON_APPROX : ICON; }
    function frDate(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : ''; }

    function popupHtml(d) {
      return '<div class="pname">' + esc(d.name) + '</div>'
        + '<div class="pnaf">' + esc(d.naf) + (d.nw ? ' \u00b7 <span class="pnew">nouveau</span>' : '') + '</div>'
        + '<div class="paddr">' + esc([d.a1, d.a2].filter(Boolean).join(', ')) + '</div>'
        + (d.dc ? '<div class="pdc">Cr\u00e9\u00e9 le ' + esc(frDate(d.dc)) + '</div>' : '')
        + (d.ap ? '<div class="papprox">Position approximative (centre de la commune)</div>' : '')
        + (d.siret ? '<a class="plink" target="_blank" rel="noopener" href="https://annuaire-entreprises.data.gouv.fr/etablissement/' + esc(d.siret) + '">Fiche annuaire-entreprises \u2192</a>' : '');
    }

    var markers = [], layers = [], nogeo = 0;
    D.forEach(function (d, i) {
      if (d.lat == null) { nogeo++; return; }
      var m = L.marker([d.lat, d.lon], { icon: iconOf(d) });
      m.bindPopup(function () { return popupHtml(d); });
      m.on('click', function () { select(i, false); });
      markers[i] = m;
      layers.push(m);
    });
    if (layers.length) { cg.addLayers(layers); map.fitBounds(cg.getBounds().pad(0.12)); }
    else map.setView([46.6, 2.5], 6);

    var box = document.getElementById('list'), inner = document.getElementById('inner');
    var head = document.getElementById('sbh'), input = document.getElementById('search');
    var hay = null, filtered = D.map(function (_, i) { return i; }), active = -1, queued = false, onlyNew = false;

    // Évolution depuis la mise à jour précédente : nouveaux (filtre) et disparus (liste)
    var nNew = D.filter(function (d) { return d.nw; }).length;
    if (X) {
      var closed = X.closed || [];
      var since = X.since ? ' depuis le ' + frDate(X.since) : '';
      document.getElementById('chg').innerHTML =
        '<button type="button" id="fNew" class="chip-new"' + (nNew ? '' : ' disabled') + '>+' + nNew.toLocaleString('fr-FR') + ' nouveau' + (nNew > 1 ? 'x' : '') + '</button>'
        + '<button type="button" id="fClosed" class="chip-closed"' + (closed.length ? '' : ' disabled') + '>\u2212' + closed.length.toLocaleString('fr-FR') + ' disparu' + (closed.length > 1 ? 's' : '') + '</button>'
        + '<span class="since">' + esc(since) + '</span>';
      document.getElementById('chg').hidden = false;
      document.getElementById('closedList').innerHTML =
        '<div class="closed-head">\u00c9tablissements disparus' + esc(since) + ' (ferm\u00e9s, changement d\u2019activit\u00e9 ou d\u00e9m\u00e9nagement)</div>'
        + closed.slice(0, 2000).map(function (c) {
          return '<div class="cl"><div class="name">' + esc(c.n) + '</div><div class="siret">' + esc(c.s) + '</div><div class="addr">' + esc([c.a1, c.a2].filter(Boolean).join(', ')) + '</div></div>';
        }).join('') + (closed.length > 2000 ? '<div class="no-results">\u2026 et ' + (closed.length - 2000) + ' autres</div>' : '');
      document.getElementById('fNew').addEventListener('click', function () {
        onlyNew = !onlyNew;
        this.classList.toggle('on', onlyNew);
        applyFilter(input.value);
      });
      document.getElementById('fClosed').addEventListener('click', function () {
        var on = document.querySelector('.sb').classList.toggle('show-closed');
        this.classList.toggle('on', on);
      });
    }

    function label() {
      var n = D.length.toLocaleString('fr-FR') + ' \u00e9tablissement' + (D.length > 1 ? 's' : '');
      if (filtered.length !== D.length) return filtered.length.toLocaleString('fr-FR') + ' / ' + n;
      return n + (nogeo ? ' \u00b7 ' + nogeo.toLocaleString('fr-FR') + ' sans position' : '');
    }

    function card(i, k) {
      var d = D[i];
      var tag = (d.nw ? '<span class="tnew">nouveau</span>' : '')
        + (d.lat == null ? '<span class="tpos">sans position</span>' : (d.ap ? '<span class="tpos">\u2248 commune</span>' : ''));
      return '<div class="card' + (i === active ? ' active' : '') + (d.lat == null ? ' nogeo' : '') + '" data-i="' + i + '" style="top:' + (k * ROW) + 'px">'
        + '<div class="name" title="' + esc(d.name) + '">' + esc(d.name) + '</div>'
        + '<div class="siret">' + esc(d.siret) + '</div>'
        + '<div class="tags"><span class="tnaf">' + esc(d.naf) + '</span>'
        + '<span class="tetat ' + (d.etat === 'A' ? 'actif">Actif' : 'ferme">Ferm\u00e9') + '</span>' + tag + '</div>'
        + '<div class="addr">' + esc([d.a1, d.a2].filter(Boolean).join(', ') || '\u2014') + '</div></div>';
    }

    function render() {
      queued = false;
      var top = box.scrollTop, h = box.clientHeight || 600;
      var from = Math.max(0, Math.floor(top / ROW) - 5);
      var to = Math.min(filtered.length, Math.ceil((top + h) / ROW) + 5);
      var html = '';
      for (var k = from; k < to; k++) html += card(filtered[k], k);
      inner.innerHTML = filtered.length ? html : '<div class="no-results">Aucun r\u00e9sultat</div>';
    }
    function schedule() { if (!queued) { queued = true; requestAnimationFrame(render); } }

    function applyFilter(q) {
      var t = q.toLowerCase().trim();
      if (!hay) hay = D.map(function (d) { return (d.name + ' ' + d.a1 + ' ' + d.a2 + ' ' + d.siret).toLowerCase(); });
      filtered = [];
      for (var i = 0; i < D.length; i++) if ((!t || hay[i].indexOf(t) >= 0) && (!onlyNew || D[i].nw)) filtered.push(i);
      inner.style.height = (filtered.length * ROW + 8) + 'px';
      head.textContent = label();
      box.scrollTop = 0;
      render();
    }

    function select(i, fromList) {
      if (active >= 0 && markers[active]) markers[active].setIcon(iconOf(D[active]));
      active = i;
      var m = markers[i];
      if (m) {
        m.setIcon(ICON_ACTIVE);
        if (fromList) cg.zoomToShowLayer(m, function () { m.openPopup(); });
      }
      if (!fromList) {
        var k = filtered.indexOf(i);
        if (k < 0) {
          input.value = ''; onlyNew = false;
          var fb = document.getElementById('fNew'); if (fb) fb.classList.remove('on');
          applyFilter(''); k = i;
        }
        if (k * ROW < box.scrollTop || (k + 1) * ROW > box.scrollTop + box.clientHeight) {
          box.scrollTop = Math.max(0, k * ROW - box.clientHeight / 2 + ROW / 2);
        }
      }
      render();
    }

    box.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    inner.addEventListener('click', function (e) {
      var c = e.target.closest('.card');
      if (c) select(+c.getAttribute('data-i'), true);
    });
    var timer = null;
    input.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { applyFilter(input.value); }, 150);
    });
    applyFilter('');
  }

  const EXPORT_CSS = [
    '*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}',
    'html,body{height:100%}',
    'body{font-family:system-ui,sans-serif;display:flex;flex-direction:column;overflow:hidden;background:#f5f3ef;color:#1a1a1a}',
    'header{background:#1a3a6b;color:#fff;padding:10px 18px;display:flex;align-items:center;gap:12px;flex-shrink:0}',
    'h1{font-size:.95rem;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.meta{font-size:.72rem;opacity:.65;margin-left:auto;white-space:nowrap}',
    '.body{display:flex;flex:1;min-height:0}',
    '.sb{width:340px;flex-shrink:0;background:#fff;border-right:1px solid #ddd;display:flex;flex-direction:column;min-height:0}',
    '.sbh{padding:9px 14px;border-bottom:1px solid #ddd;font-size:.72rem;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:.05em}',
    '.search-box{padding:8px;border-bottom:1px solid #eee}',
    '.search-box input{width:100%;border:1px solid #ddd;border-radius:5px;padding:6px 10px;font-size:.82rem;outline:none;background:#f9f9f9}',
    '.search-box input:focus{border-color:#1a3a6b;background:#fff}',
    '.list{flex:1;overflow-y:auto;position:relative}',
    '#inner{position:relative}',
    '.no-results{padding:24px 14px;text-align:center;font-size:.8rem;color:#aaa}',
    '.card{position:absolute;left:8px;right:8px;height:80px;margin-top:6px;overflow:hidden;background:#fafaf8;border:1px solid #e5e2d9;border-left:3px solid transparent;border-radius:6px;padding:8px 12px;cursor:pointer;transition:border-color .15s}',
    '.card:hover{border-left-color:#1a3a6b}.card.active{border-left-color:#c8342a;background:#fff8f7}.card.nogeo{cursor:default;opacity:.8}',
    '.name{font-weight:600;font-size:.85rem;margin-bottom:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.siret{font-family:monospace;font-size:.64rem;color:#888;margin-bottom:3px}',
    '.tags{display:flex;gap:4px;margin-bottom:4px}',
    '.tnaf,.tetat,.tpos{border-radius:3px;font-size:.65rem;padding:1px 6px;font-weight:600}',
    '.tnaf{background:#e8eef8;color:#1a3a6b}.tpos{background:#eee;color:#666}.tnew{border-radius:3px;font-size:.65rem;padding:1px 6px;font-weight:700;background:#2d7a50;color:#fff}',
    '.chg{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:7px 10px;border-bottom:1px solid #eee;font-size:.72rem}',
    '.chg[hidden]{display:none}.chg .since{color:#888}',
    '.chg button{border-radius:12px;padding:2px 9px;font-size:.72rem;font-weight:600;cursor:pointer;border:1px solid}',
    '.chg button:disabled{opacity:.45;cursor:default}',
    '.chip-new{background:#e6f4ec;color:#2d7a50;border-color:#a5d6a7}.chip-new.on{background:#2d7a50;color:#fff}',
    '.chip-closed{background:#fdecea;color:#c8342a;border-color:#f5b8b8}.chip-closed.on{background:#c8342a;color:#fff}',
    '.closed-list{display:none;flex:1;overflow-y:auto;padding:8px}',
    '.sb.show-closed .closed-list{display:block}.sb.show-closed .list,.sb.show-closed .search-box{display:none}',
    '.closed-head{font-size:.72rem;color:#666;margin:2px 4px 8px}',
    '.cl{background:#fafaf8;border:1px solid #e5e2d9;border-left:3px solid #c8342a;border-radius:6px;padding:7px 10px;margin-bottom:6px}',
    '.pnew{color:#2d7a50;font-weight:700}.pdc{font-size:.7rem;color:#888;margin-top:3px}',
    '.actif{background:#e6f4ec;color:#2d7a50}.ferme{background:#fdecea;color:#c8342a}',
    '.addr{font-size:.75rem;color:#777;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '#map{flex:1;min-height:0}',
    '.leaflet-popup-content-wrapper{border-radius:6px!important;font-family:system-ui,sans-serif!important}',
    '.pname{font-weight:700;font-size:.85rem;margin-bottom:3px}',
    '.pnaf{font-family:monospace;font-size:.72rem;color:#1a3a6b;margin-bottom:4px}',
    '.paddr{font-size:.75rem;color:#777}',
    '.papprox{font-size:.7rem;color:#a06a00;margin-top:4px}',
    '.plink{display:inline-block;margin-top:6px;font-size:.72rem;color:#1a3a6b}',
    '@media (max-width:700px){',
    '.body{flex-direction:column-reverse}',
    '.sb{width:auto;height:42%;border-right:0;border-top:1px solid #ddd}',
    'header{padding:8px 12px}.meta{display:none}h1{font-size:.85rem}',
    '}',
  ].join('');

  const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/';

  // Page HTML autonome pour une liste d'établissements.
  // rows : [{ name, siret, naf, etat, dateCreation?, addr:{line1,line2}, lat, lon, approx?, isNew? }]
  // (lat null = sans position). changes : résultat de diffRows (facultatif).
  function buildExportHtml(rows, nafCode, dLabel, { generated = new Date(), changes = null } = {}) {
    const count = rows.length;
    const geo = rows.filter(r => r.lat != null).length;
    const title = 'Sirene \u2014 ' + nafCode + ' \u00b7 ' + dLabel + ' \u2014 ' + count + ' \u00e9tablissements';
    const when = generated.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

    // Format compact embarqué. Neutralise la rupture de balise script et les
    // séparateurs de ligne JS (U+2028/2029) pour que le JSON reste sûr et valide.
    const dataJson = safeJson(rows.map(r => {
      const o = { name: r.name, siret: r.siret, naf: r.naf, etat: r.etat, a1: r.addr.line1 || '', a2: r.addr.line2 || '', lat: r.lat, lon: r.lon };
      if (r.approx) o.ap = 1;
      if (r.dateCreation) o.dc = r.dateCreation;
      if (r.isNew) o.nw = 1;
      return o;
    }));
    const changesJson = changes ? safeJson({
      since: changes.since,
      closed: changes.closed.map(c => ({ n: c.name, s: c.siret, a1: c.addr.line1 || '', a2: c.addr.line2 || '' })),
    }) : null;

    return [
      '<!DOCTYPE html><html lang="fr"><head>',
      '<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>',
      '<meta name="sirene:count" content="' + count + '"/>',
      '<meta name="sirene:geo" content="' + geo + '"/>',
      '<meta name="sirene:naf" content="' + escHtml(nafCode) + '"/>',
      '<meta name="sirene:dept" content="' + escHtml(dLabel) + '"/>',
      '<meta name="sirene:generated" content="' + generated.toISOString() + '"/>',
      '<meta name="sirene:template" content="' + TEMPLATE_VERSION + '"/>',
      '<title>' + escHtml(title) + '</title>',
      '<link rel="stylesheet" href="' + CDN + 'leaflet/1.9.4/leaflet.min.css"/>',
      '<script src="' + CDN + 'leaflet/1.9.4/leaflet.min.js"><' + '/script>',
      '<link rel="stylesheet" href="' + CDN + 'leaflet.markercluster/1.5.3/MarkerCluster.css"/>',
      '<link rel="stylesheet" href="' + CDN + 'leaflet.markercluster/1.5.3/MarkerCluster.Default.css"/>',
      '<script src="' + CDN + 'leaflet.markercluster/1.5.3/leaflet.markercluster.js"><' + '/script>',
      '<style>' + EXPORT_CSS + '</style></head><body>',
      '<header><h1>&#128205; ' + escHtml(title) + '</h1><div class="meta">Export\u00e9 le ' + escHtml(when) + ' \u2014 API Sirene INSEE</div></header>',
      '<div class="body"><div class="sb"><div class="sbh" id="sbh">' + count + ' \u00e9tablissements</div>',
      '<div class="chg" id="chg" hidden></div>',
      '<div class="search-box"><input id="search" type="search" placeholder="Rechercher nom, adresse, SIRET\u2026"/></div>',
      '<div class="list" id="list"><div id="inner"></div></div><div class="closed-list" id="closedList"></div></div><div id="map"></div></div>',
      '<script>\nconst D=' + dataJson + ';\n'
        + (changesJson ? 'const X=' + changesJson + ';\n' : 'const X=null;\n')
        + '(' + exportPageRuntime.toString() + ')(D, X);\n<' + '/script>',
      '</body></html>',
    ].join('');
  }

  // Relit les lignes embarquées d'une page d'export (tous gabarits) au format de buildExportHtml.
  function rowsFromExportHtml(html) {
    const ds = extractDataset(html);
    if (!ds) return null;
    return JSON.parse(ds).map(d => {
      const r = { name: d.name, siret: d.siret, naf: d.naf, etat: d.etat, addr: { line1: d.a1 || '', line2: d.a2 || '' }, lat: d.lat, lon: d.lon };
      if (d.ap) r.approx = true;
      if (d.dc) r.dateCreation = d.dc;
      if (d.nw) r.isNew = true;
      return r;
    });
  }

  // Prépare la page d'un département à partir de ses lignes et de la version
  // précédente de la page (texte HTML ou null) : calcule l'évolution, génère le HTML,
  // et indique si la page est inchangée (inutile de la réécrire).
  // Sans aucun changement, la date de référence de la version précédente est
  // conservée (« aucun changement depuis le … »), pour ne pas réécrire la page.
  function prepareExport(rows, nafCode, dept, oldHtml, { generated } = {}) {
    let changes = null;
    if (oldHtml) {
      changes = diffRows(rows, rowsFromExportHtml(oldHtml), readMeta(oldHtml, 'generated'));
      if (changes && !changes.opened && !changes.closed.length) {
        const prev = changesFromExportHtml(oldHtml);
        if (prev && !prev.opened && !prev.closed.length && prev.since) changes.since = prev.since;
      }
    }
    const html = buildExportHtml(rows, nafCode, dept, { changes, generated: generated || new Date() });
    return { html, changes, unchanged: !!oldHtml && sameExport(oldHtml, html) };
  }

  // JSON sûr dans un <script> : neutralise la rupture de balise et les séparateurs
  // de ligne JS (U+2028/2029).
  function safeJson(v) {
    return JSON.stringify(v)
      .replace(/</g, '\\u003c').replace(/>/g, '\\u003e')
      .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  }

  return {
    config,
    DEPT_NAMES, DEPT_CODES, DEPT_POPULATION, NAF_DICT, NAF_ALIASES,
    escHtml, normText, resolveNaf, nafSlug, exportFileName, deptClause, isDeptCode, deptQuery,
    buildAddr, getName, todayIso, parseCsv, csvCell,
    fetchSirene, fetchAllSirene, filterEtabs,
    geoCacheKey, geocodeEtabs, toExportRow, collectDept,
    manifestEntry, manifestChanged, mergeManifest, diffRows, prepareExport,
    TEMPLATE_VERSION, extractDataset, sameExport, readMeta, buildExportHtml, rowsFromExportHtml, changesFromExportHtml, exportPageRuntime,
  };
});
