// Export CSV : un fichier texte que l'on peut ouvrir avec Excel,
// LibreOffice Calc ou Google Sheets.
//
// Réglages choisis pour Excel en français (le plus exigeant) :
//   - point-virgule « ; » entre les colonnes ;
//   - virgule décimale (3,5) ;
//   - encodage UTF-8 avec une marque au début (« BOM »), pour que les
//     accents s'affichent correctement ;
//   - les formules sont exportées avec leur RÉSULTAT ;
//   - les nombres sont écrits sans espace ni symbole (12,5 et non « 12,50 € »),
//     pour rester des nombres dans le tableur qui ouvrira le fichier.

import { adresse } from '../donnees/adresses.js';
import { nombrePourFichier } from '../affichage/format.js';

export const SEPARATEUR = ';';

/** Texte d'une valeur de cellule pour le fichier. */
function texteValeur(valeur) {
  if (valeur === null || valeur === undefined) return '';
  if (typeof valeur === 'number') return nombrePourFichier(valeur);
  if (typeof valeur === 'boolean') return valeur ? 'VRAI' : 'FAUX';
  if (typeof valeur === 'object' && 'affichage' in valeur) return valeur.affichage; // erreur : #DIV/0!…
  return String(valeur);
}

/** Met un champ entre guillemets si nécessaire (« "" » pour un guillemet). */
function proteger(champ) {
  if (/[";\r\n]/.test(champ) || /^\s|\s$/.test(champ)) return `"${champ.replace(/"/g, '""')}"`;
  return champ;
}

/**
 * Crée le contenu du fichier CSV : de A1 jusqu'à la dernière cellule remplie.
 * @param {import('../donnees/classeur.js').Feuille} feuille
 * @param {{ valeur: (adresse: string) => * }} moteur
 * @returns {string} contenu ('' si la feuille est vide)
 */
export function genererCSV(feuille, moteur) {
  const { lignes, colonnes } = feuille.etendue();
  if (lignes === 0) return '';
  const texte = [];
  for (let l = 1; l <= lignes; l++) {
    const champs = [];
    for (let c = 1; c <= colonnes; c++) champs.push(proteger(texteValeur(moteur.valeur(adresse(l, c)))));
    texte.push(champs.join(SEPARATEUR));
  }
  return `﻿${texte.join('\r\n')}\r\n`;
}
