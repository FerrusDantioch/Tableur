// Étape 2 : les formules dans l'application (saisie, recalcul, erreurs à l'écran).

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { demarrerServeur, lancerNavigateur, ouvrirApplication, texteCellule } from './outils.mjs';

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

/** Tape une série de contenus dans la colonne active, avec Entrée après chacun. */
async function taperColonne(page, contenus) {
  for (const contenu of contenus) {
    await page.keyboard.type(contenu);
    await page.keyboard.press('Enter');
  }
}

test('formules tapées au clavier et recalcul automatique', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await taperColonne(page, ['10', '20', '30', '=SOMME(A1:A3)', '=MOYENNE(A1:A3)', '=MIN(A1:A3)', '=MAX(A1:A3)', '=NB(A1:A6)', '=SI(A4>50;"beaucoup";"peu")']);
  assert.equal(await texteCellule(page, 'A4'), '60');
  assert.equal(await texteCellule(page, 'A5'), '20');
  assert.equal(await texteCellule(page, 'A6'), '10');
  assert.equal(await texteCellule(page, 'A7'), '30');
  assert.equal(await texteCellule(page, 'A8'), '6');
  assert.equal(await texteCellule(page, 'A9'), 'beaucoup');

  // La barre de formule montre la formule, la cellule montre le résultat.
  await page.keyboard.press('ArrowUp');
  assert.equal(await page.inputValue('#champ-formule'), '=SI(A4>50;"beaucoup";"peu")');

  // Changer A1 : tout est recalculé.
  await page.keyboard.press('Control+Home');
  await page.keyboard.type('1,5');
  await page.keyboard.press('Enter');
  assert.equal(await texteCellule(page, 'A4'), '51,5');
  assert.equal(await texteCellule(page, 'A6'), '1,5');
  assert.equal(await texteCellule(page, 'A9'), 'beaucoup');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Delete');
  assert.equal(await texteCellule(page, 'A4'), '50');
  assert.equal(await texteCellule(page, 'A9'), 'peu');

  // Annuler remet l'ancienne valeur et recalcule.
  await page.keyboard.press('Control+z');
  assert.equal(await texteCellule(page, 'A4'), '51,5');
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('erreurs visibles et expliquées', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await taperColonne(page, ['=1/0', '=A1+1', '=Z5000', '=TOTO(2)', '=SOMME(A1', '=A6', '=A6']);
  assert.equal(await texteCellule(page, 'A1'), '#DIV/0!');
  assert.equal(await texteCellule(page, 'A2'), '#DIV/0!');
  assert.equal(await texteCellule(page, 'A3'), '#REF!');
  assert.equal(await texteCellule(page, 'A4'), '#NOM?');
  assert.equal(await texteCellule(page, 'A5'), '#ERREUR!');
  assert.equal(await texteCellule(page, 'A6'), '#CIRC!');
  // Style « erreur » et infobulle.
  assert.equal(await page.getAttribute('td[data-ligne="1"][data-colonne="1"]', 'class'), 'erreur');
  assert.match(await page.getAttribute('td[data-ligne="1"][data-colonne="1"]', 'title'), /Division par zéro/);

  // L'explication s'affiche en bas quand on sélectionne la cellule.
  await page.keyboard.press('Control+Home');
  assert.match(await page.textContent('#message'), /#DIV\/0! — Division par zéro/);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  assert.match(await page.textContent('#message'), /Référence invalide/);
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.textContent('#message'), '');
  await contexte.close();
});

test('somme et moyenne de la sélection dans la barre d’état', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await taperColonne(page, ['4', '6', 'texte', '=A1*2']);
  await page.keyboard.press('Control+Home');
  await page.keyboard.press('Shift+ArrowDown');
  await page.keyboard.press('Shift+ArrowDown');
  await page.keyboard.press('Shift+ArrowDown');
  assert.equal(await page.textContent('#statistiques'), 'Somme : 18 · Moyenne : 6 · Nombres : 3');
  await contexte.close();
});

test('fonctions françaises : NB.SI, SOMME.SI, RECHERCHEV, texte et date', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  // Colonne A : fruits ; colonne B : prix.
  await taperColonne(page, ['Pomme', 'Poire', 'Banane']);
  await page.click('td[data-ligne="1"][data-colonne="2"]');
  await taperColonne(page, ['2,5', '3', '1,8']);
  await page.click('td[data-ligne="1"][data-colonne="3"]');
  await taperColonne(page, [
    '=NB.SI(B1:B3;">2")',
    '=SOMME.SI(A1:A3;"P*";B1:B3)',
    '=RECHERCHEV("poire";A1:B3;2;FAUX)',
    '=MAJUSCULE(A1)&" à "&B1&" €"',
    '=RECHERCHEV("Kiwi";A1:B3;2;FAUX)',
    '=AUJOURDHUI()',
  ]);
  assert.equal(await texteCellule(page, 'C1'), '2');
  assert.equal(await texteCellule(page, 'C2'), '5,5');
  assert.equal(await texteCellule(page, 'C3'), '3');
  assert.equal(await texteCellule(page, 'C4'), 'POMME à 2,5 €');
  assert.equal(await texteCellule(page, 'C5'), '#N/A');
  assert.match(await texteCellule(page, 'C6'), /^\d\d\/\d\d\/\d{4}$/);
  // L'erreur #N/A est expliquée en bas de l'écran.
  await page.click('td[data-ligne="5"][data-colonne="3"]');
  assert.match(await page.textContent('#message'), /RECHERCHEV n’a pas trouvé/);
  // Changer un prix met à jour toutes les formules qui l'utilisent.
  await page.click('td[data-ligne="2"][data-colonne="2"]');
  await page.keyboard.type('4');
  await page.keyboard.press('Enter');
  assert.equal(await texteCellule(page, 'C2'), '6,5');
  assert.equal(await texteCellule(page, 'C3'), '4');
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});
