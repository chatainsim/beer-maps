# beer-maps

Cartographie des établissements français à partir de l'**API SIRENE de l'INSEE**.
Recherchez un type d'activité (brasseries, restaurants, librairies…), géolocalisez
les établissements sur une carte, et exportez le résultat (page autonome, CSV, GeoJSON).

Le projet est constitué de **fichiers HTML autonomes, sans étape de build** : aucune
dépendance à installer, aucun serveur applicatif. Tout tourne dans le navigateur
(Leaflet pour la carte, `fetch` vers les API publiques INSEE et BAN).

## Les deux outils

| Fichier | Rôle |
|---|---|
| **`sirene-explorer.html`** | Outil de recherche : interroge l'API SIRENE, géocode les adresses, affiche les établissements sur une carte, et génère les exports. |
| **`index.html`** | Carte choroplèthe de la France métropolitaine : colore chaque département selon le nombre d'établissements, en lisant les pages déjà générées dans `exports/`. |

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
- Recherche par code NAF (ex. `11.05Z`) ou par libellé d'activité, et par
  code postal / département.
- Filtre **« créé depuis (année) »** (`dateCreationEtablissement`).
- Inclure / exclure les établissements fermés et les DOM-TOM.
- Mode **« Tout charger »** : enchaîne plusieurs requêtes pour dépasser la limite
  de 200 résultats de l'API.
- **Lien profond + persistance** : les critères sont reflétés dans l'URL (partageable)
  et restaurés au rechargement. Une URL portant des critères relance la recherche
  automatiquement si une clé API est présente.

**Géocodage**
- Géocodage par lot via l'endpoint CSV de la BAN (rapide pour de gros volumes).
- **Cache local** (`localStorage`) : les adresses déjà résolues ne sont pas
  re-interrogées, succès comme échecs.
- Réessais automatiques avec backoff sur les quotas (HTTP 429 / 503).

**Exports**
- **Page HTML autonome** : carte + liste + recherche intégrée, un seul fichier
  partageable, sans dépendance autre que les CDN Leaflet.
- **CSV** (BOM UTF-8 pour Excel, échappement RFC 4180).
- **GeoJSON** (`FeatureCollection`, exploitable dans QGIS).

**Publication automatique**
- Bouton **Push GitHub** : pousse l'export courant sur un dépôt via l'API Contents.
- **« Tous les départements → GitHub »** : boucle sur les 95 départements
  métropolitains, génère et pousse une page par département. Les commits identiques
  sont **ignorés** (comparaison du jeu de données embarqué, hors tampon de date).

## Le dossier `exports/`

Les pages générées y sont stockées, **une par activité × département**, nommées :

```
exports/sirene-<NAF>-<DEPT>.html      ex. exports/sirene-11-05Z-56.html
```

`index.html` scanne ces fichiers pour construire la carte choroplèthe. Chaque export
embarque une balise `<meta name="sirene:count">` (+ `:naf`, `:dept`, `:generated`)
qui permet à `index.html` de lire le décompte sans parser le contenu.

Activités déjà publiées : brasseries (`11.05Z`), restauration (`56.10A`), débits de
boissons (`56.30Z`), boulangeries (`10.71C`), librairies (`47.61Z`), et quelques autres.

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

- **Aucun build, aucune dépendance npm.** Trois contextes JS : `index.html`,
  `sirene-explorer.html`, et le gabarit généré par `buildExportHtml()`.
- Du code est **volontairement dupliqué** entre ces trois endroits (table des
  départements, CSS de base, fonctions utilitaires) puisqu'il n'y a pas de module
  partagé : une correction transverse doit être répétée à chaque endroit.
- Cartographie : [Leaflet](https://leafletjs.com) 1.9 +
  [Leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster) (via CDN).

## Sécurité

- La clé API INSEE et le token GitHub sont stockés **en clair dans le `localStorage`**
  du navigateur. Ne les saisissez pas sur un poste partagé ; privilégiez un token à
  portée minimale (`repo`) que vous pouvez révoquer.
- Le contenu issu de l'API est **échappé** à l'affichage et dans les exports ; le JSON
  embarqué dans les pages générées neutralise les ruptures de balise `</script>`.

## Sources de données

- [API SIRENE 3.11 — INSEE](https://portail-api.insee.fr) (données établissements).
- [Base Adresse Nationale](https://adresse.data.gouv.fr) (géocodage).
- Fonds de carte © [OpenStreetMap](https://www.openstreetmap.org/copyright).
- Contours départementaux :
  [france-geojson](https://github.com/gregoiredavid/france-geojson).
