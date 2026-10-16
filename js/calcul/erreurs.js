// Erreurs de calcul, affichées dans les cellules comme dans Excel en français
// (#DIV/0!, #VALEUR!, #REF!…), avec une explication en clair qui apparaît
// en bas de l'écran quand on sélectionne la cellule.

/**
 * Chaque erreur : le code utilisé par la bibliothèque de formules (en
 * anglais), le texte affiché dans la cellule et une explication simple.
 */
const ERREURS = {
  '#DIV/0!': {
    affichage: '#DIV/0!',
    explication: 'Division par zéro : la formule divise par 0 ou par une cellule vide.',
  },
  '#VALUE!': {
    affichage: '#VALEUR!',
    explication: 'Valeur incorrecte : la formule calcule avec du texte là où un nombre est attendu.',
  },
  '#REF!': {
    affichage: '#REF!',
    explication: 'Référence invalide : la formule désigne une cellule qui n’existe pas (au-delà de la colonne AZ ou de la ligne 1000).',
  },
  '#NAME?': {
    affichage: '#NOM?',
    explication: 'Nom inconnu : une fonction ou une référence est mal orthographiée.',
  },
  '#NUM!': {
    affichage: '#NOMBRE!',
    explication: 'Calcul impossible : nombre trop grand, ou opération interdite (comme la racine d’un nombre négatif).',
  },
  '#N/A': {
    affichage: '#N/A',
    explication: 'Valeur non disponible.',
  },
  '#NULL!': {
    affichage: '#NUL!',
    explication: 'Plages sans cellule commune.',
  },
  '#ERROR!': {
    affichage: '#ERREUR!',
    explication: 'Formule mal écrite : vérifiez les parenthèses, les points-virgules et les guillemets.',
  },
  '#CIRC!': {
    affichage: '#CIRC!',
    explication: 'Référence circulaire : la formule dépend de sa propre cellule, directement ou par d’autres cellules.',
  },
};

/** Codes connus (ceux de la bibliothèque, plus #CIRC! pour les boucles). */
export const CODES_ERREUR = Object.keys(ERREURS);

/** Une erreur de calcul, stockée comme valeur de la cellule. */
export class ErreurCalcul {
  /**
   * @param {string} code  code de la bibliothèque, ex. '#DIV/0!'
   * @param {string} [precision]  complément d'explication (ex. nom de la fonction inconnue)
   */
  constructor(code, precision = '') {
    const connue = ERREURS[code] ?? ERREURS['#ERROR!'];
    this.code = ERREURS[code] ? code : '#ERROR!';
    this.affichage = connue.affichage;
    this.explication = precision ? `${connue.explication} ${precision}` : connue.explication;
  }

  toString() {
    return this.affichage;
  }
}

/** Vrai si la valeur est une erreur de calcul. */
export function estErreur(valeur) {
  return valeur instanceof ErreurCalcul;
}
