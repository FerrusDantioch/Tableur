// Tests de la lecture et de la réécriture des références dans le texte des
// formules (recopie, insertion et suppression de lignes ou colonnes, feuilles).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ajusterReferences,
  decalerReferences,
  nomFeuillePourFormule,
  oublierFeuilleDansFormule,
  referencesDe,
  renommerFeuilleDansFormule,
} from '../../js/donnees/formules.js';

describe('Lecture des références', () => {
  test('cellules, plages, colonnes et lignes entières, autres feuilles', () => {
    const refs = referencesDe("=A1+$B$2*SOMME(C3:D4;E:E;2:3)+Feuille2!A1+'Mes données'!B1:B5");
    const textes = refs.map((r) => `${r.feuille ?? ''}|${r.debut.colonne},${r.debut.ligne}|${r.fin ? `${r.fin.colonne},${r.fin.ligne}` : '-'}`);
    assert.deepEqual(textes, ['|1,1|-', '|2,2|-', '|3,3|4,4', '|5,null|5,null', '|null,2|null,3', 'Feuille2|1,1|-', 'Mes données|2,1|2,5']);
  });

  test('le texte, les fonctions et les nombres ne sont pas des références', () => {
    assert.deepEqual(referencesDe('="A1"&SOMME(1;2)+LOG10(5)'), []);
    assert.deepEqual(referencesDe('=#REF!+1'), []);
  });

  test('nom de feuille dans une formule', () => {
    assert.equal(nomFeuillePourFormule('Feuille2'), 'Feuille2');
    assert.equal(nomFeuillePourFormule('Données'), 'Données');
    assert.equal(nomFeuillePourFormule('Ventes 2026'), "'Ventes 2026'");
    assert.equal(nomFeuillePourFormule("L'été"), "'L''été'");
    assert.equal(nomFeuillePourFormule('AB12'), "'AB12'"); // ressemblerait à une cellule
    assert.equal(nomFeuillePourFormule('2026'), "'2026'");
  });
});

describe('Recopie et copier-coller : décalage des références', () => {
  test('relatives, absolues, plages', () => {
    assert.equal(decalerReferences('=A1*2', 1, 0), '=A2*2');
    assert.equal(decalerReferences('=SOMME(A1:B2)', 2, 1), '=SOMME(B3:C4)');
    assert.equal(decalerReferences('=$A$1+A$1+$A1', 1, 1), '=$A$1+B$1+$A2');
    assert.equal(decalerReferences('=SOMME(A:A)', 5, 1), '=SOMME(B:B)'); // colonne entière
    assert.equal(decalerReferences('=Feuille2!A1', 1, 0), '=Feuille2!A2');
    assert.equal(decalerReferences("='Ma feuille'!$A1", 3, 3), "='Ma feuille'!$A4");
    assert.equal(decalerReferences('=A1', -1, 0), '=#REF!');
    assert.equal(decalerReferences('=AZ1', 0, 1), '=#REF!'); // au-delà de la dernière colonne
    assert.equal(decalerReferences('=A1&"B2"', 1, 0), '=A2&"B2"');
  });
});

describe('Insertion et suppression de lignes et colonnes', () => {
  const lignes = (type, position, nombre) => ({ feuille: 'Feuille1', axe: 'lignes', type, position, nombre });
  const colonnes = (type, position, nombre) => ({ feuille: 'Feuille1', axe: 'colonnes', type, position, nombre });
  const ajuster = (formule, changement, feuille = 'Feuille1') => ajusterReferences(formule, feuille, changement);

  test('insertion de lignes', () => {
    const inserer = lignes('insertion', 5, 2); // 2 lignes au-dessus de la ligne 5
    assert.equal(ajuster('=A4+A5+A10', inserer), '=A4+A7+A12');
    assert.equal(ajuster('=SOMME(A1:A10)', inserer), '=SOMME(A1:A12)'); // la plage s'agrandit
    assert.equal(ajuster('=SOMME(A5:A6)', inserer), '=SOMME(A7:A8)');
    assert.equal(ajuster('=SOMME(A1:A4)', inserer), '=SOMME(A1:A4)'); // au-dessus : rien ne change
    assert.equal(ajuster('=$A$5', inserer), '=$A$7'); // les « $ » suivent aussi la cellule
    assert.equal(ajuster('=SOMME(B:B)', inserer), '=SOMME(B:B)'); // colonne entière
    assert.equal(ajuster('=SOMME(3:6)', inserer), '=SOMME(3:8)'); // lignes entières
    assert.equal(ajuster('=A1000', inserer), '=#REF!'); // sortirait de la feuille
  });

  test('suppression de lignes', () => {
    const supprimer = lignes('suppression', 5, 2); // lignes 5 et 6 supprimées
    assert.equal(ajuster('=A4+A7', supprimer), '=A4+A5');
    assert.equal(ajuster('=A5*2', supprimer), '=#REF!*2');
    assert.equal(ajuster('=SOMME(A1:A10)', supprimer), '=SOMME(A1:A8)');
    assert.equal(ajuster('=SOMME(A5:A6)', supprimer), '=SOMME(#REF!)');
    assert.equal(ajuster('=SOMME(A6:A9)', supprimer), '=SOMME(A5:A7)');
    assert.equal(ajuster('=SOMME(A2:A5)', supprimer), '=SOMME(A2:A4)');
  });

  test('insertion et suppression de colonnes', () => {
    assert.equal(ajuster('=A1+B1+C1', colonnes('insertion', 2, 1)), '=A1+C1+D1');
    assert.equal(ajuster('=SOMME(A1:C1)', colonnes('insertion', 2, 1)), '=SOMME(A1:D1)');
    assert.equal(ajuster('=A1+B1+C1', colonnes('suppression', 2, 1)), '=A1+#REF!+B1');
    assert.equal(ajuster('=SOMME(B:D)', colonnes('suppression', 1, 1)), '=SOMME(A:C)');
  });

  test('seules les références vers la feuille modifiée changent', () => {
    const inserer = { feuille: 'Ventes', axe: 'lignes', type: 'insertion', position: 1, nombre: 1 };
    // Formule sur une autre feuille : A1 (sans nom) désigne sa propre feuille.
    assert.equal(ajuster('=A1+Ventes!A1+ventes!B2', inserer, 'Bilan'), '=A1+Ventes!A2+ventes!B3');
    // Formule sur la feuille Ventes elle-même.
    assert.equal(ajuster('=A1+Bilan!A1', inserer, 'Ventes'), '=A2+Bilan!A1');
  });
});

describe('Feuilles renommées ou supprimées', () => {
  test('renommer', () => {
    assert.equal(renommerFeuilleDansFormule('=Feuille2!A1+A1', 'Feuille2', 'Ventes 2026'), "='Ventes 2026'!A1+A1");
    assert.equal(renommerFeuilleDansFormule("='Ventes 2026'!A1", 'ventes 2026', 'Ventes'), '=Ventes!A1');
    assert.equal(renommerFeuilleDansFormule('=Autre!A1', 'Feuille2', 'X'), '=Autre!A1');
  });

  test('supprimer', () => {
    assert.equal(oublierFeuilleDansFormule('=Feuille2!A1+1', 'Feuille2'), '=#REF!+1');
    assert.equal(oublierFeuilleDansFormule('=SOMME(Feuille2!A1:B2)', 'feuille2'), '=SOMME(#REF!)');
  });
});
