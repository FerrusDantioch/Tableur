// Ajout 2e : fenêtre « Mise en forme conditionnelle ».

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { demarrerServeur, lancerNavigateur, ouvrirApplication, cliquerOutil } from './outils.mjs';

const td = (ligne, colonne) => `td[data-ligne="${ligne}"][data-colonne="${colonne}"]`;
const fond = (page, ligne, colonne) => page.getAttribute(td(ligne, colonne), 'data-fond');
const encre = (page, ligne, colonne) => page.getAttribute(td(ligne, colonne), 'data-encre');
const textesListe = (page) => page.$$eval('#liste-regles .texte-regle', (elements) => elements.map((e) => e.textContent));

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
    const contenus = { A1: 'Article', B1: 'Prix', C1: 'État', A2: 'Pain', B2: '2', C2: 'payé', A3: 'Vélo', B3: '150', C3: 'en retard', A4: 'Lampe', B4: '=B2*30', C4: 'payé' };
    classeur.modifierCellules(feuille, Object.entries(contenus).map(([adresse, brut]) => ({ adresse, brut })));
  });
}

test('créer, voir, modifier et supprimer des règles ; les couleurs suivent les valeurs', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await remplir(page);
  await page.evaluate(() => window.omniTableur.selection.choisirPlage({ debut: { ligne: 2, colonne: 2 }, fin: { ligne: 4, colonne: 2 } }));
  await cliquerOutil(page, '#bouton-conditions');
  await page.waitForSelector('#fenetre-conditions[open]');
  assert.equal(await page.inputValue('#regle-plage'), 'B2:B4'); // les cellules sélectionnées
  assert.equal(await page.isVisible('#aucune-regle'), true);

  // Règle 1 : prix supérieur à 100 → fond rouge (couleur proposée par défaut).
  await page.selectOption('#regle-type', 'superieur');
  await page.fill('#regle-valeur', '100');
  await page.click('#regle-enregistrer');
  assert.deepEqual(await textesListe(page), ['B2:B4 : si valeur supérieure à 100 → fond rouge']);

  // Règle 2 : la colonne C contient « retard » → texte orange, sans fond.
  await page.fill('#regle-plage', 'C2:C10');
  await page.selectOption('#regle-type', 'contient');
  await page.fill('#regle-valeur', 'retard');
  await page.click('#regle-fond .pastille.aucune');
  await page.click('#regle-encre .pastille[data-encre="orange"]');
  await page.click('#regle-enregistrer');
  assert.equal((await textesListe(page)).length, 2);
  await page.click('#fenetre-conditions [data-fermer]');

  assert.equal(await fond(page, 2, 2), null); // 2
  assert.equal(await fond(page, 3, 2), 'rouge'); // 150
  assert.equal(await fond(page, 4, 2), null); // =B2*30 = 60
  assert.equal(await encre(page, 3, 3), 'orange');
  assert.equal(await encre(page, 2, 3), null);

  // B2 passe à 5 : la formule B4 vaut 150 et devient rouge toute seule.
  await page.click(td(2, 2));
  await page.keyboard.type('5');
  await page.keyboard.press('Enter');
  assert.equal(await fond(page, 4, 2), 'rouge');

  // Modifier la règle 1 : supérieur à 149 → fond jaune ; B4 (150) reste colorée, en jaune.
  await cliquerOutil(page, '#bouton-conditions');
  await page.click('#liste-regles li:nth-child(1) button:text("Modifier")');
  assert.equal(await page.inputValue('#regle-valeur'), '100');
  assert.equal(await page.textContent('#regle-enregistrer'), 'Enregistrer');
  await page.fill('#regle-valeur', '149,5');
  await page.click('#regle-fond .pastille[data-fond="jaune"]');
  await page.click('#regle-enregistrer');
  assert.equal((await textesListe(page))[0], 'B2:B4 : si valeur supérieure à 149,5 → fond jaune');
  // Supprimer la règle 2.
  await page.click('#liste-regles li:nth-child(2) button:text("Supprimer")');
  assert.equal((await textesListe(page)).length, 1);
  await page.click('#fenetre-conditions [data-fermer]');
  assert.equal(await fond(page, 4, 2), 'jaune');
  assert.equal(await encre(page, 3, 3), null);

  // « Annuler » remet la règle supprimée.
  await page.click('#bouton-annuler');
  assert.equal(await encre(page, 3, 3), 'orange');
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('règle incomplète : message clair, rien n’est ajouté', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await cliquerOutil(page, '#bouton-conditions');
  await page.selectOption('#regle-type', 'superieur');
  await page.fill('#regle-valeur', 'cent');
  await page.click('#regle-enregistrer');
  assert.match(await page.textContent('#erreur-regle'), /Tapez un nombre/);
  await page.selectOption('#regle-type', 'entre');
  assert.equal(await page.isVisible('#regle-valeur2'), true);
  await page.selectOption('#regle-type', 'negatif');
  assert.equal(await page.isVisible('#regle-valeur'), false);
  await page.click('#regle-fond .pastille.aucune');
  await page.click('#regle-enregistrer');
  assert.match(await page.textContent('#erreur-regle'), /Choisissez une couleur/);
  assert.equal(await page.evaluate(() => window.omniTableur.feuille.regles.length), 0);
  await contexte.close();
});

test('les couleurs conditionnelles sont dans le PDF', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await remplir(page);
  await page.evaluate(() => {
    const { classeur, feuille } = window.omniTableur;
    classeur.ajouterRegle(feuille, { plage: 'B2:B4', type: 'superieur', valeur: '100', fond: 'rouge', encre: 'bleu' });
  });
  const cellule = await page.evaluate(() => {
    window.omniTableur.exportPdf.preparer();
    const td = document.querySelectorAll('#impression tr')[2].cells[1];
    const resultat = { texte: td.textContent, fond: td.dataset.fond, encre: td.dataset.encre };
    window.omniTableur.exportPdf.terminer();
    return resultat;
  });
  assert.deepEqual(cellule, { texte: '150', fond: 'rouge', encre: 'bleu' });
  await contexte.close();
});

test('au doigt, sur un téléphone : la fenêtre tient dans l’écran', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url, {
    viewport: { width: 360, height: 740 },
    hasTouch: true,
    isMobile: true,
  });
  await remplir(page);
  await page.evaluate(() => window.omniTableur.selection.choisirPlage({ debut: { ligne: 2, colonne: 2 }, fin: { ligne: 4, colonne: 2 } }));
  await cliquerOutil(page, '#bouton-conditions', { doigt: true });
  await page.waitForSelector('#fenetre-conditions[open]');
  const boite = await page.evaluate(() => document.getElementById('fenetre-conditions').getBoundingClientRect().toJSON());
  assert.ok(boite.left >= 0 && boite.right <= 360, `fenêtre dans l'écran (${boite.left} → ${boite.right})`);
  await page.fill('#regle-valeur', '100');
  await page.tap('#regle-fond .pastille[data-fond="vert"]');
  await page.tap('#regle-enregistrer');
  assert.equal((await textesListe(page)).length, 1);
  await page.tap('#fenetre-conditions [data-fermer]');
  assert.equal(await fond(page, 3, 2), 'vert');
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});
