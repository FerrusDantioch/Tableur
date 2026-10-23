// Tests de la traduction des formules françaises et du décalage des références.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { decouper, nomsInconnus, traduireFormule } from '../../js/calcul/traduction.js';
import { decalerReferences } from '../../js/donnees/formules.js';

describe('Traduction vers la bibliothèque', () => {
  test('fonctions, séparateurs et nombres', () => {
    assert.equal(traduireFormule('=SOMME(A1:A10)'), 'SUM(A1:A10)');
    assert.equal(traduireFormule('=si(A1>0;"oui";"non")'), 'IF(A1>0,"oui","non")');
    assert.equal(traduireFormule('=ARRONDI(B2*1,5;2)'), 'ROUND(B2*1.5,2)');
    assert.equal(traduireFormule('=NB.SI(A1:A3;">5")'), 'NB.SI(A1:A3,">5")'); // inconnue : laissée telle quelle
    assert.equal(traduireFormule('=SOMME.SI(A1:A3;">5")'), 'SUMIF(A1:A3,">5")');
    assert.equal(traduireFormule('=ET(VRAI;faux)'), 'AND(TRUE,FALSE)');
    assert.equal(traduireFormule('= 1E3 + 2,5e-1'), ' 1000 + 0.25');
    assert.equal(traduireFormule('=SOMME (A1)'), 'SUM (A1)');
  });

  test('le texte entre guillemets n’est jamais modifié', () => {
    assert.equal(traduireFormule('="SOMME;1,5 VRAI"&A1'), '"SOMME;1,5 VRAI"&A1');
    assert.equal(traduireFormule('="il dit ""SI"""'), '"il dit ""SI"""');
  });

  test('recoller les morceaux redonne la formule', () => {
    for (const formule of ['SOMME(A1:B2;3,5)', '"a;b"&C3', "'Ma feuille'!A1", '-2^2%', 'SI(A1<>"";1;0)']) {
      assert.equal(
        decouper(formule)
          .map((j) => j.source)
          .join(''),
        formule,
      );
    }
  });

  test('noms inconnus', () => {
    assert.deepEqual(nomsInconnus('=total*2'), ['total']);
    assert.deepEqual(nomsInconnus('=SOMME(A:C)+$B$2+VRAI'), []);
    assert.deepEqual(nomsInconnus('=#REF!+1'), []);
  });
});

describe('Décalage des références (copier-coller)', () => {
  test('références relatives et absolues', () => {
    assert.equal(decalerReferences('=A1*2', 1, 0), '=A2*2');
    assert.equal(decalerReferences('=SOMME(A1:B2)', 2, 1), '=SOMME(B3:C4)');
    assert.equal(decalerReferences('=$A$1+A$1+$A1', 1, 1), '=$A$1+B$1+$A2');
    assert.equal(decalerReferences('=Z1', 0, 1), '=AA1');
    assert.equal(decalerReferences('=A1', -1, 0), '=#REF!');
    assert.equal(decalerReferences('=SOMME(A1;1,5)+"B2"', 1, 0), '=SOMME(A2;1,5)+"B2"');
    assert.equal(decalerReferences('texte A1', 1, 0), 'texte A1'); // pas une formule
  });
});

describe('Texte tabulé (coller depuis Excel ou une page web)', async () => {
  const { lireTexteTabule } = await import('../../js/affichage/presse-papiers.js');
  test('lignes, colonnes et guillemets', () => {
    assert.deepEqual(lireTexteTabule('a\tb\r\nc\td\r\n'), [
      ['a', 'b'],
      ['c', 'd'],
    ]);
    assert.deepEqual(lireTexteTabule('seul'), [['seul']]);
    assert.deepEqual(lireTexteTabule('"deux\nlignes"\tx'), [['deux\nlignes', 'x']]);
    assert.deepEqual(lireTexteTabule('"il dit ""oui"""'), [['il dit "oui"']]);
    assert.deepEqual(lireTexteTabule('a\t\tc'), [['a', '', 'c']]);
    assert.deepEqual(lireTexteTabule(''), []);
  });
});
