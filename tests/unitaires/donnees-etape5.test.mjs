// Étape 5 : tri, import CSV, feuilles (onglets), première ligne figée.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { creerTableur } from './outils.mjs';
import { ordreDeTri, sembleTitres, zoneAutour } from '../../js/donnees/tri.js';
import { decoderFichier, detecterSeparateur, feuilleDepuisCSV, lireCSV, nomDepuisFichier } from '../../js/services/import-csv.js';
import { genererCSV } from '../../js/services/export-csv.js';
import { lirePlage } from '../../js/donnees/adresses.js';

describe('Tri', () => {
  test('ordre croissant et décroissant, vides à la fin', () => {
    const cles = [3, 'banane', null, 1, 'Abricot', true, 'article 10', 'article 2', 2.5, ''];
    const croissant = ordreDeTri(cles, true).map((i) => cles[i]);
    assert.deepEqual(croissant, [1, 2.5, 3, 'Abricot', 'article 2', 'article 10', 'banane', true, null, '']);
    const decroissant = ordreDeTri(cles, false).map((i) => cles[i]);
    assert.deepEqual(decroissant, [true, 'banane', 'article 10', 'article 2', 'Abricot', 3, 2.5, 1, null, '']);
    // Égalités : l'ordre d'avant est gardé (tri « stable »).
    assert.deepEqual(ordreDeTri(['b', 'a', 'B', 'A']), [1, 3, 0, 2]);
  });

  test('le tableau autour de la cellule active', () => {
    const t = creerTableur({ B2: 'Nom', C2: 'Âge', B3: 'Léa', C3: '30', B4: 'Paul', D4: 'x', F8: 'loin' });
    const zone = zoneAutour((a) => t.feuille.brut(a), t.feuille, 3, 2);
    assert.deepEqual(zone, lirePlage('B2:D4')); // D4 touche le tableau, F8 non
    assert.equal(zoneAutour((a) => t.feuille.brut(a), t.feuille, 20, 20), null);
  });

  test('ligne de titres reconnue', () => {
    const t = creerTableur({ A1: 'Article', B1: 'Prix', A2: 'Pomme', B2: '2' });
    const valeur = (a) => t.valeur(a);
    const cellule = (a) => t.feuille.cellule(a);
    assert.equal(sembleTitres(valeur, cellule, lirePlage('A1:B2'), 2), true); // « Prix » au-dessus d'un nombre
    assert.equal(sembleTitres(valeur, cellule, lirePlage('A1:B2'), 1), true); // la colonne B le montre aussi
    assert.equal(sembleTitres(valeur, cellule, lirePlage('A1:A2'), 1), false); // deux textes : rien ne le montre
    t.classeur.modifierCellules(t.feuille, [{ adresse: 'A1', gras: true }]);
    assert.equal(sembleTitres(valeur, cellule, lirePlage('A1:A2'), 1), true); // titre en gras
  });

  test('trier des lignes : la mise en forme suit, les formules s’adaptent, Annuler remet l’ordre', () => {
    const t = creerTableur({ A1: 'Poire', B1: '3', C1: '=B1*2', A2: 'Pomme', B2: '1', C2: '=B2*2', A3: 'Kiwi', B3: '2', C3: '=B3*2', E1: 'à côté' });
    t.classeur.modifierCellules(t.feuille, [{ adresse: 'A2', gras: true }]);
    const zone = lirePlage('A1:C3');
    const cles = [1, 2, 3].map((l) => t.valeur(`B${l}`));
    const ordre = ordreDeTri(cles, true).map((i) => i + 1);
    assert.deepEqual(ordre, [2, 3, 1]);
    assert.equal(t.classeur.reordonnerLignes(t.feuille, zone, ordre), true);
    assert.deepEqual(['A1', 'A2', 'A3'].map((a) => t.feuille.brut(a)), ['Pomme', 'Kiwi', 'Poire']);
    assert.equal(t.feuille.cellule('A1').gras, true); // la mise en forme a suivi
    assert.equal(t.feuille.brut('C1'), '=B1*2'); // la formule de Pomme (ligne 2 → 1) s'est adaptée
    assert.equal(t.affiche('C3'), '6');
    assert.equal(t.feuille.brut('E1'), 'à côté'); // hors de la zone : rien ne bouge
    t.classeur.annuler();
    assert.deepEqual(['A1', 'A2', 'A3'].map((a) => t.feuille.brut(a)), ['Poire', 'Pomme', 'Kiwi']);
    assert.equal(t.feuille.brut('C2'), '=B2*2');
  });
});

describe('Import CSV', () => {
  test('séparateur détecté, guillemets, accents, retours à la ligne', () => {
    assert.equal(detecterSeparateur('a;b;c\n1;2;3'), ';');
    assert.equal(detecterSeparateur('a,b,c\n1,2,3'), ',');
    assert.equal(detecterSeparateur('a\tb\n1\t2'), '\t');
    assert.equal(detecterSeparateur('Nom;Prix\n"Dupont, Jean";12,5'), ';'); // la virgule est dans un champ
    assert.deepEqual(lireCSV('a;"b;c";"il dit ""oui"""\r\n"deux\nlignes";x', ';'), [
      ['a', 'b;c', 'il dit "oui"'],
      ['deux\nlignes', 'x'],
    ]);
  });

  test('UTF-8 (avec ou sans marque) et ancien format Windows', () => {
    const utf8 = new TextEncoder().encode('﻿Été;Noël');
    assert.equal(decoderFichier(utf8), 'Été;Noël');
    const windows = new Uint8Array([0xc9, 0x74, 0xe9, 0x3b, 0x4e, 0x6f, 0xeb, 0x6c]); // « Été;Noël » en Windows-1252
    assert.equal(decoderFichier(windows), 'Été;Noël');
  });

  test('contenu de la feuille importée', () => {
    const resultat = feuilleDepuisCSV('Article;Prix;Date\nPomme;2,5;01/02/2026\nPoire;3.5;\n=SOMME(A1);"x";\n\n');
    assert.equal(resultat.lignes, 4);
    assert.equal(resultat.colonnes, 3);
    assert.equal(resultat.tronque, false);
    const { cellules } = resultat.donnees;
    assert.equal(cellules.B2.brut, '2,5');
    assert.equal(cellules.B3.brut, '3.5');
    assert.equal(cellules.A4.brut, "'=SOMME(A1)"); // jamais exécuté comme une formule
    assert.equal(cellules.C3, undefined);
    // Les valeurs deviennent des nombres et des dates dans le classeur.
    const t = creerTableur();
    const feuille = t.classeur.ajouterFeuille({ nom: 'Import', donnees: resultat.donnees });
    assert.equal(t.moteur.valeur(feuille, 'B2'), 2.5);
    assert.equal(t.moteur.valeur(feuille, 'B3'), 3.5);
    assert.equal(t.moteur.valeur(feuille, 'C2'), 46054);
    assert.equal(t.moteur.valeur(feuille, 'A4'), '=SOMME(A1)');
  });

  test('aller-retour : export CSV puis import donne les mêmes valeurs', () => {
    const t = creerTableur({ A1: 'Libellé', B1: 'Montant', A2: 'Café ; thé', B2: '3,5', A3: 'Il dit "oui"', B3: '=B2*2', A4: 'Total', B4: '=SOMME(B2:B3)' });
    const csv = genererCSV(t.feuille, t.moteur);
    const resultat = feuilleDepuisCSV(decoderFichier(new TextEncoder().encode(csv)));
    const feuille = t.classeur.ajouterFeuille({ nom: 'Retour', donnees: resultat.donnees });
    for (const adr of ['A1', 'A2', 'A3', 'B2', 'B3', 'B4']) {
      assert.deepEqual(t.moteur.valeur(feuille, adr), t.moteur.valeur(t.feuille, adr), `${adr} identique après l'aller-retour`);
    }
  });

  test('export CSV : les dates restent des dates (jj/mm/aaaa)', () => {
    const t = creerTableur({ A1: '14/07/2026', B1: '46318', C1: '=A1+1', D1: '20 %' });
    t.classeur.modifierCellules(t.feuille, [{ adresse: 'B1', format: { type: 'date', decimales: 0 } }, { adresse: 'C1', format: { type: 'date', decimales: 0 } }]);
    const csv = genererCSV(t.feuille, t.moteur);
    assert.equal(csv.replace(/^\uFEFF/, '').trim(), '14/07/2026;23/10/2026;15/07/2026;0,2');
  });

  test('fichier trop grand : coupé à 1000 lignes et 52 colonnes', () => {
    const lignes = Array.from({ length: 1200 }, (_, i) => Array.from({ length: 60 }, (__, j) => `${i}-${j}`).join(';'));
    const resultat = feuilleDepuisCSV(lignes.join('\n'));
    assert.equal(resultat.tronque, true);
    assert.equal(resultat.lignes, 1000);
    assert.equal(resultat.colonnes, 52);
  });

  test('nom de la feuille tiré du nom du fichier', () => {
    assert.equal(nomDepuisFichier('Relevé mars.csv'), 'Relevé mars');
    assert.equal(nomDepuisFichier('a/b:c*.csv'), 'a b c');
    assert.equal(nomDepuisFichier('.csv'), 'Import');
    assert.equal(nomDepuisFichier(`${'x'.repeat(40)}.csv`).length, 31);
  });
});

describe('Feuilles (onglets)', () => {
  test('ajouter, renommer, supprimer, avec annulation', () => {
    const t = creerTableur({ A1: 'un' });
    const evenements = [];
    t.classeur.abonner((e) => evenements.push(e.type));
    const deux = t.classeur.ajouterFeuille();
    assert.equal(deux.nom, 'Feuille2');
    assert.equal(t.classeur.feuilleActive, deux);
    assert.ok(evenements.includes('onglets') && evenements.includes('active'));
    // Noms refusés.
    assert.match(t.classeur.verifierNomFeuille(''), /vide/);
    assert.match(t.classeur.verifierNomFeuille('feuille1'), /déjà/); // majuscules ignorées
    assert.match(t.classeur.verifierNomFeuille('a/b'), /caractères/);
    assert.match(t.classeur.verifierNomFeuille('x'.repeat(32)), /31/);
    assert.equal(t.classeur.renommerFeuille(deux, 'Feuille1'), 'Une autre feuille porte déjà ce nom.');
    assert.equal(t.classeur.renommerFeuille(deux, '  Budget  '), null);
    assert.equal(deux.nom, 'Budget');
    // Supprimer, puis annuler : la feuille revient avec son contenu.
    t.classeur.modifierCellules(deux, [{ adresse: 'B2', brut: 'deux' }]);
    t.classeur.supprimerFeuille(deux);
    assert.equal(t.classeur.feuilles.length, 1);
    assert.equal(t.classeur.feuilleActive, t.feuille);
    assert.equal(t.classeur.supprimerFeuille(t.feuille), false); // il reste toujours une feuille
    t.classeur.annuler();
    assert.equal(t.classeur.feuilles.length, 2);
    assert.equal(t.classeur.feuilles[1].brut('B2'), 'deux');
    assert.equal(t.classeur.feuilleActive.nom, 'Budget');
  });

  test('plusieurs feuilles enregistrées et rechargées (feuille affichée comprise)', async () => {
    const { Classeur } = await import('../../js/donnees/classeur.js');
    const t = creerTableur({ A1: '5' });
    const ventes = t.classeur.ajouterFeuille({ nom: 'Ventes 2026' });
    t.classeur.modifierCellules(ventes, [{ adresse: 'A1', brut: "=Feuille1!A1*2", bordures: { bas: { style: 'epais', couleur: 'rouge' } } }]);
    t.classeur.figerPremiereLigne(ventes, true);
    const json = JSON.parse(JSON.stringify(t.classeur.versJSON()));
    assert.equal(json.active, 1);
    const copie = new Classeur();
    copie.charger(json);
    assert.deepEqual(copie.feuilles.map((f) => f.nom), ['Feuille1', 'Ventes 2026']);
    assert.equal(copie.feuilleActive.nom, 'Ventes 2026');
    assert.equal(copie.feuilles[1].figee, true);
    assert.equal(copie.feuilles[1].cellule('A1').bordures.bas.style, 'epais');
  });

  test('ancien classeur (version 1) : la feuille « Feuille 1 » devient « Feuille1 »', async () => {
    const { Classeur } = await import('../../js/donnees/classeur.js');
    const copie = new Classeur();
    copie.charger({ format: 'tableur', version: 1, titre: 'Ancien', feuilles: [{ nom: 'Feuille 1', cellules: { A1: { brut: 'x', gras: true, fond: 'bleu' } } }] });
    assert.equal(copie.feuilles[0].nom, 'Feuille1');
    assert.equal(copie.feuilles[0].cellule('A1').fond, 'bleu');
  });

  test('figer la première ligne : annulable', () => {
    const t = creerTableur();
    assert.equal(t.feuille.figee, false);
    t.classeur.figerPremiereLigne(t.feuille, true);
    assert.equal(t.feuille.figee, true);
    t.classeur.annuler();
    assert.equal(t.feuille.figee, false);
  });
});
