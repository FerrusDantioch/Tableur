// Mise en forme des valeurs pour l'affichage, à la française :
// virgule décimale, VRAI / FAUX, « 12,50 € », « 15 % », « 23/10/2026 ».
//
// Deux cas :
//   - format « automatique » : le nombre s'affiche comme il a été tapé
//     (20 % reste en pourcentage, 12,50 € en euros, une date en date) ;
//   - format choisi dans « Format » : nombre (avec séparateur des milliers),
//     euros, pourcentage ou date, avec un nombre de décimales fixe.
//
// Ce module ne fait aucun calcul : il reçoit une valeur déjà calculée et
// renvoie le texte à montrer dans la cellule.

import { dateVersTexte } from '../donnees/saisie.js';

/** Plus grand numéro de date (31/12/9999). */
const DERNIERE_DATE = 2958465;

/** Numéro de série → « jj/mm/aaaa », ou « ##### » s'il ne correspond à aucune date (comme Excel). */
function dateOuDieses(nombre) {
  return nombre >= 1 && nombre <= DERNIERE_DATE ? dateVersTexte(nombre) : '#####';
}

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

/** Nombre → texte français. Style : 'general', 'pourcent', 'euro' ou 'date'. */
export function formaterNombre(nombre, style = 'general') {
  const propre = arrondiPropre(nombre) + 0; // « + 0 » transforme -0 en 0
  if (style === 'pourcent') return formatPourcent.format(propre);
  if (style === 'euro') return formatEuro.format(propre);
  if (style === 'date') return dateOuDieses(propre);
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

/** Formats choisis (Intl.NumberFormat), gardés pour ne pas les recréer à chaque cellule. */
const formats = new Map();
function formateur(type, decimales) {
  const cle = `${type}|${decimales}`;
  if (!formats.has(cle)) {
    const options = { minimumFractionDigits: decimales, maximumFractionDigits: decimales };
    if (type === 'euro') Object.assign(options, { style: 'currency', currency: 'EUR' });
    if (type === 'pourcent') options.style = 'percent';
    formats.set(cle, new Intl.NumberFormat('fr-FR', options));
  }
  return formats.get(cle);
}

/**
 * Nombre → texte selon un format choisi : { type: 'nombre'|'euro'|'pourcent'|'date', decimales }.
 * Exemples avec 2 décimales : 1 234,50 ; 1 234,50 € ; 12,50 %.
 */
export function formaterSelonFormat(nombre, format) {
  const propre = arrondiPropre(nombre) + 0;
  if (format.type === 'date') return dateOuDieses(propre);
  return formateur(format.type, format.decimales).format(propre);
}

/** Nombre de décimales affichées par le format automatique (pour « + décimale »). */
export function decimalesAffichees(nombre, style = 'general') {
  const texte = formaterNombre(nombre, style);
  const morceaux = /,(\d+)/.exec(texte);
  return morceaux ? Math.min(10, morceaux[1].length) : 0;
}

/** Nombre → texte pour un fichier CSV : virgule décimale, sans espace ni symbole. */
export function nombrePourFichier(nombre) {
  return String(arrondiPropre(nombre) + 0).replace('.', ',');
}

/**
 * Prépare l'affichage d'une valeur de cellule.
 * @param {*} valeur  nombre, texte, booléen, erreur de calcul ou null
 * @param {string} [style]  style des nombres saisis (voir donnees/saisie.js)
 * @param {{type: string, decimales: number}|null} [format]  format choisi pour la cellule (null : automatique)
 * @returns {{texte: string, genre: 'vide'|'nombre'|'texte'|'booleen'|'erreur', explication?: string}}
 */
export function presenter(valeur, style = 'general', format = null) {
  if (valeur === null || valeur === undefined) return { texte: '', genre: 'vide' };
  if (typeof valeur === 'number') {
    return { texte: format ? formaterSelonFormat(valeur, format) : formaterNombre(valeur, style), genre: 'nombre' };
  }
  if (typeof valeur === 'boolean') return { texte: valeur ? 'VRAI' : 'FAUX', genre: 'booleen' };
  if (typeof valeur === 'object' && 'affichage' in valeur) {
    // Erreur de calcul (voir calcul/erreurs.js) : code court + explication.
    return { texte: valeur.affichage, genre: 'erreur', explication: valeur.explication };
  }
  return { texte: String(valeur), genre: 'texte' };
}
