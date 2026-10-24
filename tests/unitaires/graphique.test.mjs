// Initiative : graphique simple. Lecture d'un tableau (catégories, séries),
// graduations « rondes » de l'axe et parts d'un camembert.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES_MAX, PARTS_MAX, SERIES_MAX, graduations, partsSecteurs, preparerGraphique } from '../../js/donnees/graphique.js';

/** Cellules { valeur, texte } à partir de valeurs simples (null : case vide). */
const cellules = (lignes) =>
  lignes.map((ligne) =>
    ligne.map((valeur) => ({ valeur, texte: valeur === null ? '' : typeof valeur === 'number' ? String(valeur).replace('.', ',') : valeur })),
  );

describe('Lire un tableau pour un graphique', () => {
  test('noms des catégories à gauche, noms des séries en haut', () => {
    const resultat = preparerGraphique(
      cellules([
        ['Mois', 'Courses', 'Loyer'],
        ['janvier', 120, 600],
        ['février', 95.5, 600],
        ['mars', 'oublié', 600],
      ]),
    );
    assert.equal(resultat.ok, true);
    assert.deepEqual(resultat.categories, ['janvier', 'février', 'mars']);
    assert.deepEqual(resultat.series, [
      { nom: 'Courses', valeurs: [120, 95.5, null] }, // du texte : un trou
      { nom: 'Loyer', valeurs: [600, 600, 600] },
    ]);
    assert.deepEqual(resultat.notes, []);
  });

  test('tableau en largeur : chaque ligne est une série', () => {
    const resultat = preparerGraphique(
      cellules([
        [null, 'janv.', 'févr.', 'mars', 'avril'],
        ['Pommes', 3, 5, 2, 8],
        ['Poires', 1, 2, 3, 4],
      ]),
    );
    assert.deepEqual(resultat.categories, ['janv.', 'févr.', 'mars', 'avril']);
    assert.deepEqual(resultat.series.map((s) => s.nom), ['Pommes', 'Poires']);
    assert.deepEqual(resultat.series[0].valeurs, [3, 5, 2, 8]);
  });

  test('sans titres : catégories numérotées, « Série 1 »', () => {
    const resultat = preparerGraphique(cellules([[4], [7], [1]]));
    assert.deepEqual(resultat.categories, ['1', '2', '3']);
    assert.deepEqual(resultat.series, [{ nom: 'Série 1', valeurs: [4, 7, 1] }]);
  });

  test('années à gauche sous un coin vide : ce sont des noms, pas une série', () => {
    const resultat = preparerGraphique(
      cellules([
        [null, 'Ventes'],
        [2024, 150],
        [2025, 210],
      ]),
    );
    assert.deepEqual(resultat.categories, ['2024', '2025']);
    assert.deepEqual(resultat.series, [{ nom: 'Ventes', valeurs: [150, 210] }]);
  });

  test('colonnes entières sélectionnées : les lignes et colonnes vides au bord sont ignorées', () => {
    const lignes = [
      [null, null, null, null],
      [null, 'Article', 'Prix', null],
      [null, 'Pain', 2, null],
      [null, 'Lait', 1.2, null],
    ];
    for (let i = 0; i < 200; i++) lignes.push([null, null, null, null]);
    const resultat = preparerGraphique(cellules(lignes));
    assert.deepEqual(resultat.categories, ['Pain', 'Lait']);
    assert.deepEqual(resultat.series, [{ nom: 'Prix', valeurs: [2, 1.2] }]);
  });

  test('une colonne de commentaires (sans nombre) est laissée de côté', () => {
    const resultat = preparerGraphique(
      cellules([
        ['Article', 'Note', 'Prix'],
        ['Pain', 'frais', 2],
        ['Lait', 'bio', 1.2],
      ]),
    );
    assert.deepEqual(resultat.series.map((s) => s.nom), ['Prix']);
  });

  test('rien à dessiner : message clair', () => {
    assert.match(preparerGraphique(cellules([[null, null], [null, null]])).message, /vides/);
    assert.match(preparerGraphique(cellules([['a', 'b'], ['c', 'd']])).message, /Aucun nombre/);
    assert.equal(preparerGraphique([]).ok, false);
  });

  test('trop de séries ou de lignes : on garde le début, avec une remarque', () => {
    const large = [['Nom', ...Array.from({ length: 10 }, (_, i) => `S${i + 1}`)]];
    for (let l = 0; l < 12; l++) large.push([`L${l}`, ...Array.from({ length: 10 }, () => l)]);
    const resultat = preparerGraphique(cellules(large));
    assert.equal(resultat.series.length, SERIES_MAX);
    assert.match(resultat.notes[0], /séries/);

    const long = Array.from({ length: CATEGORIES_MAX + 50 }, (_, i) => [`L${i}`, i]);
    const resultat2 = preparerGraphique(cellules(long));
    assert.equal(resultat2.categories.length, CATEGORIES_MAX);
    assert.equal(resultat2.series[0].valeurs.length, CATEGORIES_MAX);
    assert.match(resultat2.notes[0], /lignes/);
  });
});

describe('Graduations de l’axe', () => {
  test('des valeurs rondes, qui partent de zéro', () => {
    assert.deepEqual(graduations(80, 650).valeurs, [0, 200, 400, 600, 800]);
    assert.deepEqual(graduations(3, 9).valeurs, [0, 2, 4, 6, 8, 10]);
    assert.deepEqual(graduations(0.1, 0.9).valeurs, [0, 0.2, 0.4, 0.6, 0.8, 1]);
    assert.deepEqual(graduations(-35, 400).valeurs, [-100, 0, 100, 200, 300, 400]);
    assert.deepEqual(graduations(-50, -10).valeurs, [-50, -40, -30, -20, -10, 0]);
    assert.deepEqual(graduations(0, 0).valeurs, [0, 0.2, 0.4, 0.6, 0.8, 1]); // tout à zéro
    const grand = graduations(0, 1234567);
    assert.equal(grand.debut, 0);
    assert.ok(grand.fin >= 1234567 && grand.valeurs.length <= 7);
  });
});

describe('Parts d’un camembert', () => {
  test('la première série, en pourcentages', () => {
    const { parts, notes } = partsSecteurs({ categories: ['A', 'B', 'C'], series: [{ nom: 'X', valeurs: [50, 30, 20] }, { nom: 'Y', valeurs: [1, 1, 1] }] });
    assert.deepEqual(parts.map((p) => p.part), [0.5, 0.3, 0.2]);
    assert.match(notes[0], /qu'une série : « X »/);
  });

  test('valeurs négatives, nulles ou manquantes : laissées de côté', () => {
    const { parts, notes } = partsSecteurs({ categories: ['A', 'B', 'C', 'D'], series: [{ nom: 'X', valeurs: [10, -5, 0, null] }] });
    assert.deepEqual(parts.map((p) => p.nom), ['A']);
    assert.match(notes[0], /2 valeurs négatives ou nulles laissées de côté/);
  });

  test('trop de parts : les plus petites forment « Autres »', () => {
    const valeurs = [10, 1, 9, 2, 8, 3, 7, 4, 6];
    const categories = valeurs.map((_, i) => `C${i}`);
    const { parts } = partsSecteurs({ categories, series: [{ nom: 'X', valeurs }] });
    assert.equal(parts.length, PARTS_MAX);
    assert.equal(parts.at(-1).nom, 'Autres');
    assert.equal(parts.at(-1).valeur, 1 + 2 + 3); // les trois plus petites
    assert.deepEqual(parts.slice(0, -1).map((p) => p.nom), ['C0', 'C2', 'C4', 'C6', 'C7', 'C8']); // dans l'ordre du tableau
    assert.ok(Math.abs(parts.reduce((s, p) => s + p.part, 0) - 1) < 1e-12);
  });
});
