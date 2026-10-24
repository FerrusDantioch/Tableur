// Tests de l'étape « Édition » : recopie (poignée et Ctrl+D), insertion et
// suppression de lignes ou de colonnes, avec mise à jour des formules.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { creerClasseurDeTest } from './outils.mjs';
import { calculerRecopie } from '../../js/donnees/recopie.js';
import { lirePlage } from '../../js/donnees/adresses.js';

/** Recopie la plage `source` de `nombre` cellules dans une direction, puis renvoie les textes bruts obtenus. */
function recopier(t, source, direction, nombre, adresses) {
  const modifications = calculerRecopie(t.feuille, lirePlage(source), direction, nombre);
  t.classeur.modifierCellules(t.feuille, modifications);
  return adresses.map((adr) => t.feuille.brut(adr));
}

describe('Recopie (poignée de recopie)', () => {
  test('une formule recopiée adapte ses références', () => {
    const t = creerClasseurDeTest({ A1: '1', A2: '2', A3: '3', B1: '=A1*10' });
    assert.deepEqual(recopier(t, 'B1', 'bas', 2, ['B2', 'B3']), ['=A2*10', '=A3*10']);
    assert.deepEqual([t.affiche('B2'), t.affiche('B3')], ['20', '30']);
    // Références absolues : elles ne bougent pas.
    t.remplir({ C1: '=$A$1+A1' });
    assert.deepEqual(recopier(t, 'C1', 'droite', 2, ['D1', 'E1']), ['=$A$1+B1', '=$A$1+C1']);
    // Vers le haut.
    t.remplir({ F5: '=F6+1' });
    assert.deepEqual(recopier(t, 'F5', 'haut', 2, ['F4', 'F3']), ['=F5+1', '=F4+1']);
  });

  test('suites de nombres, de dates, de jours et de textes numérotés', () => {
    const t = creerClasseurDeTest({ A1: '1', A2: '2', B1: '10', B2: '20', C1: '5' });
    assert.deepEqual(recopier(t, 'A1:C2', 'bas', 3, ['A3', 'A4', 'A5', 'B3', 'B5', 'C3', 'C4']), ['3', '4', '5', '30', '50', '5', '']);
    // C1:C2 : un seul nombre (C1) puis une cellule vide → simple répétition.
    t.remplir({ D1: '0,5', D2: '1' });
    assert.deepEqual(recopier(t, 'D1:D2', 'bas', 2, ['D3', 'D4']), ['1,5', '2']);
    t.remplir({ E1: '31/12/2025' });
    assert.deepEqual(recopier(t, 'E1', 'bas', 2, ['E2', 'E3']), ['01/01/2026', '02/01/2026']);
    t.remplir({ F1: 'Lundi', G1: 'janvier', H1: 'Semaine 9', I1: 'bonjour' });
    assert.deepEqual(recopier(t, 'F1', 'bas', 7, ['F2', 'F7', 'F8']), ['Mardi', 'Dimanche', 'Lundi']);
    assert.deepEqual(recopier(t, 'G1', 'bas', 2, ['G2', 'G3']), ['février', 'mars']);
    assert.deepEqual(recopier(t, 'H1', 'bas', 2, ['H2', 'H3']), ['Semaine 10', 'Semaine 11']);
    assert.deepEqual(recopier(t, 'I1', 'bas', 2, ['I2', 'I3']), ['bonjour', 'bonjour']);
    t.remplir({ J1: '10 %', J2: '20 %' });
    assert.deepEqual(recopier(t, 'J1:J2', 'bas', 1, ['J3']), ['30 %']);
  });

  test('la mise en forme est recopiée, et tout s’annule d’un coup', () => {
    const t = creerClasseurDeTest();
    t.classeur.modifierCellules(t.feuille, [{ adresse: 'A1', brut: 'x', gras: true, fond: 'vert' }]);
    recopier(t, 'A1', 'bas', 3, []);
    assert.equal(t.feuille.cellule('A4').gras, true);
    assert.equal(t.feuille.cellule('A4').fond, 'vert');
    t.classeur.annuler();
    assert.equal(t.feuille.cellule('A2'), null);
  });

  test('sans suite (Ctrl+D) : simple copie', () => {
    const t = creerClasseurDeTest({ A1: '1', A2: '2' });
    const modifications = calculerRecopie(t.feuille, lirePlage('A1:A2'), 'bas', 2, { suites: false });
    assert.deepEqual(
      modifications.map((m) => m.brut),
      ['1', '2'],
    );
  });
});

describe('Insérer et supprimer des lignes et des colonnes', () => {
  test('insérer des lignes : les cellules descendent, les formules suivent', () => {
    const t = creerClasseurDeTest({ A1: '1', A2: '2', A3: '3', B1: '=SOMME(A1:A3)', B5: '=A3*2' });
    assert.equal(t.affiche('B1'), '6');
    const resultat = t.classeur.inserer(t.feuille, 'lignes', 2, 2);
    assert.deepEqual(resultat, { ok: true });
    assert.equal(t.feuille.brut('A2'), '');
    assert.equal(t.feuille.brut('A4'), '2');
    assert.equal(t.feuille.brut('B1'), '=SOMME(A1:A5)');
    assert.equal(t.feuille.brut('B7'), '=A5*2');
    assert.equal(t.feuille.lignes, 102);
    t.remplir({ A2: '10' });
    assert.equal(t.affiche('B1'), '16'); // la nouvelle ligne est dans la somme
    assert.equal(t.affiche('B7'), '6');
    // Annuler remet tout comme avant.
    t.classeur.annuler(); // la saisie de 10
    t.classeur.annuler(); // l'insertion
    assert.equal(t.feuille.brut('A2'), '2');
    assert.equal(t.feuille.brut('B1'), '=SOMME(A1:A3)');
    assert.equal(t.feuille.brut('B5'), '=A3*2');
    assert.equal(t.affiche('B1'), '6');
    t.classeur.retablir();
    assert.equal(t.feuille.brut('B7'), '=A5*2');
  });

  test('supprimer des lignes : #REF! si la cellule utilisée disparaît', () => {
    const t = creerClasseurDeTest({ A1: '1', A2: '2', A3: '3', A4: '4', B1: '=SOMME(A1:A4)', C1: '=A2', C2: '=A4' });
    t.classeur.supprimer(t.feuille, 'lignes', 2, 1);
    assert.equal(t.feuille.brut('A2'), '3');
    assert.equal(t.feuille.brut('B1'), '=SOMME(A1:A3)');
    assert.equal(t.affiche('B1'), '8');
    assert.equal(t.feuille.brut('C1'), '=#REF!');
    assert.equal(t.affiche('C1'), '#REF!');
    assert.equal(t.feuille.brut('C2'), ''); // C2 a été supprimée (ligne 2)
    assert.equal(t.feuille.brut('C1'), '=#REF!');
    assert.equal(t.feuille.lignes, 100); // la feuille garde sa taille
    t.classeur.annuler();
    assert.equal(t.feuille.brut('C1'), '=A2');
    assert.equal(t.affiche('C1'), '2');
  });

  test('insérer et supprimer des colonnes (avec les largeurs)', () => {
    const t = creerClasseurDeTest({ A1: '5', B1: '7', C1: '=A1+B1' });
    t.classeur.modifierLargeurs(t.feuille, [2], 160);
    t.classeur.inserer(t.feuille, 'colonnes', 2, 1);
    assert.equal(t.feuille.brut('C1'), '7');
    assert.equal(t.feuille.brut('D1'), '=A1+C1');
    assert.equal(t.feuille.largeur(3), 160);
    assert.equal(t.feuille.largeur(2), 100);
    assert.equal(t.affiche('D1'), '12');
    t.classeur.supprimer(t.feuille, 'colonnes', 1, 1);
    assert.equal(t.feuille.brut('C1'), '=#REF!+B1');
    assert.equal(t.affiche('C1'), '#REF!');
  });

  test('insertion refusée si des cellules sortiraient de la feuille', () => {
    const t = creerClasseurDeTest({ A1000: 'fin' });
    const resultat = t.classeur.inserer(t.feuille, 'lignes', 5, 1);
    assert.equal(resultat.ok, false);
    assert.match(resultat.message, /ligne 1000/);
    assert.equal(t.feuille.brut('A1000'), 'fin');
  });

  test('les formules des autres feuilles suivent aussi', () => {
    const t = creerClasseurDeTest({ A1: '1', A2: '2' });
    const bilan = t.classeur.ajouterFeuille({ nom: 'Bilan' });
    t.classeur.modifierCellules(bilan, [{ adresse: 'A1', brut: '=Feuille1!A2*100' }]);
    assert.equal(t.moteur.valeur(bilan, 'A1'), 200);
    t.classeur.inserer(t.feuille, 'lignes', 1, 3);
    assert.equal(bilan.brut('A1'), '=Feuille1!A5*100');
    assert.equal(t.moteur.valeur(bilan, 'A1'), 200);
  });
});
