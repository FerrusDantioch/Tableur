// Comparaisons et conversions « à la française », comme dans Excel :
//   - le texte se compare sans tenir compte des majuscules (« Oui » = « oui ») ;
//   - les nombres se comparent sur 15 chiffres (0,1 + 0,2 = 0,3 est VRAI) ;
//   - un nombre devient du texte avec une virgule (2,5 → « 2,5 ») et
//     VRAI / FAUX restent en français ;
//   - les critères de NB.SI, SOMME.SI… : ">5", "<>non", "pom*", "<=31/12/2026"…
//
// Ces fonctions ne connaissent pas la bibliothèque de calcul : elles
// travaillent sur des valeurs simples (nombre, texte, booléen, null pour une
// cellule vide). Les erreurs sont gérées par l'appelant (fonctions.js).

import { lireDate, lireNombre } from '../donnees/saisie.js';

/** Nombre arrondi à 15 chiffres significatifs (supprime les « miettes » du calcul). */
export const arrondi15 = (nombre) => Number(nombre.toPrecision(15)) + 0;

/** Valeur → texte, comme Excel en français : 2,5 ; VRAI ; FAUX ; '' pour une cellule vide. */
export function texteDe(valeur) {
  if (valeur === null || valeur === undefined) return '';
  if (typeof valeur === 'boolean') return valeur ? 'VRAI' : 'FAUX';
  if (typeof valeur === 'number') return String(arrondi15(valeur)).replace('.', ',').replace('e', 'E');
  return String(valeur);
}

/** Rang des types pour comparer des valeurs différentes (comme Excel) : nombres < texte < VRAI/FAUX. */
const RANG = { number: 1, string: 2, boolean: 3 };

/** Compare deux textes sans tenir compte des majuscules (les accents comptent). */
export function comparerTextes(a, b) {
  return a.localeCompare(b, 'fr', { sensitivity: 'accent' });
}

/**
 * Compare deux valeurs : renvoie un nombre négatif, 0 ou positif.
 * Une cellule vide vaut 0 face à un nombre, "" face à un texte, FAUX face à un booléen.
 */
export function ordre(a, b) {
  let x = a;
  let y = b;
  const vide = (v) => v === null || v === undefined;
  if (vide(x) && vide(y)) return 0;
  if (vide(x)) x = typeof y === 'string' ? '' : typeof y === 'boolean' ? false : 0;
  if (vide(y)) y = typeof x === 'string' ? '' : typeof x === 'boolean' ? false : 0;
  if (typeof x !== typeof y) return RANG[typeof x] - RANG[typeof y];
  if (typeof x === 'number') return Math.sign(arrondi15(x) - arrondi15(y));
  if (typeof x === 'string') return comparerTextes(x, y);
  return Number(x) - Number(y);
}

/** Applique un opérateur de comparaison (=, <>, <, >, <=, >=) à deux valeurs. */
export function comparer(a, operateur, b) {
  const resultat = ordre(a, b);
  switch (operateur) {
    case '=':
      return resultat === 0;
    case '<>':
      return resultat !== 0;
    case '<':
      return resultat < 0;
    case '>':
      return resultat > 0;
    case '<=':
      return resultat <= 0;
    case '>=':
      return resultat >= 0;
    default:
      return false;
  }
}

/**
 * Motif « joker » → expression régulière : * (n'importe quels caractères),
 * ? (un caractère), ~* et ~? (une vraie étoile, un vrai point d'interrogation).
 */
function motifJoker(texte) {
  let source = '';
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (c === '~' && (texte[i + 1] === '*' || texte[i + 1] === '?' || texte[i + 1] === '~')) {
      source += `\\${texte[++i]}`;
    } else if (c === '*') source += '.*';
    else if (c === '?') source += '.';
    else source += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${source}$`, 'isu');
}

/** Vrai si le texte contient des jokers (* ou ?). */
const aDesJokers = (texte) => /[*?]/.test(texte);

/** Égalité de textes, avec jokers éventuels, sans tenir compte des majuscules. */
export function textesEgaux(motif, texte) {
  if (aDesJokers(motif)) return motifJoker(motif).test(texte);
  return comparerTextes(motif, texte) === 0;
}

/**
 * Transforme un critère de NB.SI / SOMME.SI / MOYENNE.SI en fonction qui dit
 * si une valeur le respecte. Exemples de critères :
 *   10   ">5"   "<=2,5"   "<>0"   "pomme"   "pom*"   "<>"   ""   ">=01/01/2026"   VRAI
 */
export function creerCritere(critere) {
  if (typeof critere === 'number') return (valeur) => typeof valeur === 'number' && arrondi15(valeur) === arrondi15(critere);
  if (typeof critere === 'boolean') return (valeur) => valeur === critere;
  if (critere === null || critere === undefined) return (valeur) => valeur === null || valeur === '';

  const morceaux = /^(<=|>=|<>|<|>|=)?([\s\S]*)$/.exec(String(critere));
  const operateur = morceaux[1] ?? '=';
  const reste = morceaux[2];

  // Critère vide : "" ou "=" → cellules vides ; "<>" → cellules non vides.
  if (reste === '') {
    if (operateur === '=') return (valeur) => valeur === null || valeur === '';
    if (operateur === '<>') return (valeur) => valeur !== null && valeur !== '';
    return () => false;
  }

  // Critère numérique (y compris une date jj/mm/aaaa).
  const nombre = lireNombre(reste) ?? lireDate(reste);
  if (nombre !== null) {
    if (operateur === '<>') return (valeur) => !(typeof valeur === 'number' && arrondi15(valeur) === arrondi15(nombre));
    return (valeur) => typeof valeur === 'number' && comparer(valeur, operateur, nombre);
  }

  // VRAI / FAUX.
  const majuscules = reste.trim().toUpperCase();
  if (['VRAI', 'FAUX', 'TRUE', 'FALSE'].includes(majuscules)) {
    const booleen = majuscules === 'VRAI' || majuscules === 'TRUE';
    if (operateur === '<>') return (valeur) => valeur !== booleen;
    if (operateur === '=') return (valeur) => valeur === booleen;
    return (valeur) => typeof valeur === 'boolean' && comparer(valeur, operateur, booleen);
  }

  // Texte (jokers permis pour = et <>).
  if (operateur === '=') return (valeur) => typeof valeur === 'string' && textesEgaux(reste, valeur);
  if (operateur === '<>') return (valeur) => !(typeof valeur === 'string' && textesEgaux(reste, valeur));
  return (valeur) => typeof valeur === 'string' && comparer(valeur, operateur, reste);
}
