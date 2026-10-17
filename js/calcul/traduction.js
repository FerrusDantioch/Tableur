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

import { lettresColonne, numeroColonne } from '../donnees/adresses.js';

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

const LETTRE = /[A-Za-z_$À-ſ]/;
const CARACTERE_NOM = /[A-Za-z0-9_.$À-ſ]/;
const CHIFFRE = /[0-9]/;
// Jetons après lesquels un « ,5 » ou « .5 » est un nombre (et pas un séparateur).
const AVANT_NOMBRE = new Set(['debut', 'separateur', 'ouvrante', 'operateur']);

/**
 * Découpe une formule (sans le « = ») en jetons :
 *   { type: 'texte', source }                   "entre guillemets"
 *   { type: 'feuille', source }                 'Nom de feuille'!
 *   { type: 'nombre', source, nombre }          12   3,5   1E3
 *   { type: 'nom', source, fonction }           A1, SOMME (fonction: vrai si suivi de « ( »), VRAI…
 *   { type: 'separateur', source }              ;  ou  ,
 *   { type: 'ouvrante' | 'fermante', source }   ( )
 *   { type: 'operateur', source }               + - * / ^ & = < > % :
 *   { type: 'espace' | 'autre', source }
 * En recollant les « source », on retrouve exactement le texte de départ.
 */
export function decouper(formule) {
  const jetons = [];
  let i = 0;
  let precedent = 'debut'; // type du dernier jeton qui n'est pas une espace

  const ajouter = (jeton) => {
    jetons.push(jeton);
    if (jeton.type !== 'espace') precedent = jeton.type;
  };

  while (i < formule.length) {
    const c = formule[i];
    const suivant = formule[i + 1] ?? '';

    // Texte entre guillemets ("" à l'intérieur = un guillemet).
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < formule.length) {
        if (formule[j] === c && formule[j + 1] === c) j += 2;
        else if (formule[j] === c) break;
        else j++;
      }
      j = Math.min(j + 1, formule.length);
      if (c === "'" && formule[j] === '!') j++;
      ajouter({ type: c === '"' ? 'texte' : 'feuille', source: formule.slice(i, j) });
      i = j;
      continue;
    }

    // Nombre : 12   3,5   3.5   1E3   1,5E-2   et aussi ,5 ou .5 en début d'argument.
    const debutDecimal = (c === ',' || c === '.') && CHIFFRE.test(suivant) && AVANT_NOMBRE.has(precedent);
    if (CHIFFRE.test(c) || debutDecimal) {
      let j = i;
      while (CHIFFRE.test(formule[j] ?? '')) j++;
      if ((formule[j] === ',' || formule[j] === '.') && CHIFFRE.test(formule[j + 1] ?? '')) {
        j++;
        while (CHIFFRE.test(formule[j] ?? '')) j++;
      }
      const exposant = /^[eE][+-]?[0-9]+/.exec(formule.slice(j));
      if (exposant) j += exposant[0].length;
      const source = formule.slice(i, j);
      ajouter({ type: 'nombre', source, nombre: Number(source.replace(',', '.')) });
      i = j;
      continue;
    }

    // Nom : référence de cellule (A1, $B$2), fonction (SOMME, NB.SI), VRAI, FAUX…
    if (LETTRE.test(c)) {
      let j = i + 1;
      while (CARACTERE_NOM.test(formule[j] ?? '')) j++;
      let k = j;
      while (formule[k] === ' ') k++;
      ajouter({ type: 'nom', source: formule.slice(i, j), fonction: formule[k] === '(' });
      i = j;
      continue;
    }

    if (c === ';' || c === ',') ajouter({ type: 'separateur', source: c });
    else if (c === '(') ajouter({ type: 'ouvrante', source: c });
    else if (c === ')') ajouter({ type: 'fermante', source: c });
    else if (/\s/.test(c)) ajouter({ type: 'espace', source: c });
    else if ('+-*/^&=<>%:'.includes(c)) ajouter({ type: 'operateur', source: c });
    else ajouter({ type: 'autre', source: c });
    i++;
  }
  return jetons;
}

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
  const jetons = decouper(corps(formule)).filter((jeton) => jeton.type !== 'espace');
  const inconnus = [];
  jetons.forEach((jeton, i) => {
    if (jeton.type !== 'nom' || jeton.fonction) return;
    const nom = jeton.source.toUpperCase();
    if (['VRAI', 'FAUX', 'TRUE', 'FALSE'].includes(nom)) return;
    if (/^\$?[A-Z]{1,3}\$?[0-9]+$/.test(nom)) return; // cellule : B3, $B$3
    if (jetons[i - 1]?.source === '#') return; // erreur écrite dans la formule : #REF!
    // Colonne ou ligne entière : A:C, $1:$3
    const deuxPoints = jetons[i - 1]?.source === ':' || jetons[i + 1]?.source === ':';
    if (deuxPoints && /^\$?([A-Z]{1,3}|[0-9]+)$/.test(nom)) return;
    inconnus.push(jeton.source);
  });
  return inconnus;
}

const MOTIF_REFERENCE = /^(\$?)([A-Za-z]{1,3})(\$?)([0-9]+)$/;

/**
 * Décale les références d'une formule, comme lors d'un copier-coller dans
 * Excel : =A1*2 copiée une ligne plus bas devient =A2*2.
 * Les parties précédées d'un « $ » ne bougent pas ($A$1 reste $A$1).
 * Une référence qui sortirait de la grille devient #REF!.
 */
export function decalerReferences(formule, dLignes, dColonnes) {
  const texte = String(formule).trim();
  if (!texte.startsWith('=')) return formule;
  const decalee = decouper(texte.slice(1))
    .map((jeton) => {
      if (jeton.type !== 'nom' || jeton.fonction) return jeton.source;
      const ref = MOTIF_REFERENCE.exec(jeton.source);
      if (!ref) return jeton.source;
      const [, dollarColonne, lettres, dollarLigne, chiffres] = ref;
      const ligne = Number(chiffres) + (dollarLigne ? 0 : dLignes);
      const colonne = numeroColonne(lettres) + (dollarColonne ? 0 : dColonnes);
      if (ligne < 1 || colonne < 1) return '#REF!';
      return `${dollarColonne}${lettresColonne(colonne)}${dollarLigne}${ligne}`;
    })
    .join('');
  return `=${decalee}`;
}
