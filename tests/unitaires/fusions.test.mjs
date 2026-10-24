// Ajout 2d : cellules fusionnées.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { creerClasseurDeTest } from './outils.mjs';
import { lirePlage, textePlage } from '../../js/donnees/adresses.js';
import { ajusterFusions, etendreAuxFusions, fusionContenant } from '../../js/donnees/fusions.js';
import { Classeur } from '../../js/donnees/classeur.js';
import { creerFichierClasseur, lireFichierClasseur } from '../../js/donnees/fichier-classeur.js';
import { Selection } from '../../js/affichage/selection.js';

const P = (texte) => lirePlage(texte);
const textes = (fusions) => fusions.map(textePlage);

describe('Calculs sur les fusions', () => {
  test('cellule dans une fusion ; sélection agrandie (même en chaîne)', () => {
    const fusions = [P('B2:C3'), P('D3:E4')];
    assert.equal(textePlage(fusionContenant(fusions, 3, 3)), 'B2:C3');
    assert.equal(fusionContenant(fusions, 1, 1), null);
    assert.equal(textePlage(etendreAuxFusions(fusions, P('A1:B2'))), 'A1:C3');
    // C3:D3 touche B2:C3, puis le nouveau rectangle touche D3:E4.
    assert.equal(textePlage(etendreAuxFusions(fusions, P('C3:D3'))), 'B2:E4');
  });

  test('insertion et suppression de lignes ou de colonnes', () => {
    const fusions = [P('A2:C4')];
    const lignes = (type, position, nombre) => textes(ajusterFusions(fusions, { axe: 'lignes', type, position, nombre, maximum: 1000 }));
    assert.deepEqual(lignes('insertion', 1, 2), ['A4:C6']); // avant : décalée
    assert.deepEqual(lignes('insertion', 3, 2), ['A2:C6']); // au milieu : agrandie
    assert.deepEqual(lignes('insertion', 5, 2), ['A2:C4']); // après : inchangée
    assert.deepEqual(lignes('suppression', 3, 1), ['A2:C3']); // une ligne en moins
    assert.deepEqual(lignes('suppression', 1, 2), ['A1:C2']); // la première ligne part
    assert.deepEqual(lignes('suppression', 2, 3), []); // toutes ses lignes : disparue
    const colonnes = textes(ajusterFusions([P('B1:C1')], { axe: 'colonnes', type: 'suppression', position: 3, nombre: 1 }));
    assert.deepEqual(colonnes, []); // il ne resterait qu'une cellule
  });
});

describe('Fusionner et défusionner', () => {
  test('seule la cellule en haut à gauche garde son contenu ; texte centré ; annulable', () => {
    const t = creerClasseurDeTest({ A1: 'Budget 2026', B1: 'x', C1: '=1+1', A2: 'ligne 2' });
    t.classeur.modifierCellules(t.feuille, [{ adresse: 'B1', fond: 'jaune' }]);
    const avant = JSON.stringify(t.classeur.versJSON());
    assert.deepEqual(t.classeur.fusionner(t.feuille, P('A1:C1')), { ok: true });
    assert.deepEqual(textes(t.feuille.fusions), ['A1:C1']);
    assert.equal(t.feuille.brut('A1'), 'Budget 2026');
    assert.equal(t.feuille.brut('B1'), '');
    assert.equal(t.feuille.brut('C1'), '');
    assert.equal(t.feuille.cellule('B1').fond, 'jaune'); // la mise en forme reste
    assert.equal(t.feuille.cellule('A1').alignement, 'centre');
    assert.equal(t.feuille.brut('A2'), 'ligne 2');
    assert.equal(t.valeur('C1'), null);
    // Annuler : tout revient (contenus, pas de fusion) ; Rétablir : fusion refaite.
    t.classeur.annuler();
    assert.equal(JSON.stringify(t.classeur.versJSON()), avant);
    assert.equal(t.valeur('C1'), 2);
    t.classeur.retablir();
    assert.deepEqual(textes(t.feuille.fusions), ['A1:C1']);
  });

  test('un alignement déjà choisi est gardé ; refus si moins de deux cellules ou fusion coupée', () => {
    const t = creerClasseurDeTest({ A1: 'Titre' });
    t.classeur.modifierCellules(t.feuille, [{ adresse: 'A1', alignement: 'gauche' }]);
    t.classeur.fusionner(t.feuille, P('A1:B1'));
    assert.equal(t.feuille.cellule('A1').alignement, 'gauche');
    assert.equal(t.classeur.fusionner(t.feuille, P('D4')).ok, false);
    const coupe = t.classeur.fusionner(t.feuille, P('B1:B3'));
    assert.equal(coupe.ok, false);
    assert.match(coupe.message, /coupe la cellule fusionnée A1:B1/);
    // Une plage qui contient toute une fusion la remplace.
    assert.equal(t.classeur.fusionner(t.feuille, P('A1:C2')).ok, true);
    assert.deepEqual(textes(t.feuille.fusions), ['A1:C2']);
  });

  test('défusionner : les cellules redeviennent séparées, le contenu reste en haut à gauche', () => {
    const t = creerClasseurDeTest({ A1: 'Titre' });
    t.classeur.fusionner(t.feuille, P('A1:D1'));
    t.classeur.fusionner(t.feuille, P('A3:A5'));
    assert.equal(t.classeur.defusionner(t.feuille, P('B1')), 1);
    assert.deepEqual(textes(t.feuille.fusions), ['A3:A5']);
    assert.equal(t.feuille.brut('A1'), 'Titre');
    assert.equal(t.classeur.defusionner(t.feuille, P('Z9')), 0);
    t.classeur.annuler();
    assert.deepEqual(textes(t.feuille.fusions), ['A1:D1', 'A3:A5']);
  });

  test('un collage ou une recopie ne met pas de texte dans les cellules couvertes', () => {
    const t = creerClasseurDeTest({ A1: 'Titre' });
    t.classeur.fusionner(t.feuille, P('A1:C1'));
    t.classeur.modifierCellules(t.feuille, [
      { adresse: 'A1', brut: 'Nouveau titre' },
      { adresse: 'B1', brut: 'caché', gras: true },
      { adresse: 'D1', brut: 'à côté' },
    ]);
    assert.equal(t.feuille.brut('A1'), 'Nouveau titre');
    assert.equal(t.feuille.brut('B1'), '');
    assert.equal(t.feuille.cellule('B1').gras, true); // la mise en forme, elle, s'applique
    assert.equal(t.feuille.brut('D1'), 'à côté');
  });

  test('insérer ou supprimer des lignes et des colonnes déplace les fusions', () => {
    const t = creerClasseurDeTest({ A2: 'Titre', E9: '=A2' });
    t.classeur.fusionner(t.feuille, P('A2:C3'));
    t.classeur.inserer(t.feuille, 'lignes', 1, 1);
    assert.deepEqual(textes(t.feuille.fusions), ['A3:C4']);
    assert.equal(t.feuille.brut('E10'), '=A3'); // la formule suit, comme avant
    t.classeur.inserer(t.feuille, 'colonnes', 2, 2);
    assert.deepEqual(textes(t.feuille.fusions), ['A3:E4']);
    t.classeur.supprimer(t.feuille, 'lignes', 4, 1);
    assert.deepEqual(textes(t.feuille.fusions), ['A3:E3']);
    t.classeur.annuler();
    assert.deepEqual(textes(t.feuille.fusions), ['A3:E4']);
  });

  test('trier des lignes qui contiennent une fusion est refusé', () => {
    const t = creerClasseurDeTest({ A1: 'b', A2: 'a', A3: 'c' });
    t.classeur.fusionner(t.feuille, P('B2:C2'));
    assert.equal(t.classeur.reordonnerLignes(t.feuille, P('A1:C3'), [2, 1, 3]), false);
    assert.equal(t.feuille.brut('A1'), 'b');
    assert.deepEqual(textes(t.classeur.fusionsGenantes(t.feuille, P('A1:C3'))), ['B2:C2']);
    assert.deepEqual(t.classeur.fusionsGenantes(t.feuille, P('A3:C5')), []);
  });
});

describe('Enregistrement des fusions', () => {
  test('sauvegarde, rechargement et fichier .json', () => {
    const t = creerClasseurDeTest({ A1: 'Titre' });
    t.classeur.fusionner(t.feuille, P('A1:D1'));
    t.classeur.fusionner(t.feuille, P('F2:F4'));
    const donnees = t.classeur.versJSON();
    assert.deepEqual(donnees.feuilles[0].fusions, ['A1:D1', 'F2:F4']);
    const autre = new Classeur();
    autre.charger(JSON.parse(JSON.stringify(donnees)));
    assert.deepEqual(textes(autre.feuilles[0].fusions), ['A1:D1', 'F2:F4']);

    const lu = lireFichierClasseur(JSON.stringify(creerFichierClasseur(t.classeur)));
    assert.equal(lu.ok, true);
    assert.deepEqual(lu.classeur.feuilles[0].fusions, ['A1:D1', 'F2:F4']);
  });

  test('fusions impossibles : ignorées au rechargement, refusées dans un fichier importé', () => {
    const classeur = new Classeur();
    classeur.charger({ format: 'omni-tableur', version: 2, feuilles: [{ nom: 'F', fusions: ['A1:B2', 'B2:C3', 'D4', 'zzz', 12, 'E1:E3'] }] });
    assert.deepEqual(textes(classeur.feuilles[0].fusions), ['A1:B2', 'E1:E3']);

    const t = creerClasseurDeTest();
    const fichier = (fusions) => {
      const objet = creerFichierClasseur(t.classeur);
      objet.feuilles[0].fusions = fusions;
      return lireFichierClasseur(JSON.stringify(objet));
    };
    assert.equal(fichier(['A1:C1']).ok, true);
    for (const mauvaises of [['A1:B2', 'B2:C3'], ['A1'], ['A1:ZZZ9'], 'A1:B1', [12]]) {
      const lu = fichier(mauvaises);
      assert.equal(lu.ok, false, JSON.stringify(mauvaises));
      assert.match(lu.message, /fusionnées/);
    }
  });
});

describe('Sélection et cellules fusionnées', () => {
  const fusions = [P('B2:C3')];
  const creer = () => new Selection(() => ({ lignes: 100, colonnes: 26 }), () => fusions);

  test('choisir une cellule couverte choisit la cellule fusionnée entière', () => {
    const selection = creer();
    selection.choisir(3, 3);
    assert.deepEqual(selection.active, { ligne: 2, colonne: 2 });
    assert.equal(textePlage(selection.plage), 'B2:C3');
    assert.equal(selection.unique, true);
    selection.choisir(1, 1);
    selection.choisir(2, 2, true);
    assert.equal(textePlage(selection.plage), 'A1:C3'); // la plage contient toute la fusion
    assert.equal(selection.unique, false);
  });

  test('les flèches sautent par-dessus la cellule fusionnée', () => {
    const selection = creer();
    selection.choisir(2, 2);
    selection.deplacer(0, 1);
    assert.deepEqual(selection.active, { ligne: 2, colonne: 4 });
    selection.choisir(2, 2);
    selection.deplacer(1, 0);
    assert.deepEqual(selection.active, { ligne: 4, colonne: 2 });
    selection.choisir(2, 4);
    selection.deplacer(0, -1);
    assert.deepEqual(selection.active, { ligne: 2, colonne: 2 }); // on entre dans la fusion par son coin
  });
});

describe('Fusions et première ligne figée', () => {
  test('pas de fusion à cheval sur la ligne figée', () => {
    const t = creerClasseurDeTest({ A1: 'Titre' });
    t.classeur.fusionner(t.feuille, P('A1:B2'));
    assert.equal(t.classeur.figerPremiereLigne(t.feuille, true), false);
    assert.equal(t.feuille.figee, false);
    t.classeur.defusionner(t.feuille, P('A1'));
    assert.equal(t.classeur.figerPremiereLigne(t.feuille, true), true);
    const refus = t.classeur.fusionner(t.feuille, P('A1:A3'));
    assert.equal(refus.ok, false);
    assert.match(refus.message, /ligne 1 est figée/);
    assert.equal(t.classeur.fusionner(t.feuille, P('A1:D1')).ok, true); // sur la ligne 1 seulement : permis
  });
});
