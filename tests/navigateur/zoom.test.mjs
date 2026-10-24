// Ajout 2b : zoom de la grille (50 % à 200 %, par pas de 10 %).

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { demarrerServeur, lancerNavigateur, ouvrirApplication, texteCellule, celluleActive } from './outils.mjs';

const td = (ligne, colonne) => `td[data-ligne="${ligne}"][data-colonne="${colonne}"]`;
const taille = (page, selecteur) => page.evaluate((s) => document.querySelector(s).getBoundingClientRect().toJSON(), selecteur);
const pourcent = (page) => page.evaluate(() => window.omniTableur.zoom.pourcent);

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

async function remplir(page) {
  await page.evaluate(() => {
    const { classeur, feuille } = window.omniTableur;
    const contenus = { A1: 'Article', B1: 'Prix', A2: 'Pommes', B2: '2,5', A3: 'Poires', B3: '3', B4: '=SOMME(B2:B3)' };
    classeur.modifierCellules(feuille, Object.entries(contenus).map(([adresse, brut]) => ({ adresse, brut })));
    classeur.modifierCellules(feuille, [{ adresse: 'A1', gras: true, bordures: { bas: { style: 'epais', couleur: 'bleu' } } }]);
    classeur.modifierLargeurs(feuille, [1], 150);
  });
}

test('boutons − et + : de 50 % à 200 %, par pas de 10 %, mémorisé', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await remplir(page);
  assert.equal(await page.textContent('#zoom-valeur'), '100 %');
  const avant = { cellule: await taille(page, td(2, 1)), police: await page.evaluate(() => getComputedStyle(document.querySelector('table.grille')).fontSize) };

  await page.click('#zoom-plus');
  assert.equal(await page.textContent('#zoom-valeur'), '110 %');
  for (let i = 0; i < 4; i++) await page.click('#zoom-plus');
  assert.equal(await page.textContent('#zoom-valeur'), '150 %');
  const apres = await taille(page, td(2, 1));
  assert.equal(Math.round(apres.width), 225); // 150 px × 1,5
  assert.equal(Math.round(apres.height), Math.round(avant.cellule.height * 1.5));
  const police = await page.evaluate(() => getComputedStyle(document.querySelector('table.grille')).fontSize);
  assert.equal(Math.round(parseFloat(police) * 10), Math.round(parseFloat(avant.police) * 1.5 * 10));

  // Jusqu'à 200 % au plus : « + » devient inactif.
  for (let i = 0; i < 5; i++) await page.click('#zoom-plus');
  assert.equal(await page.textContent('#zoom-valeur'), '200 %');
  assert.equal(await page.isDisabled('#zoom-plus'), true);
  // Un appui sur le pourcentage revient à 100 %.
  await page.click('#zoom-valeur');
  assert.equal(await page.textContent('#zoom-valeur'), '100 %');
  // Jusqu'à 50 % au moins : « − » devient inactif.
  for (let i = 0; i < 5; i++) await page.click('#zoom-moins');
  assert.equal(await page.textContent('#zoom-valeur'), '50 %');
  assert.equal(await page.isDisabled('#zoom-moins'), true);
  assert.equal(Math.round((await taille(page, td(2, 1))).width), 75);

  // Mémorisé : on le retrouve en rouvrant l'application.
  await page.click('#zoom-plus');
  await page.reload();
  await page.waitForFunction(() => window.omniTableur !== undefined);
  assert.equal(await page.textContent('#zoom-valeur'), '60 %');
  assert.equal(Math.round((await taille(page, td(2, 1))).width), 90);
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('Ctrl + molette zoome (et seulement la grille), la molette seule fait défiler', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await remplir(page);
  const cellule = await taille(page, td(5, 3));
  await page.mouse.move(cellule.x + 10, cellule.y + 10);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -100);
  await page.waitForFunction(() => window.omniTableur.zoom.pourcent === 110);
  await page.mouse.wheel(0, -100);
  await page.waitForFunction(() => window.omniTableur.zoom.pourcent === 120);
  // Pavé tactile : petits mouvements additionnés.
  for (let i = 0; i < 5; i++) await page.mouse.wheel(0, 20);
  await page.waitForFunction(() => window.omniTableur.zoom.pourcent === 110);
  await page.keyboard.up('Control');
  // Sans Ctrl, la molette fait défiler la grille, sans zoomer.
  await page.mouse.wheel(0, 300);
  await page.waitForFunction(() => document.getElementById('zone-grille').scrollTop > 0);
  assert.equal(await pourcent(page), 110);
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('au doigt : écarter ou pincer deux doigts sur la grille', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url, {
    viewport: { width: 390, height: 760 },
    hasTouch: true,
    isMobile: true,
  });
  await remplir(page);
  const cdp = await contexte.newCDPSession(page);
  const zone = await taille(page, '#zone-grille');
  const cx = zone.x + zone.width / 2;
  const cy = zone.y + zone.height / 2;
  /** Deux doigts posés à `depart` px l'un de l'autre, déplacés jusqu'à `arrivee` px. */
  const geste = async (depart, arrivee) => {
    const points = (ecart) => [
      { x: cx - ecart / 2, y: cy, id: 1 },
      { x: cx + ecart / 2, y: cy, id: 2 },
    ];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(depart) });
    for (let i = 1; i <= 8; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(depart + ((arrivee - depart) * i) / 8) });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  await geste(100, 150); // écarter : × 1,5
  assert.equal(await pourcent(page), 150);
  await geste(200, 100); // pincer : ÷ 2
  assert.equal(await pourcent(page), 80); // (150 / 2 = 75, arrondi à 80)
  await geste(100, 1000); // très grand écart : 200 % au plus
  assert.equal(await pourcent(page), 200);
  // Un appui sur une cellule la sélectionne toujours correctement.
  await page.evaluate(() => {
    document.getElementById('zone-grille').scrollTop = 0;
    document.getElementById('zone-grille').scrollLeft = 0;
  });
  await page.tap(td(3, 2));
  assert.equal(await celluleActive(page), 'B3');
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('zoomé : clics, glisser, saisie et largeur des colonnes restent justes', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await remplir(page);
  await page.evaluate(() => window.omniTableur.zoom.choisir(170));
  await page.click(td(3, 2));
  assert.equal(await celluleActive(page), 'B3');
  // Glisser de B2 à C4.
  const b2 = await taille(page, td(2, 2));
  const c4 = await taille(page, td(4, 3));
  await page.mouse.move(b2.x + 5, b2.y + 5);
  await page.mouse.down();
  await page.mouse.move(c4.x + 5, c4.y + 5, { steps: 5 });
  await page.mouse.up();
  assert.equal(await page.inputValue('#nom-cellule'), 'B2:C4');
  // Le cadre de la cellule active est bien posé sur elle.
  await page.click(td(2, 2));
  await page.keyboard.press('F2');
  const editeur = await taille(page, '#editeur-cellule');
  const cible = await taille(page, td(2, 2));
  assert.ok(Math.abs(editeur.x - cible.x) <= 2 && Math.abs(editeur.y - cible.y) <= 2, 'éditeur sur la cellule');
  await page.keyboard.press('End');
  await page.keyboard.type('0');
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => window.omniTableur.feuille.brut('B2')), '2,50');
  assert.equal(await texteCellule(page, 'B4'), '5,5'); // la formule a été recalculée

  // Glisser le bord d'une colonne de 68 px à l'écran (zoom 170 %) : + 40 px enregistrés.
  const poignee = await page.locator('.poignee-largeur[data-colonne="2"]').boundingBox();
  await page.mouse.move(poignee.x + poignee.width / 2, poignee.y + poignee.height / 2);
  await page.mouse.down();
  await page.mouse.move(poignee.x + poignee.width / 2 + 68, poignee.y + poignee.height / 2, { steps: 4 });
  await page.mouse.up();
  assert.equal(await page.evaluate(() => window.omniTableur.feuille.largeur(2)), 140);
  // « Ajuster au contenu » donne la même largeur qu'à 100 %.
  await page.dblclick('.poignee-largeur[data-colonne="1"]');
  const largeurZoom = await page.evaluate(() => window.omniTableur.feuille.largeur(1));
  await page.evaluate(() => window.omniTableur.zoom.choisir(100));
  await page.evaluate(() => window.omniTableur.classeur.modifierLargeurs(window.omniTableur.feuille, [1], 150));
  await page.dblclick('.poignee-largeur[data-colonne="1"]');
  const largeurNormale = await page.evaluate(() => window.omniTableur.feuille.largeur(1));
  assert.ok(Math.abs(largeurZoom - largeurNormale) <= 1, `${largeurZoom} ≈ ${largeurNormale}`);
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('le zoom ne change ni le classeur ni le PDF ; il voyage dans le fichier .json', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await remplir(page);
  const imprimer = () =>
    page.evaluate(() => {
      window.omniTableur.exportPdf.preparer();
      const zone = document.getElementById('impression');
      const html = zone.outerHTML;
      window.omniTableur.exportPdf.terminer();
      return html;
    });
  const classeurAvant = await page.evaluate(() => JSON.stringify(window.omniTableur.classeur.versJSON()));
  const pdfAvant = await imprimer();
  await page.emulateMedia({ media: 'print' });
  await page.evaluate(() => window.omniTableur.exportPdf.preparer());
  const policePdfAvant = await page.evaluate(() => getComputedStyle(document.querySelector('#impression td')).fontSize);
  await page.evaluate(() => window.omniTableur.exportPdf.terminer());
  await page.emulateMedia({ media: 'screen' });

  await page.evaluate(() => window.omniTableur.zoom.choisir(190));
  assert.equal(await page.evaluate(() => JSON.stringify(window.omniTableur.classeur.versJSON())), classeurAvant);
  assert.equal(await imprimer(), pdfAvant);
  await page.emulateMedia({ media: 'print' });
  await page.evaluate(() => window.omniTableur.exportPdf.preparer());
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#impression td')).fontSize), policePdfAvant);
  await page.evaluate(() => window.omniTableur.exportPdf.terminer());
  await page.emulateMedia({ media: 'screen' });

  // Le fichier .json garde le zoom ; l'import le remet.
  await page.click('#onglet-donnees');
  await page.click('#bouton-exporter');
  const [telechargement] = await Promise.all([page.waitForEvent('download'), page.click('#exporter-classeur')]);
  const { readFile } = await import('node:fs/promises');
  const contenu = await readFile(await telechargement.path(), 'utf8');
  assert.equal(JSON.parse(contenu).affichage.zoom, 190);
  await page.evaluate(() => window.omniTableur.zoom.choisir(100));
  await page.click('#bouton-importer');
  const choix = page.waitForEvent('filechooser');
  await page.click('#importer-classeur');
  await (await choix).setFiles({ name: 'zoom.json', mimeType: 'application/json', buffer: Buffer.from(contenu) });
  await page.click('#fenetre-importer-classeur [data-fermer="remplacer"]');
  await page.waitForFunction(() => window.omniTableur.zoom.pourcent === 190);
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});
