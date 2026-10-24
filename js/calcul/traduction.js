// Traduction des formules « à la française » vers la syntaxe de la
// bibliothèque de calcul (fast-formula-parser), qui ne connaît que l'anglais.
//
// Ce que la personne tape            Ce que reçoit la bibliothèque
//   =SOMME(A1:A10)                     SUM(A1:A10)
//   =SI(A1>0;"oui";"non")              IF(A1>0,"oui","non")
//   =ARRONDI(B2*1,5;2)                 ROUND(B2*1.5,2)
//   =ET(VRAI;FAUX)                     AND(TRUE,FALSE)
//   =A1&" €"                           INTERNE.CONCAT(A1," €")
//   =SI(A1="oui";1;0)                  IF(INTERNE.COMPARER(A1,"=","oui"),1,0)
//
// Règles :
//   - les noms de fonctions français sont traduits (les noms anglais restent acceptés) ;
//   - le point-virgule « ; » sépare les arguments (comme dans Excel en français).
//     Par tolérance, une virgule qui n'est pas entre deux chiffres sépare aussi ;
//   - dans un nombre, la virgule est le séparateur décimal (le point aussi) ;
//   - VRAI et FAUX deviennent TRUE et FALSE ;
//   - le texte entre guillemets n'est jamais modifié ;
//   - l'opérateur « & » et les comparaisons (=, <>, <, >, <=, >=) sont confiés à
//     nos propres fonctions (voir fonctions.js) : la bibliothèque écrirait
//     « 2.5 » et « TRUE », et distinguerait « Oui » de « oui ».

import { decouper, segmenter } from '../donnees/formules.js';

export { decouper };

/** Fonctions disponibles : nom français → nom anglais de la bibliothèque. */
export const FONCTIONS = Object.freeze({
  // Les six fonctions de base
  SOMME: 'SUM',
  MOYENNE: 'AVERAGE',
  MEDIANE: 'MEDIAN',
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
  MAJUSCULE: 'UPPER',
  MINUSCULE: 'LOWER',
  // Conditions
  'NB.SI': 'COUNTIF',
  'SOMME.SI': 'SUMIF',
  'MOYENNE.SI': 'AVERAGEIF',
  'NB.SI.ENS': 'COUNTIFS',
  'SOMME.SI.ENS': 'SUMIFS',
  'MOYENNE.SI.ENS': 'AVERAGEIFS',
  NBVAL: 'COUNTA',
  // Dates
  AUJOURDHUI: 'TODAY',
  DATE: 'DATE',
  ANNEE: 'YEAR',
  MOIS: 'MONTH',
  JOUR: 'DAY',
  // Recherche
  RECHERCHEV: 'VLOOKUP',
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
  return traduireSuite(decouper(corps(formule)));
}

/** Traduit un jeton seul (nombre, séparateur, nom de fonction, VRAI / FAUX). */
function traduireJeton(jeton) {
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
}

/**
 * Traduit une suite de jetons : les parenthèses sont traduites à part
 * (récursivement), puis chaque argument (entre deux séparateurs) est traduit
 * comme une expression.
 */
function traduireSuite(jetons) {
  const morceaux = [];
  let i = 0;
  while (i < jetons.length) {
    const jeton = jetons[i];
    if (jeton.type === 'ouvrante') {
      // On cherche la parenthèse fermante qui correspond.
      let profondeur = 1;
      let j = i + 1;
      while (j < jetons.length && profondeur > 0) {
        if (jetons[j].type === 'ouvrante') profondeur++;
        else if (jetons[j].type === 'fermante') profondeur--;
        j++;
      }
      const fermee = profondeur === 0;
      const interieur = jetons.slice(i + 1, fermee ? j - 1 : j);
      morceaux.push({ type: 'groupe', texte: `(${traduireSuite(interieur)}${fermee ? ')' : ''}` });
      i = j;
      continue;
    }
    morceaux.push({ type: jeton.type, texte: traduireJeton(jeton) });
    i++;
  }
  // Découpage en arguments (séparateurs de ce niveau).
  const expressions = [[]];
  for (const morceau of morceaux) {
    if (morceau.type === 'separateur') expressions.push([]);
    else expressions.at(-1).push(morceau);
  }
  return expressions.map(traduireExpression).join(',');
}

const COMPARAISONS = ['=', '<>', '<', '>', '<=', '>='];
const texteDe = (morceaux) => morceaux.map((morceau) => morceau.texte).join('');
const vide = (morceaux) => texteDe(morceaux).trim() === '';

/** Coupe une liste de morceaux à chaque opérateur choisi. */
function couper(morceaux, estOperateur) {
  const parties = [[]];
  const operateurs = [];
  for (const morceau of morceaux) {
    if (estOperateur(morceau)) {
      operateurs.push(morceau.texte);
      parties.push([]);
    } else {
      parties.at(-1).push(morceau);
    }
  }
  return { parties, operateurs };
}

/**
 * Traduit une expression sans séparateur. Les comparaisons et « & » sont les
 * opérations les moins prioritaires (=A1+1&"x" assemble A1+1 et "x") : on
 * peut donc couper l'expression à ces opérateurs sans changer son sens.
 * Une formule mal écrite (opérande manquant) est laissée telle quelle : la
 * bibliothèque signalera l'erreur.
 */
function traduireExpression(morceaux) {
  // « < » suivi de « = » ou « > », et « > » suivi de « = », forment un seul opérateur.
  const fusionnes = [];
  for (const morceau of morceaux) {
    const precedent = fusionnes.at(-1);
    const suite = precedent?.type === 'operateur' && morceau.type === 'operateur';
    if (suite && ((precedent.texte === '<' && (morceau.texte === '=' || morceau.texte === '>')) || (precedent.texte === '>' && morceau.texte === '='))) {
      fusionnes[fusionnes.length - 1] = { type: 'operateur', texte: precedent.texte + morceau.texte };
    } else {
      fusionnes.push(morceau);
    }
  }
  const comparaisons = couper(fusionnes, (m) => m.type === 'operateur' && COMPARAISONS.includes(m.texte));
  if (comparaisons.parties.some(vide) && comparaisons.operateurs.length) return texteDe(morceaux);
  const textes = comparaisons.parties.map(traduireAssemblage);
  if (textes.includes(null)) return texteDe(morceaux);
  let resultat = textes[0];
  comparaisons.operateurs.forEach((operateur, k) => {
    resultat = `INTERNE.COMPARER(${resultat},"${operateur}",${textes[k + 1]})`;
  });
  return resultat;
}

/** A&B&C → INTERNE.CONCAT(A,B,C) ; null si un morceau manque (formule mal écrite). */
function traduireAssemblage(morceaux) {
  const { parties, operateurs } = couper(morceaux, (m) => m.type === 'operateur' && m.texte === '&');
  if (operateurs.length === 0) return texteDe(morceaux);
  if (parties.some(vide)) return null;
  return `INTERNE.CONCAT(${parties.map(texteDe).join(',')})`;
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
