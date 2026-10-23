// Traduction des formules « à la française » vers la syntaxe de la
// bibliothèque de calcul (fast-formula-parser), qui ne connaît que l'anglais.
//
// Ce que la personne tape            Ce que reçoit la bibliothèque
//   =SOMME(A1:A10)                     SUM(A1:A10)
//   =SI(A1>0;"oui";"non")              IF(A1>0,"oui","non")
//   =ARRONDI(B2*1,5;2)                 ROUND(B2*1.5,2)
//   =ET(VRAI;FAUX)                     AND(TRUE,FALSE)
//
// Règles :
//   - les noms de fonctions français sont traduits (les noms anglais restent acceptés) ;
//   - le point-virgule « ; » sépare les arguments (comme dans Excel en français).
//     Par tolérance, une virgule qui n'est pas entre deux chiffres sépare aussi ;
//   - dans un nombre, la virgule est le séparateur décimal (le point aussi) ;
//   - VRAI et FAUX deviennent TRUE et FALSE ;
//   - le texte entre guillemets n'est jamais modifié.

import { decouper, segmenter } from '../donnees/formules.js';

export { decouper };

/** Fonctions disponibles : nom français → nom anglais de la bibliothèque. */
export const FONCTIONS = Object.freeze({
  // Les six fonctions de base
  SOMME: 'SUM',
  MOYENNE: 'AVERAGE',
  MIN: 'MIN',
  MAX: 'MAX',
  NB: 'COUNT',
  SI: 'IF',
  // Quelques fonctions courantes en plus
  ET: 'AND',
  OU: 'OR',
  NON: 'NOT',
  SIERREUR: 'IFERROR',
  ARRONDI: 'ROUND',
  'ARRONDI.SUP': 'ROUNDUP',
  'ARRONDI.INF': 'ROUNDDOWN',
  ABS: 'ABS',
  ENT: 'INT',
  MOD: 'MOD',
  PRODUIT: 'PRODUCT',
  RACINE: 'SQRT',
  PUISSANCE: 'POWER',
  NBCAR: 'LEN',
  CONCATENER: 'CONCATENATE',
  'SOMME.SI': 'SUMIF',
  'MOYENNE.SI': 'AVERAGEIF',
});

/** Retire le « = » du début (et les espaces autour). */
function corps(formule) {
  return String(formule).trim().replace(/^=/, '');
}

/**
 * Traduit une formule française (avec ou sans « = ») en formule pour la
 * bibliothèque (sans « = »).
 */
export function traduireFormule(formule) {
  return decouper(corps(formule))
    .map((jeton) => {
      switch (jeton.type) {
        case 'nombre':
          // String(…) donne une écriture que la bibliothèque comprend : 1.5, 1e-7, 1e+21.
          return String(jeton.nombre);
        case 'separateur':
          return ',';
        case 'nom': {
          const majuscules = jeton.source.toUpperCase();
          if (jeton.fonction) return FONCTIONS[majuscules] ?? majuscules;
          if (majuscules === 'VRAI') return 'TRUE';
          if (majuscules === 'FAUX') return 'FALSE';
          return jeton.source;
        }
        default:
          return jeton.source;
      }
    })
    .join('');
}

/**
 * Noms qui ne désignent ni une cellule, ni une fonction, ni VRAI / FAUX :
 * par exemple « total » dans =total*2. La formule affichera alors #NOM?.
 */
export function nomsInconnus(formule) {
  const morceaux = segmenter(corps(formule)).filter((morceau) => morceau.reference || morceau.jeton.type !== 'espace');
  const inconnus = [];
  morceaux.forEach((morceau, i) => {
    const jeton = morceau.jeton;
    if (!jeton || jeton.type !== 'nom' || jeton.fonction) return;
    if (['VRAI', 'FAUX', 'TRUE', 'FALSE'].includes(jeton.source.toUpperCase())) return;
    if (morceaux[i - 1]?.source === '#') return; // erreur écrite dans la formule : #REF!
    inconnus.push(jeton.source);
  });
  return inconnus;
}
