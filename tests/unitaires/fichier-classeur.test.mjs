// Ajout 1 : sauvegarde complète du classeur dans un fichier .json.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { creerClasseurDeTest } from './outils.mjs';
import { Classeur } from '../../js/donnees/classeur.js';
import {
  FORMAT_FICHIER,
  VERSION_FICHIER,
  creerFichierClasseur,
  lireFichierClasseur,
  nomFichierClasseur,
} from '../../js/donnees/fichier-classeur.js';

/** Un classeur bien rempli : 2 feuilles, formules, mise en forme, bordures, largeurs, ligne figée. */
function classeurComplet() {
  const t = creerClasseurDeTest({ A1: 'Article', B1: 'Prix', A2: 'Pomme', B2: '2,5', A3: 'Poire', B3: '3', B4: '=SOMME(B2:B3)' });
  const { classeur, feuille } = t;
  classeur.renommer('Courses de la semaine');
  classeur.modifierCellules(feuille, [
    { adresse: 'A1', gras: true, italique: true, couleur: 'bleu', fond: 'jaune', alignement: 'centre' },
    { adresse: 'B2', format: { type: 'euro', decimales: 2 } },
    { adresse: 'B4', bordures: { haut: { style: 'epais', couleur: 'rouge' }, bas: { style: 'fin', couleur: 'auto' } } },
  ]);
  classeur.modifierLargeurs(feuille, [1], 180);
  classeur.figerPremiereLigne(feuille, true);
  const seconde = classeur.ajouterFeuille({ nom: 'Résumé' });
  classeur.modifierCellules(seconde, [{ adresse: 'A1', brut: '=Feuille1!B4*2' }, { adresse: 'C5', brut: '24/10/2026' }]);
  classeur.activer(seconde);
  return t;
}

/** Fichier valable (texte JSON), modifié par `changer(objet)` si besoin. */
function fichier(changer = () => {}) {
  const { classeur } = classeurComplet();
  const objet = JSON.parse(JSON.stringify(creerFichierClasseur(classeur, { affichage: { zoom: 120, theme: 'clair' } })));
  changer(objet);
  return JSON.stringify(objet);
}

describe('Exporter le classeur (.json)', () => {
  test('nom de fichier omni-tableur-AAAA-MM-JJ.json', () => {
    assert.equal(nomFichierClasseur(new Date(2026, 9, 4, 23, 59)), 'omni-tableur-2026-10-04.json');
  });

  test('le fichier contient tout le classeur, avec le numéro de version du format', () => {
    const { classeur } = classeurComplet();
    const contenu = creerFichierClasseur(classeur, {
      affichage: { zoom: 120, theme: 'clair' },
      application: 'Omni-Tableur 2.1.0',
      date: new Date('2026-10-24T09:30:00Z'),
    });
    assert.equal(contenu.format, FORMAT_FICHIER);
    assert.equal(contenu.version, 1);
    assert.equal(contenu.creePar, 'Omni-Tableur 2.1.0');
    assert.equal(contenu.exporteLe, '2026-10-24T09:30:00.000Z');
    assert.equal(contenu.titre, 'Courses de la semaine');
    assert.equal(contenu.feuilleActive, 1);
    assert.deepEqual(contenu.affichage, { zoom: 120, theme: 'clair' });
    assert.deepEqual(contenu.feuilles.map((f) => f.nom), ['Feuille1', 'Résumé']);
    const [premiere] = contenu.feuilles;
    assert.equal(premiere.figee, true);
    assert.deepEqual(premiere.largeurs, { A: 180 });
    assert.deepEqual(premiere.cellules.A1, { brut: 'Article', gras: true, italique: true, couleur: 'bleu', fond: 'jaune', alignement: 'centre' });
    assert.deepEqual(premiere.cellules.B2, { brut: '2,5', format: { type: 'euro', decimales: 2 } });
    assert.equal(premiere.cellules.B4.brut, '=SOMME(B2:B3)'); // la formule, pas seulement son résultat
    assert.deepEqual(premiere.cellules.B4.bordures.haut, { style: 'epais', couleur: 'rouge' });
  });

  test('aller-retour : le classeur importé est identique, formules recalculées', () => {
    const origine = classeurComplet();
    const texte = JSON.stringify(creerFichierClasseur(origine.classeur, { affichage: { zoom: 90, theme: 'sombre' } }));
    const lu = lireFichierClasseur(texte);
    assert.equal(lu.ok, true);
    assert.deepEqual(lu.affichage, { zoom: 90, theme: 'sombre' });
    assert.deepEqual(lu.resume, { titre: 'Courses de la semaine', feuilles: 2 });

    const autre = creerClasseurDeTest({ Z9: 'sera remplacé' });
    autre.classeur.remplacer(lu.classeur);
    assert.deepEqual(autre.classeur.versJSON(), origine.classeur.versJSON());
    const resume = autre.classeur.feuilleNommee('Résumé');
    assert.equal(autre.moteur.valeur(resume, 'A1'), 11);
    assert.equal(autre.classeur.feuilleActive, resume);
  });
});

describe('Importer un classeur (.json)', () => {
  test('« Annuler » rend le classeur d’avant (titre compris), « Rétablir » le classeur importé', () => {
    const t = creerClasseurDeTest({ A1: 'mon ancien classeur' });
    t.classeur.renommer('Ancien');
    const avant = JSON.stringify(t.classeur.versJSON());
    const lu = lireFichierClasseur(fichier());
    t.classeur.remplacer(lu.classeur);
    const importe = JSON.stringify(t.classeur.versJSON());
    assert.equal(t.classeur.titre, 'Courses de la semaine');
    t.classeur.annuler();
    assert.equal(JSON.stringify(t.classeur.versJSON()), avant);
    assert.equal(t.classeur.titre, 'Ancien');
    assert.equal(t.moteur.valeur(t.classeur.feuilles[0], 'A1'), 'mon ancien classeur');
    t.classeur.retablir();
    assert.equal(JSON.stringify(t.classeur.versJSON()), importe);
  });

  test('un fichier invalide est refusé avec un message clair, sans rien modifier', () => {
    const cas = [
      ['', /illisible/],
      ['{ "format": "omni-tableur/classeur", "version": 1, "feuilles": [', /illisible/], // fichier coupé
      ['texte quelconque', /illisible/],
      ['[1, 2, 3]', /pas été créé par Omni-Tableur/],
      ['{"nom": "un autre logiciel"}', /pas été créé par Omni-Tableur/],
      [JSON.stringify({ format: 'tableur', version: 2, feuilles: [] }), /pas été créé par Omni-Tableur/],
      [fichier((o) => (o.version = 2)), /version plus récente/],
      [fichier((o) => (o.version = 'un')), /abîmé/],
      [fichier((o) => (o.feuilles = [])), /aucune feuille/],
      [fichier((o) => (o.feuilles = 'Feuille1')), /aucune feuille/],
      [fichier((o) => (o.feuilles[1].nom = 'Feuille1')), /deux feuilles portent le nom/],
      [fichier((o) => (o.feuilles[0].nom = 'a/b')), /n'a pas de nom valable/],
      [fichier((o) => (o.feuilles[0].lignes = 5000)), /taille impossible/],
      [fichier((o) => (o.feuilles[0].cellules.ZZZ1 = { brut: 'x' })), /adresse de cellule impossible/],
      [
        // Clé « __proto__ » (tentative de « pollution » des objets JavaScript).
        fichier((o) => Object.defineProperty(o.feuilles[0].cellules, '__proto__', { value: { brut: 'x' }, enumerable: true })),
        /adresse de cellule impossible/,
      ],
      [fichier((o) => (o.feuilles[0].cellules.A1 = 'texte')), /cellule A1.*illisible/],
      [fichier((o) => (o.feuilles[0].cellules.A1.brut = 12)), /cellule A1/],
      [fichier((o) => (o.feuilles[0].cellules.A1.fond = 'fuchsia')), /valeur inconnue \(« fond »\)/],
      [fichier((o) => (o.feuilles[0].cellules.A1.gras = 'oui')), /valeur inconnue \(« gras »\)/],
      [fichier((o) => (o.feuilles[0].cellules.B2.format = { type: 'monnaie' })), /format de nombre inconnu/],
      [fichier((o) => (o.feuilles[0].cellules.B4.bordures = { milieu: { style: 'fin', couleur: 'auto' } })), /bordure inconnue/],
      [fichier((o) => (o.feuilles[0].largeurs = { A: -5 })), /largeur de colonne impossible/],
      [fichier((o) => (o.feuilleActive = 7)), /feuille à afficher/],
    ];
    for (const [texte, attendu] of cas) {
      const t = creerClasseurDeTest({ A1: 'intact' });
      const avant = JSON.stringify(t.classeur.versJSON());
      const lu = lireFichierClasseur(texte);
      assert.equal(lu.ok, false, `refusé : ${texte.slice(0, 60)}`);
      assert.match(lu.message, attendu, texte.slice(0, 60));
      // Rien n'a bougé dans le classeur.
      assert.equal(JSON.stringify(t.classeur.versJSON()), avant);
      assert.equal(t.classeur.peutAnnuler, true); // (seulement la saisie de A1)
    }
  });

  test('le contenu est traité comme des données : rien n’est exécuté', () => {
    let execute = false;
    globalThis.piege = () => {
      execute = true;
    };
    const texte = fichier((o) => {
      o.titre = '<img src=x onerror="piege()">';
      o.feuilles[0].cellules.A1.brut = '<script>piege()</script>';
      o.affichage = { zoom: 'piege()', theme: { code: 'piege()' } };
      o.constructor = { prototype: { piege: true } };
    });
    const lu = lireFichierClasseur(texte);
    assert.equal(lu.ok, true);
    assert.deepEqual(lu.affichage, {}); // réglages étranges ignorés
    const classeur = new Classeur();
    classeur.remplacer(lu.classeur);
    assert.equal(classeur.titre, '<img src=x onerror="piege()">'); // gardé comme simple texte
    assert.equal(classeur.feuilles[0].brut('A1'), '<script>piege()</script>');
    assert.equal({}.piege, undefined);
    assert.equal(execute, false);
    delete globalThis.piege;
  });

  test('version actuelle du format', () => {
    assert.equal(VERSION_FICHIER, 1);
    assert.equal(lireFichierClasseur(fichier((o) => delete o.affichage)).ok, true); // affichage facultatif
  });
});
