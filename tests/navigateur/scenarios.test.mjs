// Ajout 3 : scénarios complets dans un vrai navigateur.
//   - un classeur complexe exporté puis réimporté (sur un autre « appareil ») ;
//   - des fichiers invalides refusés sans toucher au classeur ;
//   - des lignes et colonnes insérées ou supprimées autour d'une fusion.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { demarrerServeur, lancerNavigateur, ouvrirApplication, texteCellule, cliquerOutil } from './outils.mjs';

const td = (ligne, colonne) => `td[data-ligne="${ligne}"][data-colonne="${colonne}"]`;
const json = (page) => page.evaluate(() => JSON.stringify(window.omniTableur.classeur.versJSON()));

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

/** Le classeur complexe (même contenu que tests/unitaires/scenarios.test.mjs). */
async function construireClasseurComplet(page) {
  await page.evaluate(() => {
    const { classeur, feuille: ventes } = window.omniTableur;
    const P = (debut, fin) => ({ debut, fin });
    const ecrire = (feuille, contenus) =>
      classeur.modifierCellules(feuille, Object.entries(contenus).map(([adresse, brut]) => ({ adresse, brut })));
    classeur.renommer('Budget de l’association');
    classeur.renommerFeuille(ventes, 'Ventes');
    ecrire(ventes, {
      A1: 'Ventes du trimestre',
      A2: 'Article', B2: 'Prix', C2: 'Quantité', D2: 'Total',
      A3: 'Gâteau', B3: '12,5', C3: '4', D3: '=B3*C3',
      A4: 'Café', B4: '1,8', C4: '120', D4: '=B4*C4',
      A5: 'Total', D5: '=SOMME(D3:D4)',
    });
    classeur.modifierCellules(ventes, [
      { adresse: 'B3', format: { type: 'euro', decimales: 2 } },
      { adresse: 'D5', gras: true, bordures: { haut: { style: 'epais', couleur: 'auto' } } },
    ]);
    classeur.fusionner(ventes, P({ ligne: 1, colonne: 1 }, { ligne: 1, colonne: 4 }));
    classeur.ajouterRegle(ventes, { plage: 'D3:D4', type: 'superieur', valeur: '100', fond: 'vert' });
    classeur.modifierLargeurs(ventes, [1], 150);
    const depenses = classeur.ajouterFeuille({ nom: 'Dépenses 2026' });
    ecrire(depenses, { A1: 'Loyer', B1: '400', A2: 'Électricité', B2: '-35', B3: '=SOMME(B1:B2)' });
    classeur.ajouterRegle(depenses, { plage: 'B1:B2', type: 'negatif', encre: 'rouge' });
    const resume = classeur.ajouterFeuille({ nom: 'Résumé' });
    ecrire(resume, { A1: 'Solde', B1: "=Ventes!D5-'Dépenses 2026'!B3" });
    classeur.activer(ventes);
  });
}

test('classeur complexe : export puis import sur un autre appareil, résultat identique', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await construireClasseurComplet(page);
  await page.evaluate(() => window.omniTableur.zoom.choisir(130));
  await page.evaluate(() => document.querySelector('input[name="theme"][value="clair"]').click());
  const original = await json(page);

  await cliquerOutil(page, '#bouton-exporter');
  const attente = page.waitForEvent('download');
  await page.click('#exporter-classeur');
  const telechargement = await attente;
  const contenu = await readFile(await telechargement.path(), 'utf8');

  // « Autre appareil » : un navigateur vierge, avec son propre classeur.
  const { contexte: contexte2, page: page2 } = await ouvrirApplication(navigateur, serveur.url);
  await page2.keyboard.type('mon ancien travail');
  await page2.keyboard.press('Enter');
  await cliquerOutil(page2, '#bouton-importer');
  const choix = page2.waitForEvent('filechooser');
  await page2.click('#importer-classeur');
  await (await choix).setFiles({ name: telechargement.suggestedFilename(), mimeType: 'application/json', buffer: Buffer.from(contenu) });
  await page2.click('#fenetre-importer-classeur [data-fermer="remplacer"]');
  await page2.waitForFunction(() => /importé/.test(document.getElementById('message').textContent));

  // Identique : contenu, mise en forme, fusions, règles, feuille affichée…
  assert.equal(await json(page2), original);
  // … et l'affichage : zoom, thème, valeurs, couleurs conditionnelles, cellule fusionnée.
  assert.equal(await page2.evaluate(() => window.omniTableur.zoom.pourcent), 130);
  assert.equal(await page2.getAttribute('html', 'data-theme'), 'clair');
  assert.equal(await page2.textContent('.cellule-fusionnee'), 'Ventes du trimestre');
  assert.equal(await texteCellule(page2, 'D5'), '266');
  assert.equal(await page2.getAttribute(td(4, 4), 'data-fond'), 'vert'); // 216 > 100
  assert.equal(await page2.getAttribute(td(3, 4), 'data-fond'), null); // 50
  await page2.click('.onglet-feuille:text-is("Résumé")');
  assert.equal(await texteCellule(page2, 'B1'), '-99');
  // Et ce classeur importé est enregistré automatiquement, comme les autres.
  await page2.waitForFunction(() => document.getElementById('etat-sauvegarde').textContent === '✓ Enregistré');
  await page2.reload();
  await page2.waitForFunction(() => window.omniTableur !== undefined);
  assert.equal(await page2.inputValue('#titre'), 'Budget de l’association');
  assert.deepEqual(page.erreurs, []);
  assert.deepEqual(page2.erreurs, []);
  await contexte.close();
  await contexte2.close();
});

test('fichiers invalides (vide, texte, autre application, version inconnue) : message et classeur inchangé', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await construireClasseurComplet(page);
  const avant = await json(page);
  const valable = JSON.stringify({ format: 'omni-tableur/classeur', version: 1, feuilles: [{ nom: 'A', lignes: 10, colonnes: 5, cellules: {} }] });
  const cas = [
    [{ name: 'vide.json', mimeType: 'application/json', buffer: Buffer.alloc(0) }, /illisible/],
    [{ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('Liste de courses : pain, lait.') }, /illisible/],
    [{ name: 'agenda.json', mimeType: 'application/json', buffer: Buffer.from('{"evenements":[{"titre":"Réunion"}]}') }, /pas été créé par Omni-Tableur/],
    [{ name: 'futur.json', mimeType: 'application/json', buffer: Buffer.from(valable.replace('"version":1', '"version":2')) }, /version plus récente/],
  ];
  for (const [fichier, attendu] of cas) {
    await cliquerOutil(page, '#bouton-importer');
    const choix = page.waitForEvent('filechooser');
    await page.click('#importer-classeur');
    await (await choix).setFiles(fichier);
    await page.waitForSelector('#fenetre-erreur-fichier[open]');
    assert.match(await page.textContent('#texte-erreur-fichier'), attendu, fichier.name);
    await page.click('#fenetre-erreur-fichier [data-fermer]');
    assert.equal(await json(page), avant, `classeur inchangé après ${fichier.name}`);
  }
  assert.equal(await page.evaluate(() => window.omniTableur.classeur.peutAnnuler), true);
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('insérer et supprimer des lignes et des colonnes autour d’une cellule fusionnée, avec les boutons', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await page.evaluate(() => {
    const { classeur, feuille } = window.omniTableur;
    classeur.modifierCellules(feuille, [
      { adresse: 'B2', brut: 'Titre' },
      { adresse: 'B5', brut: 'sous le titre' },
      { adresse: 'F2', brut: '=B2' },
    ]);
    classeur.fusionner(feuille, { debut: { ligne: 2, colonne: 2 }, fin: { ligne: 3, colonne: 4 } });
  });
  const fusions = () => page.evaluate(() => window.omniTableur.feuille.fusions.map((f) => `${f.debut.ligne},${f.debut.colonne}:${f.fin.ligne},${f.fin.colonne}`));
  assert.deepEqual(await fusions(), ['2,2:3,4']);

  // Une ligne insérée au-dessus : la fusion descend.
  await page.click(td(1, 1));
  await cliquerOutil(page, '#bouton-inserer');
  await page.click('#inserer-lignes-dessus');
  assert.deepEqual(await fusions(), ['3,2:4,4']);
  assert.equal(await texteCellule(page, 'F3'), 'Titre'); // la formule a suivi

  // Une colonne insérée au milieu (après C) : la fusion s'élargit.
  await page.evaluate(() => window.omniTableur.selection.choisir(10, 3));
  await cliquerOutil(page, '#bouton-inserer');
  await page.click('#inserer-colonnes-droite');
  assert.deepEqual(await fusions(), ['3,2:4,5']);

  // La ligne du bas de la fusion supprimée : elle rétrécit, sans perdre son titre.
  await page.evaluate(() => window.omniTableur.selection.choisir(4, 8));
  await cliquerOutil(page, '#bouton-supprimer');
  await page.click('#supprimer-lignes');
  assert.deepEqual(await fusions(), ['3,2:3,5']);
  assert.equal(await page.textContent('.cellule-fusionnee'), 'Titre');
  assert.equal(await texteCellule(page, 'B5'), 'sous le titre');

  // Les colonnes B à E supprimées : la fusion disparaît avec elles, proprement.
  await page.evaluate(() => window.omniTableur.selection.choisirPlage({ debut: { ligne: 8, colonne: 2 }, fin: { ligne: 8, colonne: 5 } }));
  await cliquerOutil(page, '#bouton-supprimer');
  await page.click('#supprimer-colonnes');
  assert.deepEqual(await fusions(), []);
  assert.equal(await page.$('.cellule-fusionnee'), null);

  // Tout s'annule pas à pas.
  for (let i = 0; i < 4; i++) await page.click('#bouton-annuler');
  assert.deepEqual(await fusions(), ['2,2:3,4']);
  assert.equal(await page.textContent('.cellule-fusionnee'), 'Titre');
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});
