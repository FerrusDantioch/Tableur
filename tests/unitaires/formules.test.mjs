// Tests du moteur de formules : cas simples, cas d'erreur et recalcul automatique.
// Chaque test vérifie le texte AFFICHÉ dans la cellule, comme à l'écran.
// Lancement : npm test

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { calculer, creerTableur } from './outils.mjs';

// Cellules de départ utilisées par la plupart des tests.
const BASE = { A1: '10', A2: '20', A3: 'texte', B1: '0', C1: 'VRAI', D1: '2,5' };

/** Vérifie une liste de [formule, résultat affiché attendu]. */
function verifier(cas, cellules = BASE) {
  for (const [formule, attendu] of cas) {
    assert.equal(calculer(formule, cellules), attendu, `${formule} devrait afficher « ${attendu} »`);
  }
}

describe('Opérations de base', () => {
  test('+ - * / et priorités', () => {
    verifier([
      ['=1+2', '3'],
      ['=5-8', '-3'],
      ['=6*7', '42'],
      ['=10/4', '2,5'],
      ['=2+3*4', '14'],
      ['=(2+3)*4', '20'],
      ['=1-2-3', '-4'],
      ['=2*-3', '-6'],
      ['=2^10', '1024'],
      ['=-2^2', '4'], // comme Excel : le signe moins passe avant la puissance
      ['=50%', '0,5'],
      ['=0,1+0,2', '0,3'], // pas de 0,30000000000000004
      ['=1E3', '1000'],
    ]);
  });

  test('références de cellules', () => {
    verifier([
      ['=A1+A2', '30'],
      ['=a1+a2', '30'], // minuscules acceptées
      ['=$A$1*2', '20'],
      ['=A1*D1', '25'], // D1 contient « 2,5 » (virgule française)
      ['=E5', '0'], // cellule vide = 0
      ['=E5+1', '1'],
      ['=C1+1', '2'], // VRAI vaut 1
      ['=A1>=10', 'VRAI'],
      ['=A1<>10', 'FAUX'],
      ['=A1&" €"', '10 €'],
      ['="a"&"b"', 'ab'],
    ]);
  });

  test('plages', () => {
    verifier([
      ['=SOMME(A1:A3)', '30'], // le texte de A3 est ignoré
      ['=SOMME(A1:B2)', '30'],
      ['=SOMME(A3:A1)', '30'], // plage écrite à l'envers
      ['=SOMME(A:A)', '30'], // colonne entière
      ['=SOMME(A1:A2)*2', '60'],
    ]);
  });

  test('séparateurs à la française', () => {
    verifier([
      ['=1,5+1', '2,5'],
      ['=SOMME(1,5;2)', '3,5'], // « ; » sépare, « , » est la virgule décimale
      ['=SOMME(A1;A2;5)', '35'],
      ['=SOMME(A1,A2)', '30'], // virgule tolérée comme séparateur entre deux références
      ['=SOMME(  A1 ; A2 )', '30'], // espaces acceptées
      ['=,5+1', '1,5'],
    ]);
  });
});

describe('Les six fonctions demandées', () => {
  test('SOMME', () => {
    verifier([
      ['=SOMME(1;2;3)', '6'],
      ['=SOMME(A1:A3;100)', '130'],
      ['=SOMME(1;;2)', '3'],
      ['=somme(a1:a2)', '30'],
      ['=SOMME("3";1)', '4'], // texte écrit dans la formule : converti
    ]);
  });

  test('MOYENNE', () => {
    verifier([
      ['=MOYENNE(A1:A3)', '15'], // texte ignoré
      ['=MOYENNE(1;2;3;4)', '2,5'],
      ['=MOYENNE(A1:A2;D1)', '10,8333333333'],
    ]);
  });

  test('MIN et MAX', () => {
    verifier([
      ['=MIN(A1:A3)', '10'],
      ['=MAX(A1:A3)', '20'],
      ['=MIN(-5;-2;7)', '-5'],
      ['=MAX(-5;-2)', '-2'],
      ['=MIN(E1:E5)', '0'], // plage vide
      ['=MAX(E1:E5)', '0'],
      ['=MAX(1;"30")', '30'],
      ['=MIN(A1:A2;3)', '3'],
    ]);
  });

  test('NB (compte les nombres)', () => {
    verifier([
      ['=NB(A1:A3)', '2'],
      ['=NB(A1:D1)', '3'], // A1, B1, D1 (C1 contient VRAI : pas un nombre dans une plage)
      ['=NB(E1:E9)', '0'],
      ['=NB(1;"2";"x";VRAI)', '3'],
    ]);
  });

  test('SI', () => {
    verifier([
      ['=SI(A1>5;"grand";"petit")', 'grand'],
      ['=SI(A1>50;"grand";"petit")', 'petit'],
      ['=SI(A1>50;"grand")', 'FAUX'],
      ['=SI(A3="texte";1;0)', '1'],
      ['=SI(A1>5;SI(A2>15;"deux";"un");"zéro")', 'deux'],
      ['=SI(VRAI;1;1/0)', '1'], // la branche non choisie n'est pas calculée
      ['=SI(B1=0;"";A1/B1)', ''], // cas classique : éviter une division par zéro
      ['=si(c1;"oui";"non")', 'oui'],
    ]);
  });
});

describe('Autres fonctions disponibles', () => {
  test('fonctions courantes', () => {
    verifier([
      ['=ARRONDI(2,567;2)', '2,57'],
      ['=ARRONDI.SUP(2,1;0)', '3'],
      ['=ARRONDI.INF(2,9;0)', '2'],
      ['=ABS(-3)', '3'],
      ['=ENT(2,7)', '2'],
      ['=MOD(7;3)', '1'],
      ['=PRODUIT(2;3;4)', '24'],
      ['=RACINE(16)', '4'],
      ['=PUISSANCE(2;3)', '8'],
      ['=ET(VRAI;FAUX)', 'FAUX'],
      ['=OU(1;0)', 'VRAI'],
      ['=NON(1)', 'FAUX'],
      ['=SIERREUR(1/0;"x")', 'x'],
      ['=NBCAR("abc")', '3'],
      ['=CONCATENER("a";"b")', 'ab'],
      ['=SOMME.SI(A1:A3;">15")', '20'],
      ['=MOYENNE.SI(A1:A3;">5")', '15'],
      ['=SUM(A1:A2)', '30'], // les noms anglais restent acceptés
    ]);
  });
});

describe('Erreurs', () => {
  test('division par zéro : #DIV/0!', () => {
    verifier([
      ['=1/0', '#DIV/0!'],
      ['=A1/B1', '#DIV/0!'], // B1 vaut 0
      ['=A1/E9', '#DIV/0!'], // E9 est vide
      ['=MOYENNE(E1:E3)', '#DIV/0!'], // aucune valeur à moyenner
    ]);
    const { remplir, explication } = creerTableur();
    remplir({ A1: '=1/0' });
    assert.match(explication('A1'), /Division par zéro/);
  });

  test('référence invalide : #REF!', () => {
    verifier([
      ['=A1001', '#REF!'], // au-delà de la ligne 1000
      ['=BA1', '#REF!'], // au-delà de la colonne AZ
      ['=ZZZ1+1', '#REF!'],
      ['=SOMME(A1:A2000)', '#REF!'],
    ]);
    const { remplir, explication } = creerTableur();
    remplir({ A1: '=A5000' });
    assert.match(explication('A1'), /Référence invalide/);
  });

  test('texte dans un calcul : #VALEUR!', () => {
    verifier([
      ['=A1+A3', '#VALEUR!'],
      ['=A1+"abc"', '#VALEUR!'],
      ['=MAX(1;"abc")', '#VALEUR!'],
    ]);
  });

  test('nom inconnu : #NOM?', () => {
    verifier([
      ['=TOTO(1)', '#NOM?'],
      ['=MEDIANE(A1:A2)', '#NOM?'],
      ['=abc', '#NOM?'],
      ['=total*2', '#NOM?'],
    ]);
    const { remplir, explication } = creerTableur();
    remplir({ A1: '=TOTO(1)', A2: '=total*2' });
    assert.match(explication('A1'), /TOTO/);
    assert.match(explication('A2'), /total/);
  });

  test('formule mal écrite : #ERREUR!', () => {
    verifier([
      ['=SOMME(A1', '#ERREUR!'],
      ['=1+', '#ERREUR!'],
      ['=(1+2', '#ERREUR!'],
      ['=', '#ERREUR!'],
      ['=SOMME(A1:)', '#ERREUR!'],
      ['="abc', '#ERREUR!'],
    ]);
  });

  test('calcul impossible : #NOMBRE!', () => {
    verifier([
      ['=RACINE(-1)', '#NOMBRE!'],
      ['=10^400', '#NOMBRE!'],
    ]);
  });

  test('référence circulaire : #CIRC!', () => {
    const t = creerTableur();
    t.remplir({ A1: '=A1+1' });
    assert.equal(t.affiche('A1'), '#CIRC!');
    assert.match(t.explication('A1'), /circulaire/);
    t.remplir({ B1: '=C1', C1: '=B1', D1: '=B1*2' });
    assert.equal(t.affiche('B1'), '#CIRC!');
    assert.equal(t.affiche('C1'), '#CIRC!');
    assert.equal(t.affiche('D1'), '#CIRC!'); // dépend d'une boucle
    t.remplir({ E1: '=SOMME(E1:E3)' }); // la plage contient la cellule elle-même
    assert.equal(t.affiche('E1'), '#CIRC!');
    // Casser la boucle : tout redevient normal.
    t.remplir({ C1: '5' });
    assert.equal(t.affiche('B1'), '5');
    assert.equal(t.affiche('D1'), '10');
  });

  test('une erreur se propage aux cellules qui l’utilisent', () => {
    const t = creerTableur({ A1: '=1/0', A2: '5' });
    t.remplir({ B1: '=A1+1', B2: '=SOMME(A1:A2)', B3: '=MOYENNE(A1:A2)', B4: '=MAX(A1:A2)', B5: '=NB(A1:A2)', B6: '=SIERREUR(A1;0)' });
    assert.equal(t.affiche('B1'), '#DIV/0!');
    assert.equal(t.affiche('B2'), '#DIV/0!');
    assert.equal(t.affiche('B3'), '#DIV/0!');
    assert.equal(t.affiche('B4'), '#DIV/0!');
    assert.equal(t.affiche('B5'), '1'); // NB compte les nombres et ignore l'erreur (comme Excel)
    assert.equal(t.affiche('B6'), '0');
  });

  test('une erreur ne bloque pas les calculs suivants', () => {
    const t = creerTableur({ A1: '=SOMME(', A2: '=1+1' });
    assert.equal(t.affiche('A1'), '#ERREUR!');
    assert.equal(t.affiche('A2'), '2');
  });
});

describe('Recalcul automatique', () => {
  test('une formule suit les cellules qu’elle utilise', () => {
    const t = creerTableur({ A1: '2', B1: '=A1*10' });
    assert.equal(t.affiche('B1'), '20');
    t.remplir({ A1: '3' });
    assert.equal(t.affiche('B1'), '30');
    t.remplir({ A1: '' }); // cellule vidée
    assert.equal(t.affiche('B1'), '0');
  });

  test('cascade : A1 → B1 → C1 → D1', () => {
    const t = creerTableur({ A1: '1', B1: '=A1+1', C1: '=B1+1', D1: '=C1+B1' });
    assert.equal(t.affiche('D1'), '5');
    t.remplir({ A1: '10' });
    assert.equal(t.affiche('B1'), '11');
    assert.equal(t.affiche('C1'), '12');
    assert.equal(t.affiche('D1'), '23');
  });

  test('formules sur des plages', () => {
    const t = creerTableur({ A1: '1', A2: '2', A3: '3', B1: '=SOMME(A1:A10)', B2: '=MOYENNE(A:A)', B3: '=NB(A1:A10)' });
    assert.equal(t.affiche('B1'), '6');
    t.remplir({ A10: '4' });
    assert.equal(t.affiche('B1'), '10');
    assert.equal(t.affiche('B2'), '2,5');
    assert.equal(t.affiche('B3'), '4');
  });

  test('ordre de saisie quelconque (formule tapée avant ses données)', () => {
    const t = creerTableur({ C1: '=A1+B1' });
    assert.equal(t.affiche('C1'), '0');
    t.remplir({ B1: '=A1*2' });
    t.remplir({ A1: '5' });
    assert.equal(t.affiche('B1'), '10');
    assert.equal(t.affiche('C1'), '15');
  });

  test('une formule remplacée par un nombre (et l’inverse)', () => {
    const t = creerTableur({ A1: '1', B1: '=A1+1', C1: '=B1*2' });
    t.remplir({ B1: '100' });
    assert.equal(t.affiche('C1'), '200');
    t.remplir({ A1: '50' }); // B1 n'est plus une formule : C1 ne bouge pas
    assert.equal(t.affiche('C1'), '200');
    t.remplir({ B1: '=A1' });
    assert.equal(t.affiche('C1'), '100');
  });

  test('annuler / rétablir recalcule aussi', () => {
    const t = creerTableur({ A1: '1', B1: '=A1*3' });
    t.remplir({ A1: '7' });
    assert.equal(t.affiche('B1'), '21');
    t.classeur.annuler();
    assert.equal(t.affiche('B1'), '3');
    t.classeur.retablir();
    assert.equal(t.affiche('B1'), '21');
  });

  test('le moteur annonce les cellules dont la valeur a changé', () => {
    const t = creerTableur({ A1: '1', B1: '=A1', C1: '=B1', Z9: '=1' });
    const annonces = [];
    t.moteur.abonner((e) => annonces.push(...e.adresses));
    t.remplir({ A1: '2' });
    assert.deepEqual(new Set(annonces), new Set(['A1', 'B1', 'C1']));
  });

  test('longue chaîne de 1000 formules (rapide, sans erreur)', () => {
    const contenus = { A1: '1' };
    for (let ligne = 2; ligne <= 1000; ligne++) contenus[`A${ligne}`] = `=A${ligne - 1}+1`;
    const debut = performance.now();
    const t = creerTableur(contenus);
    t.remplir({ A1: '1000' });
    const duree = performance.now() - debut;
    assert.equal(t.affiche('A1000'), '1999');
    assert.ok(duree < 5000, `calcul trop lent : ${Math.round(duree)} ms`);
  });

  test('rechargement d’un classeur entier', () => {
    const t = creerTableur({ A1: '1' });
    t.classeur.charger({ format: 'tableur', feuilles: [{ cellules: { A1: { brut: '4' }, A2: { brut: '=A1^2' } } }] });
    assert.equal(t.affiche('A2'), '16');
  });

  test('valeurs d’une plage (pour les futurs graphiques)', () => {
    const t = creerTableur({ A1: 'Mois', B1: 'Total', A2: 'Janvier', B2: '=10*2', A3: 'Février', B3: '15' });
    assert.deepEqual(t.moteur.valeursPlage('A1:B3'), [
      ['Mois', 'Total'],
      ['Janvier', 20],
      ['Février', 15],
    ]);
    const resume = t.moteur.resumer({ debut: { ligne: 1, colonne: 2 }, fin: { ligne: 3, colonne: 2 } });
    assert.deepEqual(resume, { remplies: 3, nombres: 2, somme: 35, moyenne: 17.5, min: 15, max: 20 });
  });
});
