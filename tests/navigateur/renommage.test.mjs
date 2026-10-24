// Ajout 0 : renommage « Tableur » → « Omni-Tableur ».
// On imite un appareil qui a utilisé l'ancienne version (données rangées sous
// le nom « tableur »), puis on ouvre la nouvelle : rien ne doit être perdu.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { demarrerServeur, lancerNavigateur, texteCellule } from './outils.mjs';

let serveur;
let navigateur;

before(async () => {
  serveur = await demarrerServeur();
  navigateur = await lancerNavigateur();
});

after(async () => {
  await navigateur?.close();
  serveur?.arreter();
});

/** Classeur tel que l'enregistrait la version 2.0.0. */
const ANCIEN_CLASSEUR = {
  format: 'tableur',
  version: 2,
  titre: 'Budget 2026',
  active: 1,
  feuilles: [
    { nom: 'Janvier', lignes: 100, colonnes: 26, cellules: { A1: { brut: 'Loyer', gras: true }, B1: { brut: '650' } } },
    { nom: 'Février', lignes: 100, colonnes: 26, cellules: { A1: { brut: 'Total' }, B1: { brut: '=Janvier!B1*2' } } },
  ],
};

/** Range des données sous l'ancien nom, depuis une page du même site (sans l'application). */
async function preparerAncienStockage(page) {
  await page.goto(`${serveur.url}licences/jstat-MIT.txt`);
  await page.evaluate(async (classeur) => {
    localStorage.setItem('tableur.preferences', JSON.stringify({ theme: 'clair', barreOutils: { groupe: 'donnees', repliee: false } }));
    // Copie de secours (rangée dans localStorage quand IndexedDB est indisponible).
    localStorage.setItem('tableur.classeur.principal', JSON.stringify({ donnees: classeur, modifieLe: '2026-10-19T08:00:00.000Z' }));
    await new Promise((resoudre, rejeter) => {
      const demande = indexedDB.open('tableur', 1);
      demande.onupgradeneeded = () => demande.result.createObjectStore('classeurs');
      demande.onsuccess = () => {
        const base = demande.result;
        const echange = base.transaction('classeurs', 'readwrite');
        echange.objectStore('classeurs').put({ donnees: classeur, modifieLe: '2026-10-20T10:00:00.000Z' }, 'principal');
        echange.oncomplete = () => {
          base.close();
          resoudre();
        };
        echange.onerror = () => rejeter(echange.error);
      };
      demande.onerror = () => rejeter(demande.error);
    });
    // Copie hors ligne de l'ancienne version.
    await (await caches.open('tableur-2.0.0')).put('ancien.txt', new Response('ancien'));
  }, ANCIEN_CLASSEUR);
}

test('les données de l’ancienne version sont copiées sous le nouveau nom, puis l’ancien exemplaire est effacé', async () => {
  const contexte = await navigateur.newContext({ locale: 'fr-FR' });
  const page = await contexte.newPage();
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await preparerAncienStockage(page);

  await page.goto(serveur.url);
  await page.waitForFunction(() => window.omniTableur !== undefined);

  // Classeur, feuille affichée et thème retrouvés dès le premier affichage.
  assert.equal(await page.inputValue('#titre'), 'Budget 2026');
  assert.equal(await page.evaluate(() => window.omniTableur.feuille.nom), 'Février');
  assert.equal(await texteCellule(page, 'B1'), '1300');
  assert.equal(await page.getAttribute('html', 'data-theme'), 'clair');
  assert.equal(await page.evaluate(() => document.getElementById('groupe-donnees').hidden), false);

  // Nouveau rangement en place, ancien effacé (après la copie).
  await page.waitForFunction(async () => !(await indexedDB.databases()).some((b) => b.name === 'tableur'));
  const etat = await page.evaluate(async () => ({
    bases: (await indexedDB.databases()).map((b) => b.name),
    anciennesPreferences: localStorage.getItem('tableur.preferences'),
    nouvellesPreferences: JSON.parse(localStorage.getItem('omni-tableur.preferences')),
    ancienSecours: localStorage.getItem('tableur.classeur.principal'),
    nouveauSecours: JSON.parse(localStorage.getItem('omni-tableur.classeur.principal')),
  }));
  assert.ok(etat.bases.includes('omni-tableur'));
  assert.equal(etat.anciennesPreferences, null);
  assert.equal(etat.nouvellesPreferences.theme, 'clair');
  assert.equal(etat.ancienSecours, null);
  assert.equal(etat.nouveauSecours.donnees.titre, 'Budget 2026');

  // Le service worker de la nouvelle version supprime l'ancienne copie hors ligne.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(async () => {
    const noms = await caches.keys();
    return !noms.includes('tableur-2.0.0') && noms.some((nom) => nom.startsWith('omni-tableur-'));
  });

  // Après rechargement, tout vient du nouveau rangement.
  await page.reload();
  await page.waitForFunction(() => window.omniTableur !== undefined);
  assert.equal(await page.inputValue('#titre'), 'Budget 2026');
  await page.evaluate(() => window.omniTableur.classeur.activer(window.omniTableur.classeur.feuilles[0]));
  assert.equal(await texteCellule(page, 'A1'), 'Loyer');
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test('sans ancienne version, aucune base « tableur » n’est créée', async () => {
  const contexte = await navigateur.newContext({ locale: 'fr-FR' });
  const page = await contexte.newPage();
  await page.goto(serveur.url);
  await page.waitForFunction(() => window.omniTableur !== undefined);
  await page.keyboard.type('Bonjour');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.getElementById('etat-sauvegarde').textContent === '✓ Enregistré');
  const bases = await page.evaluate(async () => (await indexedDB.databases()).map((b) => b.name));
  assert.deepEqual(bases, ['omni-tableur']);
  assert.equal(await page.evaluate(() => Object.keys(localStorage).some((cle) => cle.startsWith('tableur'))), false);
  await contexte.close();
});

test('un vieil onglet qui garde l’ancienne base ouverte ne bloque pas le démarrage', async () => {
  const contexte = await navigateur.newContext({ locale: 'fr-FR' });
  const vieux = await contexte.newPage();
  await preparerAncienStockage(vieux);
  // Le « vieil onglet » garde la base ouverte (comme l'ancienne version).
  await vieux.evaluate(
    () =>
      new Promise((resoudre) => {
        const demande = indexedDB.open('tableur', 1);
        demande.onsuccess = () => {
          window.baseGardee = demande.result;
          resoudre();
        };
      }),
  );
  const page = await contexte.newPage();
  await page.goto(serveur.url);
  await page.waitForFunction(() => window.omniTableur !== undefined);
  assert.equal(await page.inputValue('#titre'), 'Budget 2026');
  // Deuxième ouverture pendant que l'effacement de l'ancienne base attend :
  // l'application démarre quand même (au plus 2 secondes d'attente).
  const debut = Date.now();
  await page.reload();
  await page.waitForFunction(() => window.omniTableur !== undefined);
  assert.ok(Date.now() - debut < 6000);
  assert.equal(await page.inputValue('#titre'), 'Budget 2026');
  // Le vieil onglet se ferme : l'ancienne base disparaît.
  await vieux.close();
  await page.waitForFunction(async () => !(await indexedDB.databases()).some((b) => b.name === 'tableur'));
  await contexte.close();
});
