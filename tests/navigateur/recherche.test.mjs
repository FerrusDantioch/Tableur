// Ajout 2c : barre « Rechercher et remplacer ».

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { demarrerServeur, lancerNavigateur, ouvrirApplication, texteCellule, celluleActive, cliquerOutil } from './outils.mjs';

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

const compte = (page) => page.textContent('#recherche-compte');
const feuille = (page) => page.evaluate(() => window.omniTableur.feuille.nom);

async function remplir(page) {
  await page.evaluate(() => {
    const { classeur, feuille } = window.omniTableur;
    const ecrire = (f, contenus) => classeur.modifierCellules(f, Object.entries(contenus).map(([adresse, brut]) => ({ adresse, brut })));
    ecrire(feuille, { A1: 'Total', B1: 'total des ventes', A2: 'Pomme', B2: '12', C5: 'TOTAL', B6: '=B2*2' });
    const autre = classeur.ajouterFeuille({ nom: 'Stock' });
    ecrire(autre, { A3: 'Sous-total' });
    classeur.activer(feuille);
  });
}

test('rechercher : nombre de résultats, « Suivant », respecter la casse, toutes les feuilles', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await remplir(page);
  await page.keyboard.press('Control+f');
  assert.equal(await page.isVisible('#barre-recherche'), true);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'recherche-texte');
  await page.keyboard.type('total');
  assert.equal(await compte(page), '1 sur 3'); // A1, sélectionnée, contient « Total »
  await page.evaluate(() => window.omniTableur.selection.choisir(10, 10));
  assert.equal(await compte(page), '3 résultats');
  await page.evaluate(() => window.omniTableur.selection.choisir(1, 1));

  // Entrée (ou « Suivant ») : A1, B1, C5, puis retour à A1.
  await page.focus('#recherche-texte');
  await page.keyboard.press('Enter');
  assert.equal(await celluleActive(page), 'B1'); // A1 était déjà sélectionnée
  assert.equal(await compte(page), '2 sur 3');
  await page.click('#recherche-suivant');
  assert.equal(await celluleActive(page), 'C5');
  await page.keyboard.press('Enter'); // le curseur est resté dans le champ
  assert.equal(await celluleActive(page), 'A1');
  assert.equal(await compte(page), '1 sur 3');

  // Respecter la casse : seule « total des ventes » (B1) est écrite ainsi.
  await page.check('#recherche-casse');
  assert.equal(await compte(page), '1 résultat');
  await page.fill('#recherche-texte', 'TOTAL DES');
  assert.equal(await compte(page), 'Aucun résultat');
  assert.equal(await page.isDisabled('#recherche-suivant'), true);
  await page.uncheck('#recherche-casse');
  assert.equal(await compte(page), '1 résultat');
  await page.fill('#recherche-texte', 'total');

  // Toutes les feuilles : « Suivant » passe à la feuille Stock.
  await page.check('#recherche-toutes-feuilles');
  assert.equal(await compte(page), '1 sur 4');
  await page.click(`#recherche-suivant`);
  await page.click(`#recherche-suivant`);
  await page.click(`#recherche-suivant`);
  assert.equal(await feuille(page), 'Stock');
  assert.equal(await celluleActive(page), 'A3');
  assert.equal(await compte(page), '4 sur 4');

  // Échap ferme la barre ; le clavier revient à la grille.
  await page.focus('#recherche-texte');
  await page.keyboard.press('Escape');
  assert.equal(await page.isVisible('#barre-recherche'), false);
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('remplacer une à une, puis tout remplacer en une seule étape d’annulation', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await remplir(page);
  await cliquerOutil(page, '#bouton-rechercher');
  await page.fill('#recherche-texte', 'total');
  await page.fill('#recherche-remplacement', 'Somme');

  // A1 est sélectionnée et contient « Total » : remplacée, puis B1 est sélectionnée.
  await page.click('#recherche-remplacer');
  assert.equal(await texteCellule(page, 'A1'), 'Somme');
  assert.equal(await celluleActive(page), 'B1');
  assert.match(await page.textContent('#message'), /1 remplacement dans A1/);
  assert.equal(await compte(page), '1 sur 2');

  // Tout remplacer (feuille affichée seulement).
  await page.click('#recherche-tout-remplacer');
  assert.equal(await texteCellule(page, 'B1'), 'Somme des ventes');
  assert.equal(await texteCellule(page, 'C5'), 'Somme');
  assert.match(await page.textContent('#message'), /2 remplacements dans 2 cellules/);
  assert.equal(await compte(page), 'Aucun résultat');
  assert.equal(await page.evaluate(() => window.omniTableur.classeur.feuilleNommee('Stock').brut('A3')), 'Sous-total');

  // Un seul « Annuler » défait « Tout remplacer » ; un second, le premier remplacement.
  await page.click('#bouton-annuler');
  assert.equal(await texteCellule(page, 'B1'), 'total des ventes');
  assert.equal(await texteCellule(page, 'C5'), 'TOTAL');
  assert.equal(await texteCellule(page, 'A1'), 'Somme');
  await page.click('#bouton-annuler');
  assert.equal(await texteCellule(page, 'A1'), 'Total');

  // Dans toutes les feuilles : encore une seule étape.
  await page.check('#recherche-toutes-feuilles');
  await page.click('#recherche-tout-remplacer');
  assert.equal(await page.evaluate(() => window.omniTableur.classeur.feuilleNommee('Stock').brut('A3')), 'Sous-Somme');
  await page.click('#bouton-annuler');
  assert.equal(await page.evaluate(() => window.omniTableur.classeur.feuilleNommee('Stock').brut('A3')), 'Sous-total');
  assert.equal(await texteCellule(page, 'A1'), 'Total');
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('le nombre de résultats suit les modifications ; le texte des formules est cherché', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await remplir(page);
  await page.keyboard.press('Control+f');
  await page.keyboard.type('B2');
  assert.equal(await compte(page), '1 résultat'); // dans =B2*2
  await page.keyboard.press('Enter');
  assert.equal(await celluleActive(page), 'B6');
  await page.evaluate(() => window.omniTableur.classeur.modifierCellules(window.omniTableur.feuille, [{ adresse: 'D9', brut: '=B2+1' }]));
  assert.equal(await compte(page), '1 sur 2');
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('au doigt, sur un téléphone : la barre tient dans l’écran', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url, {
    viewport: { width: 360, height: 740 },
    hasTouch: true,
    isMobile: true,
  });
  await remplir(page);
  await cliquerOutil(page, '#bouton-rechercher', { doigt: true });
  await page.fill('#recherche-texte', 'pomme');
  await page.tap('#recherche-suivant');
  assert.equal(await celluleActive(page), 'A2');
  await page.fill('#recherche-remplacement', 'Poire');
  await page.tap('#recherche-remplacer');
  assert.equal(await texteCellule(page, 'A2'), 'Poire');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 360);
  const barre = await page.evaluate(() => document.getElementById('barre-recherche').getBoundingClientRect().toJSON());
  assert.ok(barre.right <= 360, `barre dans l'écran (${barre.right})`);
  // La grille reste visible sous la barre.
  const grille = await page.evaluate(() => document.getElementById('zone-grille').getBoundingClientRect().toJSON());
  assert.ok(grille.height > 250, `grille assez haute (${grille.height})`);
  // Sur téléphone, la barre d'outils est repliée pendant la recherche, puis rouverte.
  assert.equal(await page.isVisible('#groupe-edition'), false);
  await page.tap('#recherche-fermer');
  assert.equal(await page.isVisible('#barre-recherche'), false);
  assert.equal(await page.isVisible('#groupe-edition'), true);
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});
