// Étape 3 : les fonctions demandées (NB.SI, SOMME.SI, RECHERCHEV, MAJUSCULE,
// MINUSCULE, CONCATENER, AUJOURDHUI…), les comparaisons à la française, les
// dates et les références vers une autre feuille.
// Chaque test vérifie le texte AFFICHÉ dans la cellule, comme à l'écran.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { calculer, creerTableur } from './outils.mjs';
import { dateVersTexte, serieAujourdhui } from '../../js/donnees/saisie.js';

/** Vérifie une liste de [formule, résultat affiché attendu] avec les cellules données. */
function verifier(cas, cellules) {
  for (const [formule, attendu] of cas) {
    assert.equal(calculer(formule, cellules), attendu, `${formule} devrait afficher « ${attendu} »`);
  }
}

// Un petit tableau de fruits pour les recherches et les conditions.
const FRUITS = {
  A1: 'Fruit', B1: 'Prix', C1: 'Stock',
  A2: 'Pomme', B2: '2,5', C2: '10',
  A3: 'Poire', B3: '3', C3: '0',
  A4: 'Banane', B4: '1,8', C4: '25',
  A5: 'Cerise', B5: '9', C5: '',
  A6: 'Prune', B6: '=B2*2', C6: 'épuisé',
};

describe('Conditions', () => {
  test('SI, ET, OU', () => {
    verifier(
      [
        ['=SI(B2>2;"cher";"bon marché")', 'cher'],
        ['=SI(ET(B2>2;C2>5);"ok";"non")', 'ok'],
        ['=SI(OU(C3=0;C3="");"rupture";"en stock")', 'rupture'],
        ['=SI(A2="pomme";1;0)', '1'], // majuscules ignorées, comme Excel
        ['=SI(A2<>"Poire";"autre";"poire")', 'autre'],
      ],
      FRUITS,
    );
  });

  test('NB.SI : compte selon un critère', () => {
    verifier(
      [
        ['=NB.SI(B2:B6;">2")', '4'], // 2,5 ; 3 ; 9 et 5 (la formule de B6)
        ['=NB.SI(C2:C6;">5")', '2'], // le texte « épuisé » et la cellule vide ne comptent pas
        ['=NB.SI(A2:A6;"pomme")', '1'],
        ['=NB.SI(A2:A6;"P*")', '3'], // jokers
        ['=NB.SI(A2:A6;"?oire")', '1'],
        ['=NB.SI(C2:C6;"")', '1'], // cellules vides
        ['=NB.SI(C2:C6;"<>")', '4'], // cellules non vides
        ['=NB.SI(C2:C6;0)', '1'],
        ['=NB.SI(C2:C6;"<>0")', '4'],
        ['=NB.SI(B2:B6;">=2,5")', '4'], // virgule française dans le critère
        ['=NB.SI(A2:A6;A3)', '1'], // critère pris dans une cellule
      ],
      FRUITS,
    );
  });

  test('SOMME.SI et MOYENNE.SI', () => {
    verifier(
      [
        ['=SOMME.SI(C2:C6;">5")', '35'],
        ['=SOMME.SI(A2:A6;"P*";C2:C6)', '10'], // Pomme 10 + Poire 0 + Prune « épuisé » (texte)
        ['=SOMME.SI(A2:A6;"banane";B2:B6)', '1,8'],
        ['=MOYENNE.SI(B2:B6;"<5")', '2,4333333333'],
        ['=MOYENNE.SI(B2:B6;">100")', '#DIV/0!'],
      ],
      FRUITS,
    );
  });
});

describe('Recherche : RECHERCHEV', () => {
  test('recherche exacte (FAUX)', () => {
    verifier(
      [
        ['=RECHERCHEV("Poire";A2:C6;2;FAUX)', '3'],
        ['=RECHERCHEV("POIRE";A2:C6;3;FAUX)', '0'], // majuscules ignorées
        ['=RECHERCHEV("cer*";A2:C6;2;FAUX)', '9'], // jokers
        ['=RECHERCHEV("Cerise";A2:C6;3;FAUX)', '0'], // case vide → 0
        ['=RECHERCHEV("Prune";A2:C6;2;FAUX)', '5'], // la valeur d'une formule
        ['=RECHERCHEV("Kiwi";A2:C6;2;FAUX)', '#N/A'], // introuvable
        ['=RECHERCHEV("Poire";A2:C6;4;FAUX)', '#REF!'], // colonne au-delà du tableau
        ['=RECHERCHEV("Poire";A2:C6;0;FAUX)', '#VALEUR!'],
        ['=SIERREUR(RECHERCHEV("Kiwi";A2:C6;2;FAUX);"absent")', 'absent'],
      ],
      FRUITS,
    );
  });

  test('valeur proche (tableau trié) : barème', () => {
    const bareme = { A1: '0', B1: 'E', A2: '10', B2: 'D', A3: '12', B3: 'C', A4: '14', B4: 'B', A5: '16', B5: 'A' };
    verifier(
      [
        ['=RECHERCHEV(13,5;A1:B5;2)', 'C'],
        ['=RECHERCHEV(16;A1:B5;2;VRAI)', 'A'],
        ['=RECHERCHEV(20;A1:B5;2)', 'A'],
        ['=RECHERCHEV(-1;A1:B5;2)', '#N/A'],
      ],
      bareme,
    );
    const t = creerTableur({ A1: '=RECHERCHEV(C1;A3:B4;2;FAUX)', A3: 'x', B3: 'trouvé' });
    assert.equal(t.affiche('A1'), '#N/A');
    assert.match(t.explication('A1'), /RECHERCHEV/);
    t.remplir({ C1: 'X' });
    assert.equal(t.affiche('A1'), 'trouvé'); // recalcul quand la valeur cherchée change
  });
});

describe('Texte', () => {
  test('MAJUSCULE, MINUSCULE, CONCATENER et &', () => {
    verifier(
      [
        ['=MAJUSCULE("été à l\'île")', "ÉTÉ À L'ÎLE"],
        ['=MINUSCULE("ÉCOLE")', 'école'],
        ['=MAJUSCULE(A2)', 'POMME'],
        ['=CONCATENER(A2;" à ";B2;" €")', 'Pomme à 2,5 €'], // virgule française
        ['=A2&" : "&C2', 'Pomme : 10'],
        ['=B2&""', '2,5'],
        ['="stock "&(C2>5)', 'stock VRAI'],
        ['=CONCATENER(1/3)', '0,333333333333333'],
        ['=MAJUSCULE(1/0)', '#DIV/0!'],
        ['=NBVAL(A1:C6)', '17'],
      ],
      FRUITS,
    );
  });
});

describe('Comparaisons à la française', () => {
  test('majuscules, nombres arrondis, cellules vides, types', () => {
    verifier(
      [
        ['="a"="A"', 'VRAI'],
        ['="abc"<"abd"', 'VRAI'],
        ['="é"="e"', 'FAUX'], // les accents comptent
        ['=0,1+0,2=0,3', 'VRAI'], // pas d'« erreur de virgule flottante »
        ['=Z9=0', 'VRAI'], // cellule vide = 0
        ['=Z9=""', 'VRAI'], // … et aussi = texte vide
        ['=1<"a"', 'VRAI'], // nombres avant le texte
        ['="z"<VRAI', 'VRAI'], // texte avant VRAI/FAUX
        ['=2>=2', 'VRAI'],
        ['=3<>3', 'FAUX'],
        ['=(1/0)=1', '#DIV/0!'],
      ],
      {},
    );
  });
});

describe('Dates', () => {
  test('AUJOURDHUI() s’affiche en date', () => {
    const aujourdhui = dateVersTexte(serieAujourdhui());
    const t = creerTableur({ A1: '=AUJOURDHUI()', A2: '=AUJOURDHUI()+1', A3: '=ANNEE(AUJOURDHUI())' });
    assert.equal(t.affiche('A1'), aujourdhui);
    assert.match(t.affiche('A2'), /^\d\d\/\d\d\/\d{4}$/);
    assert.equal(t.affiche('A3'), String(new Date().getFullYear()));
  });

  test('dates tapées jj/mm/aaaa : des nombres qu’on peut calculer', () => {
    const t = creerTableur({ A1: '01/01/2026', A2: '15/03/2026', A3: '=A2-A1', A4: '=A1+31', B1: '31/02/2026', B2: '1/2/26' });
    assert.equal(t.affiche('A1'), '01/01/2026');
    assert.equal(t.affiche('A3'), '73'); // écart en jours
    assert.equal(t.valeur('A4'), 46054);
    assert.equal(t.affiche('B1'), '31/02/2026'); // date impossible : reste du texte
    assert.equal(typeof t.valeur('B1'), 'string');
    assert.equal(t.affiche('B2'), '01/02/2026');
    assert.equal(calculer('=MOIS(A2)', { A2: '15/03/2026' }), '3');
    assert.equal(calculer('=JOUR(A2)', { A2: '15/03/2026' }), '15');
    assert.equal(calculer('=NB.SI(A1:A3;">=01/02/2026")', { A1: '15/01/2026', A2: '01/02/2026', A3: '20/12/2026' }), '2');
  });
});

describe('Références vers une autre feuille', () => {
  test('=Feuille2!A1, plages, noms avec espaces, recalcul', () => {
    const t = creerTableur({ A1: '10' });
    const ventes = t.classeur.ajouterFeuille({ nom: 'Feuille2' });
    t.classeur.modifierCellules(ventes, [
      { adresse: 'A1', brut: '5' },
      { adresse: 'A2', brut: '7' },
      { adresse: 'B1', brut: '=Feuille1!A1*2' },
    ]);
    t.remplir({ C1: '=Feuille2!A1+A1', C2: '=SOMME(Feuille2!A1:A2)', C3: "='Feuille2'!B1", C4: '=feuille2!a2' });
    assert.equal(t.affiche('C1'), '15');
    assert.equal(t.affiche('C2'), '12');
    assert.equal(t.affiche('C3'), '20');
    assert.equal(t.affiche('C4'), '7'); // majuscules ignorées dans le nom de la feuille
    // Recalcul en cascade d'une feuille à l'autre.
    t.classeur.modifierCellules(ventes, [{ adresse: 'A2', brut: '100' }]);
    assert.equal(t.affiche('C2'), '105');
    t.remplir({ A1: '1' });
    assert.equal(t.moteur.valeur(ventes, 'B1'), 2);
    assert.equal(t.affiche('C3'), '2');
  });

  test('feuille renommée ou supprimée', () => {
    const t = creerTableur();
    const autre = t.classeur.ajouterFeuille({ nom: 'Ventes' });
    t.classeur.modifierCellules(autre, [{ adresse: 'A1', brut: '42' }]);
    t.remplir({ A1: '=Ventes!A1', A2: '=Inconnue!A1' });
    assert.equal(t.affiche('A1'), '42');
    assert.equal(t.affiche('A2'), '#REF!');
    // Renommer met à jour les formules (avec des apostrophes si le nom a une espace).
    assert.equal(t.classeur.renommerFeuille(autre, 'Ventes 2026'), null);
    assert.equal(t.feuille.brut('A1'), "='Ventes 2026'!A1");
    assert.equal(t.affiche('A1'), '42');
    // Une feuille nommée comme celle qui manquait : la formule la trouve.
    t.classeur.ajouterFeuille({ nom: 'Inconnue' });
    assert.equal(t.affiche('A2'), '0');
    // Supprimer : #REF!, et Annuler remet tout.
    t.classeur.supprimerFeuille(autre);
    assert.equal(t.feuille.brut('A1'), '=#REF!');
    assert.equal(t.affiche('A1'), '#REF!');
    t.classeur.annuler();
    assert.equal(t.feuille.brut('A1'), "='Ventes 2026'!A1");
    assert.equal(t.affiche('A1'), '42');
  });
});
