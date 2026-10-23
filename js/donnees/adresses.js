// Adresses de cellules : conversion entre « B3 » et { ligne: 3, colonne: 2 }.
//
// Les lignes et les colonnes sont numérotées à partir de 1, comme dans Excel :
// la colonne A porte le numéro 1, la colonne B le numéro 2, etc.
// Une « plage » est un rectangle de cellules, par exemple A1:C10.

/** Taille maximale d'une feuille : 1000 lignes et 52 colonnes (jusqu'à AZ). */
export const LIGNES_MAX = 1000;
export const COLONNES_MAX = 52;

/** Numéro de colonne → lettres : 1 → "A", 26 → "Z", 27 → "AA", 52 → "AZ". */
export function lettresColonne(numero) {
  let lettres = '';
  let reste = numero;
  while (reste > 0) {
    const position = (reste - 1) % 26;
    lettres = String.fromCharCode(65 + position) + lettres;
    reste = Math.floor((reste - 1) / 26);
  }
  return lettres;
}

/** Lettres → numéro de colonne : "A" → 1, "aa" → 27. Renvoie 0 si les lettres sont invalides. */
export function numeroColonne(lettres) {
  let numero = 0;
  for (const caractere of String(lettres).toUpperCase()) {
    const valeur = caractere.charCodeAt(0) - 64;
    if (valeur < 1 || valeur > 26) return 0;
    numero = numero * 26 + valeur;
  }
  return numero;
}

/** (ligne 3, colonne 2) → "B3". */
export function adresse(ligne, colonne) {
  return lettresColonne(colonne) + ligne;
}

// Une adresse : 1 à 3 lettres puis un nombre qui ne commence pas par 0.
// Les « $ » des références absolues (ex. $B$3) sont acceptés et ignorés.
const MOTIF_ADRESSE = /^\$?([A-Za-z]{1,3})\$?([1-9][0-9]*)$/;

/** "B3" → { ligne: 3, colonne: 2 }, ou null si le texte n'est pas une adresse. */
export function lireAdresse(texte) {
  const trouve = MOTIF_ADRESSE.exec(String(texte).trim());
  if (!trouve) return null;
  return { ligne: Number(trouve[2]), colonne: numeroColonne(trouve[1]) };
}

/**
 * Plage rectangulaire entre deux cellules, toujours « rangée » :
 * `debut` est le coin en haut à gauche, `fin` le coin en bas à droite.
 */
export function plage(coinA, coinB = coinA) {
  return {
    debut: { ligne: Math.min(coinA.ligne, coinB.ligne), colonne: Math.min(coinA.colonne, coinB.colonne) },
    fin: { ligne: Math.max(coinA.ligne, coinB.ligne), colonne: Math.max(coinA.colonne, coinB.colonne) },
  };
}

/** "A1:C3" (ou "B2" seule) → plage, ou null si le texte est invalide. */
export function lirePlage(texte) {
  const morceaux = String(texte).split(':');
  if (morceaux.length > 2) return null;
  const debut = lireAdresse(morceaux[0]);
  const fin = lireAdresse(morceaux[1] ?? morceaux[0]);
  if (!debut || !fin) return null;
  return plage(debut, fin);
}

/** Plage → texte : "A1:C3", ou "B2" si la plage ne contient qu'une cellule. */
export function textePlage({ debut, fin }) {
  const premier = adresse(debut.ligne, debut.colonne);
  if (debut.ligne === fin.ligne && debut.colonne === fin.colonne) return premier;
  return `${premier}:${adresse(fin.ligne, fin.colonne)}`;
}

/** Vrai si la cellule (ligne, colonne) fait partie de la plage. */
export function dansPlage({ debut, fin }, ligne, colonne) {
  return ligne >= debut.ligne && ligne <= fin.ligne && colonne >= debut.colonne && colonne <= fin.colonne;
}

/** Nombre de lignes et de colonnes d'une plage. */
export function taillePlage({ debut, fin }) {
  return { lignes: fin.ligne - debut.ligne + 1, colonnes: fin.colonne - debut.colonne + 1 };
}

/** Parcourt les adresses d'une plage, ligne par ligne (A1, B1, … puis A2, B2, …). */
export function* adressesDePlage({ debut, fin }) {
  for (let ligne = debut.ligne; ligne <= fin.ligne; ligne++) {
    for (let colonne = debut.colonne; colonne <= fin.colonne; colonne++) {
      yield adresse(ligne, colonne);
    }
  }
}
