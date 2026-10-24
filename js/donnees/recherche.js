// Rechercher et remplacer du texte dans les cellules.
//
// La recherche porte sur ce qui a été TAPÉ dans les cellules (le texte
// « brut ») : pour une formule, c'est son texte (« =SOMME(A1:A3) »), comme
// dans Excel. Le texte cherché est pris tel quel (les caractères spéciaux
// comme * ou ? n'ont pas de sens particulier). Sans « respecter la casse »,
// majuscules et minuscules sont confondues (« total » trouve « Total »),
// mais pas les accents (« e » ne trouve pas « é »).
//
// Ces fonctions ne modifient rien : elles préparent les modifications, que
// l'affichage confie ensuite au classeur (qui les rend annulables).

import { lireAdresse } from './adresses.js';

/**
 * Expression régulière qui trouve le texte, ou null si le texte est vide.
 * @param {string} texte
 * @param {{casse?: boolean}} [options]  casse : respecter les majuscules et minuscules
 */
export function motifRecherche(texte, { casse = false } = {}) {
  if (!texte) return null;
  // Les caractères qui ont un sens dans une expression régulière sont neutralisés.
  const echappe = texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(echappe, casse ? 'gu' : 'giu');
}

/** Nombre de fois où le motif apparaît dans un texte. */
export function compterDans(texte, motif) {
  return texte.match(motif)?.length ?? 0;
}

/** Le texte avec chaque apparition du motif remplacée (le remplacement est pris tel quel). */
export function remplacerDans(texte, motif, remplacement) {
  return texte.replace(motif, () => remplacement);
}

/**
 * Toutes les cellules qui contiennent le texte, dans l'ordre de lecture :
 * feuille après feuille (dans l'ordre des onglets), ligne après ligne, de
 * gauche à droite.
 * @param {import('./classeur.js').Classeur} classeur
 * @param {RegExp} motif  (voir motifRecherche)
 * @param {Array<import('./classeur.js').Feuille>} feuilles  feuilles où chercher
 * @returns {Array<{feuille, rangFeuille: number, adresse: string, ligne: number, colonne: number, nombre: number}>}
 */
export function rechercher(classeur, motif, feuilles) {
  const resultats = [];
  for (const feuille of feuilles) {
    const rangFeuille = classeur.feuilles.indexOf(feuille);
    for (const adresse of feuille.adresses()) {
      const nombre = compterDans(feuille.brut(adresse), motif);
      if (nombre === 0) continue;
      const { ligne, colonne } = lireAdresse(adresse);
      resultats.push({ feuille, rangFeuille, adresse, ligne, colonne, nombre });
    }
  }
  return resultats.sort((a, b) => a.rangFeuille - b.rangFeuille || a.ligne - b.ligne || a.colonne - b.colonne);
}

/**
 * Rang du premier résultat situé APRÈS une position (feuille, ligne, colonne),
 * en revenant au début après le dernier. -1 s'il n'y a aucun résultat.
 */
export function rangSuivant(resultats, { rangFeuille, ligne, colonne }) {
  if (resultats.length === 0) return -1;
  const apres = resultats.findIndex(
    (r) =>
      r.rangFeuille > rangFeuille ||
      (r.rangFeuille === rangFeuille && (r.ligne > ligne || (r.ligne === ligne && r.colonne > colonne))),
  );
  return apres === -1 ? 0 : apres;
}

/**
 * Modifications pour remplacer le texte dans des résultats, regroupées par
 * feuille (prêtes pour Classeur.modifierFeuilles), et nombre de remplacements.
 */
export function preparerRemplacements(resultats, motif, remplacement) {
  const parFeuille = new Map();
  let remplacements = 0;
  for (const { feuille, adresse, nombre } of resultats) {
    if (!parFeuille.has(feuille)) parFeuille.set(feuille, []);
    parFeuille.get(feuille).push({ adresse, brut: remplacerDans(feuille.brut(adresse), motif, remplacement) });
    remplacements += nombre;
  }
  const liste = [...parFeuille].map(([feuille, modifications]) => ({ feuille, modifications }));
  return { liste, remplacements, cellules: resultats.length };
}
