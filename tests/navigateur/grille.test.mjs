// Étape 1 : la grille, la saisie et les déplacements (clavier, souris, doigt).

import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { celluleActive, demarrerServeur, lancerNavigateur, ouvrirApplication, texteCellule } from './outils.mjs';

const td = (ligne, colonne) => `td[data-ligne="${ligne}"][data-colonne="${colonne}"]`;
const enEdition = (page) => page.evaluate(() => document.body.classList.contains('en-edition'));

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

describe('Au clavier', () => {
  test('saisie de texte et de nombres, Entrée descend, Tab va à droite', async () => {
    const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
    await page.keyboard.type('Bonjour');
    await page.keyboard.press('Enter');
    assert.equal(await celluleActive(page), 'A2');
    await page.keyboard.type('3,5');
    await page.keyboard.press('Tab');
    assert.equal(await celluleActive(page), 'B2');
    await page.keyboard.type('1 234');
    await page.keyboard.press('Enter');
    assert.equal(await texteCellule(page, 'A1'), 'Bonjour');
    assert.equal(await texteCellule(page, 'A2'), '3,5');
    assert.equal(await texteCellule(page, 'B2'), '1234');
    // Nombres alignés à droite, texte à gauche.
    assert.equal(await page.getAttribute(td(2, 1), 'class'), 'nombre');
    assert.equal(await page.getAttribute(td(1, 1), 'class'), 'texte');
    assert.deepEqual(page.erreurs, []);
    await contexte.close();
  });

  test('flèches, Maj+Tab, Maj+Entrée et bords de la grille', async () => {
    const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
    await page.keyboard.press('ArrowUp'); // déjà en haut : on reste en A1
    await page.keyboard.press('ArrowLeft');
    assert.equal(await celluleActive(page), 'A1');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    assert.equal(await celluleActive(page), 'C2');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await celluleActive(page), 'B2');
    await page.keyboard.press('Shift+Enter');
    assert.equal(await celluleActive(page), 'B1');
    await page.keyboard.press('Control+ArrowDown');
    assert.equal(await celluleActive(page), 'B100');
    await page.keyboard.press('Control+ArrowRight');
    assert.equal(await celluleActive(page), 'Z100');
    // La cellule active est visible (la grille a défilé).
    const visible = await page.evaluate(() => {
      const zone = document.getElementById('zone-grille').getBoundingClientRect();
      const r = window.omniTableur.grille.td(100, 26).getBoundingClientRect();
      return r.bottom <= zone.bottom + 1 && r.right <= zone.right + 1;
    });
    assert.ok(visible, 'la cellule Z100 doit être visible');
    await page.keyboard.press('Control+Home');
    assert.equal(await celluleActive(page), 'A1');
    await contexte.close();
  });

  test('taper remplace, F2 modifie, Échap annule, les flèches valident', async () => {
    const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
    await page.keyboard.type('abc');
    await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowUp');
    // F2 : on garde le texte et on ajoute à la fin.
    await page.keyboard.press('F2');
    assert.equal(await enEdition(page), true);
    await page.keyboard.type('def');
    await page.keyboard.press('ArrowLeft'); // en modification, la flèche déplace le curseur
    assert.equal(await enEdition(page), true);
    await page.keyboard.press('Enter');
    assert.equal(await texteCellule(page, 'A1'), 'abcdef');
    // Échap : la saisie est abandonnée.
    await page.keyboard.press('ArrowUp');
    await page.keyboard.type('zzz');
    await page.keyboard.press('Escape');
    assert.equal(await enEdition(page), false);
    assert.equal(await texteCellule(page, 'A1'), 'abcdef');
    // Taper remplace le contenu ; une flèche valide et déplace.
    await page.keyboard.type('xyz');
    await page.keyboard.press('ArrowRight');
    assert.equal(await texteCellule(page, 'A1'), 'xyz');
    assert.equal(await celluleActive(page), 'B1');
    // Accent tapé en premier caractère (é).
    await page.keyboard.type('été');
    await page.keyboard.press('Enter');
    assert.equal(await texteCellule(page, 'B1'), 'été');
    await contexte.close();
  });

  test('Suppr vide la sélection, Ctrl+Z annule, Ctrl+Y rétablit', async () => {
    const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
    for (const texte of ['1', '2', '3']) {
      await page.keyboard.type(texte);
      await page.keyboard.press('Enter');
    }
    await page.keyboard.press('Control+Home');
    await page.keyboard.press('Shift+ArrowDown');
    await page.keyboard.press('Delete');
    assert.equal(await texteCellule(page, 'A1'), '');
    assert.equal(await texteCellule(page, 'A2'), '');
    assert.equal(await texteCellule(page, 'A3'), '3');
    await page.keyboard.press('Control+z');
    assert.equal(await texteCellule(page, 'A1'), '1');
    assert.equal(await texteCellule(page, 'A2'), '2');
    await page.keyboard.press('Control+y');
    assert.equal(await texteCellule(page, 'A1'), '');
    // Les boutons de la barre d'outils font la même chose.
    await page.click('#bouton-annuler');
    assert.equal(await texteCellule(page, 'A2'), '2');
    await page.click('#bouton-retablir');
    assert.equal(await texteCellule(page, 'A2'), '');
    await contexte.close();
  });

  test('case « A1 » : aller à une cellule ou une plage', async () => {
    const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
    await page.fill('#nom-cellule', 'c10');
    await page.press('#nom-cellule', 'Enter');
    assert.equal(await celluleActive(page), 'C10');
    await page.fill('#nom-cellule', 'B2:D4');
    await page.press('#nom-cellule', 'Enter');
    assert.equal(await page.inputValue('#nom-cellule'), 'B2:D4');
    // Le focus est revenu à la grille : on peut taper directement.
    await page.keyboard.type('ok');
    await page.keyboard.press('Enter');
    assert.equal(await texteCellule(page, 'B2'), 'ok');
    await contexte.close();
  });
});

describe('À la souris', () => {
  test('clic, Maj+clic, glisser, double-clic et en-têtes', async () => {
    const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
    await page.click(td(3, 2));
    assert.equal(await celluleActive(page), 'B3');
    await page.click(td(5, 4), { modifiers: ['Shift'] });
    assert.equal(await page.inputValue('#nom-cellule'), 'B3:D5');
    // Glisser de A1 à C2.
    const a = await page.locator(td(1, 1)).boundingBox();
    const c = await page.locator(td(2, 3)).boundingBox();
    await page.mouse.move(a.x + 10, a.y + 10);
    await page.mouse.down();
    await page.mouse.move(c.x + 10, c.y + 10, { steps: 5 });
    await page.mouse.up();
    assert.equal(await page.inputValue('#nom-cellule'), 'A1:C2');
    // Double-clic : modification de la cellule.
    await page.click(td(4, 1));
    await page.keyboard.type('début');
    await page.keyboard.press('Enter');
    await page.dblclick(td(4, 1));
    assert.equal(await enEdition(page), true);
    await page.keyboard.type(' fin');
    await page.keyboard.press('Enter');
    assert.equal(await texteCellule(page, 'A4'), 'début fin');
    // Clic sur l'en-tête de colonne C : toute la colonne.
    await page.click('th.entete-colonne[data-colonne="3"]');
    assert.equal(await page.inputValue('#nom-cellule'), 'C1:C100');
    await page.click('th.entete-ligne[data-ligne="2"]');
    assert.equal(await page.inputValue('#nom-cellule'), 'A2:Z2');
    // Cliquer une autre cellule pendant une saisie la valide.
    await page.click(td(6, 1));
    await page.keyboard.type('valide');
    await page.click(td(8, 1));
    assert.equal(await texteCellule(page, 'A6'), 'valide');
    assert.equal(await celluleActive(page), 'A8');
    assert.deepEqual(page.erreurs, []);
    await contexte.close();
  });
});

describe('Grande feuille (grille virtuelle)', () => {
  test('seules les lignes visibles sont dessinées ; le défilement dessine la suite', async () => {
    const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
    const duree = await page.evaluate(() => {
      const { classeur, feuille } = window.omniTableur;
      const debut = performance.now();
      classeur.agrandir(feuille, { lignes: 900, colonnes: 26 });
      document.body.offsetHeight; // force le dessin
      return performance.now() - debut;
    });
    assert.ok(duree < 500, `1000 lignes × 52 colonnes dessinées en ${Math.round(duree)} ms`);
    const lignesDessinees = () => page.evaluate(() => document.querySelectorAll('.grille tbody tr:not(.espace)').length);
    assert.ok((await lignesDessinees()) < 120, 'moins de 120 lignes dans la page');
    // La barre de défilement correspond bien aux 1000 lignes.
    const hauteur = await page.evaluate(() => {
      const zone = document.getElementById('zone-grille');
      return zone.scrollHeight / window.omniTableur.grille.hauteurLigne;
    });
    assert.ok(Math.abs(hauteur - 1001) < 1, `hauteur de la grille : ${hauteur} lignes`);

    // Aller tout en bas au clavier, saisir, revenir.
    await page.keyboard.press('Control+ArrowDown');
    assert.equal(await celluleActive(page), 'A1000');
    await page.keyboard.type('tout en bas');
    await page.keyboard.press('Enter');
    assert.equal(await texteCellule(page, 'A1000'), 'tout en bas');
    const visible = await page.evaluate(() => {
      const zone = document.getElementById('zone-grille').getBoundingClientRect();
      const r = window.omniTableur.grille.td(1000, 1).getBoundingClientRect();
      return r.bottom <= zone.bottom + 1 && r.top >= zone.top;
    });
    assert.ok(visible, 'A1000 est visible');
    assert.ok((await lignesDessinees()) < 120);

    // Défilement à la molette : les lignes du milieu apparaissent.
    await page.keyboard.press('Control+Home');
    await page.mouse.move(300, 400);
    for (let i = 0; i < 20; i++) await page.mouse.wheel(0, 600);
    await page.waitForTimeout(100);
    const auMilieu = await page.evaluate(() => {
      const zone = document.getElementById('zone-grille');
      const r = zone.getBoundingClientRect();
      const element = document.elementFromPoint(r.left + 150, r.top + r.height / 2);
      const td = element?.closest('td');
      return { scrollTop: zone.scrollTop, ligne: Number(td?.dataset.ligne), colonne: Number(td?.dataset.colonne) };
    });
    assert.ok(auMilieu.scrollTop > 5000, `défilement : ${auMilieu.scrollTop}`);
    assert.ok(auMilieu.ligne > 150, `une vraie cellule est affichée au milieu (ligne ${auMilieu.ligne})`);
    // Un clic sur cette cellule la sélectionne.
    const r = await page.evaluate(() => document.getElementById('zone-grille').getBoundingClientRect().toJSON());
    await page.mouse.click(r.left + 150, r.top + r.height / 2);
    assert.equal(await celluleActive(page), `${'ABC'[auMilieu.colonne - 1]}${auMilieu.ligne}`);
    assert.deepEqual(page.erreurs, []);
    await contexte.close();
  });
});

describe('Au doigt (téléphone)', () => {
  const telephone = { viewport: { width: 390, height: 760 }, hasTouch: true, isMobile: true };

  test('un appui sélectionne, un second appui ouvre la saisie', async () => {
    const { contexte, page } = await ouvrirApplication(navigateur, serveur.url, telephone);
    await page.tap(td(2, 2));
    assert.equal(await celluleActive(page), 'B2');
    assert.equal(await enEdition(page), false);
    // Le clavier du téléphone ne doit pas s'ouvrir au premier appui.
    assert.notEqual(await page.evaluate(() => document.activeElement.tagName), 'INPUT');
    await page.tap(td(2, 2));
    assert.equal(await enEdition(page), true);
    await page.keyboard.type('42');
    await page.keyboard.press('Enter');
    assert.equal(await texteCellule(page, 'B2'), '42');
    assert.equal(await celluleActive(page), 'B3');
    // La page ne déborde pas de l'écran.
    const largeur = await page.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(largeur <= 390, `largeur de la page : ${largeur}`);
    await contexte.close();
  });

  test('barre de formule, boutons ✓ et ✕', async () => {
    const { contexte, page } = await ouvrirApplication(navigateur, serveur.url, telephone);
    await page.tap(td(1, 1));
    await page.tap('#champ-formule');
    await page.keyboard.type('avec la barre');
    await page.tap('#valider-saisie');
    assert.equal(await texteCellule(page, 'A1'), 'avec la barre');
    await page.tap('#champ-formule');
    await page.keyboard.type(' (à oublier)');
    await page.tap('#annuler-saisie');
    assert.equal(await texteCellule(page, 'A1'), 'avec la barre');
    assert.equal(await enEdition(page), false);
    await contexte.close();
  });

  test('glisser la poignée étend la sélection', async () => {
    const { contexte, page } = await ouvrirApplication(navigateur, serveur.url, telephone);
    await page.tap(td(2, 1));
    const poignee = await page.locator('.poignee-selection').boundingBox();
    const cible = await page.locator(td(4, 2)).boundingBox();
    // Geste au doigt envoyé directement au navigateur.
    const cdp = await contexte.newCDPSession(page);
    const point = (x, y) => [{ x, y, id: 1 }];
    const depart = { x: poignee.x + poignee.width / 2, y: poignee.y + poignee.height / 2 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(depart.x, depart.y) });
    for (let i = 1; i <= 5; i++) {
      const x = depart.x + ((cible.x + 20 - depart.x) * i) / 5;
      const y = depart.y + ((cible.y + 10 - depart.y) * i) / 5;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(x, y) });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.equal(await page.inputValue('#nom-cellule'), 'A2:B4');
    assert.equal(await celluleActive(page), 'A2');
    await contexte.close();
  });
});
