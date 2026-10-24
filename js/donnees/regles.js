// Règles de mise en forme conditionnelle : « si la valeur est… alors
// colorer la cellule ». Ce module décrit une règle et la vérifie ; le calcul
// (la cellule respecte-t-elle la règle ?) est dans calcul/conditions.js.
//
// Une règle, telle qu'elle est enregistrée :
//   { id: 3, plage: "B2:B20", type: "superieur", valeur: "100", valeur2: "",
//     fond: "rouge", encre: null }
//   - type : superieur, inferieur, egal, entre, negatif, contient ;
//   - valeur (et valeur2 pour « entre ») : le texte tapé par la personne,
//     gardé tel quel (« 2,5 », « 24/10/2026 », « payé ») ;
//   - fond et encre : couleurs du thème (au moins l'une des deux).
// Plusieurs règles peuvent viser les mêmes cellules : pour chaque couleur,
// la première règle de la liste qui s'applique l'emporte.

import { COLONNES_MAX, LIGNES_MAX, lirePlage, textePlage } from './adresses.js';
import { COULEURS_FOND, ENCRES } from './classeur.js';
import { interpreterSaisie } from './saisie.js';

export const TYPES_REGLES = ['superieur', 'inferieur', 'egal', 'entre', 'negatif', 'contient'];

/** Ce que dit chaque type de règle (« si la valeur est … »). */
export const LIBELLES_REGLES = {
  superieur: 'supérieure à',
  inferieur: 'inférieure à',
  egal: 'égale à',
  entre: 'entre',
  negatif: 'négative',
  contient: 'contient le texte',
};

/** Types qui attendent un nombre (« 100 », « 2,5 », « 20 % », « 24/10/2026 »). */
const TYPES_NOMBRE = ['superieur', 'inferieur', 'entre'];

/** Nombre maximal de règles par feuille (garde-fou). */
export const REGLES_MAX = 200;
const TEXTE_MAX = 200;

/** Le nombre que représente un texte tapé (« 2,5 », « 1 000 », « 20 % », une date), ou null. */
export function nombreDe(texte) {
  const saisie = interpreterSaisie(String(texte ?? '').trim());
  return saisie.type === 'nombre' ? saisie.valeur : null;
}

/**
 * Vérifie une règle. Renvoie null si elle est valable, sinon un message en
 * français qui dit quoi corriger.
 */
export function verifierRegle(regle) {
  if (!regle || typeof regle !== 'object') return 'Règle illisible.';
  const zone = typeof regle.plage === 'string' ? lirePlage(regle.plage.trim().toUpperCase()) : null;
  if (!zone || zone.fin.ligne > LIGNES_MAX || zone.fin.colonne > COLONNES_MAX) {
    return 'Les cellules concernées ne sont pas valables : écrivez par exemple B2:B20 (ou C5 pour une seule cellule).';
  }
  if (!TYPES_REGLES.includes(regle.type)) return 'Choisissez une condition.';
  const valeur = typeof regle.valeur === 'string' ? regle.valeur : '';
  const valeur2 = typeof regle.valeur2 === 'string' ? regle.valeur2 : '';
  if (valeur.length > TEXTE_MAX || valeur2.length > TEXTE_MAX) return 'La valeur est trop longue.';
  if (TYPES_NOMBRE.includes(regle.type) && nombreDe(valeur) === null) {
    return 'Tapez un nombre pour la condition (par exemple 100, 2,5 ou 20 %).';
  }
  if (regle.type === 'entre' && nombreDe(valeur2) === null) return 'Tapez aussi le second nombre (« et … »).';
  if (regle.type === 'egal' && valeur.trim() === '') return 'Tapez la valeur (un nombre ou un texte).';
  if (regle.type === 'contient' && valeur.trim() === '') return 'Tapez le texte à chercher.';
  const fond = regle.fond ?? null;
  const encre = regle.encre ?? null;
  if ((fond !== null && !COULEURS_FOND.includes(fond)) || (encre !== null && !ENCRES.includes(encre))) return 'Couleur inconnue.';
  if (fond === null && encre === null) return 'Choisissez une couleur de fond ou une couleur de texte (ou les deux).';
  return null;
}

/**
 * Règle propre et gelée (avec, en plus, sa plage lue et ses nombres déjà
 * convertis, pour aller vite à l'affichage), ou null si elle n'est pas valable.
 */
export function nettoyerRegle(regle) {
  if (verifierRegle(regle) !== null) return null;
  const zone = lirePlage(regle.plage.trim().toUpperCase());
  const avecNombre = regle.type !== 'contient';
  return Object.freeze({
    id: Number.isInteger(regle.id) && regle.id > 0 ? regle.id : 0,
    plage: textePlage(zone),
    type: regle.type,
    valeur: regle.type === 'negatif' ? '' : regle.valeur,
    valeur2: regle.type === 'entre' ? regle.valeur2 : '',
    fond: regle.fond ?? null,
    encre: regle.encre ?? null,
    // Champs calculés (non enregistrés) :
    zone: Object.freeze({ debut: Object.freeze(zone.debut), fin: Object.freeze(zone.fin) }),
    nombre: avecNombre ? nombreDe(regle.valeur) : null,
    nombre2: regle.type === 'entre' ? nombreDe(regle.valeur2) : null,
  });
}

/** Ce qui est enregistré d'une règle (sans les champs calculés). */
export function regleVersJSON({ id, plage, type, valeur, valeur2, fond, encre }) {
  const donnees = { id, plage, type };
  if (valeur) donnees.valeur = valeur;
  if (valeur2) donnees.valeur2 = valeur2;
  if (fond) donnees.fond = fond;
  if (encre) donnees.encre = encre;
  return donnees;
}

/** Phrase qui décrit une règle : « valeur supérieure à 100 ». */
export function decrireRegle(regle) {
  switch (regle.type) {
    case 'negatif':
      return 'valeur négative';
    case 'entre':
      return `valeur entre ${regle.valeur} et ${regle.valeur2}`;
    case 'contient':
      return `contient « ${regle.valeur} »`;
    default:
      return `valeur ${LIBELLES_REGLES[regle.type]} ${regle.valeur}`;
  }
}
