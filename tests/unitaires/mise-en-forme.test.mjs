// Étape 4 : mise en forme — formats de nombre, bordures, enregistrement de
// toute la mise en forme.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { creerClasseurDeTest } from './outils.mjs';
import { presenter, decimalesAffichees } from '../../js/affichage/format.js';
import { borduresADessiner, calculerBordures } from '../../js/donnees/bordures.js';
import { lirePlage } from '../../js/donnees/adresses.js';
import { Classeur } from '../../js/donnees/classeur.js';

/** Espaces fines insécables (séparateur des milliers en français) → espaces normales, pour comparer. */
const texte = (valeur, format, style) => presenter(valeur, style, format).texte.replace(/[\u202f\u00a0]/g, ' ');

describe('Formats de nombre', () => {
  test('nombre, euros, pourcentage, date, décimales', () => {
    assert.equal(texte(1234.5, { type: 'nombre', decimales: 2 }), '1 234,50');
    assert.equal(texte(1234.5, { type: 'nombre', decimales: 0 }), '1 235');
    assert.equal(texte(-3.14159, { type: 'nombre', decimales: 3 }), '-3,142');
    assert.equal(texte(1234.5, { type: 'euro', decimales: 2 }), '1 234,50 €');
    assert.equal(texte(0.125, { type: 'pourcent', decimales: 1 }), '12,5 %');
    assert.equal(texte(0.5, { type: 'pourcent', decimales: 0 }), '50 %');
    assert.equal(texte(46318, { type: 'date', decimales: 0 }), '23/10/2026');
    assert.equal(texte(-5, { type: 'date', decimales: 0 }), '#####'); // pas une date
    // Le format ne touche pas au texte ni aux VRAI/FAUX.
    assert.equal(texte('Bonjour', { type: 'euro', decimales: 2 }), 'Bonjour');
    assert.equal(texte(true, { type: 'nombre', decimales: 2 }), 'VRAI');
    // Format automatique : comme tapé.
    assert.equal(texte(0.2, null, 'pourcent'), '20 %');
    assert.equal(texte(12.5, null, 'euro'), '12,50 €');
  });

  test('décimales affichées (point de départ de « + décimale »)', () => {
    assert.equal(decimalesAffichees(2.567), 3);
    assert.equal(decimalesAffichees(12), 0);
    assert.equal(decimalesAffichees(12, 'euro'), 2);
    assert.equal(decimalesAffichees(1 / 3), 10);
  });

  test('le format ne change pas la valeur utilisée par les calculs', () => {
    const t = creerClasseurDeTest({ A1: '2,345' });
    t.classeur.modifierCellules(t.feuille, [{ adresse: 'A1', format: { type: 'nombre', decimales: 1 } }]);
    t.remplir({ B1: '=A1*1000' });
    assert.equal(t.valeur('A1'), 2.345);
    assert.equal(t.affiche('B1'), '2345');
  });
});

describe('Bordures', () => {
  const taille = { lignes: 100, colonnes: 26 };
  const fin = { style: 'fin', couleur: 'auto' };
  const epais = { style: 'epais', couleur: 'rouge' };

  /** Applique des bordures et renvoie une fonction pour lire ce qui sera dessiné. */
  function poser(t, plage, type, bordure) {
    t.classeur.modifierCellules(t.feuille, calculerBordures(lirePlage(plage), type, bordure, taille));
    return (adr) => {
      const { ligne, colonne } = lirePlage(adr).debut;
      return borduresADessiner((a) => t.feuille.cellule(a), ligne, colonne);
    };
  }
  const cotes = (bordures) => Object.keys(bordures ?? {}).sort().join(',');

  test('toutes les bordures : chaque cellule est encadrée', () => {
    const t = creerClasseurDeTest();
    const dessin = poser(t, 'B2:C3', 'toutes', fin);
    assert.deepEqual(t.feuille.cellule('B2').bordures, { haut: fin, bas: fin, gauche: fin, droite: fin });
    // B2 dessine son bas et sa droite ; son haut est dessiné par B1, sa gauche par A2.
    assert.equal(cotes(dessin('B2')), 'bas,droite');
    assert.equal(cotes(dessin('B1')), 'bas');
    assert.equal(cotes(dessin('A2')), 'droite');
    assert.equal(cotes(dessin('A3')), 'droite');
    assert.equal(cotes(dessin('D2')), ''); // à droite du tableau : rien à dessiner
  });

  test('bordure extérieure seulement', () => {
    const t = creerClasseurDeTest();
    const dessin = poser(t, 'B2:D4', 'exterieur', epais);
    assert.deepEqual(t.feuille.cellule('C3'), null); // la cellule du milieu n'a rien
    assert.deepEqual(t.feuille.cellule('B2').bordures, { haut: epais, gauche: epais });
    assert.deepEqual(t.feuille.cellule('D4').bordures, { bas: epais, droite: epais });
    assert.equal(cotes(dessin('C1')), 'bas');
    assert.equal(cotes(dessin('C4')), 'bas');
    assert.equal(cotes(dessin('C3')), '');
  });

  test('haut, bas, gauche, droite, puis aucune', () => {
    const t = creerClasseurDeTest();
    poser(t, 'A1:B1', 'bas', fin);
    assert.deepEqual(t.feuille.cellule('A1').bordures, { bas: fin });
    let dessin = poser(t, 'A1', 'haut', epais);
    assert.deepEqual(dessin('A1'), { haut: epais, bas: fin }); // ligne 1 : le haut est dessiné par la cellule
    poser(t, 'C1:C3', 'gauche', fin);
    poser(t, 'C1:C3', 'droite', fin);
    assert.deepEqual(t.feuille.cellule('C2').bordures, { gauche: fin, droite: fin });
    // « Aucune » sur A1:C3 efface tout, y compris ce que les voisines dessinaient vers la sélection.
    dessin = poser(t, 'A1:C3', 'aucune', fin);
    for (const adr of ['A1', 'B1', 'C2']) assert.equal(t.feuille.cellule(adr), null);
    assert.equal(dessin('A1'), null);
    // Une seule annulation remet les bordures.
    t.classeur.annuler();
    assert.deepEqual(t.feuille.cellule('C2').bordures, { gauche: fin, droite: fin });
  });

  test('la dernière bordure posée l’emporte sur celle de la voisine', () => {
    const t = creerClasseurDeTest();
    poser(t, 'A1', 'toutes', fin);
    const dessin = poser(t, 'A2', 'haut', epais);
    // Le bas de A1 (fin) a été effacé : c'est le haut épais de A2 qui se voit.
    assert.equal(t.feuille.cellule('A1').bordures.bas, undefined);
    assert.deepEqual(dessin('A1').bas, epais);
  });
});

describe('Toute la mise en forme est enregistrée', () => {
  test('gras, italique, couleurs, alignement, format, bordures, ligne figée', () => {
    const classeur = new Classeur({ titre: 'Mise en forme' });
    const feuille = classeur.feuilles[0];
    const bordures = { haut: { style: 'epais', couleur: 'bleu' }, bas: { style: 'fin', couleur: 'auto' } };
    classeur.modifierCellules(feuille, [
      {
        adresse: 'B2',
        brut: '12',
        gras: true,
        italique: true,
        couleur: 'rouge',
        fond: 'jaune',
        alignement: 'centre',
        format: { type: 'euro', decimales: 1 },
        bordures,
      },
    ]);
    classeur.figerPremiereLigne(feuille, true);
    const json = JSON.parse(JSON.stringify(classeur.versJSON()));
    assert.equal(json.version, 2);
    assert.deepEqual(json.feuilles[0].cellules.B2, {
      brut: '12',
      gras: true,
      italique: true,
      couleur: 'rouge',
      fond: 'jaune',
      alignement: 'centre',
      format: { type: 'euro', decimales: 1 },
      bordures,
    });
    const copie = new Classeur();
    copie.charger(json);
    const cellule = copie.feuilles[0].cellule('B2');
    assert.equal(cellule.italique, true);
    assert.equal(cellule.couleur, 'rouge');
    assert.deepEqual(cellule.format, { type: 'euro', decimales: 1 });
    assert.deepEqual(cellule.bordures, bordures);
    assert.equal(copie.feuilles[0].figee, true);
  });

  test('valeurs inconnues ignorées (fichier abîmé)', () => {
    const copie = new Classeur();
    copie.charger({
      format: 'tableur',
      version: 2,
      feuilles: [{ cellules: { A1: { brut: 'x', couleur: 'fluo', alignement: 'travers', format: { type: 'bizarre' }, bordures: { haut: { style: 'zigzag' }, milieu: {} } } } }],
    });
    const cellule = copie.feuilles[0].cellule('A1');
    assert.equal(cellule.couleur, null);
    assert.equal(cellule.alignement, null);
    assert.equal(cellule.format, null);
    assert.deepEqual(cellule.bordures, { haut: { style: 'fin', couleur: 'auto' } });
  });
});
