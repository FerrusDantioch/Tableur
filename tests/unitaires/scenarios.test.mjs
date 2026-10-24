// Ajout 3 : scénario complet. Un classeur qui utilise presque tout (plusieurs
// feuilles, formules, références entre feuilles, formats, bordures, fusions,
// règles conditionnelles, ligne figée, largeurs) est exporté en .json puis
// réimporté : le résultat doit être identique à l'original.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { creerClasseurDeTest } from './outils.mjs';
import { lirePlage } from '../../js/donnees/adresses.js';
import { Classeur } from '../../js/donnees/classeur.js';
import { MoteurCalcul } from '../../js/calcul/moteur.js';
import { creerFichierClasseur, lireFichierClasseur } from '../../js/donnees/fichier-classeur.js';

const P = (texte) => lirePlage(texte);

/** Classeur complet : trois feuilles qui se répondent. */
export function classeurComplet() {
  const t = creerClasseurDeTest();
  const { classeur } = t;
  const ventes = t.feuille;
  classeur.renommer('Budget de l’association');
  classeur.renommerFeuille(ventes, 'Ventes');
  const ecrire = (feuille, contenus) =>
    classeur.modifierCellules(feuille, Object.entries(contenus).map(([adresse, brut]) => ({ adresse, brut })));

  ecrire(ventes, {
    A1: 'Ventes du trimestre',
    A2: 'Article', B2: 'Prix', C2: 'Quantité', D2: 'Total', E2: 'Date',
    A3: 'Gâteau', B3: '12,5', C3: '4', D3: '=B3*C3', E3: '05/01/2026',
    A4: 'Café', B4: '1,8', C4: '120', D4: '=B4*C4', E4: '=E3+30',
    A5: 'Total', D5: '=SOMME(D3:D4)',
    A6: 'Part du café', D6: '=D4/D5',
  });
  classeur.modifierCellules(ventes, [
    { adresse: 'B3', format: { type: 'euro', decimales: 2 } },
    { adresse: 'D6', format: { type: 'pourcent', decimales: 1 }, italique: true },
    { adresse: 'A5', gras: true, couleur: 'bleu' },
    { adresse: 'D5', bordures: { haut: { style: 'epais', couleur: 'auto' }, bas: { style: 'fin', couleur: 'rouge' } } },
  ]);
  classeur.fusionner(ventes, P('A1:E1'));
  classeur.modifierCellules(ventes, ['A1', 'B1', 'C1', 'D1', 'E1'].map((adresse) => ({ adresse, fond: 'jaune', gras: true })));
  classeur.modifierLargeurs(ventes, [1], 160);
  classeur.figerPremiereLigne(ventes, true);
  classeur.ajouterRegle(ventes, { plage: 'D3:D4', type: 'superieur', valeur: '100', fond: 'vert' });
  classeur.ajouterRegle(ventes, { plage: 'A3:A10', type: 'contient', valeur: 'café', encre: 'violet' });

  const depenses = classeur.ajouterFeuille({ nom: 'Dépenses 2026' });
  ecrire(depenses, { A1: 'Loyer', B1: '400', A2: 'Électricité', B2: '-35', A3: 'Total', B3: '=SOMME(B1:B2)', C1: 'payé', C2: 'en retard' });
  classeur.ajouterRegle(depenses, { plage: 'B1:B2', type: 'negatif', encre: 'rouge' });
  classeur.ajouterRegle(depenses, { plage: 'B1:B3', type: 'entre', valeur: '300', valeur2: '500', fond: 'gris' });
  classeur.fusionner(depenses, P('C4:D5'));

  const resume = classeur.ajouterFeuille({ nom: 'Résumé' });
  ecrire(resume, {
    A1: 'Recettes', B1: '=Ventes!D5',
    A2: 'Dépenses', B2: "='Dépenses 2026'!B3",
    A3: 'Solde', B3: '=B1-B2',
    A4: 'Avis', B4: '=SI(B3>0;"bénéfice";"perte")',
    A5: 'Prix du café', B5: '=RECHERCHEV("café";Ventes!A3:D4;2;FAUX)',
    A6: 'Mois', B6: '=MOIS(Ventes!E4)',
  });
  classeur.activer(resume);
  return t;
}

/** Toutes les valeurs calculées du classeur, feuille par feuille. */
function toutesLesValeurs(classeur, moteur) {
  const valeurs = {};
  for (const feuille of classeur.feuilles) {
    for (const adresse of feuille.adresses()) valeurs[`${feuille.nom}!${adresse}`] = moteur.valeur(feuille, adresse);
  }
  return valeurs;
}

describe('Scénario complet : export puis import d’un classeur complexe', () => {
  test('les formules donnent bien les résultats attendus', () => {
    const { classeur, moteur } = classeurComplet();
    const resume = classeur.feuilleNommee('Résumé');
    assert.equal(moteur.valeur(resume, 'B1'), 266); // 12,5 × 4 + 1,8 × 120
    assert.equal(moteur.valeur(resume, 'B2'), 365);
    assert.equal(moteur.valeur(resume, 'B3'), -99);
    assert.equal(moteur.valeur(resume, 'B4'), 'perte');
    assert.equal(moteur.valeur(resume, 'B5'), 1.8);
    assert.equal(moteur.valeur(resume, 'B6'), 2); // 05/01/2026 + 30 jours : février
  });

  test('le classeur réimporté est identique : contenu, mise en forme, fusions, règles, valeurs, affichage', () => {
    const original = classeurComplet();
    const texte = JSON.stringify(
      creerFichierClasseur(original.classeur, { affichage: { zoom: 130, theme: 'clair' }, application: 'Omni-Tableur test' }),
    );

    const lu = lireFichierClasseur(texte);
    assert.equal(lu.ok, true, lu.message);
    assert.deepEqual(lu.affichage, { zoom: 130, theme: 'clair' });
    assert.deepEqual(lu.resume, { titre: 'Budget de l’association', feuilles: 3 });

    // Un autre classeur, déjà rempli, reçoit le fichier.
    const autre = creerClasseurDeTest({ A1: 'sera remplacé' });
    autre.classeur.remplacer(lu.classeur);
    assert.deepEqual(autre.classeur.versJSON(), original.classeur.versJSON());
    assert.deepEqual(toutesLesValeurs(autre.classeur, autre.moteur), toutesLesValeurs(original.classeur, original.moteur));
    assert.equal(autre.classeur.feuilleActive.nom, 'Résumé');
    const ventes = autre.classeur.feuilleNommee('Ventes');
    assert.equal(ventes.figee, true);
    assert.equal(ventes.largeur(1), 160);
    assert.deepEqual(ventes.fusions.map((f) => `${f.debut.ligne},${f.debut.colonne}:${f.fin.ligne},${f.fin.colonne}`), ['1,1:1,5']);
    assert.equal(ventes.regles.length, 2);
    assert.equal(autre.classeur.feuilleNommee('Dépenses 2026').regles[1].type, 'entre');

    // Réexporter le classeur importé redonne exactement le même fichier (sauf la date).
    const sansDate = (objet) => ({ ...objet, exporteLe: null });
    const deuxieme = creerFichierClasseur(autre.classeur, { affichage: { zoom: 130, theme: 'clair' }, application: 'Omni-Tableur test' });
    assert.deepEqual(sansDate(JSON.parse(JSON.stringify(deuxieme))), sansDate(JSON.parse(texte)));
  });

  test('un classeur rechargé depuis la sauvegarde automatique est lui aussi identique', () => {
    const original = classeurComplet();
    const sauvegarde = JSON.parse(JSON.stringify(original.classeur.versJSON()));
    const recharge = new Classeur();
    recharge.charger(sauvegarde);
    const moteur = new MoteurCalcul(recharge);
    assert.deepEqual(recharge.versJSON(), original.classeur.versJSON());
    assert.deepEqual(toutesLesValeurs(recharge, moteur), toutesLesValeurs(original.classeur, original.moteur));
  });

  test('fichiers invalides : vide, texte quelconque, autre application, version inconnue', () => {
    const texteValable = JSON.stringify(creerFichierClasseur(classeurComplet().classeur));
    const cas = [
      ['', /illisible/],
      ['   ', /illisible/],
      ['Bonjour, ceci est une lettre.', /illisible/],
      [JSON.stringify({ type: 'tableau', lignes: [[1, 2]] }), /pas été créé par Omni-Tableur/],
      [texteValable.replace('"version":1', '"version":7'), /version plus récente/],
    ];
    for (const [texte, attendu] of cas) {
      const t = creerClasseurDeTest({ A1: 'mon travail' });
      const avant = JSON.stringify(t.classeur.versJSON());
      const lu = lireFichierClasseur(texte);
      assert.equal(lu.ok, false);
      assert.match(lu.message, attendu);
      assert.equal(JSON.stringify(t.classeur.versJSON()), avant); // classeur actuel inchangé
    }
  });
});
