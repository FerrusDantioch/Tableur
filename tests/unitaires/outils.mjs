// Outils communs aux tests unitaires.
//
// La bibliothèque de formules est chargée exactement comme dans le
// navigateur : le fichier vendor/fast-formula-parser/parser.min.js est
// exécuté comme un script classique, qui crée la variable « FormulaParser ».

import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { Classeur } from '../../js/donnees/classeur.js';
import { MoteurCalcul } from '../../js/calcul/moteur.js';
import { presenter } from '../../js/affichage/format.js';
import { interpreterSaisie } from '../../js/donnees/saisie.js';

globalThis.window ??= globalThis;
if (!globalThis.FormulaParser) {
  const fichier = new URL('../../vendor/fast-formula-parser/parser.min.js', import.meta.url);
  vm.runInThisContext(readFileSync(fichier, 'utf8'), { filename: 'parser.min.js' });
}

/**
 * Crée un classeur et son moteur de calcul, avec des cellules déjà remplies.
 * Renvoie des raccourcis pratiques pour les tests.
 */
export function creerTableur(cellules = {}) {
  const classeur = new Classeur();
  const feuille = classeur.feuilles[0];
  const moteur = new MoteurCalcul(classeur);

  /** Remplit des cellules : remplir({ A1: '10', B1: '=A1*2' }). */
  const remplir = (contenus) =>
    classeur.modifierCellules(
      feuille,
      Object.entries(contenus).map(([adresse, brut]) => ({ adresse, brut })),
    );

  /** Texte affiché dans une cellule, comme à l'écran (ex. "2,5", "#DIV/0!"). */
  const affiche = (adresse) => {
    const saisie = interpreterSaisie(feuille.brut(adresse));
    return presenter(moteur.valeur(feuille, adresse), saisie.style).texte;
  };

  /** Explication de l'erreur d'une cellule (ou undefined). */
  const explication = (adresse) => presenter(moteur.valeur(feuille, adresse)).explication;

  remplir(cellules);
  return { classeur, feuille, moteur, remplir, affiche, explication, valeur: (a) => moteur.valeur(feuille, a) };
}

/** Calcule une formule seule (dans Z1) au milieu de cellules données ; renvoie le texte affiché. */
export function calculer(formule, cellules = {}) {
  const { remplir, affiche } = creerTableur(cellules);
  remplir({ Z1: formule });
  return affiche('Z1');
}
