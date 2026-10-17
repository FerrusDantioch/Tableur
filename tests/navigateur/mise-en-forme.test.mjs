// Étape 3 : gras, couleur de fond et largeur des colonnes.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { demarrerServeur, lancerNavigateur, ouvrirApplication } from './outils.mjs';

const td = (ligne, colonne) => `td[data-ligne="${ligne}"][data-colonne="${colonne}"]`;
const largeurColonne = (page, colonne) =>
  page.evaluate((c) => Math.round(window.tableur.grille.td(1, c).getBoundingClientRect().width), colonne);

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

test('gras : bouton et Ctrl+B, sur une plage, annulable', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await page.keyboard.type('Titre');
  await page.keyboard.press('Tab');
  await page.keyboard.type('Total');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Control+Home');
  await page.keyboard.press('Shift+ArrowRight');
  await page.click('#bouton-gras');
  assert.match(await page.getAttribute(td(1, 1), 'class'), /gras/);
  assert.match(await page.getAttribute(td(1, 2), 'class'), /gras/);
  assert.equal(await page.getAttribute('#bouton-gras', 'aria-pressed'), 'true');
  // Le gras se voit vraiment (graisse de la police).
  const graisse = await page.evaluate(() => getComputedStyle(window.tableur.grille.td(1, 1)).fontWeight);
  assert.equal(graisse, '700');
  // Ctrl+B enlève le gras.
  await page.keyboard.press('Control+b');
  assert.doesNotMatch(await page.getAttribute(td(1, 1), 'class'), /gras/);
  assert.equal(await page.getAttribute('#bouton-gras', 'aria-pressed'), 'false');
  await page.keyboard.press('Control+z');
  assert.match(await page.getAttribute(td(1, 2), 'class'), /gras/);
  // Le texte n'a pas changé.
  assert.equal(await page.textContent(td(1, 2)), 'Total');
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('couleur de fond : nuancier, aucune couleur, annulation', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await page.keyboard.press('Shift+ArrowDown');
  await page.click('#bouton-fond');
  assert.ok(await page.isVisible('#panneau-fond'));
  await page.click('#panneau-fond .pastille[data-fond="vert"]');
  assert.equal(await page.isVisible('#panneau-fond'), false);
  assert.equal(await page.getAttribute(td(1, 1), 'data-fond'), 'vert');
  assert.equal(await page.getAttribute(td(2, 1), 'data-fond'), 'vert');
  assert.equal(await page.getAttribute('#temoin-fond', 'data-fond'), 'vert');
  // La couleur affichée vient du thème.
  const couleur = await page.evaluate(() => getComputedStyle(window.tableur.grille.td(1, 1)).backgroundColor);
  const attendue = await page.evaluate(() => {
    const essai = document.createElement('div');
    essai.style.background = 'var(--fond-vert)';
    document.body.append(essai);
    const resultat = getComputedStyle(essai).backgroundColor;
    essai.remove();
    return resultat;
  });
  assert.equal(couleur, attendue);
  // « Aucune » retire la couleur.
  await page.click('#bouton-fond');
  await page.click('#panneau-fond .pastille.aucune');
  assert.equal(await page.getAttribute(td(1, 1), 'data-fond'), null);
  await page.click('#bouton-annuler');
  assert.equal(await page.getAttribute(td(1, 1), 'data-fond'), 'vert');
  // On peut taper dans une cellule colorée sans perdre la couleur.
  await page.keyboard.type('123');
  await page.keyboard.press('Enter');
  assert.equal(await page.getAttribute(td(1, 1), 'data-fond'), 'vert');
  await contexte.close();
});

test('largeur des colonnes : glisser, double-clic, panneau', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  assert.equal(await largeurColonne(page, 2), 100);

  // Glisser le bord droit de l'en-tête B de 60 pixels.
  const poignee = await page.locator('.poignee-largeur[data-colonne="2"]').boundingBox();
  const x = poignee.x + poignee.width / 2;
  const y = poignee.y + poignee.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 60, y, { steps: 6 });
  await page.mouse.up();
  assert.equal(await largeurColonne(page, 2), 160);
  assert.equal(await page.evaluate(() => window.tableur.feuille.largeur(2)), 160);
  await page.keyboard.press('Control+z');
  assert.equal(await largeurColonne(page, 2), 100);

  // Double-clic sur le bord : ajuste au contenu.
  await page.keyboard.type('Un texte assez long pour dépasser la colonne');
  await page.keyboard.press('Enter');
  await page.dblclick('.poignee-largeur[data-colonne="1"]');
  const ajustee = await largeurColonne(page, 1);
  assert.ok(ajustee > 250, `largeur ajustée : ${ajustee}`);
  const texteVisible = await page.evaluate(() => {
    const td = window.tableur.grille.td(1, 1);
    return td.scrollWidth <= td.clientWidth;
  });
  assert.ok(texteVisible, 'le texte doit tenir dans la colonne');

  // Panneau « Largeur » : + et − sur deux colonnes sélectionnées.
  await page.click(td(1, 3));
  await page.click(td(1, 4), { modifiers: ['Shift'] });
  await page.click('#bouton-largeur');
  assert.match(await page.textContent('#largeur-colonnes'), /C à D/);
  await page.click('#largeur-plus');
  await page.click('#largeur-plus');
  assert.equal(await largeurColonne(page, 3), 140);
  assert.equal(await largeurColonne(page, 4), 140);
  assert.equal(await page.textContent('#largeur-valeur'), '140 px');
  await page.click('#largeur-moins');
  assert.equal(await largeurColonne(page, 3), 120);
  await page.click('#largeur-normale');
  assert.equal(await largeurColonne(page, 4), 100);
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('largeur au doigt (téléphone)', async () => {
  const telephone = { viewport: { width: 390, height: 760 }, hasTouch: true, isMobile: true };
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url, telephone);
  await page.tap(td(1, 2));
  await page.tap('#bouton-largeur');
  await page.tap('#largeur-plus');
  assert.equal(await largeurColonne(page, 2), 120);
  // Un appui en dehors du panneau le ferme.
  await page.tap(td(6, 3));
  assert.equal(await page.isVisible('#panneau-largeur'), false);
  // Glisser le bord de l'en-tête au doigt.
  const poignee = await page.locator('.poignee-largeur[data-colonne="1"]').boundingBox();
  const cdp = await contexte.newCDPSession(page);
  const x = poignee.x + poignee.width / 2;
  const y = poignee.y + poignee.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  for (let i = 1; i <= 4; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 10 * i, y, id: 1 }] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.equal(await largeurColonne(page, 1), 140);
  await contexte.close();
});
