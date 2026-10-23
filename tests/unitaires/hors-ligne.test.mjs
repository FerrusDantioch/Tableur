// Vérifie que l'application peut fonctionner hors ligne : chaque fichier
// utilisé par l'application doit figurer dans la liste du service worker
// (sw.js), et chaque fichier de la liste doit exister.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = fileURLToPath(new URL('../..', import.meta.url));
const lire = (chemin) => readFileSync(join(RACINE, chemin), 'utf8');

/** Liste des fichiers mis en cache par sw.js. */
function fichiersDuServiceWorker() {
  const liste = /const FICHIERS = \[([\s\S]*?)\];/.exec(lire('sw.js'))[1];
  return [...liste.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

/** Tous les fichiers d'un dossier (récursivement), chemins relatifs à la racine. */
function fichiersDe(dossier) {
  const resultat = [];
  const parcourir = (chemin) => {
    for (const nom of readdirSync(chemin)) {
      const complet = join(chemin, nom);
      if (statSync(complet).isDirectory()) parcourir(complet);
      else resultat.push(relative(RACINE, complet).split('\\').join('/'));
    }
  };
  parcourir(join(RACINE, dossier));
  return resultat;
}

test('chaque fichier de la liste hors ligne existe', () => {
  for (const fichier of fichiersDuServiceWorker()) {
    if (fichier === './') continue;
    assert.ok(existsSync(join(RACINE, fichier)), `${fichier} est dans sw.js mais n'existe pas`);
  }
});

test('chaque fichier de l’application est dans la liste hors ligne', () => {
  const liste = new Set(fichiersDuServiceWorker());
  const attendus = [
    'index.html',
    'manifest.webmanifest',
    ...fichiersDe('css'),
    ...fichiersDe('js'),
    ...fichiersDe('fonts'),
    ...fichiersDe('icons'),
    ...fichiersDe('assets'),
    ...fichiersDe('licences'),
    'vendor/fast-formula-parser/parser.min.js',
  ];
  for (const fichier of attendus) assert.ok(liste.has(fichier), `${fichier} manque dans la liste de sw.js`);
});

test('le manifeste et config.js donnent le même nom', () => {
  const manifeste = JSON.parse(lire('manifest.webmanifest'));
  const nom = /nom: '([^']+)'/.exec(lire('js/config.js'))[1];
  assert.equal(manifeste.name, nom);
  assert.equal(manifeste.short_name, nom);
  for (const icone of manifeste.icons) assert.ok(existsSync(join(RACINE, icone.src)), `${icone.src} introuvable`);
});

test('index.html ne charge rien depuis internet', () => {
  const page = lire('index.html');
  const adresses = [...page.matchAll(/(?:src|href)="([^"#]+)"/g)].map((m) => m[1]);
  for (const adresse of adresses) {
    if (adresse.startsWith('mailto:')) {
      // Lien « écrire un e-mail » (À propos) : il ouvre la messagerie, rien n'est chargé.
      assert.match(adresse, /^mailto:omni-systeme\.choking513@passmail\.net\?subject=/, `adresse e-mail inattendue : ${adresse}`);
    } else if (adresse.startsWith('http')) {
      // Seul le lien vers le site de l'Omni-système (ouvert à la demande) est permis.
      assert.match(adresse, /^https:\/\/ferrusdantioch\.github\.io\//, `ressource externe : ${adresse}`);
    } else {
      assert.ok(existsSync(join(RACINE, adresse)), `fichier introuvable : ${adresse}`);
    }
  }
});
