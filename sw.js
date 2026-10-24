// Service worker : garde une copie de l'application sur l'appareil pour
// qu'elle fonctionne sans connexion internet.
//
// - À l'installation, tous les fichiers de la liste FICHIERS sont copiés dans
//   un cache dont le nom contient la version (ex. « omni-tableur-2.1.0 »).
// - Ensuite, chaque fichier est servi depuis ce cache (« cache d'abord »).
// - Quand la version change dans js/config.js, le navigateur détecte ce
//   service worker modifié, prépare le nouveau cache, et l'application propose
//   « Recharger ». Les anciens caches de CETTE application sont alors supprimés
//   (jamais ceux des autres applications du même site), y compris ceux d'avant
//   le renommage en « Omni-Tableur » (préfixe « tableur- »).

importScripts('js/config.js');

const CONFIG = self.CONFIG_APP;
const PREFIXE = `${CONFIG.idStockage}-`;
const ANCIEN_PREFIXE = `${CONFIG.ancienIdStockage}-`;
const CACHE = `${PREFIXE}${CONFIG.version}`;

// Liste de tous les fichiers de l'application. À tenir à jour quand on en
// ajoute un : le test tests/unitaires/hors-ligne.test.mjs le vérifie.
const FICHIERS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/polices.css',
  'css/themes.css',
  'css/base.css',
  'css/grille.css',
  'css/fenetres.css',
  'css/impression.css',
  'js/config.js',
  'js/theme-initial.js',
  'js/app.js',
  'js/donnees/adresses.js',
  'js/donnees/bordures.js',
  'js/donnees/classeur.js',
  'js/donnees/fichier-classeur.js',
  'js/donnees/formules.js',
  'js/donnees/fusions.js',
  'js/donnees/recherche.js',
  'js/donnees/recopie.js',
  'js/donnees/regles.js',
  'js/donnees/saisie.js',
  'js/donnees/tri.js',
  'js/calcul/bibliotheque.js',
  'js/calcul/comparaisons.js',
  'js/calcul/conditions.js',
  'js/calcul/erreurs.js',
  'js/calcul/fonctions.js',
  'js/calcul/moteur.js',
  'js/calcul/traduction.js',
  'js/affichage/barre-outils.js',
  'js/affichage/commandes-donnees.js',
  'js/affichage/commandes-edition.js',
  'js/affichage/commandes-fusion.js',
  'js/affichage/conditions.js',
  'js/affichage/edition.js',
  'js/affichage/fenetres.js',
  'js/affichage/format.js',
  'js/affichage/grille.js',
  'js/affichage/interactions.js',
  'js/affichage/menu.js',
  'js/affichage/onglets-feuilles.js',
  'js/affichage/outils-bordures.js',
  'js/affichage/mise-en-forme.js',
  'js/affichage/presse-papiers.js',
  'js/affichage/recherche.js',
  'js/affichage/sauvegarde-fichier.js',
  'js/affichage/selection.js',
  'js/affichage/zoom.js',
  'js/services/export-csv.js',
  'js/services/export-pdf.js',
  'js/services/fichiers.js',
  'js/services/import-csv.js',
  'js/services/onglets.js',
  'js/services/pwa.js',
  'js/services/sauvegarde-auto.js',
  'js/services/stockage.js',
  'js/services/theme.js',
  'vendor/fast-formula-parser/parser.min.js',
  'assets/logo-omni-systeme.webp',
  'icons/favicon-32.png',
  'icons/apple-touch-icon.png',
  'icons/icone-192.png',
  'icons/icone-512.png',
  'icons/icone-masquable-192.png',
  'icons/icone-masquable-512.png',
  'fonts/oxanium-latin-500-normal.woff2',
  'fonts/oxanium-latin-ext-500-normal.woff2',
  'fonts/oxanium-latin-700-normal.woff2',
  'fonts/oxanium-latin-ext-700-normal.woff2',
  'fonts/literata-latin-400-normal.woff2',
  'fonts/literata-latin-ext-400-normal.woff2',
  'fonts/literata-latin-700-normal.woff2',
  'fonts/literata-latin-ext-700-normal.woff2',
  'fonts/jetbrains-mono-latin-500-normal.woff2',
  'fonts/jetbrains-mono-latin-ext-500-normal.woff2',
  'licences/fast-formula-parser-MIT.txt',
  'licences/chevrotain-Apache-2.0.txt',
  'licences/jstat-MIT.txt',
  'licences/bessel-Apache-2.0.txt',
  'licences/bahttext-MIT.txt',
  'licences/police-Oxanium-OFL.txt',
  'licences/police-Literata-OFL.txt',
  'licences/police-JetBrains-Mono-OFL.txt',
];

self.addEventListener('install', (evenement) => {
  evenement.waitUntil(
    caches.open(CACHE).then((cache) =>
      // « reload » : on prend les fichiers sur le serveur, pas dans le cache HTTP.
      cache.addAll(FICHIERS.map((fichier) => new Request(fichier, { cache: 'reload' }))),
    ),
  );
});

self.addEventListener('activate', (evenement) => {
  evenement.waitUntil(
    (async () => {
      for (const nom of await caches.keys()) {
        const deCetteApplication = nom.startsWith(PREFIXE) || nom.startsWith(ANCIEN_PREFIXE);
        if (deCetteApplication && nom !== CACHE) await caches.delete(nom);
      }
      await self.clients.claim();
    })(),
  );
});

// L'application demande l'activation de la nouvelle version (bouton « Recharger »).
self.addEventListener('message', (evenement) => {
  if (evenement.data?.type === 'activer') self.skipWaiting();
});

self.addEventListener('fetch', (evenement) => {
  const requete = evenement.request;
  if (requete.method !== 'GET') return;
  const url = new URL(requete.url);
  if (url.origin !== self.location.origin || !requete.url.startsWith(self.registration.scope)) return;

  evenement.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      if (requete.mode === 'navigate') {
        // Toute page de l'application affiche index.html.
        const page = (await cache.match('./')) ?? (await cache.match('index.html'));
        if (page) return page;
        return fetch(requete);
      }
      const enCache = await cache.match(requete, { ignoreSearch: true });
      return enCache ?? fetch(requete);
    })(),
  );
});
