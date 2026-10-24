// Ajout 2c : rechercher et remplacer.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { creerClasseurDeTest } from './outils.mjs';
import { compterDans, motifRecherche, preparerRemplacements, rangSuivant, rechercher, remplacerDans } from '../../js/donnees/recherche.js';

const adresses = (resultats) => resultats.map((r) => `${r.feuille.nom}!${r.adresse}`);

/** Deux feuilles : « Ventes » (feuille 1) et « Stock ». */
function classeurExemple() {
  const t = creerClasseurDeTest({ A1: 'Total', B1: 'total des ventes', A2: 'Pomme', B2: '=SOMME(C1:C3)', C3: 'TOTAL TOTAL', A3: 'Café' });
  t.classeur.renommerFeuille(t.feuille, 'Ventes');
  const stock = t.classeur.ajouterFeuille({ nom: 'Stock' });
  t.classeur.modifierCellules(stock, [
    { adresse: 'A1', brut: 'Sous-total' },
    { adresse: 'B5', brut: 'cafe' },
  ]);
  return { ...t, stock };
}

describe('Rechercher', () => {
  test('sans respecter la casse : « total » trouve Total, total, TOTAL ; ordre de lecture', () => {
    const { classeur } = classeurExemple();
    const motif = motifRecherche('total');
    const resultats = rechercher(classeur, motif, [classeur.feuilles[0]]);
    assert.deepEqual(adresses(resultats), ['Ventes!A1', 'Ventes!B1', 'Ventes!C3']);
    assert.deepEqual(resultats.map((r) => r.nombre), [1, 1, 2]);
  });

  test('en respectant la casse', () => {
    const { classeur } = classeurExemple();
    const resultats = rechercher(classeur, motifRecherche('Total', { casse: true }), classeur.feuilles);
    assert.deepEqual(adresses(resultats), ['Ventes!A1']); // « Sous-total » a une minuscule
  });

  test('dans toutes les feuilles, dans l’ordre des onglets', () => {
    const { classeur } = classeurExemple();
    assert.deepEqual(adresses(rechercher(classeur, motifRecherche('TOTAL'), classeur.feuilles)), [
      'Ventes!A1',
      'Ventes!B1',
      'Ventes!C3',
      'Stock!A1',
    ]);
  });

  test('les accents comptent ; le texte des formules est cherché ; caractères spéciaux pris tels quels', () => {
    const { classeur } = classeurExemple();
    assert.deepEqual(adresses(rechercher(classeur, motifRecherche('café'), classeur.feuilles)), ['Ventes!A3']);
    assert.deepEqual(adresses(rechercher(classeur, motifRecherche('somme('), classeur.feuilles)), ['Ventes!B2']);
    assert.deepEqual(adresses(rechercher(classeur, motifRecherche('C1:C3)'), classeur.feuilles)), ['Ventes!B2']);
    assert.deepEqual(rechercher(classeur, motifRecherche('.*'), classeur.feuilles), []);
    assert.equal(motifRecherche(''), null);
  });

  test('« Suivant » : le résultat après la cellule active, puis retour au début', () => {
    const { classeur } = classeurExemple();
    const resultats = rechercher(classeur, motifRecherche('total'), classeur.feuilles);
    const rang = (rangFeuille, ligne, colonne) => rangSuivant(resultats, { rangFeuille, ligne, colonne });
    assert.equal(rang(0, 1, 1), 1); // après Ventes!A1 → Ventes!B1
    assert.equal(rang(0, 2, 5), 2); // Ventes!C3
    assert.equal(rang(0, 3, 3), 3); // passe à la feuille Stock
    assert.equal(rang(1, 1, 1), 0); // après le dernier : retour au premier
    assert.equal(rangSuivant([], { rangFeuille: 0, ligne: 1, colonne: 1 }), -1);
  });
});

describe('Remplacer', () => {
  test('toutes les apparitions dans une cellule, remplacement pris tel quel', () => {
    const motif = motifRecherche('total');
    assert.equal(remplacerDans('TOTAL Total total', motif, 'Somme'), 'Somme Somme Somme');
    assert.equal(remplacerDans('Total', motif, '$& et $1'), '$& et $1');
    assert.equal(compterDans('TOTAL Total total', motif), 3);
  });

  test('« Tout remplacer » dans toutes les feuilles : une seule étape d’annulation', () => {
    const { classeur, moteur, feuille, stock } = classeurExemple();
    const avant = JSON.stringify(classeur.versJSON());
    const motif = motifRecherche('total');
    const resultats = rechercher(classeur, motif, classeur.feuilles);
    const { liste, remplacements, cellules } = preparerRemplacements(resultats, motif, 'Somme');
    assert.equal(remplacements, 5);
    assert.equal(cellules, 4);
    assert.equal(classeur.modifierFeuilles(liste), true);
    assert.equal(feuille.brut('C3'), 'Somme Somme');
    assert.equal(feuille.brut('B1'), 'Somme des ventes');
    assert.equal(stock.brut('A1'), 'Sous-Somme');
    assert.equal(moteur.valeur(feuille, 'A1'), 'Somme');
    // Un seul « Annuler » remet les deux feuilles.
    classeur.annuler();
    assert.equal(JSON.stringify(classeur.versJSON()), avant);
    classeur.retablir();
    assert.equal(stock.brut('A1'), 'Sous-Somme');
  });

  test('remplacer dans une formule la recalcule ; remplacer par rien vide le texte (mise en forme gardée)', () => {
    const t = creerClasseurDeTest({ A1: '2', A2: '3', B1: '=SOMME(A1:A2)', C1: 'à effacer' });
    t.classeur.modifierCellules(t.feuille, [{ adresse: 'C1', gras: true }]);
    const motif = motifRecherche('SOMME');
    t.classeur.modifierFeuilles(preparerRemplacements(rechercher(t.classeur, motif, [t.feuille]), motif, 'MAX').liste);
    assert.equal(t.feuille.brut('B1'), '=MAX(A1:A2)');
    assert.equal(t.valeur('B1'), 3);
    const efface = motifRecherche('à effacer');
    t.classeur.modifierFeuilles(preparerRemplacements(rechercher(t.classeur, efface, [t.feuille]), efface, '').liste);
    assert.equal(t.feuille.brut('C1'), '');
    assert.equal(t.feuille.cellule('C1').gras, true);
  });
});
