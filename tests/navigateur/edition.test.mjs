// Étape 2 : édition — boutons copier/coller, poignée de recopie, Ctrl+D,
// insertion et suppression de lignes et de colonnes, effacer.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { celluleActive, cliquerOutil, demarrerServeur, lancerNavigateur, ouvrirApplication, texteCellule } from './outils.mjs';

const td = (ligne, colonne) => `td[data-ligne="${ligne}"][data-colonne="${colonne}"]`;
const brut = (page, adr) => page.evaluate((a) => window.omniTableur.feuille.brut(a), adr);

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

/** Tape des valeurs dans une colonne, à partir de la cellule active (Entrée entre chaque). */
async function taperColonne(page, valeurs) {
  for (const valeur of valeurs) {
    await page.keyboard.type(valeur);
    await page.keyboard.press('Enter');
  }
}

test('poignée de recopie à la souris : suite de nombres et formules', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await taperColonne(page, ['1', '2']);
  await page.click(td(1, 2));
  await taperColonne(page, ['=A1*10']);
  // Sélection A1:B2, puis on tire le petit carré jusqu'à la ligne 5.
  await page.click(td(1, 1));
  await page.click(td(2, 2), { modifiers: ['Shift'] });
  const poignee = await page.locator('.poignee-recopie').boundingBox();
  const cible = await page.locator(td(5, 2)).boundingBox();
  await page.mouse.move(poignee.x + poignee.width / 2, poignee.y + poignee.height / 2);
  await page.mouse.down();
  await page.mouse.move(cible.x + 20, cible.y + 10, { steps: 6 });
  assert.equal(await page.isVisible('.cadre-recopie'), true, 'contour pointillé pendant le geste');
  await page.mouse.up();
  assert.equal(await page.isVisible('.cadre-recopie'), false);
  assert.deepEqual(
    [await texteCellule(page, 'A3'), await texteCellule(page, 'A5'), await texteCellule(page, 'B5')],
    ['3', '5', '50'],
  );
  // Colonne B : le motif « formule, case vide » est répété.
  assert.equal(await brut(page, 'B3'), '=A3*10');
  assert.equal(await brut(page, 'B4'), '');
  assert.equal(await page.inputValue('#nom-cellule'), 'A1:B5');
  // Une seule annulation défait toute la recopie.
  await page.keyboard.press('Control+z');
  assert.equal(await brut(page, 'A3'), '');
  assert.equal(await brut(page, 'B2'), '');
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('Ctrl+D et bouton « Recopier en bas » : formules adaptées', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await taperColonne(page, ['10', '20', '30']);
  await page.click(td(1, 2));
  await page.keyboard.type('=A1+1');
  await page.keyboard.press('Enter');
  // Ctrl+D sur B1:B3 : B1 est recopiée en B2 et B3.
  await page.click(td(1, 2));
  await page.click(td(3, 2), { modifiers: ['Shift'] });
  await page.keyboard.press('Control+d');
  assert.equal(await brut(page, 'B3'), '=A3+1');
  assert.equal(await texteCellule(page, 'B3'), '31');
  // Bouton : une seule cellule sélectionnée → la cellule du dessus y est recopiée.
  await page.click(td(4, 2));
  await cliquerOutil(page, '#bouton-recopier-bas');
  assert.equal(await brut(page, 'B4'), '=A4+1');
  // Ctrl+R vers la droite.
  await page.click(td(1, 2));
  await page.click(td(1, 4), { modifiers: ['Shift'] });
  await page.keyboard.press('Control+r');
  assert.equal(await brut(page, 'D1'), '=C1+1');
  assert.ok(page.url().includes('/omni-tableur/'), 'Ctrl+R ne recharge pas la page');
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('boutons Copier, Couper, Coller et Effacer', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url, { permissions: ['clipboard-read', 'clipboard-write'] });
  await taperColonne(page, ['5', '=A1*2']);
  await page.click(td(1, 1));
  await page.click(td(2, 1), { modifiers: ['Shift'] });
  await cliquerOutil(page, '#bouton-copier');
  // (Le message arrive juste après l'écriture dans le presse-papiers.)
  await page.waitForFunction(() => /2 cellules copiées/.test(document.getElementById('message').textContent));
  await page.click(td(1, 3));
  await cliquerOutil(page, '#bouton-coller');
  await page.waitForFunction(() => window.omniTableur.feuille.brut('C2') !== '');
  assert.equal(await brut(page, 'C2'), '=C1*2');
  assert.equal(await texteCellule(page, 'C2'), '10');
  // Couper puis coller ailleurs : la formule garde ses références.
  await page.click(td(2, 3));
  await cliquerOutil(page, '#bouton-couper');
  assert.equal(await brut(page, 'C2'), '');
  await page.click(td(5, 5));
  await cliquerOutil(page, '#bouton-coller');
  await page.waitForFunction(() => window.omniTableur.feuille.brut('E5') !== '');
  assert.equal(await brut(page, 'E5'), '=C1*2');
  // Effacer (comme la touche Suppr).
  await cliquerOutil(page, '#bouton-effacer');
  assert.equal(await brut(page, 'E5'), '');
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('insérer et supprimer des lignes et des colonnes', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await taperColonne(page, ['1', '2', '3', '=SOMME(A1:A3)']);
  assert.equal(await texteCellule(page, 'A4'), '6');
  // Deux lignes sélectionnées (2 et 3) → « 2 lignes au-dessus ».
  await page.click(td(2, 1));
  await page.click(td(3, 1), { modifiers: ['Shift'] });
  await cliquerOutil(page, '#bouton-inserer');
  assert.equal(await page.textContent('#inserer-lignes-dessus'), '2 lignes au-dessus');
  await page.click('#inserer-lignes-dessus');
  assert.equal(await brut(page, 'A6'), '=SOMME(A1:A5)');
  assert.equal(await texteCellule(page, 'A4'), '2');
  assert.equal(await page.inputValue('#nom-cellule'), 'A2:A3');
  await page.keyboard.type('100');
  await page.keyboard.press('Enter');
  assert.equal(await texteCellule(page, 'A6'), '106');
  // Supprimer la colonne A : la formule de B1 devient #REF!.
  await page.click(td(1, 2));
  await page.keyboard.type('=A1*2');
  await page.keyboard.press('Enter');
  await page.click(td(1, 1));
  await cliquerOutil(page, '#bouton-supprimer');
  assert.equal(await page.textContent('#supprimer-colonnes'), 'Supprimer la colonne A');
  await page.click('#supprimer-colonnes');
  assert.equal(await texteCellule(page, 'A1'), '#REF!');
  assert.match(await page.textContent('#message'), /Colonne supprimée/);
  // Annuler la remet.
  await page.click('#bouton-annuler');
  assert.equal(await texteCellule(page, 'B1'), '2');
  assert.equal(await celluleActive(page), 'A1');
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('au doigt : la barre d’outils en onglets et la recopie par bouton', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url, {
    viewport: { width: 390, height: 760 },
    hasTouch: true,
    isMobile: true,
  });
  // Les onglets montrent un groupe à la fois ; toucher l'onglet ouvert replie la barre.
  assert.equal(await page.isVisible('#bouton-copier'), true);
  assert.equal(await page.isVisible('#bouton-gras'), false);
  await page.tap('#onglet-mise-en-forme');
  assert.equal(await page.isVisible('#bouton-gras'), true);
  await page.tap('#onglet-mise-en-forme');
  assert.equal(await page.isVisible('#bouton-gras'), false);
  await page.tap('#onglet-edition');
  // Recopie : 7 en A1, sélection A1:A3 avec la poignée ronde, puis « Recopier en bas ».
  // A1 est déjà la cellule active : un appui ouvre la saisie.
  await page.tap(td(1, 1));
  await page.keyboard.type('=B1+7');
  await page.keyboard.press('Enter');
  await page.evaluate(() => window.omniTableur.selection.choisirPlage({ debut: { ligne: 1, colonne: 1 }, fin: { ligne: 3, colonne: 1 } }));
  await page.tap('#bouton-recopier-bas');
  assert.equal(await brut(page, 'A3'), '=B3+7');
  // La page ne déborde pas de l'écran.
  assert.ok((await page.evaluate(() => document.documentElement.scrollWidth)) <= 390);
  await contexte.close();
});
