// Mise en forme des valeurs pour l'affichage, à la française :
// virgule décimale, VRAI / FAUX, « 12,50 € », « 15 % ».
//
// Ce module ne fait aucun calcul : il reçoit une valeur déjà calculée et
// renvoie le texte à montrer dans la cellule.

const formatGeneral = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 10, useGrouping: false });
const formatPourcent = new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 8 });
const formatEuro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

/**
 * Supprime les « miettes » des calculs en virgule flottante :
 * 0.1 + 0.2 vaut 0.30000000000000004 pour l'ordinateur, on affiche 0,3.
 */
export function arrondiPropre(nombre) {
  return Number(nombre.toPrecision(15));
}

/** Nombre → texte français. Style : 'general', 'pourcent' ou 'euro'. */
export function formaterNombre(nombre, style = 'general') {
  const propre = arrondiPropre(nombre) + 0; // « + 0 » transforme -0 en 0
  if (style === 'pourcent') return formatPourcent.format(propre);
  if (style === 'euro') return formatEuro.format(propre);
  const taille = Math.abs(propre);
  // Très grands ou très petits nombres : notation scientifique, comme Excel (1,5E+20).
  if (taille !== 0 && (taille >= 1e15 || taille < 1e-9)) {
    const [mantisse, exposant] = propre.toExponential(9).split('e');
    const sansZeros = mantisse.replace(/\.?0+$/, '').replace('.', ',');
    const signe = exposant.startsWith('-') ? '-' : '+';
    return `${sansZeros}E${signe}${exposant.replace(/^[+-]/, '').padStart(2, '0')}`;
  }
  return formatGeneral.format(propre);
}

/** Nombre → texte pour un fichier CSV : virgule décimale, sans espace ni symbole. */
export function nombrePourFichier(nombre) {
  return String(arrondiPropre(nombre) + 0).replace('.', ',');
}

/**
 * Prépare l'affichage d'une valeur de cellule.
 * @param {*} valeur  nombre, texte, booléen, erreur de calcul ou null
 * @param {string} [style]  style des nombres saisis (voir donnees/saisie.js)
 * @returns {{texte: string, genre: 'vide'|'nombre'|'texte'|'booleen'|'erreur', explication?: string}}
 */
export function presenter(valeur, style = 'general') {
  if (valeur === null || valeur === undefined) return { texte: '', genre: 'vide' };
  if (typeof valeur === 'number') return { texte: formaterNombre(valeur, style), genre: 'nombre' };
  if (typeof valeur === 'boolean') return { texte: valeur ? 'VRAI' : 'FAUX', genre: 'booleen' };
  if (typeof valeur === 'object' && 'affichage' in valeur) {
    // Erreur de calcul (voir calcul/erreurs.js) : code court + explication.
    return { texte: valeur.affichage, genre: 'erreur', explication: valeur.explication };
  }
  return { texte: String(valeur), genre: 'texte' };
}
