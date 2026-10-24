// Tri des lignes d'un tableau selon une colonne (croissant ou décroissant).
//
// Quelle partie de la feuille trier ?
//   - si plusieurs lignes ET plusieurs colonnes sont sélectionnées : exactement
//     ce bloc ;
//   - sinon : le tableau qui entoure la cellule active, c'est-à-dire le bloc de
//     cellules remplies qui se touchent (comme la « zone en cours » d'Excel).
// Les lignes restent entières (le prix reste à côté de son article).
//
// Ordre croissant, comme Excel : nombres (et dates), puis texte (A → Z, sans
// tenir compte des majuscules ; « article 2 » avant « article 10 »), puis
// VRAI / FAUX, puis erreurs. Les cellules vides restent toujours à la fin.
//
// Ce module ne modifie rien : il calcule le nouvel ordre des lignes, que
// l'appelant donne à Classeur.reordonnerLignes (annulable).

import { adresse, plage as creerPlage } from './adresses.js';

const collateur = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });

/** Rang de chaque genre de valeur dans l'ordre croissant. */
function rang(valeur) {
  if (typeof valeur === 'number') return 1;
  if (typeof valeur === 'string') return 2;
  if (typeof valeur === 'boolean') return 3;
  return 4; // erreur de calcul
}

const estVide = (valeur) => valeur === null || valeur === undefined || valeur === '';

/** Compare deux valeurs pour un tri croissant (les vides ne passent pas par ici). */
export function comparerPourTri(a, b) {
  const difference = rang(a) - rang(b);
  if (difference) return difference;
  if (typeof a === 'number') return a - b;
  if (typeof a === 'string') return collateur.compare(a, b);
  if (typeof a === 'boolean') return Number(a) - Number(b);
  return 0;
}

/**
 * Nouvel ordre des lignes : renvoie la liste des positions d'origine (0, 1,
 * 2…) dans l'ordre trié. Les égalités gardent leur ordre d'avant.
 * @param {Array<*>} cles  valeur de la colonne de tri, ligne par ligne
 * @param {boolean} croissant
 */
export function ordreDeTri(cles, croissant = true) {
  const pleines = [];
  const vides = [];
  cles.forEach((cle, i) => (estVide(cle) ? vides : pleines).push(i));
  pleines.sort((i, j) => (croissant ? 1 : -1) * comparerPourTri(cles[i], cles[j]) || i - j);
  return [...pleines, ...vides];
}

/**
 * Le tableau autour d'une cellule : on agrandit le rectangle tant qu'une
 * cellule remplie le touche (même en diagonale). Null si tout est vide autour.
 * @param {(adresse: string) => string} brut  texte d'une cellule
 * @param {{lignes: number, colonnes: number}} taille  taille de la feuille
 */
export function zoneAutour(brut, taille, ligne, colonne) {
  const rempli = (l, c) => l >= 1 && c >= 1 && l <= taille.lignes && c <= taille.colonnes && brut(adresse(l, c)).trim() !== '';
  let haut = ligne;
  let bas = ligne;
  let gauche = colonne;
  let droite = colonne;
  let agrandi = true;
  const ligneRemplie = (l) => {
    for (let c = gauche - 1; c <= droite + 1; c++) if (rempli(l, c)) return true;
    return false;
  };
  const colonneRemplie = (c) => {
    for (let l = haut - 1; l <= bas + 1; l++) if (rempli(l, c)) return true;
    return false;
  };
  while (agrandi) {
    agrandi = false;
    if (haut > 1 && ligneRemplie(haut - 1)) {
      haut--;
      agrandi = true;
    }
    if (bas < taille.lignes && ligneRemplie(bas + 1)) {
      bas++;
      agrandi = true;
    }
    if (gauche > 1 && colonneRemplie(gauche - 1)) {
      gauche--;
      agrandi = true;
    }
    if (droite < taille.colonnes && colonneRemplie(droite + 1)) {
      droite++;
      agrandi = true;
    }
  }
  const zone = creerPlage({ ligne: haut, colonne: gauche }, { ligne: bas, colonne: droite });
  // Rien de rempli dans la zone (cellule isolée et vide) : pas de tableau.
  for (let l = haut; l <= bas; l++) for (let c = gauche; c <= droite; c++) if (rempli(l, c)) return zone;
  return null;
}

/**
 * La première ligne de la zone ressemble-t-elle à une ligne de titres ?
 * Oui si, dans une des colonnes (celle du tri d'abord), elle contient du
 * texte alors que la ligne suivante contient un nombre ou une date ; ou si
 * elle est en gras et pas la suivante.
 * @param {(adresse: string) => *} valeur  valeur calculée d'une cellule
 * @param {(adresse: string) => object|null} cellule  cellule (mise en forme)
 */
export function sembleTitres(valeur, cellule, zone, colonneCle) {
  const { debut, fin } = zone;
  if (fin.ligne <= debut.ligne) return false;
  const colonnes = [colonneCle];
  for (let c = debut.colonne; c <= fin.colonne; c++) if (c !== colonneCle) colonnes.push(c);
  for (const c of colonnes) {
    const premiere = valeur(adresse(debut.ligne, c));
    const seconde = valeur(adresse(debut.ligne + 1, c));
    if (typeof premiere === 'string' && premiere !== '' && typeof seconde === 'number') return true;
  }
  let premiereGras = true;
  let secondeGras = true;
  let remplie = false;
  for (let c = debut.colonne; c <= fin.colonne; c++) {
    const haut = cellule(adresse(debut.ligne, c));
    if (haut?.brut) {
      remplie = true;
      if (!haut.gras) premiereGras = false;
    }
    if (cellule(adresse(debut.ligne + 1, c))?.brut && !cellule(adresse(debut.ligne + 1, c)).gras) secondeGras = false;
  }
  return remplie && premiereGras && !secondeGras;
}
