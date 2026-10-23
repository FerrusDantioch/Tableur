// Étape 5 : données — onglets des feuilles, formules entre feuilles, tri,
// première ligne figée, import CSV.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { celluleActive, cliquerOutil, demarrerServeur, lancerNavigateur, ouvrirApplication, texteCellule } from './outils.mjs';

const td = (ligne, colonne) => `td[data-ligne="${ligne}"][data-colonne="${colonne}"]`;
const onglet = (nom) => `.onglet-feuille:text-is("${nom}")`;
const nomsOnglets = (page) => page.$$eval('.onglet-feuille', (onglets) => onglets.map((o) => o.textContent));
const brut = (page, adr) => page.evaluate((a) => window.tableur.feuille.brut(a), adr);

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

async function taperColonne(page, valeurs) {
  for (const valeur of valeurs) {
    await page.keyboard.type(valeur);
    await page.keyboard.press('Enter');
  }
}

test('onglets : ajouter, changer, renommer, supprimer ; formules entre feuilles', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  assert.deepEqual(await nomsOnglets(page), ['Feuille1']);
  await taperColonne(page, ['10']);
  // Nouvelle feuille : elle s'affiche tout de suite, vide.
  await page.click('#ajouter-feuille');
  assert.deepEqual(await nomsOnglets(page), ['Feuille1', 'Feuille2']);
  assert.equal(await page.getAttribute(onglet('Feuille2'), 'aria-selected'), 'true');
  assert.equal(await texteCellule(page, 'A1'), '');
  await taperColonne(page, ['32', '=Feuille1!A1*3']);
  assert.equal(await texteCellule(page, 'A2'), '30');
  // Retour sur Feuille1 : la sélection d'avant est retrouvée (A2).
  await page.click(onglet('Feuille1'));
  assert.equal(await texteCellule(page, 'A1'), '10');
  assert.equal(await celluleActive(page), 'A2');
  await page.keyboard.type('=Feuille2!A1+1');
  await page.keyboard.press('Enter');
  assert.equal(await texteCellule(page, 'A2'), '33');
  // Renommer Feuille2 (menu de l'onglet affiché) : la formule suit le nouveau nom.
  await page.click(onglet('Feuille2'));
  assert.equal(await celluleActive(page), 'A3');
  await page.click(onglet('Feuille2'));
  await page.click('#feuille-renommer');
  assert.ok(await page.isVisible('#fenetre-renommer-feuille'));
  await page.fill('#nom-feuille', 'feuille1');
  await page.press('#nom-feuille', 'Enter');
  assert.match(await page.textContent('#erreur-nom-feuille'), /déjà/);
  await page.fill('#nom-feuille', 'Mes ventes');
  await page.press('#nom-feuille', 'Enter');
  assert.equal(await page.isVisible('#fenetre-renommer-feuille'), false);
  assert.deepEqual(await nomsOnglets(page), ['Feuille1', 'Mes ventes']);
  await page.click(onglet('Feuille1'));
  assert.equal(await brut(page, 'A2'), "='Mes ventes'!A1+1");
  // Supprimer « Mes ventes » : confirmation, puis #REF! ; Annuler la fait revenir.
  await page.click(onglet('Mes ventes'));
  await page.click(onglet('Mes ventes'));
  await page.click('#feuille-supprimer');
  await page.click('#fenetre-supprimer-feuille [data-fermer="supprimer"]');
  await page.waitForFunction(() => window.tableur.classeur.feuilles.length === 1);
  assert.deepEqual(await nomsOnglets(page), ['Feuille1']);
  assert.equal(await texteCellule(page, 'A2'), '#REF!');
  await page.click('#bouton-annuler');
  assert.deepEqual(await nomsOnglets(page), ['Feuille1', 'Mes ventes']);
  await page.click(onglet('Feuille1'));
  assert.equal(await texteCellule(page, 'A2'), '33');
  // Double-clic sur un onglet : renommer directement.
  await page.dblclick(onglet('Feuille1'));
  assert.ok(await page.isVisible('#fenetre-renommer-feuille'));
  await page.keyboard.press('Escape');
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('trier une colonne (croissant, décroissant), avec la ligne de titres', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await taperColonne(page, ['Fruit', 'Poire', 'Abricot', 'Mangue']);
  await page.click(td(1, 2));
  await taperColonne(page, ['Prix', '3', '5', '1,5']);
  // Tri selon la colonne B (cellule active B3).
  await page.click(td(3, 2));
  await cliquerOutil(page, '#bouton-trier');
  assert.match(await page.textContent('#tri-description'), /lignes 2 à 4 .* colonne B/);
  assert.equal(await page.isChecked('#tri-titres'), true);
  await page.click('#trier-croissant');
  assert.deepEqual([await texteCellule(page, 'A2'), await texteCellule(page, 'A3'), await texteCellule(page, 'A4')], ['Mangue', 'Poire', 'Abricot']);
  assert.equal(await texteCellule(page, 'A1'), 'Fruit'); // les titres n'ont pas bougé
  // Décroissant selon la colonne A.
  await page.click(td(2, 1));
  await cliquerOutil(page, '#bouton-trier');
  await page.click('#trier-decroissant');
  assert.deepEqual([await texteCellule(page, 'A2'), await texteCellule(page, 'B2')], ['Poire', '3']);
  assert.match(await page.textContent('#message'), /triées \(décroissant\)/);
  await page.keyboard.press('Control+z');
  assert.equal(await texteCellule(page, 'A2'), 'Mangue');
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('figer la première ligne : elle reste visible et utilisable en défilant', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await taperColonne(page, ['Titre']);
  await page.evaluate(() => window.tableur.classeur.agrandir(window.tableur.feuille, { lignes: 200 }));
  await cliquerOutil(page, '#bouton-figer');
  assert.equal(await page.getAttribute('#bouton-figer', 'aria-pressed'), 'true');
  // Défiler loin : la ligne 1 reste juste sous les en-têtes A, B, C…
  await page.evaluate(() => {
    document.getElementById('zone-grille').scrollTop = 3000;
  });
  await page.waitForTimeout(100);
  const position = await page.evaluate(() => {
    const entete = document.querySelector('th.coin').getBoundingClientRect();
    const titre = window.tableur.grille.td(1, 1).getBoundingClientRect();
    return { ecart: Math.round(titre.top - entete.bottom), texte: window.tableur.grille.td(1, 1).textContent };
  });
  assert.ok(Math.abs(position.ecart) <= 1, `la ligne 1 est collée sous les en-têtes (écart ${position.ecart})`);
  assert.equal(position.texte, 'Titre');
  // Cliquer dessus pendant le défilement la sélectionne ; on peut la modifier.
  await page.click(td(1, 1));
  assert.equal(await celluleActive(page), 'A1');
  await page.keyboard.type('Nouveau titre');
  await page.keyboard.press('Enter');
  assert.equal(await brut(page, 'A1'), 'Nouveau titre');
  // Libérer la ligne.
  await cliquerOutil(page, '#bouton-figer');
  assert.equal(await page.getAttribute('#bouton-figer', 'aria-pressed'), 'false');
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('importer un fichier CSV dans une nouvelle feuille', async () => {
  const contenu = '\uFEFFDate;Libellé;Montant\r\n02/03/2026;Boulangerie;-4,20\r\n05/03/2026;"Salaire; mars";1850\r\n';
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await taperColonne(page, ['ne bouge pas']);
  // Le bouton « Importer CSV » ouvre le choix de fichier du système ; le test donne le fichier directement.
  const choix = page.waitForEvent('filechooser');
  await cliquerOutil(page, '#bouton-importer');
  await (await choix).setFiles({ name: 'Relevé mars.csv', mimeType: 'text/csv', buffer: Buffer.from(contenu, 'utf8') });
  await page.waitForFunction(() => window.tableur.classeur.feuilles.length === 2);
  assert.deepEqual(await nomsOnglets(page), ['Feuille1', 'Relevé mars']);
  assert.equal(await texteCellule(page, 'B3'), 'Salaire; mars');
  assert.equal(await texteCellule(page, 'C2'), '-4,2');
  assert.equal(await texteCellule(page, 'A2'), '02/03/2026');
  assert.match(await page.textContent('#message'), /nouvelle feuille « Relevé mars » \(3 lignes, 3 colonnes\)/);
  // Les montants sont des nombres : une somme fonctionne.
  await page.click(td(5, 3));
  await page.keyboard.type('=SOMME(C2:C3)');
  await page.keyboard.press('Enter');
  assert.equal(await texteCellule(page, 'C5'), '1845,8');
  // La première feuille n'a pas changé.
  await page.click(onglet('Feuille1'));
  assert.equal(await texteCellule(page, 'A1'), 'ne bouge pas');
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('au doigt : onglets des feuilles et menu de la feuille', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url, {
    viewport: { width: 390, height: 760 },
    hasTouch: true,
    isMobile: true,
  });
  await page.tap('#ajouter-feuille');
  await page.tap('#ajouter-feuille');
  assert.deepEqual(await nomsOnglets(page), ['Feuille1', 'Feuille2', 'Feuille3']);
  await page.tap(onglet('Feuille1'));
  assert.equal(await page.getAttribute(onglet('Feuille1'), 'aria-selected'), 'true');
  await page.waitForTimeout(600); // (deux appuis trop rapides compteraient comme un double appui)
  await page.tap(onglet('Feuille1'));
  assert.ok(await page.isVisible('#panneau-feuille'));
  // Le menu s'ouvre au-dessus de l'onglet, sans sortir de l'écran.
  const boite = await page.locator('#panneau-feuille').boundingBox();
  assert.ok(boite.y >= 0 && boite.y + boite.height <= 760 && boite.x + boite.width <= 390);
  assert.ok((await page.evaluate(() => document.documentElement.scrollWidth)) <= 390);
  await contexte.close();
});
