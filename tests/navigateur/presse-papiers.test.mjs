// Bonus : copier, couper, coller.

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

const brut = (page, adr) => page.evaluate((a) => window.tableur.feuille.brut(a), adr);
const aller = async (page, adr) => {
  await page.fill('#nom-cellule', adr);
  await page.press('#nom-cellule', 'Enter');
};
const options = { permissions: ['clipboard-read', 'clipboard-write'] };

test('copier-coller une formule : les références s’adaptent', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url, options);
  await page.evaluate(() => {
    const { classeur, feuille } = window.tableur;
    classeur.modifierCellules(feuille, [
      { adresse: 'A1', brut: '2' }, { adresse: 'A2', brut: '3' }, { adresse: 'A3', brut: '4' },
      { adresse: 'B1', brut: '=A1*10', gras: true, fond: 'vert' },
    ]);
  });
  await aller(page, 'B1');
  await page.keyboard.press('Control+c');
  // Une cellule copiée, collée sur B2:B3 : la formule est recopiée vers le bas.
  await aller(page, 'B2:B3');
  await page.keyboard.press('Control+v');
  assert.equal(await brut(page, 'B2'), '=A2*10');
  assert.equal(await brut(page, 'B3'), '=A3*10');
  assert.equal(await texteCellule(page, 'B3'), '40');
  assert.equal(await page.getAttribute('td[data-ligne="3"][data-colonne="2"]', 'data-fond'), 'vert');
  // Le presse-papiers du système contient le texte affiché.
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), '20');
  // Un seul Ctrl+Z annule tout le collage.
  await page.keyboard.press('Control+z');
  assert.equal(await brut(page, 'B2'), '');
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('couper-coller déplace sans changer les références', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url, options);
  await page.evaluate(() => {
    const { classeur, feuille } = window.tableur;
    classeur.modifierCellules(feuille, [{ adresse: 'A1', brut: '5' }, { adresse: 'B1', brut: '=A1+1' }]);
  });
  await aller(page, 'B1');
  await page.keyboard.press('Control+x');
  assert.equal(await brut(page, 'B1'), '');
  await aller(page, 'D4');
  await page.keyboard.press('Control+v');
  assert.equal(await brut(page, 'D4'), '=A1+1');
  assert.equal(await texteCellule(page, 'D4'), '6');
  await contexte.close();
});

test('coller un tableau venu d’ailleurs (texte tabulé)', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url, options);
  await page.evaluate(() => navigator.clipboard.writeText('Nom\tÂge\r\nAlice\t30\r\n"Bob ""B"""\t25,5\r\n'));
  await aller(page, 'B2');
  await page.keyboard.press('Control+v');
  assert.equal(await texteCellule(page, 'B2'), 'Nom');
  assert.equal(await texteCellule(page, 'C3'), '30');
  assert.equal(await texteCellule(page, 'B4'), 'Bob "B"');
  assert.equal(await texteCellule(page, 'C4'), '25,5');
  assert.equal(await page.inputValue('#nom-cellule'), 'B2:C4');
  // Pendant une saisie, Ctrl+V colle dans le texte de la cellule (comportement normal).
  await aller(page, 'E1');
  await page.keyboard.type('x');
  await page.evaluate(() => navigator.clipboard.writeText('yz'));
  await page.keyboard.press('Control+v');
  await page.keyboard.press('Enter');
  assert.equal(await texteCellule(page, 'E1'), 'xyz');
  await contexte.close();
});
