// Interprétation de ce que la personne tape dans une cellule.
//
// Le texte tapé (appelé « brut ») est toujours conservé tel quel : c'est lui
// qui est enregistré et réaffiché quand on modifie la cellule. Cette fonction
// en déduit seulement :
//   - le TYPE de contenu : vide, nombre, texte, booléen (VRAI/FAUX) ou formule ;
//   - la VALEUR utilisée par les calculs (ex. "3,5" → 3.5) ;
//   - le STYLE d'affichage des nombres : général, pourcentage ou euros.

/**
 * @typedef {object} Saisie
 * @property {'vide'|'nombre'|'texte'|'booleen'|'formule'} type
 * @property {number|string|boolean|null} valeur  valeur pour les calculs (null pour vide et formule)
 * @property {'general'|'pourcent'|'euro'} style  façon d'afficher un nombre
 * @property {string} [formule]  texte de la formule, avec le « = » (type formule seulement)
 */

// Espaces acceptés entre les milliers : espace normale, insécable, fine insécable.
const ESPACES = '[ \\u00A0\\u202F]';

// Un nombre « à la française » ou « à l'anglaise » :
//   12   -7   3,5   3.5   1 234,56   ,5   2,   1E3   1,5e-2
// Les espaces ne sont acceptées qu'entre des groupes de trois chiffres.
const MOTIF_NOMBRE = new RegExp(
  `^[+-]?(?:\\d{1,3}(?:${ESPACES}\\d{3})+|\\d+)?(?:[.,]\\d*)?(?:[eE][+-]?\\d+)?$`,
);

/**
 * Convertit un texte en nombre, ou renvoie null si ce n'est pas un nombre.
 * Exemples : "3,5" → 3.5, "1 234" → 1234, "abc" → null.
 */
export function lireNombre(texte) {
  const propre = String(texte).trim();
  // Il faut au moins un chiffre (sinon "," ou "+" seraient des nombres).
  if (!/\d/.test(propre) || !MOTIF_NOMBRE.test(propre)) return null;
  const normalise = propre.replace(new RegExp(ESPACES, 'g'), '').replace(',', '.');
  // Le motif peut s'arrêter sur un séparateur décimal seul (ex. « 2, » ou
  // « 1,E3 ») : on retire ce séparateur orphelin avant la conversion.
  const nombre = Number(normalise.replace(/\.(?=$|[eE])/, ''));
  return Number.isFinite(nombre) ? nombre : null;
}

/** Interprète le texte brut d'une cellule. */
export function interpreterSaisie(brut) {
  const texte = String(brut ?? '');
  const sansEspaces = texte.trim();

  if (sansEspaces === '') return { type: 'vide', valeur: null, style: 'general' };

  // Une apostrophe au début force le texte (comme dans Excel) : '0123 reste « 0123 ».
  if (texte.startsWith("'")) return { type: 'texte', valeur: texte.slice(1), style: 'general' };

  // Le signe « = » au début annonce une formule, calculée par le moteur de calcul.
  if (sansEspaces.startsWith('=')) {
    return { type: 'formule', valeur: null, style: 'general', formule: sansEspaces };
  }

  const majuscules = sansEspaces.toUpperCase();
  if (majuscules === 'VRAI') return { type: 'booleen', valeur: true, style: 'general' };
  if (majuscules === 'FAUX') return { type: 'booleen', valeur: false, style: 'general' };

  // Pourcentage (« 20 % ») ou montant en euros (« 12,50 € »).
  const unite = /^(.*?)[   ]*([%€])$/.exec(sansEspaces);
  if (unite) {
    const nombre = lireNombre(unite[1]);
    if (nombre !== null) {
      return unite[2] === '%'
        ? { type: 'nombre', valeur: nombre / 100, style: 'pourcent' }
        : { type: 'nombre', valeur: nombre, style: 'euro' };
    }
  }

  const nombre = lireNombre(sansEspaces);
  if (nombre !== null) return { type: 'nombre', valeur: nombre, style: 'general' };

  return { type: 'texte', valeur: texte, style: 'general' };
}
