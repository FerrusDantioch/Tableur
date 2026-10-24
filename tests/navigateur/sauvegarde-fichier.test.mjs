// Ajout 1 : « Exporter le classeur (.json) » et « Importer un classeur (.json) »,
// à la souris et au doigt (téléphone Android imité).

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { demarrerServeur, lancerNavigateur, ouvrirApplication, texteCellule, cliquerOutil } from './outils.mjs';

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

/** Date du jour au format AAAA-MM-JJ (heure locale), comme dans le nom du fichier. */
function aujourdhui() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Remplit un petit classeur : deux feuilles, une formule entre feuilles, du gras et une bordure. */
async function remplirClasseur(page) {
  await page.fill('#titre', 'Budget familial');
  await page.press('#titre', 'Enter');
  await page.keyboard.type('Loyer');
  await page.keyboard.press('Tab');
  await page.keyboard.type('650');
  await page.keyboard.press('Enter');
  await page.evaluate(() => {
    const { classeur, feuille } = window.omniTableur;
    classeur.modifierCellules(feuille, [
      { adresse: 'A1', gras: true, fond: 'vert' },
      { adresse: 'B1', format: { type: 'euro', decimales: 2 }, bordures: { bas: { style: 'epais', couleur: 'bleu' } } },
    ]);
    classeur.modifierLargeurs(feuille, [1], 160);
    const autre = classeur.ajouterFeuille({ nom: 'Année' });
    classeur.modifierCellules(autre, [{ adresse: 'A1', brut: '=Feuille1!B1*12' }]);
  });
}

/** Exporte le classeur et renvoie { nom, contenu } du fichier téléchargé. */
async function exporter(page, { doigt = false } = {}) {
  await cliquerOutil(page, '#bouton-exporter', { doigt });
  const attente = page.waitForEvent('download');
  if (doigt) await page.tap('#exporter-classeur');
  else await page.click('#exporter-classeur');
  const telechargement = await attente;
  return { nom: telechargement.suggestedFilename(), contenu: await readFile(await telechargement.path(), 'utf8') };
}

/** Attend la fin de l'import (message « … importé … » dans la barre d'état). */
const attendreImport = (page) => page.waitForFunction(() => /importé/.test(document.getElementById('message').textContent));

/** Choisit un fichier avec « Importer un classeur (.json) ». */
async function importer(page, fichier, { doigt = false } = {}) {
  await cliquerOutil(page, '#bouton-importer', { doigt });
  const choix = page.waitForEvent('filechooser');
  if (doigt) await page.tap('#importer-classeur');
  else await page.click('#importer-classeur');
  await (await choix).setFiles(fichier);
}

test('exporter puis réimporter le classeur : tout revient, et « Annuler » rend le classeur d’avant', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await remplirClasseur(page);
  const { nom, contenu } = await exporter(page);
  assert.equal(nom, `omni-tableur-${aujourdhui()}.json`);
  const objet = JSON.parse(contenu);
  assert.equal(objet.format, 'omni-tableur/classeur');
  assert.equal(objet.version, 1);
  assert.deepEqual(objet.feuilles.map((f) => f.nom), ['Feuille1', 'Année']);
  assert.match(await page.textContent('#message'), /omni-tableur-.*\.json/);

  // Une autre personne (navigateur vierge) importe le fichier.
  const { contexte: contexte2, page: page2 } = await ouvrirApplication(navigateur, serveur.url);
  await page2.keyboard.type('à remplacer');
  await page2.keyboard.press('Enter');
  await importer(page2, { name: nom, mimeType: 'application/json', buffer: Buffer.from(contenu) });
  await page2.waitForSelector('#fenetre-importer-classeur[open]');
  assert.match(await page2.textContent('#fenetre-importer-classeur'), /Cela remplacera votre classeur actuel\. Continuer \?/);
  assert.match(await page2.textContent('#resume-import'), /classeur « Budget familial », 2 feuilles/);
  await page2.click('#fenetre-importer-classeur [data-fermer="remplacer"]');
  await attendreImport(page2);

  assert.equal(await page2.inputValue('#titre'), 'Budget familial');
  assert.equal(await page2.evaluate(() => window.omniTableur.feuille.nom), 'Année');
  assert.equal(await texteCellule(page2, 'A1'), '7800');
  await page2.click('.onglet-feuille:text-is("Feuille1")');
  assert.match(await texteCellule(page2, 'B1'), /^650,00\s€$/);
  assert.match(await page2.getAttribute(td(1, 1), 'class'), /gras/);
  assert.equal(await page2.getAttribute(td(1, 1), 'data-fond'), 'vert');
  assert.equal(await page2.evaluate(() => window.omniTableur.feuille.largeur(1)), 160);
  assert.deepEqual(await page2.evaluate(() => window.omniTableur.feuille.cellule('B1').bordures.bas), { style: 'epais', couleur: 'bleu' });

  // « Annuler » : retour au classeur d'avant l'import.
  await page2.click('#bouton-annuler');
  assert.equal(await page2.inputValue('#titre'), 'Sans titre');
  assert.equal(await page2.evaluate(() => window.omniTableur.classeur.feuilles.length), 1);
  assert.equal(await texteCellule(page2, 'A1'), 'à remplacer');
  assert.deepEqual(page.erreurs, []);
  assert.deepEqual(page2.erreurs, []);
  await contexte.close();
  await contexte2.close();
});

test('le thème enregistré dans le fichier est repris', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await page.evaluate(() => document.querySelector('input[name="theme"][value="clair"]').click());
  const { nom, contenu } = await exporter(page);
  await page.evaluate(() => document.querySelector('input[name="theme"][value="omni"]').click());
  assert.equal(await page.getAttribute('html', 'data-theme'), 'omni');
  await importer(page, { name: nom, mimeType: 'application/json', buffer: Buffer.from(contenu) });
  await page.click('#fenetre-importer-classeur [data-fermer="remplacer"]');
  await attendreImport(page);
  assert.equal(await page.getAttribute('html', 'data-theme'), 'clair');
  assert.equal(await page.evaluate(() => document.querySelector('input[name="theme"]:checked').value), 'clair');
  await contexte.close();
});

test('« Garder mon classeur » : rien ne change', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await remplirClasseur(page);
  const { nom, contenu } = await exporter(page);
  await page.click(td(5, 1));
  await page.keyboard.type('nouveau');
  await page.keyboard.press('Enter');
  const avant = await page.evaluate(() => JSON.stringify(window.omniTableur.classeur.versJSON()));
  await importer(page, { name: nom, mimeType: 'application/json', buffer: Buffer.from(contenu) });
  await page.click('#fenetre-importer-classeur [data-fermer="garder"]');
  await page.waitForFunction(() => /Import abandonné/.test(document.getElementById('message').textContent));
  assert.equal(await page.evaluate(() => JSON.stringify(window.omniTableur.classeur.versJSON())), avant);
  assert.match(await page.textContent('#message'), /Import abandonné/);
  await contexte.close();
});

test('fichier invalide, abîmé ou d’une autre application : message clair et classeur intact', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await remplirClasseur(page);
  const { contenu } = await exporter(page);
  const avant = await page.evaluate(() => JSON.stringify(window.omniTableur.classeur.versJSON()));
  const cas = [
    [{ name: 'releve.csv', mimeType: 'text/csv', buffer: Buffer.from('Date;Montant\n01/01/2026;12') }, /illisible/],
    [{ name: 'photo.json', mimeType: 'application/json', buffer: Buffer.from('{"appareil":"téléphone"}') }, /pas été créé par Omni-Tableur/],
    [{ name: 'coupe.json', mimeType: 'application/json', buffer: Buffer.from(contenu.slice(0, contenu.length / 2)) }, /illisible/],
    [{ name: 'abime.json', mimeType: 'application/json', buffer: Buffer.from(contenu.replace('"lignes":100', '"lignes":-3')) }, /abîmé/],
  ];
  for (const [fichierChoisi, attendu] of cas) {
    await importer(page, fichierChoisi);
    await page.waitForSelector('#fenetre-erreur-fichier[open]');
    assert.match(await page.textContent('#texte-erreur-fichier'), attendu);
    assert.match(await page.textContent('#fenetre-erreur-fichier'), /Votre classeur actuel n'a pas été modifié/);
    assert.equal(await page.isVisible('#fenetre-importer-classeur'), false); // aucune confirmation demandée
    await page.click('#fenetre-erreur-fichier [data-fermer]');
    assert.equal(await page.evaluate(() => JSON.stringify(window.omniTableur.classeur.versJSON())), avant);
  }
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('au doigt, sur un téléphone Android : téléchargement et choix du fichier', async () => {
  const android = {
    viewport: { width: 393, height: 780 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2.75,
    userAgent:
      'Mozilla/5.0 (Linux; Android 15; 25040RA2EG) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
    acceptDownloads: true,
  };
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url, android);
  await remplirClasseur(page);
  const { nom, contenu } = await exporter(page, { doigt: true });
  assert.equal(nom, `omni-tableur-${aujourdhui()}.json`);
  // Les panneaux tiennent dans l'écran du téléphone (rien ne déborde).
  await cliquerOutil(page, '#bouton-exporter', { doigt: true });
  const boite = await page.evaluate(() => document.getElementById('panneau-exporter').getBoundingClientRect().toJSON());
  assert.ok(boite.left >= 0 && boite.right <= 393, `panneau dans l'écran (${boite.left} → ${boite.right})`);
  await page.evaluate(() => document.getElementById('panneau-exporter').hidePopover());

  const { contexte: contexte2, page: page2 } = await ouvrirApplication(navigateur, serveur.url, android);
  await importer(page2, { name: nom, mimeType: 'application/json', buffer: Buffer.from(contenu) }, { doigt: true });
  await page2.waitForSelector('#fenetre-importer-classeur[open]');
  await page2.tap('#fenetre-importer-classeur [data-fermer="remplacer"]');
  await attendreImport(page2);
  assert.equal(await page2.inputValue('#titre'), 'Budget familial');
  assert.equal(await texteCellule(page2, 'A1'), '7800');
  assert.equal(await page2.evaluate(() => document.documentElement.scrollWidth), 393); // pas de défilement de côté
  assert.deepEqual(page.erreurs, []);
  assert.deepEqual(page2.erreurs, []);
  await contexte.close();
  await contexte2.close();
});
