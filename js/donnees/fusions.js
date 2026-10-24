// Cellules fusionnées : une plage (au moins deux cellules) qui s'affiche
// comme une seule grande cellule, idéale pour un titre de tableau.
//
// Règles (comme dans Excel) :
//   - seule la cellule en haut à gauche garde son contenu ; c'est elle qu'on
//     voit, qu'on modifie et qu'on utilise dans les formules (=A1) ;
//   - les autres cellules de la plage sont vidées au moment de la fusion ;
//   - deux fusions ne se chevauchent jamais ;
//   - une sélection qui touche une cellule fusionnée s'agrandit pour la
//     contenir en entier.
//
// Ce module ne contient que des calculs sur des plages
// ({ debut: { ligne, colonne }, fin: { ligne, colonne } }) : aucun affichage.

import { dansPlage, plage as creerPlage } from './adresses.js';

/** Nombre de cellules d'une plage. */
export const nombreCellules = ({ debut, fin }) => (fin.ligne - debut.ligne + 1) * (fin.colonne - debut.colonne + 1);

/** Vrai si deux plages ont au moins une cellule en commun. */
export function seChevauchent(a, b) {
  return a.debut.ligne <= b.fin.ligne && b.debut.ligne <= a.fin.ligne && a.debut.colonne <= b.fin.colonne && b.debut.colonne <= a.fin.colonne;
}

/** Vrai si la plage `a` contient entièrement la plage `b`. */
export function contient(a, b) {
  return dansPlage(a, b.debut.ligne, b.debut.colonne) && dansPlage(a, b.fin.ligne, b.fin.colonne);
}

/** La fusion qui contient la cellule (ligne, colonne), ou null. */
export function fusionContenant(fusions, ligne, colonne) {
  return fusions.find((f) => dansPlage(f, ligne, colonne)) ?? null;
}

/**
 * Agrandit une plage pour qu'elle contienne en entier chaque fusion qu'elle
 * touche (une fusion ajoutée peut en toucher une autre : on recommence
 * jusqu'à ce que plus rien ne change).
 */
export function etendreAuxFusions(fusions, plage) {
  let resultat = plage;
  let change = true;
  while (change) {
    change = false;
    for (const f of fusions) {
      if (!seChevauchent(resultat, f) || contient(resultat, f)) continue;
      resultat = creerPlage(
        { ligne: Math.min(resultat.debut.ligne, f.debut.ligne), colonne: Math.min(resultat.debut.colonne, f.debut.colonne) },
        { ligne: Math.max(resultat.fin.ligne, f.fin.ligne), colonne: Math.max(resultat.fin.colonne, f.fin.colonne) },
      );
      change = true;
    }
  }
  return resultat;
}

/**
 * Fusions après une insertion ou une suppression de lignes (ou de colonnes) :
 *   - insertion avant une fusion : elle se décale ; au milieu : elle s'agrandit ;
 *   - suppression : elle perd les lignes supprimées, et disparaît s'il ne lui
 *     reste qu'une cellule.
 * @param {Array<object>} fusions
 * @param {{axe: 'lignes'|'colonnes', type: 'insertion'|'suppression', position: number, nombre: number, maximum: number}} changement
 */
export function ajusterFusions(fusions, { axe, type, position, nombre, maximum }) {
  const cle = axe === 'lignes' ? 'ligne' : 'colonne';
  const resultat = [];
  for (const f of fusions) {
    let debut = f.debut[cle];
    let fin = f.fin[cle];
    if (type === 'insertion') {
      if (debut >= position) debut += nombre;
      if (fin >= position) fin += nombre;
      fin = Math.min(fin, maximum);
      if (debut > maximum) continue;
    } else {
      const derniere = position + nombre - 1;
      // Lignes (ou colonnes) de la fusion qui restent, avec leur nouveau numéro.
      const restantes = [];
      for (let v = debut; v <= fin; v++) {
        if (v < position) restantes.push(v);
        else if (v > derniere) restantes.push(v - nombre);
      }
      if (restantes.length === 0) continue;
      debut = restantes[0];
      fin = restantes.at(-1);
    }
    const nouvelle = {
      debut: { ...f.debut, [cle]: debut },
      fin: { ...f.fin, [cle]: fin },
    };
    if (nombreCellules(nouvelle) >= 2) resultat.push(nouvelle);
  }
  return resultat;
}
