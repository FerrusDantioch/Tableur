// Ajout 2a : sélectionner une ligne ou une colonne entière en touchant (ou
// en cliquant) son en-tête, puis agir sur cette sélection.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { demarrerServeur, lancerNavigateur, ouvrirApplication, texteCellule, cliquerOutil } from './outils.mjs';

const enteteColonne = (c) => `th.entete-colonne[data-colonne="${c}"]`;
const enteteLigne = (l) => `th.entete-ligne[data-ligne="${l}"]`;
const plage = (page) => page.evaluate(() => document.getElementById('nom-cellule').value);
const visible = (page, id) => page.evaluate((i) => document.getElementById(i).checkVisibility(), id);

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

/** Remplit A1:C3 : A = noms, B = nombres, C = formules. */
async function remplir(page) {
  await page.evaluate(() => {
    const { classeur, feuille } = window.omniTableur;
    const contenus = { A1: 'Nom', B1: 'Prix', C1: 'Double', A2: 'Pomme', B2: '2', C2: '=B2*2', A3: 'Poire', B3: '3', C3: '=B3*2' };
    classeur.modifierCellules(feuille, Object.entries(contenus).map(([adresse, brut]) => ({ adresse, brut })));
  });
}

test('à la souris : colonne entière, mise en forme, insertion et suppression de colonnes', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await remplir(page);
  await page.click(enteteColonne(2));
  assert.equal(await plage(page), 'B1:B100');
  assert.match(await page.getAttribute(enteteColonne(2), 'class'), /surligne/);

  // Gras sur toute la colonne (jusqu'à la dernière ligne).
  await cliquerOutil(page, '#bouton-gras');
  const gras = await page.evaluate(() => ['B1', 'B3', 'B100'].map((a) => window.omniTableur.feuille.cellule(a)?.gras));
  assert.deepEqual(gras, [true, true, true]);

  // « Insérer » ne propose que des colonnes (pas « 100 lignes au-dessus »).
  await cliquerOutil(page, '#bouton-inserer');
  assert.equal(await visible(page, 'inserer-lignes-dessus'), false);
  assert.equal(await visible(page, 'inserer-lignes-dessous'), false);
  assert.equal(await visible(page, 'inserer-colonnes-gauche'), true);
  await page.click('#inserer-colonnes-gauche');
  assert.equal(await texteCellule(page, 'C1'), 'Prix');
  assert.equal(await texteCellule(page, 'D2'), '4'); // =C2*2, la formule a suivi
  assert.equal(await plage(page), 'B1:B100'); // la nouvelle colonne est sélectionnée

  // « Supprimer » ne propose que la colonne.
  await cliquerOutil(page, '#bouton-supprimer');
  assert.equal(await visible(page, 'supprimer-lignes'), false);
  assert.equal(await page.textContent('#supprimer-colonnes'), 'Supprimer la colonne B');
  await page.click('#supprimer-colonnes');
  assert.equal(await texteCellule(page, 'B1'), 'Prix');
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('à la souris : ligne entière, plusieurs lignes, suppression et effacement', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await remplir(page);
  await page.click(enteteLigne(2));
  assert.equal(await plage(page), 'A2:Z2');
  await page.click(enteteLigne(3), { modifiers: ['Shift'] });
  assert.equal(await plage(page), 'A2:Z3');
  await cliquerOutil(page, '#bouton-supprimer');
  assert.equal(await visible(page, 'supprimer-colonnes'), false);
  assert.equal(await page.textContent('#supprimer-lignes'), 'Supprimer les lignes 2 à 3');
  await page.evaluate(() => document.getElementById('panneau-supprimer').hidePopover());

  // Couleur de fond sur les deux lignes entières, puis Suppr vide leur contenu.
  await cliquerOutil(page, '#bouton-fond');
  await page.click('#panneau-fond .pastille[data-fond="bleu"]');
  assert.deepEqual(
    await page.evaluate(() => ['A2', 'Z3'].map((a) => window.omniTableur.feuille.cellule(a)?.fond)),
    ['bleu', 'bleu'],
  );
  await page.click(enteteLigne(2));
  await page.keyboard.press('Delete');
  assert.equal(await texteCellule(page, 'A2'), '');
  assert.equal(await texteCellule(page, 'A3'), 'Poire');
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('copier une colonne entière et la coller sur une autre', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url, { permissions: ['clipboard-read', 'clipboard-write'] });
  await remplir(page);
  await page.click(enteteColonne(1));
  await cliquerOutil(page, '#bouton-copier');
  await page.click(enteteColonne(5));
  await cliquerOutil(page, '#bouton-coller');
  await page.waitForFunction(() => window.omniTableur.feuille.brut('E3') === 'Poire');
  assert.equal(await texteCellule(page, 'E1'), 'Nom');
  assert.equal(await texteCellule(page, 'E2'), 'Pomme');
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('au doigt (téléphone) : toucher un en-tête sélectionne la colonne ou la ligne', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url, {
    viewport: { width: 390, height: 760 },
    hasTouch: true,
    isMobile: true,
  });
  await remplir(page);
  await page.tap(enteteColonne(3));
  assert.equal(await plage(page), 'C1:C100');
  await cliquerOutil(page, '#bouton-italique', { doigt: true });
  assert.equal(await page.evaluate(() => window.omniTableur.feuille.cellule('C50')?.italique), true);
  await page.tap(enteteLigne(1));
  assert.equal(await plage(page), 'A1:Z1');
  await cliquerOutil(page, '#bouton-inserer', { doigt: true });
  assert.equal(await visible(page, 'inserer-colonnes-gauche'), false);
  await page.tap('#inserer-lignes-dessus');
  assert.equal(await texteCellule(page, 'A2'), 'Nom');
  assert.equal(await texteCellule(page, 'C3'), '4'); // =B3*2 : la formule a suivi
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('le bouton « Installer » du menu reste caché quand l’installation est impossible', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await page.click('#bouton-menu');
  assert.equal(await visible(page, 'menu-installer'), false);
  await contexte.close();
});
