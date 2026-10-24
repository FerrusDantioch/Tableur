// Bordures des cellules, pour construire de vrais tableaux.
//
// Chaque cellule peut avoir une bordure sur chacun de ses quatre côtés
// (haut, bas, gauche, droite), avec un trait (fin ou épais) et une couleur.
//
// Deux cellules voisines partagent un trait : le bas de B2 est aussi le haut
// de B3. Quand on pose une bordure sur la sélection, on efface donc le côté
// d'en face chez la voisine, pour que le dernier choix soit bien celui qui se
// voit (comme dans Excel).
//
// Ce module calcule les modifications, que l'appelant donne ensuite à
// Classeur.modifierCellules (annulable d'un coup).

import { adresse } from './adresses.js';

/** Les façons de poser des bordures sur une plage. */
export const TYPES_BORDURES = ['toutes', 'exterieur', 'haut', 'bas', 'gauche', 'droite', 'aucune'];

/** Côté d'en face, chez la cellule voisine. */
const OPPOSE = { haut: 'bas', bas: 'haut', gauche: 'droite', droite: 'gauche' };

/**
 * Modifications pour poser des bordures sur une plage.
 * @param {{debut: object, fin: object}} plage
 * @param {string} type  'toutes' | 'exterieur' | 'haut' | 'bas' | 'gauche' | 'droite' | 'aucune'
 * @param {{style: 'fin'|'epais', couleur: string}} bordure  trait et couleur
 * @param {{lignes: number, colonnes: number}} taille  taille de la feuille (pour ne pas en sortir)
 * @returns {Array<{adresse: string, bordures: object}>}
 */
export function calculerBordures(plage, type, bordure, taille) {
  const { debut, fin } = plage;
  const parAdresse = new Map(); // adresse → { côté: bordure ou null }
  const poser = (ligne, colonne, cote, valeur) => {
    if (ligne < 1 || colonne < 1 || ligne > taille.lignes || colonne > taille.colonnes) return;
    const adr = adresse(ligne, colonne);
    if (!parAdresse.has(adr)) parAdresse.set(adr, {});
    parAdresse.get(adr)[cote] = valeur;
  };
  // Côté d'une cellule de la plage, et côté d'en face chez la voisine (effacé).
  const voisin = { haut: [-1, 0], bas: [1, 0], gauche: [0, -1], droite: [0, 1] };
  const poserBord = (ligne, colonne, cote, valeur) => {
    poser(ligne, colonne, cote, valeur);
    const [dl, dc] = voisin[cote];
    const dehors = ligne + dl < debut.ligne || ligne + dl > fin.ligne || colonne + dc < debut.colonne || colonne + dc > fin.colonne;
    if (dehors) poser(ligne + dl, colonne + dc, OPPOSE[cote], null);
  };
  const valeur = type === 'aucune' ? null : bordure;

  for (let l = debut.ligne; l <= fin.ligne; l++) {
    for (let c = debut.colonne; c <= fin.colonne; c++) {
      const bords = {
        haut: l === debut.ligne,
        bas: l === fin.ligne,
        gauche: c === debut.colonne,
        droite: c === fin.colonne,
      };
      for (const cote of ['haut', 'bas', 'gauche', 'droite']) {
        const concerne = type === 'toutes' || type === 'aucune' || (type === 'exterieur' ? bords[cote] : type === cote && bords[cote]);
        if (concerne) poserBord(l, c, cote, valeur);
      }
    }
  }
  return [...parAdresse].map(([adr, bordures]) => ({ adresse: adr, bordures }));
}

/** Le plus « fort » de deux traits : l'épais l'emporte. */
const plusFort = (a, b) => (a && b ? (b.style === 'epais' && a.style !== 'epais' ? b : a) : a ?? b ?? null);

/**
 * Bordures à DESSINER pour une cellule, en tenant compte de ses voisines :
 * le bas vient de la cellule ou du haut de celle du dessous ; la droite, de
 * la cellule ou de la gauche de celle de droite. Le haut et la gauche ne sont
 * dessinés que sur la première ligne et la première colonne (ailleurs, c'est
 * la voisine du dessus ou de gauche qui les dessine).
 * @param {(adresse: string) => object|null} lireCellule
 * @returns {{haut?: object, bas?: object, gauche?: object, droite?: object}|null}
 */
export function borduresADessiner(lireCellule, ligne, colonne) {
  const propres = lireCellule(adresse(ligne, colonne))?.bordures ?? null;
  const dessous = lireCellule(adresse(ligne + 1, colonne))?.bordures?.haut ?? null;
  const droite = lireCellule(adresse(ligne, colonne + 1))?.bordures?.gauche ?? null;
  const resultat = {};
  const bas = plusFort(propres?.bas ?? null, dessous);
  const cote = plusFort(propres?.droite ?? null, droite);
  if (bas) resultat.bas = bas;
  if (cote) resultat.droite = cote;
  if (ligne === 1 && propres?.haut) resultat.haut = propres.haut;
  if (colonne === 1 && propres?.gauche) resultat.gauche = propres.gauche;
  return Object.keys(resultat).length ? resultat : null;
}
