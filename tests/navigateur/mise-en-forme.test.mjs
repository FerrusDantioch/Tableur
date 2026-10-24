// Étape 4 : mise en forme (gras, italique, couleurs, alignement, formats,
// bordures) et largeur des colonnes.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { demarrerServeur, lancerNavigateur, ouvrirApplication, cliquerOutil } from './outils.mjs';

const td = (ligne, colonne) => `td[data-ligne="${ligne}"][data-colonne="${colonne}"]`;
const largeurColonne = (page, colonne) =>
  page.evaluate((c) => Math.round(window.omniTableur.grille.td(1, c).getBoundingClientRect().width), colonne);

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
  await cliquerOutil(page, '#bouton-gras');
  assert.match(await page.getAttribute(td(1, 1), 'class'), /gras/);
  assert.match(await page.getAttribute(td(1, 2), 'class'), /gras/);
  assert.equal(await page.getAttribute('#bouton-gras', 'aria-pressed'), 'true');
  // Le gras se voit vraiment (graisse de la police).
  const graisse = await page.evaluate(() => getComputedStyle(window.omniTableur.grille.td(1, 1)).fontWeight);
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
  await cliquerOutil(page, '#bouton-fond');
  assert.ok(await page.isVisible('#panneau-fond'));
  await page.click('#panneau-fond .pastille[data-fond="vert"]');
  assert.equal(await page.isVisible('#panneau-fond'), false);
  assert.equal(await page.getAttribute(td(1, 1), 'data-fond'), 'vert');
  assert.equal(await page.getAttribute(td(2, 1), 'data-fond'), 'vert');
  assert.equal(await page.getAttribute('#temoin-fond', 'data-fond'), 'vert');
  // La couleur affichée vient du thème.
  const couleur = await page.evaluate(() => getComputedStyle(window.omniTableur.grille.td(1, 1)).backgroundColor);
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
  await cliquerOutil(page, '#bouton-fond');
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
  assert.equal(await page.evaluate(() => window.omniTableur.feuille.largeur(2)), 160);
  await page.keyboard.press('Control+z');
  assert.equal(await largeurColonne(page, 2), 100);

  // Double-clic sur le bord : ajuste au contenu.
  await page.keyboard.type('Un texte assez long pour dépasser la colonne');
  await page.keyboard.press('Enter');
  await page.dblclick('.poignee-largeur[data-colonne="1"]');
  const ajustee = await largeurColonne(page, 1);
  assert.ok(ajustee > 250, `largeur ajustée : ${ajustee}`);
  const texteVisible = await page.evaluate(() => {
    const td = window.omniTableur.grille.td(1, 1);
    return td.scrollWidth <= td.clientWidth;
  });
  assert.ok(texteVisible, 'le texte doit tenir dans la colonne');

  // Panneau « Largeur » : + et − sur deux colonnes sélectionnées.
  await page.click(td(1, 3));
  await page.click(td(1, 4), { modifiers: ['Shift'] });
  await cliquerOutil(page, '#bouton-largeur');
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
  await cliquerOutil(page, '#bouton-largeur', { doigt: true });
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

const style = (page, adr, propriete) =>
  page.evaluate(
    ([a, p]) => {
      const m = /^([A-Z]+)(\d+)$/.exec(a);
      const colonne = m[1].charCodeAt(0) - 64;
      return getComputedStyle(window.omniTableur.grille.td(Number(m[2]), colonne))[p];
    },
    [adr, propriete],
  );

test('italique, couleur du texte et alignement', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await page.keyboard.type('Bonjour');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Control+i');
  assert.equal(await style(page, 'A1', 'fontStyle'), 'italic');
  await cliquerOutil(page, '#bouton-italique');
  assert.equal(await style(page, 'A1', 'fontStyle'), 'normal');
  assert.equal(await page.getAttribute('#bouton-italique', 'aria-pressed'), 'false');
  // Couleur du texte : rouge, puis automatique.
  const avant = await style(page, 'A1', 'color');
  await cliquerOutil(page, '#bouton-encre');
  await page.click('#panneau-encre .pastille[data-encre="rouge"]');
  const rouge = await style(page, 'A1', 'color');
  assert.notEqual(rouge, avant);
  assert.equal(await page.getAttribute('#temoin-encre', 'data-encre'), 'rouge');
  await cliquerOutil(page, '#bouton-encre');
  await page.click('#panneau-encre .pastille.aucune');
  assert.equal(await style(page, 'A1', 'color'), avant);
  // Alignement : centre, puis un second appui revient à l'automatique (texte à gauche).
  await cliquerOutil(page, '#bouton-centre');
  assert.equal(await style(page, 'A1', 'textAlign'), 'center');
  assert.equal(await page.getAttribute('#bouton-centre', 'aria-pressed'), 'true');
  await cliquerOutil(page, '#bouton-droite');
  assert.equal(await style(page, 'A1', 'textAlign'), 'right');
  await cliquerOutil(page, '#bouton-droite');
  assert.equal(await style(page, 'A1', 'textAlign'), 'start');
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('formats de nombre : euros, pourcentage, date, décimales', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  const texte = (adr) => page.evaluate((a) => window.omniTableur.grille.td(1, a).textContent.replace(/[\u202f\u00a0]/g, ' '), adr);
  for (const valeur of ['1234,5', '0,125', '46318', '2,567']) {
    await page.keyboard.type(valeur);
    await page.keyboard.press('Tab');
  }
  // A1 en euros.
  await page.click(td(1, 1));
  await cliquerOutil(page, '#bouton-format');
  await page.click('#panneau-format [data-format="euro"]');
  assert.equal(await texte(1), '1 234,50 €');
  // B1 en pourcentage, avec une décimale de plus.
  await page.click(td(1, 2));
  await cliquerOutil(page, '#bouton-format');
  await page.click('#panneau-format [data-format="pourcent"]');
  assert.equal(await texte(2), '13 %');
  await cliquerOutil(page, '#bouton-format');
  await page.click('#decimales-plus');
  assert.equal(await page.textContent('#decimales-valeur'), '1 décimale');
  await page.keyboard.press('Escape');
  assert.equal(await texte(2), '12,5 %');
  // C1 en date.
  await page.click(td(1, 3));
  await cliquerOutil(page, '#bouton-format');
  await page.click('#panneau-format [data-format="date"]');
  assert.equal(await texte(3), '23/10/2026');
  // D1 : « − décimale » en partant du format automatique (2,567 → 2,57).
  await page.click(td(1, 4));
  await cliquerOutil(page, '#bouton-format');
  await page.click('#decimales-moins');
  await page.keyboard.press('Escape');
  assert.equal(await texte(4), '2,57');
  // La valeur reste entière pour les calculs, et « Automatique » revient à l'affichage d'origine.
  assert.equal(await page.evaluate(() => window.omniTableur.moteur.valeur(window.omniTableur.feuille, 'D1')), 2.567);
  await cliquerOutil(page, '#bouton-format');
  await page.click('#panneau-format [data-format=""]');
  assert.equal(await texte(4), '2,567');
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('bordures : toutes, extérieure épaisse en couleur, aucune', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await page.click(td(2, 2));
  await page.click(td(3, 3), { modifiers: ['Shift'] });
  await cliquerOutil(page, '#groupe-bordures [data-bordures="toutes"]');
  // B2 dessine son bas et sa droite ; A2 dessine la gauche de B2 ; B1 son haut.
  assert.equal(await style(page, 'B2', 'borderBottomWidth'), '1px');
  assert.equal(await style(page, 'A2', 'borderRightWidth'), '1px');
  assert.equal(await style(page, 'B1', 'borderBottomWidth'), '1px');
  const quadrillage = await style(page, 'E5', 'borderBottomColor');
  assert.notEqual(await style(page, 'B2', 'borderBottomColor'), quadrillage);
  // Trait épais, couleur bleue, bordure extérieure.
  await cliquerOutil(page, '#trait-epais');
  await cliquerOutil(page, '#bouton-couleur-bordure');
  await page.click('#panneau-couleur-bordure .pastille[data-encre="bleu"]');
  await cliquerOutil(page, '#groupe-bordures [data-bordures="exterieur"]');
  assert.equal(await style(page, 'C3', 'borderBottomWidth'), '2px');
  assert.equal(await style(page, 'B2', 'borderBottomWidth'), '1px'); // l'intérieur reste fin
  const bleu = await style(page, 'C3', 'borderBottomColor');
  assert.notEqual(bleu, await style(page, 'B2', 'borderBottomColor'));
  // Le choix du trait est mémorisé.
  assert.equal(await page.getAttribute('#trait-epais', 'aria-pressed'), 'true');
  // Aucune : tout disparaît ; Annuler remet.
  await cliquerOutil(page, '#groupe-bordures [data-bordures="aucune"]');
  assert.equal(await style(page, 'B2', 'borderBottomColor'), quadrillage);
  assert.equal(await style(page, 'C3', 'borderBottomWidth'), '1px');
  await page.click('#bouton-annuler');
  assert.equal(await style(page, 'C3', 'borderBottomWidth'), '2px');
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});
