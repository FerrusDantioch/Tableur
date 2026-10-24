// Ajout 2e : mise en forme conditionnelle.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { creerClasseurDeTest } from './outils.mjs';
import { Classeur } from '../../js/donnees/classeur.js';
import { nettoyerRegle, verifierRegle } from '../../js/donnees/regles.js';
import { couleursConditionnelles, regleVerifiee } from '../../js/calcul/conditions.js';
import { creerFichierClasseur, lireFichierClasseur } from '../../js/donnees/fichier-classeur.js';
import { presenter } from '../../js/affichage/format.js';

const regle = (type, valeur = '', valeur2 = '', plage = 'A1:A10') => nettoyerRegle({ plage, type, valeur, valeur2, fond: 'rouge' });
/** La règle s'applique-t-elle à cette valeur (texte affiché comme à l'écran) ? */
const verifie = (r, valeur, style) => regleVerifiee(r, valeur, presenter(valeur, style).texte);

describe('Conditions', () => {
  test('supérieure à, inférieure à, entre, négative : nombres à la française', () => {
    assert.equal(verifie(regle('superieur', '100'), 150), true);
    assert.equal(verifie(regle('superieur', '100'), 100), false);
    assert.equal(verifie(regle('superieur', '2,5'), 2.6), true);
    assert.equal(verifie(regle('superieur', '1 000'), 999), false);
    assert.equal(verifie(regle('inferieur', '20 %'), 0.1), true); // 20 % = 0,2
    assert.equal(verifie(regle('inferieur', '0'), -1), true);
    assert.equal(verifie(regle('entre', '10', '20'), 10), true); // bornes comprises
    assert.equal(verifie(regle('entre', '20', '10'), 15), true); // dans n'importe quel ordre
    assert.equal(verifie(regle('entre', '10', '20'), 21), false);
    assert.equal(verifie(regle('negatif'), -0.5), true);
    assert.equal(verifie(regle('negatif'), 0), false);
    // Comme Excel : 0,1 + 0,2 vaut bien 0,3.
    assert.equal(verifie(regle('superieur', '0,3'), 0.1 + 0.2), false);
    assert.equal(verifie(regle('egal', '0,3'), 0.1 + 0.2), true);
    // Une date est un nombre de jours : « après le 01/01/2026 ».
    assert.equal(verifie(regle('superieur', '01/01/2026'), 46300, 'date'), true);
  });

  test('du texte, une cellule vide ou en erreur ne respectent pas une condition sur les nombres', () => {
    const r = regle('superieur', '0');
    assert.equal(verifie(r, 'beaucoup'), false);
    assert.equal(verifie(r, null), false);
    assert.equal(regleVerifiee(r, { code: '#DIV/0!' }, '#DIV/0!'), false);
    assert.equal(verifie(regle('negatif'), true), false);
  });

  test('égale à (nombre ou texte) et contient le texte, sans tenir compte des majuscules', () => {
    assert.equal(verifie(regle('egal', '12'), 12), true);
    assert.equal(verifie(regle('egal', '12'), '12 pommes'), false);
    assert.equal(verifie(regle('egal', 'Payé'), 'payé'), true);
    assert.equal(verifie(regle('egal', 'payé'), 'paye'), false); // les accents comptent
    assert.equal(verifie(regle('egal', 'VRAI'), true), true);
    assert.equal(verifie(regle('contient', 'retard'), 'En RETARD de 3 jours'), true);
    assert.equal(verifie(regle('contient', 'retard'), 'à l’heure'), false);
    assert.equal(verifie(regle('contient', '2026'), 46319, 'date'), true); // 24/10/2026 affiché
  });

  test('plusieurs règles : pour chaque couleur, la première qui s’applique l’emporte', () => {
    const regles = [
      nettoyerRegle({ plage: 'A1:A10', type: 'superieur', valeur: '100', fond: 'rouge' }),
      nettoyerRegle({ plage: 'A1:A10', type: 'superieur', valeur: '50', fond: 'jaune', encre: 'bleu' }),
      nettoyerRegle({ plage: 'B1:B10', type: 'negatif', fond: 'gris' }),
    ];
    assert.deepEqual(couleursConditionnelles(regles, 2, 1, 150, '150'), { fond: 'rouge', encre: 'bleu' });
    assert.deepEqual(couleursConditionnelles(regles, 2, 1, 80, '80'), { fond: 'jaune', encre: 'bleu' });
    assert.deepEqual(couleursConditionnelles(regles, 2, 1, 10, '10'), { fond: null, encre: null });
    assert.deepEqual(couleursConditionnelles(regles, 20, 1, 150, '150'), { fond: null, encre: null }); // hors plage
  });

  test('règles incomplètes : messages clairs', () => {
    const base = { plage: 'B2:B20', type: 'superieur', valeur: '100', fond: 'rouge' };
    assert.equal(verifierRegle(base), null);
    assert.match(verifierRegle({ ...base, plage: 'B2:' }), /cellules concernées/);
    assert.match(verifierRegle({ ...base, valeur: 'cent' }), /Tapez un nombre/);
    assert.match(verifierRegle({ ...base, type: 'entre', valeur2: '' }), /second nombre/);
    assert.match(verifierRegle({ ...base, type: 'contient', valeur: ' ' }), /texte à chercher/);
    assert.match(verifierRegle({ ...base, fond: null, encre: null }), /couleur/);
    assert.match(verifierRegle({ ...base, fond: 'fuchsia' }), /Couleur inconnue/);
    assert.equal(verifierRegle({ ...base, type: 'negatif', valeur: '' }), null);
  });
});

describe('Règles dans le classeur', () => {
  test('création, modification, suppression ; recalcul quand une valeur change ; annulable', () => {
    const t = creerClasseurDeTest({ A1: '50', A2: '150', A3: '=A1*3' });
    const couleur = (adr) => {
      const { ligne, colonne } = { A1: { ligne: 1, colonne: 1 }, A2: { ligne: 2, colonne: 1 }, A3: { ligne: 3, colonne: 1 } }[adr];
      const valeur = t.valeur(adr);
      return couleursConditionnelles(t.feuille.regles, ligne, colonne, valeur, presenter(valeur).texte).fond;
    };
    const ajout = t.classeur.ajouterRegle(t.feuille, { plage: 'a1:a3', type: 'superieur', valeur: '100', fond: 'rouge' });
    assert.equal(ajout.ok, true);
    assert.equal(t.feuille.regles[0].plage, 'A1:A3');
    assert.deepEqual([couleur('A1'), couleur('A2'), couleur('A3')], [null, 'rouge', 'rouge']);
    // Une valeur change : la formule A3 aussi, et la couleur suit.
    t.remplir({ A1: '10' });
    assert.deepEqual([couleur('A1'), couleur('A2'), couleur('A3')], [null, 'rouge', null]);
    // Modification de la règle (même place, même numéro).
    assert.equal(t.classeur.modifierRegle(t.feuille, ajout.id, { plage: 'A1:A3', type: 'inferieur', valeur: '20', fond: 'vert' }).ok, true);
    assert.deepEqual([couleur('A1'), couleur('A2'), couleur('A3')], ['vert', null, null]); // 10 < 20 ; 150 et 30 non
    // Suppression, puis Annuler la remet.
    assert.equal(t.classeur.supprimerRegle(t.feuille, ajout.id), true);
    assert.equal(t.feuille.regles.length, 0);
    t.classeur.annuler();
    assert.equal(t.feuille.regles[0].type, 'inferieur');
    t.classeur.annuler();
    assert.equal(t.feuille.regles[0].type, 'superieur');
    assert.equal(t.classeur.ajouterRegle(t.feuille, { plage: 'A1', type: 'superieur', valeur: 'x', fond: 'rouge' }).ok, false);
  });

  test('insérer ou supprimer des lignes déplace les règles ; enregistrement et fichier .json', () => {
    const t = creerClasseurDeTest({ A2: '5' });
    t.classeur.ajouterRegle(t.feuille, { plage: 'A2:B5', type: 'negatif', encre: 'rouge' });
    t.classeur.ajouterRegle(t.feuille, { plage: 'D9', type: 'contient', valeur: 'ok', fond: 'vert' });
    t.classeur.inserer(t.feuille, 'lignes', 1, 2);
    assert.deepEqual(t.feuille.regles.map((r) => r.plage), ['A4:B7', 'D11']);
    t.classeur.supprimer(t.feuille, 'lignes', 11, 1);
    assert.deepEqual(t.feuille.regles.map((r) => r.plage), ['A4:B7']); // la règle de D11 a disparu avec sa ligne
    t.classeur.inserer(t.feuille, 'colonnes', 2, 1);
    assert.deepEqual(t.feuille.regles.map((r) => r.plage), ['A4:C7']);

    const donnees = t.classeur.versJSON();
    assert.deepEqual(donnees.feuilles[0].reglesConditionnelles, [{ id: 1, plage: 'A4:C7', type: 'negatif', encre: 'rouge' }]);
    const autre = new Classeur();
    autre.charger(JSON.parse(JSON.stringify(donnees)));
    assert.equal(autre.feuilles[0].regles[0].plage, 'A4:C7');

    const fichier = creerFichierClasseur(t.classeur);
    assert.equal(lireFichierClasseur(JSON.stringify(fichier)).ok, true);
    fichier.feuilles[0].reglesConditionnelles[0].type = 'clignote';
    const lu = lireFichierClasseur(JSON.stringify(fichier));
    assert.equal(lu.ok, false);
    assert.match(lu.message, /mise en forme conditionnelle impossible/);
  });
});
