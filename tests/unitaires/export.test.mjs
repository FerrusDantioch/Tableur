// Tests de l'export CSV (et du nom de fichier).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creerTableur } from './outils.mjs';
import { genererCSV } from '../../js/services/export-csv.js';
import { nomDeFichier } from '../../js/services/fichiers.js';

test('CSV : séparateur « ; », virgule décimale, résultats des formules', () => {
  const t = creerTableur({
    A1: 'Poste',
    B1: 'Montant',
    A2: 'Loyer',
    B2: '650,50 €',
    A3: 'Taux',
    B3: '20 %',
    A4: 'Total',
    B4: '=B2*2',
    C4: '=B2>100',
    D5: '=1/0',
  });
  const csv = genererCSV(t.feuille, t.moteur);
  assert.ok(csv.startsWith('﻿'), 'marque UTF-8 pour Excel');
  assert.equal(
    csv.slice(1),
    ['Poste;Montant;;', 'Loyer;650,5;;', 'Taux;0,2;;', 'Total;1301;VRAI;', ';;;#DIV/0!', ''].join('\r\n'),
  );
});

test('CSV : guillemets quand c’est nécessaire', () => {
  const t = creerTableur({ A1: 'a;b', B1: 'il dit "oui"', C1: ' espace', A2: 'é à ç €' });
  const lignes = genererCSV(t.feuille, t.moteur).slice(1).split('\r\n');
  assert.equal(lignes[0], '"a;b";"il dit ""oui""";" espace"');
  assert.equal(lignes[1], 'é à ç €;;');
});

test('CSV : classeur vide', () => {
  const t = creerTableur();
  assert.equal(genererCSV(t.feuille, t.moteur), '');
  // Une cellule seulement mise en forme ne compte pas.
  t.classeur.modifierCellules(t.feuille, [{ adresse: 'C3', gras: true }]);
  assert.equal(genererCSV(t.feuille, t.moteur), '');
});

test('nom de fichier', () => {
  assert.equal(nomDeFichier('Budget 2026'), 'Budget 2026');
  assert.equal(nomDeFichier('a/b:c*?"<>|d'), 'a b c d');
  assert.equal(nomDeFichier('   '), 'Sans titre');
});
