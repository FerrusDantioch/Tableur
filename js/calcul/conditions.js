// Mise en forme conditionnelle : la cellule respecte-t-elle une règle ?
// (Les règles elles-mêmes sont décrites dans donnees/regles.js.)
//
// - « supérieure à », « inférieure à », « entre », « négative » : seulement
//   pour les nombres (une date est un nombre de jours) ; les nombres sont
//   comparés sur 15 chiffres, comme dans Excel (0,1 + 0,2 est égal à 0,3).
// - « égale à » : un nombre si la valeur de la règle en est un, sinon un texte
//   (sans tenir compte des majuscules : « oui » = « Oui »).
// - « contient le texte » : dans le texte affiché de la cellule, sans tenir
//   compte des majuscules (« 2026 » se trouve dans une date 24/10/2026).
// - Une cellule vide ou en erreur ne respecte aucune règle.

import { dansPlage } from '../donnees/adresses.js';
import { arrondi15 } from './comparaisons.js';

const minuscules = (texte) => String(texte).trim().toLocaleLowerCase('fr');

/**
 * @param {object} regle  règle nettoyée (voir nettoyerRegle)
 * @param {*} valeur  valeur calculée de la cellule
 * @param {string} texte  texte affiché de la cellule
 */
export function regleVerifiee(regle, valeur, texte) {
  if (valeur === null || valeur === undefined || valeur === '') return false;
  if (typeof valeur === 'object') return false; // erreur de calcul (#DIV/0!…)
  const nombre = typeof valeur === 'number' ? arrondi15(valeur) : null;
  switch (regle.type) {
    case 'negatif':
      return nombre !== null && nombre < 0;
    case 'superieur':
      return nombre !== null && nombre > arrondi15(regle.nombre);
    case 'inferieur':
      return nombre !== null && nombre < arrondi15(regle.nombre);
    case 'entre': {
      if (nombre === null) return false;
      const bas = arrondi15(Math.min(regle.nombre, regle.nombre2));
      const haut = arrondi15(Math.max(regle.nombre, regle.nombre2));
      return nombre >= bas && nombre <= haut;
    }
    case 'egal':
      if (regle.nombre !== null) return nombre !== null && nombre === arrondi15(regle.nombre);
      return minuscules(texte) === minuscules(regle.valeur);
    case 'contient':
      return minuscules(texte).includes(minuscules(regle.valeur));
    default:
      return false;
  }
}

/**
 * Couleurs données par les règles à la cellule (ligne, colonne) :
 * { fond, encre } (null quand aucune règle ne s'applique). Pour chaque
 * couleur, la première règle de la liste qui s'applique l'emporte.
 */
export function couleursConditionnelles(regles, ligne, colonne, valeur, texte) {
  const resultat = { fond: null, encre: null };
  for (const regle of regles) {
    if (resultat.fond && resultat.encre) break;
    if (!dansPlage(regle.zone, ligne, colonne)) continue;
    if ((regle.fond && !resultat.fond) || (regle.encre && !resultat.encre)) {
      if (!regleVerifiee(regle, valeur, texte)) continue;
      resultat.fond ??= regle.fond;
      resultat.encre ??= regle.encre;
    }
  }
  return resultat;
}
