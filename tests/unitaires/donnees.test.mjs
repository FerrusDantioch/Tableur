// Tests de la couche « données » : adresses, interprétation de la saisie, classeur.
// Lancement : npm test   (ou : node --test tests/unitaires/)

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  adresse,
  dansPlage,
  lettresColonne,
  lireAdresse,
  lirePlage,
  numeroColonne,
  textePlage,
} from '../../js/donnees/adresses.js';
import { interpreterSaisie, lireNombre } from '../../js/donnees/saisie.js';
import { Classeur, Feuille, LIGNES_MAX } from '../../js/donnees/classeur.js';

/** Une cellule complète, telle que la rend le classeur (mise en forme par défaut sinon). */
const cellule = (proprietes) => ({
  brut: '',
  gras: false,
  italique: false,
  couleur: null,
  fond: null,
  alignement: null,
  format: null,
  bordures: null,
  ...proprietes,
});

describe('Adresses', () => {
  test('lettres de colonnes', () => {
    assert.equal(lettresColonne(1), 'A');
    assert.equal(lettresColonne(26), 'Z');
    assert.equal(lettresColonne(27), 'AA');
    assert.equal(lettresColonne(52), 'AZ');
    assert.equal(lettresColonne(703), 'AAA');
    for (let n = 1; n <= 800; n++) assert.equal(numeroColonne(lettresColonne(n)), n);
    assert.equal(numeroColonne('a'), 1);
    assert.equal(numeroColonne('A1'), 0);
  });

  test('lecture et écriture des adresses et des plages', () => {
    assert.equal(adresse(3, 2), 'B3');
    assert.deepEqual(lireAdresse('B3'), { ligne: 3, colonne: 2 });
    assert.deepEqual(lireAdresse(' $c$10 '), { ligne: 10, colonne: 3 });
    assert.equal(lireAdresse('A0'), null);
    assert.equal(lireAdresse('3B'), null);
    assert.equal(lireAdresse(''), null);
    const plage = lirePlage('C3:A1');
    assert.deepEqual(plage, { debut: { ligne: 1, colonne: 1 }, fin: { ligne: 3, colonne: 3 } });
    assert.equal(textePlage(plage), 'A1:C3');
    assert.equal(textePlage(lirePlage('B2')), 'B2');
    assert.ok(dansPlage(plage, 2, 2));
    assert.ok(!dansPlage(plage, 4, 1));
    assert.equal(lirePlage('A1:B2:C3'), null);
  });
});

describe('Interprétation de la saisie', () => {
  test('nombres à la française et à l’anglaise', () => {
    assert.equal(lireNombre('12'), 12);
    assert.equal(lireNombre('-7'), -7);
    assert.equal(lireNombre('3,5'), 3.5);
    assert.equal(lireNombre('3.5'), 3.5);
    assert.equal(lireNombre('1 234,56'), 1234.56);
    assert.equal(lireNombre('1 234'), 1234);
    assert.equal(lireNombre(',5'), 0.5);
    assert.equal(lireNombre('2,'), 2);
    assert.equal(lireNombre('1E3'), 1000);
    assert.equal(lireNombre('1,5e-2'), 0.015);
    for (const pasNombre of ['', 'abc', '1 2', '12a', '1.234.567', ',', '+', 'E3', '1,2,3']) {
      assert.equal(lireNombre(pasNombre), null, `« ${pasNombre} » n'est pas un nombre`);
    }
  });

  test('types de contenu', () => {
    assert.deepEqual(interpreterSaisie(''), { type: 'vide', valeur: null, style: 'general' });
    assert.deepEqual(interpreterSaisie('   '), { type: 'vide', valeur: null, style: 'general' });
    assert.deepEqual(interpreterSaisie('Bonjour'), { type: 'texte', valeur: 'Bonjour', style: 'general' });
    assert.deepEqual(interpreterSaisie(' 42 '), { type: 'nombre', valeur: 42, style: 'general' });
    assert.deepEqual(interpreterSaisie("'0123"), { type: 'texte', valeur: '0123', style: 'general' });
    assert.deepEqual(interpreterSaisie('vrai'), { type: 'booleen', valeur: true, style: 'general' });
    assert.deepEqual(interpreterSaisie('FAUX'), { type: 'booleen', valeur: false, style: 'general' });
    assert.deepEqual(interpreterSaisie('20 %'), { type: 'nombre', valeur: 0.2, style: 'pourcent' });
    assert.deepEqual(interpreterSaisie('12,50 €'), { type: 'nombre', valeur: 12.5, style: 'euro' });
    assert.deepEqual(interpreterSaisie('12€'), { type: 'nombre', valeur: 12, style: 'euro' });
    assert.equal(interpreterSaisie('%').type, 'texte');
    const formule = interpreterSaisie(' =A1+B2');
    assert.equal(formule.type, 'formule');
    assert.equal(formule.formule, '=A1+B2');
  });
});

describe('Classeur', () => {
  test('modifier, annuler, rétablir', () => {
    const classeur = new Classeur();
    const feuille = classeur.feuilles[0];
    const evenements = [];
    classeur.abonner((e) => evenements.push(e));

    assert.equal(classeur.modifierCellules(feuille, [{ adresse: 'A1', brut: 'un' }]), true);
    assert.equal(feuille.brut('A1'), 'un');
    assert.deepEqual(evenements[0], { type: 'cellules', feuille, adresses: ['A1'], contenus: ['A1'] });

    // Une modification qui ne change rien n'est pas mémorisée.
    assert.equal(classeur.modifierCellules(feuille, [{ adresse: 'A1', brut: 'un' }]), false);

    // Mise en forme seule : la cellule change mais pas son contenu.
    classeur.modifierCellules(feuille, [{ adresse: 'A1', gras: true }]);
    assert.deepEqual(feuille.cellule('A1'), cellule({ brut: 'un', gras: true }));
    assert.deepEqual(evenements.at(-2).contenus, []);

    classeur.modifierCellules(feuille, [
      { adresse: 'A1', brut: 'deux' },
      { adresse: 'B5', brut: '5' },
    ]);
    assert.equal(feuille.brut('B5'), '5');
    classeur.annuler();
    assert.equal(feuille.brut('A1'), 'un');
    assert.equal(feuille.cellule('B5'), null);
    classeur.retablir();
    assert.equal(feuille.brut('A1'), 'deux');
    assert.equal(feuille.brut('B5'), '5');
    classeur.annuler();
    classeur.annuler(); // annule le gras
    assert.equal(feuille.cellule('A1').gras, false);
    classeur.annuler();
    assert.equal(feuille.cellule('A1'), null);
    assert.equal(classeur.peutAnnuler, false);
    assert.equal(classeur.annuler(), null);
  });

  test('largeurs, agrandissement et vidage', () => {
    const classeur = new Classeur();
    const feuille = classeur.feuilles[0];
    classeur.modifierLargeurs(feuille, [1, 2], 150);
    assert.equal(feuille.largeur(1), 150);
    assert.equal(feuille.largeur(3), 100);
    classeur.modifierLargeurs(feuille, [1], 5000); // bornée au maximum
    assert.equal(feuille.largeur(1), 600);
    classeur.annuler();
    assert.equal(feuille.largeur(1), 150);

    classeur.agrandir(feuille, { lignes: 50, colonnes: 5 });
    assert.equal(feuille.lignes, 150);
    assert.equal(feuille.colonnes, 31);
    classeur.agrandir(feuille, { lignes: 5000 });
    assert.equal(feuille.lignes, LIGNES_MAX);
    classeur.annuler();
    classeur.annuler();
    assert.equal(feuille.lignes, 100);

    classeur.modifierCellules(feuille, [{ adresse: 'C3', brut: 'x', fond: 'jaune' }]);
    classeur.viderFeuille(feuille);
    assert.equal(feuille.cellule('C3'), null);
    assert.equal(feuille.largeur(2), 100);
    classeur.annuler();
    assert.deepEqual(feuille.cellule('C3'), cellule({ brut: 'x', fond: 'jaune' }));
    assert.equal(feuille.largeur(2), 150);
  });

  test('étendue utilisée', () => {
    const feuille = new Feuille();
    assert.deepEqual(feuille.etendue(), { lignes: 0, colonnes: 0 });
    feuille.poser('C2', { brut: 'x' });
    feuille.poser('A7', { brut: '1' });
    feuille.poser('F1', { brut: '', gras: true }); // mise en forme seule : ne compte pas
    assert.deepEqual(feuille.etendue(), { lignes: 7, colonnes: 3 });
  });

  test('enregistrement et rechargement (JSON)', () => {
    const classeur = new Classeur({ titre: 'Budget' });
    const feuille = classeur.feuilles[0];
    classeur.modifierCellules(feuille, [
      { adresse: 'A1', brut: 'Total', gras: true, fond: 'bleu' },
      { adresse: 'B1', brut: '=SOMME(B2:B5)' },
    ]);
    classeur.modifierLargeurs(feuille, [2], 180);
    const json = JSON.parse(JSON.stringify(classeur.versJSON()));
    assert.equal(json.titre, 'Budget');
    assert.deepEqual(json.feuilles[0].cellules.A1, { brut: 'Total', gras: true, fond: 'bleu' });
    assert.deepEqual(json.feuilles[0].largeurs, { B: 180 });

    const copie = new Classeur();
    const feuilleCopie = copie.feuilles[0];
    copie.charger(json);
    assert.equal(copie.feuilles[0], feuilleCopie, 'la même feuille est réutilisée');
    assert.equal(copie.titre, 'Budget');
    assert.equal(feuilleCopie.brut('B1'), '=SOMME(B2:B5)');
    assert.equal(feuilleCopie.largeur(2), 180);
    assert.equal(copie.peutAnnuler, false);

    // Données abîmées : on garde ce qui est valable.
    copie.charger({
      format: 'tableur',
      feuilles: [{ lignes: 'x', cellules: { a1: { brut: 'ok', fond: 'fluo' }, ZZZ9999: { brut: 'trop loin' } } }],
    });
    assert.deepEqual(feuilleCopie.cellule('A1'), cellule({ brut: 'ok' }));
    assert.equal(feuilleCopie.lignes, 100);
    assert.throws(() => copie.charger({ format: 'autre' }));
  });
});
