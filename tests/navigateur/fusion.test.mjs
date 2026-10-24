// Ajout 2d : cellules fusionnées, dans un vrai navigateur.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { demarrerServeur, lancerNavigateur, ouvrirApplication, texteCellule, celluleActive, cliquerOutil } from './outils.mjs';

const bloc = '.cellule-fusionnee';
const taille = (page, selecteur) => page.evaluate((s) => document.querySelector(s).getBoundingClientRect().toJSON(), selecteur);
const fusions = (page) => page.evaluate(() => window.omniTableur.feuille.fusions.map((f) => `${f.debut.ligne},${f.debut.colonne}:${f.fin.ligne},${f.fin.colonne}`));
const td = (ligne, colonne) => `td[data-ligne="${ligne}"][data-colonne="${colonne}"]`;

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

async function remplir(page, contenus) {
  await page.evaluate((c) => {
    const { classeur, feuille } = window.omniTableur;
    classeur.modifierCellules(feuille, Object.entries(c).map(([adresse, brut]) => ({ adresse, brut })));
  }, contenus);
}

test('fusionner un titre : confirmation, une seule grande cellule, flèches, saisie, défusionner', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await remplir(page, { A1: 'Budget', B1: 'à effacer', A2: 'Poste', B2: 'Montant' });
  await page.click(td(1, 1));
  await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('Shift+ArrowRight');
  await cliquerOutil(page, '#bouton-fusionner');
  // B1 est remplie : on demande confirmation.
  await page.waitForSelector('#fenetre-fusion[open]');
  assert.match(await page.textContent('#texte-fusion'), /Seul le contenu de la cellule en haut à gauche \(A1\) sera conservé/);
  assert.match(await page.textContent('#texte-fusion'), /B1/);
  await page.click('#fenetre-fusion [data-fermer="fusionner"]');
  await page.waitForSelector(bloc);

  assert.deepEqual(await fusions(page), ['1,1:1,3']);
  assert.equal(await page.textContent(bloc), 'Budget');
  assert.equal(await texteCellule(page, 'B1'), '');
  // Le bloc couvre exactement A1:C1, et le texte est centré.
  const a1 = await taille(page, td(1, 1));
  const c1 = await taille(page, td(1, 3));
  const rect = await taille(page, bloc);
  assert.ok(Math.abs(rect.x - a1.x) <= 1 && Math.abs(rect.right - c1.right) <= 1, 'largeur A1 → C1');
  assert.equal(await page.evaluate((s) => getComputedStyle(document.querySelector(s)).textAlign, bloc), 'center');
  assert.equal(await page.inputValue('#nom-cellule'), 'A1');
  assert.equal(await page.textContent('#bouton-fusionner .libelle'), 'Défusionner');

  // Flèche droite : on saute à D1 ; flèche gauche : on revient sur la cellule fusionnée.
  await page.keyboard.press('ArrowRight');
  assert.equal(await celluleActive(page), 'D1');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await celluleActive(page), 'A1');
  // Un clic n'importe où sur le bloc choisit la cellule fusionnée.
  await page.click(td(3, 3));
  await page.mouse.click(c1.x + 10, c1.y + 10);
  assert.equal(await celluleActive(page), 'A1');
  // Taper remplace son contenu ; le champ de saisie couvre toute la fusion.
  await page.keyboard.type('Budget 2026');
  const editeur = await taille(page, '#editeur-cellule');
  assert.ok(Math.abs(editeur.width - (c1.right - a1.x)) <= 2, 'éditeur aussi large que la fusion');
  await page.keyboard.press('Enter');
  assert.equal(await page.textContent(bloc), 'Budget 2026');
  assert.equal(await celluleActive(page), 'A2');

  // Défusionner, puis Annuler. (Les cases couvertes ne reçoivent plus les clics : le bloc est par-dessus.)
  await page.click(bloc, { position: { x: 120, y: 10 } });
  assert.equal(await celluleActive(page), 'A1');
  await cliquerOutil(page, '#bouton-fusionner');
  assert.equal(await page.$(bloc), null);
  assert.deepEqual(await fusions(page), []);
  assert.equal(await texteCellule(page, 'A1'), 'Budget 2026');
  await page.click('#bouton-annuler');
  assert.deepEqual(await fusions(page), ['1,1:1,3']);
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('« Ne pas fusionner » : rien ne change ; cellules vides : pas de question', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await remplir(page, { A1: 'un', B1: 'deux' });
  await page.evaluate(() => window.omniTableur.selection.choisirPlage({ debut: { ligne: 1, colonne: 1 }, fin: { ligne: 1, colonne: 2 } }));
  await cliquerOutil(page, '#bouton-fusionner');
  await page.click('#fenetre-fusion [data-fermer="garder"]');
  assert.deepEqual(await fusions(page), []);
  assert.equal(await texteCellule(page, 'B1'), 'deux');

  await page.evaluate(() => window.omniTableur.selection.choisirPlage({ debut: { ligne: 4, colonne: 1 }, fin: { ligne: 6, colonne: 1 } }));
  await page.click('#bouton-fusionner');
  assert.equal(await page.isVisible('#fenetre-fusion'), false);
  assert.deepEqual(await fusions(page), ['4,1:6,1']);
  // Une seule cellule sélectionnée (non fusionnée) : bouton inactif.
  await page.click(td(9, 3));
  assert.equal(await page.isDisabled('#bouton-fusionner'), true);
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('au doigt : toucher la cellule fusionnée la choisit, un second appui ouvre la saisie', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url, {
    viewport: { width: 390, height: 760 },
    hasTouch: true,
    isMobile: true,
  });
  await remplir(page, { A1: 'Titre' });
  await page.evaluate(() => window.omniTableur.selection.choisirPlage({ debut: { ligne: 1, colonne: 1 }, fin: { ligne: 1, colonne: 3 } }));
  await cliquerOutil(page, '#bouton-fusionner', { doigt: true });
  await page.waitForSelector(bloc);
  await page.tap(td(5, 1));
  const rect = await taille(page, bloc);
  await page.touchscreen.tap(rect.x + rect.width - 20, rect.y + rect.height / 2);
  assert.equal(await celluleActive(page), 'A1');
  await page.waitForTimeout(400);
  await page.touchscreen.tap(rect.x + rect.width - 20, rect.y + rect.height / 2);
  await page.waitForFunction(() => document.body.classList.contains('en-edition'));
  assert.equal(await page.inputValue('#editeur-cellule'), 'Titre');
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('PDF, première ligne figée, zoom et insertion de colonnes', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await remplir(page, { A1: 'Budget', A2: 'Poste', B2: 'Montant', C2: 'Note', A3: 'Loyer', B3: '650' });
  await page.evaluate(() => {
    const { classeur, feuille } = window.omniTableur;
    classeur.fusionner(feuille, { debut: { ligne: 1, colonne: 1 }, fin: { ligne: 1, colonne: 3 } });
  });
  // PDF : une seule case qui s'étend sur trois colonnes.
  const impression = await page.evaluate(() => {
    window.omniTableur.exportPdf.preparer();
    const lignes = [...document.querySelectorAll('#impression tr')].map((tr) => [...tr.cells].map((td) => `${td.textContent}|${td.colSpan}`));
    window.omniTableur.exportPdf.terminer();
    return lignes;
  });
  assert.deepEqual(impression[0], ['Budget|3']);
  assert.deepEqual(impression[1], ['Poste|1', 'Montant|1', 'Note|1']);

  // Ligne figée : le titre fusionné reste visible en faisant défiler.
  await page.evaluate(() => window.omniTableur.classeur.figerPremiereLigne(window.omniTableur.feuille, true));
  assert.equal(await page.evaluate(() => document.querySelector('.cellule-fusionnee').parentElement.className), 'couche-figee');
  await page.evaluate(() => (document.getElementById('zone-grille').scrollTop = 600));
  await page.waitForTimeout(100);
  const zone = await taille(page, '#zone-grille');
  const titre = await taille(page, bloc);
  assert.ok(titre.y >= zone.y && titre.y < zone.y + 80, `titre toujours en haut (${titre.y})`);
  await page.evaluate(() => (document.getElementById('zone-grille').scrollTop = 0));

  // Zoom : le bloc grandit avec la grille.
  const largeur100 = (await taille(page, bloc)).width;
  await page.evaluate(() => window.omniTableur.zoom.choisir(150));
  assert.ok(Math.abs((await taille(page, bloc)).width - largeur100 * 1.5) <= 3);
  await page.evaluate(() => window.omniTableur.zoom.choisir(100));

  // Insérer une colonne au milieu de la fusion l'agrandit.
  await page.evaluate(() => window.omniTableur.classeur.inserer(window.omniTableur.feuille, 'colonnes', 2, 1));
  assert.deepEqual(await fusions(page), ['1,1:1,4']);
  assert.equal(await texteCellule(page, 'C2'), 'Montant');
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('trier : un titre fusionné au-dessus du tableau est laissé à sa place ; une fusion dans les lignes bloque le tri', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await remplir(page, { A1: 'Mes fruits', A2: 'Fruit', B2: 'Prix', A3: 'Poire', B3: '3', A4: 'Abricot', B4: '5', A5: 'Kiwi', B5: '2' });
  await page.evaluate(() => {
    const { classeur, feuille } = window.omniTableur;
    classeur.fusionner(feuille, { debut: { ligne: 1, colonne: 1 }, fin: { ligne: 1, colonne: 2 } });
  });
  await page.click(td(4, 1));
  await cliquerOutil(page, '#bouton-trier');
  assert.match(await page.textContent('#tri-description'), /Trier les lignes 3 à 5/);
  await page.click('#trier-croissant');
  assert.equal(await texteCellule(page, 'A3'), 'Abricot');
  assert.equal(await page.textContent(bloc), 'Mes fruits');

  // Une fusion dans les lignes à trier : refus expliqué.
  await page.evaluate(() => {
    const { classeur, feuille } = window.omniTableur;
    classeur.fusionner(feuille, { debut: { ligne: 4, colonne: 1 }, fin: { ligne: 4, colonne: 2 } });
  });
  await page.click(td(3, 1));
  await cliquerOutil(page, '#bouton-trier');
  assert.match(await page.textContent('#tri-description'), /Impossible de trier .* cellules fusionnées \(A4:B4\)/);
  assert.equal(await page.isDisabled('#trier-croissant'), true);
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});
