# beer-maps

Cartographie des établissements français à partir de l'**API SIRENE de l'INSEE**.
Recherchez un type d'activité (brasseries, restaurants, librairies…), géolocalisez
les établissements sur une carte, et exportez le résultat (page autonome, CSV, GeoJSON).

Le projet est constitué de **fichiers HTML et JS statiques, sans étape de build** :
aucune dépendance à installer, aucun serveur applicatif. Tout tourne dans le
navigateur (Leaflet pour la carte, `fetch` vers les API publiques INSEE et BAN) ; une
GitHub Action réutilise le même code sous Node pour la mise à jour mensuelle.

## Les deux outils

| Fichier | Rôle |
|---|---|
| **`sirene-explorer.html`** | Outil de recherche : interroge l'API SIRENE, géocode les adresses, affiche les établissements sur une carte, et génère les exports. |
| **`index.html`** | Carte choroplèthe de la France métropolitaine : colore chaque département selon le nombre d'établissements ou leur densité **pour 10 000 habitants**, d'après `exports/manifest.json`. |

Les deux pages sont reliées par des liens croisés en en-tête.

## Démarrage rapide

1. Ouvrez `sirene-explorer.html` dans un navigateur (double-clic, ou via un petit
   serveur statique — voir [Déploiement](#déploiement)).
2. Cliquez sur **Paramètres** et collez votre clé API INSEE
   (`X-INSEE-Api-Key-Integration`). Clé gratuite sur
   [portail-api.insee.fr](https://portail-api.insee.fr).
3. Choisissez une activité (champ NAF ou un raccourci : 🍺 Brasseries, 🍽 Restaurants…),
   éventuellement un département / code postal, puis **Rechercher**.
4. Les adresses sont géocodées en arrière-plan via la
   [Base Adresse Nationale](https://adresse.data.gouv.fr) et affichées sur la carte
   (marqueurs regroupés en clusters).

> La clé API et les paramètres sont enregistrés **en clair dans le `localStorage`**
> du navigateur (voir [Sécurité](#sécurité)).

## Fonctionnalités

**Recherche**
- Recherche par code NAF (ex. `11.05Z`, `1105z`) ou par libellé d'activité
  (« brasseries », « boulangerie », « cafés »…), et par département ou code postal.
  Un département (`38`, `2A`, `20` = toute la Corse, `971`…) est filtré sur le
  **code commune INSEE**, plus fiable que le code postal (certaines communes ont le
  code postal d'un département voisin).
- Seule la **situation actuelle** des établissements est interrogée (paramètre
  `date=` de l'API) : un établissement fermé ou qui a changé d'activité n'est pas
  compté.
- Filtre **« créé depuis (année) »** (`dateCreationEtablissement`).
- Inclure / exclure les établissements fermés et les DOM-TOM.
- Mode **« Tout charger »** : enchaîne des requêtes de 1 000 résultats via le
  **curseur** de l'API (pagination profonde), jusqu'à 10 000 établissements.
- **Lien profond + persistance** : les critères sont reflétés dans l'URL (partageable)
  et restaurés au rechargement. Une URL portant des critères relance la recherche
  automatiquement si une clé API est présente.

**Géocodage**
- Géocodage par lot via l'endpoint CSV de la BAN (rapide pour de gros volumes), en
  **deux passes** : adresse filtrée sur le code postal, puis, pour les échecs,
  adresse sans code postal ni « CEDEX » filtrée sur le **code commune INSEE**
  (rattrape les codes postaux CEDEX, inconnus de la BAN).
- Une adresse résolue seulement au niveau de la commune est marquée **« ≈ commune »**
  (marqueur gris). Les établissements introuvables restent dans la liste et les
  exports, signalés **« sans position »**, au lieu d'être supprimés.
- **Cache local** (`localStorage`) : les adresses déjà résolues ne sont pas
  re-interrogées, succès comme échecs.
- Réessais automatiques avec backoff sur les quotas (HTTP 429 / 502 / 503).

**Exports**
- **Page HTML autonome** : carte + liste + recherche (nom, adresse, SIRET), un seul
  fichier partageable, sans dépendance autre que les CDN Leaflet. La liste est
  **virtualisée** (seules les cartes visibles sont dans le DOM) : une page de 16 000
  établissements s'ouvre en quelques secondes. Chaque fiche renvoie vers
  [annuaire-entreprises.data.gouv.fr](https://annuaire-entreprises.data.gouv.fr).
- **CSV** (BOM UTF-8 pour Excel, échappement RFC 4180), avec une colonne `position`
  (`adresse`, `commune` ou `aucune`).
- **GeoJSON** (`FeatureCollection`, exploitable dans QGIS) — établissements géolocalisés.

**Publication**
- Bouton **Push GitHub** : pousse l'export courant (et le manifest s'il s'agit d'un
  département complet) en **un seul commit**.
- **« Tous les départements → GitHub »** : boucle sur les 95 départements
  métropolitains, récupère **tous** les établissements actifs de chacun (pas de
  plafond), génère une page par département et met à jour `manifest.json`, le tout
  en **un seul commit** (API Git Data : blobs → arbre → commit), même en cas
  d'annulation. Un panneau suit la progression (département en cours, compteurs,
  erreurs). Les pages dont les données et le gabarit sont inchangés ne sont pas
  réécrites ; un batch sans changement ne crée aucun commit.
- **Mise à jour mensuelle automatique** : voir [GitHub Action](#mise-à-jour-automatique).

## Le dossier `exports/`

Les pages générées y sont stockées, **une par activité × département**, nommées :

```
exports/sirene-<NAF>-<DEPT>.html      ex. exports/sirene-11-05Z-56.html
```

`exports/manifest.json` recense les décomptes de toutes les pages ; `index.html` le
lit en une seule requête pour construire la carte choroplèthe et la liste des
activités :

```json
{ "version": 1, "updated": "…",
  "naf": { "11.05Z": { "label": "Fabrication de bière",
                       "depts": { "38": { "count": 85, "geo": 80, "total": 85, "generated": "…" } } } } }
```

`count` = établissements dans la page, `geo` = dont géolocalisés, `total` = résultats
SIRENE (absent pour les pages antérieures au manifest). Le manifest est mis à jour
par le batch « Tous les départements », par la GitHub Action, et par le bouton
**Push GitHub** lorsqu'il s'agit d'un département complet (« Tout charger » coché).

Sans manifest, `index.html` retombe sur l'ancien mode : il scanne chaque page, dont
la balise `<meta name="sirene:count">` (+ `:geo`, `:naf`, `:dept`, `:generated`,
`:template`) donne le décompte.

**La carte** colore les départements par **quantiles** (chaque couleur regroupe à peu
près autant de départements), pour qu'un département hors norme comme Paris n'écrase
pas l'échelle. Le sélecteur **Mesure** bascule entre le nombre d'établissements et la
densité **pour 10 000 habitants** (populations légales INSEE). La vue est partageable :
`index.html?naf=56.10A&mesure=hab`.

## Mise à jour automatique

`.github/workflows/update-exports.yml` relance chaque mois (le 2, à 03:17 UTC) la
régénération de **toutes les activités du manifest** sur les 95 départements, et
commite le résultat **en un seul commit**. Elle se lance aussi à la main depuis
l'onglet *Actions* (« Run workflow »), avec en option une liste de codes NAF et/ou
de départements.

**Prérequis** : ajouter la clé INSEE comme secret de dépôt `INSEE_API_KEY`
(*Settings → Secrets and variables → Actions*). Le cache de géocodage est conservé
d'une exécution à l'autre (`actions/cache`), seules les nouvelles adresses sont
envoyées à la BAN. L'exécution est marquée en échec si un département n'a pas pu
être traité ; les autres sont tout de même commités, et le résumé de l'exécution
liste les erreurs.

En local (Node ≥ 18) :

```bash
INSEE_API_KEY=… node scripts/update-exports.mjs --naf 11.05Z,56.30Z --dept 38,69
node scripts/rebuild-exports.mjs   # applique le gabarit actuel aux pages, sans appel d'API
```

`rebuild-exports.mjs` sert après une modification de `buildExportHtml()` : il relit les
données embarquées dans chaque page et la régénère.

## Déploiement

Comme tout est statique, n'importe quel hébergement de fichiers convient
(GitHub Pages, Gitea Pages, Netlify, un simple bucket…). En local, pour éviter les
restrictions `file://` :

```bash
python3 -m http.server 8000
# puis http://localhost:8000/sirene-explorer.html
```

Les exports sont référencés en chemin **relatif** (`exports/…`), donc l'arborescence
fonctionne telle quelle une fois servie.

## Architecture

- **Aucun build, aucune dépendance npm.**
- **`lib/sirene-core.js`** regroupe le code commun : référentiels (départements,
  populations, codes NAF), requêtes SIRENE, géocodage BAN, gabarit des pages
  d'export, manifest. Il se charge par `<script src>` dans les deux pages (global
  `SireneCore`) et par `require` sous Node (`scripts/`).
- Les **pages d'export restent autonomes** : `buildExportHtml()` y recopie le code de
  `exportPageRuntime()`. Après une modification du gabarit, incrémentez
  `TEMPLATE_VERSION` (les pages seront réécrites au prochain batch même si leurs
  données n'ont pas changé) et lancez `scripts/rebuild-exports.mjs`.
- Les trois pages s'adaptent aux **petits écrans** (carte au-dessus, liste en dessous).
- Cartographie : [Leaflet](https://leafletjs.com) 1.9 +
  [Leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster) (via CDN).

## Sécurité

- La clé API INSEE et le token GitHub sont stockés **en clair dans le `localStorage`**
  du navigateur. Ne les saisissez pas sur un poste partagé ; privilégiez un token
  *fine-grained* limité à ce dépôt (permission *Contents : read and write*), que vous
  pouvez révoquer. Avec la GitHub Action, aucun token n'est nécessaire dans le
  navigateur : la clé INSEE reste dans les secrets du dépôt.
- Le contenu issu de l'API est **échappé** à l'affichage et dans les exports ; le JSON
  embarqué dans les pages générées neutralise les ruptures de balise `</script>`.

## Sources de données

- [API SIRENE 3.11 — INSEE](https://portail-api.insee.fr) (données établissements).
- [Base Adresse Nationale](https://adresse.data.gouv.fr) (géocodage).
- Populations légales INSEE par département, via
  [@etalab/decoupage-administratif](https://github.com/datagouv/decoupage-administratif)
  (somme des communes ; Corse = 2A + 2B).
- Fonds de carte © [OpenStreetMap](https://www.openstreetmap.org/copyright).
- Contours départementaux :
  [france-geojson](https://github.com/gregoiredavid/france-geojson).
