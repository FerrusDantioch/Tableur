// Import d'un fichier CSV (exporté par Excel, LibreOffice, Google Sheets,
// une banque…) dans une nouvelle feuille du classeur.
//
// Un fichier CSV est un simple texte : une ligne par ligne du tableau, les
// colonnes séparées par un point-virgule (Excel en français), une virgule
// (en anglais) ou une tabulation. Le séparateur est détecté tout seul.
//
// Précautions :
//   - les accents : le fichier est lu en UTF-8 ; s'il n'en est pas (vieux
//     fichiers Windows), il est relu en « Windows-1252 » ;
//   - un texte qui commence par « = » est gardé comme texte (jamais exécuté
//     comme une formule) ;
//   - au-delà de 1000 lignes ou 52 colonnes, le reste est laissé de côté
//     (l'appelant prévient la personne).

import { COLONNES_MAX, LIGNES_MAX } from '../donnees/adresses.js';
import { adresse } from '../donnees/adresses.js';

const SEPARATEURS = [';', ',', '\t'];

/** Octets du fichier → texte (UTF-8, ou Windows-1252 pour les anciens fichiers). */
export function decoderFichier(octets) {
  let texte;
  try {
    texte = new TextDecoder('utf-8', { fatal: true }).decode(octets);
  } catch {
    texte = new TextDecoder('windows-1252').decode(octets);
  }
  return texte.replace(/^\uFEFF/, ''); // marque UTF-8 du début (BOM)
}

/**
 * Découpe un texte CSV en lignes de champs. Les champs entre guillemets
 * peuvent contenir le séparateur, des retours à la ligne et des guillemets
 * doublés ("" = ").
 */
export function lireCSV(texte, separateur) {
  const lignes = [];
  let ligne = [];
  let champ = '';
  let entreGuillemets = false;
  let i = 0;
  while (i < texte.length) {
    const c = texte[i];
    if (entreGuillemets) {
      if (c === '"' && texte[i + 1] === '"') {
        champ += '"';
        i += 2;
        continue;
      }
      if (c === '"') entreGuillemets = false;
      else champ += c;
      i++;
      continue;
    }
    if (c === '"' && champ === '') {
      entreGuillemets = true;
    } else if (c === separateur) {
      ligne.push(champ);
      champ = '';
    } else if (c === '\n' || c === '\r') {
      ligne.push(champ);
      lignes.push(ligne);
      ligne = [];
      champ = '';
      if (c === '\r' && texte[i + 1] === '\n') i++;
    } else {
      champ += c;
    }
    i++;
  }
  if (champ !== '' || ligne.length) {
    ligne.push(champ);
    lignes.push(ligne);
  }
  return lignes;
}

/**
 * Devine le séparateur : celui qui donne le même nombre de colonnes (plus
 * d'une) sur les premières lignes. À égalité, le point-virgule l'emporte.
 */
export function detecterSeparateur(texte) {
  const debut = texte.slice(0, 20000);
  let meilleur = ';';
  let meilleurScore = -1;
  for (const separateur of SEPARATEURS) {
    const lignes = lireCSV(debut, separateur)
      .slice(0, 20)
      .filter((ligne) => ligne.some((champ) => champ !== ''));
    if (lignes.length === 0) continue;
    const largeurs = lignes.map((ligne) => ligne.length);
    const largeur = largeurs[0];
    if (largeur < 2) continue;
    const regulieres = largeurs.filter((l) => l === largeur).length;
    const score = (regulieres / largeurs.length) * 1000 + largeur;
    if (score > meilleurScore) {
      meilleur = separateur;
      meilleurScore = score;
    }
  }
  return meilleur;
}

/**
 * Texte CSV → contenu d'une feuille (format de Feuille.restaurer).
 * @returns {{donnees: object, lignes: number, colonnes: number, tronque: boolean}}
 */
export function feuilleDepuisCSV(texte) {
  const separateur = detecterSeparateur(texte);
  const lignes = lireCSV(texte, separateur);
  // Les lignes vides de la fin sont ignorées.
  while (lignes.length && lignes.at(-1).every((champ) => champ.trim() === '')) lignes.pop();
  const largeur = lignes.reduce((max, ligne) => Math.max(max, ligne.length), 0);
  const tronque = lignes.length > LIGNES_MAX || largeur > COLONNES_MAX;
  const nombreLignes = Math.min(lignes.length, LIGNES_MAX);
  const nombreColonnes = Math.min(largeur, COLONNES_MAX);
  const cellules = {};
  for (let l = 0; l < nombreLignes; l++) {
    for (let c = 0; c < Math.min(lignes[l].length, COLONNES_MAX); c++) {
      const champ = lignes[l][c];
      if (champ.trim() === '') continue;
      // Un texte qui commence par « = » reste du texte (l'apostrophe le protège).
      cellules[adresse(l + 1, c + 1)] = { brut: champ.trimStart().startsWith('=') ? `'${champ}` : champ };
    }
  }
  return {
    donnees: {
      lignes: Math.max(100, nombreLignes),
      colonnes: Math.max(26, nombreColonnes),
      cellules,
    },
    lignes: nombreLignes,
    colonnes: nombreColonnes,
    separateur,
    tronque,
  };
}

/** Nom de feuille tiré d'un nom de fichier : « Relevé mars.csv » → « Relevé mars ». */
export function nomDepuisFichier(nomFichier) {
  const propre = String(nomFichier)
    .replace(/\.[^.]*$/, '')
    .replace(/[[\]:*?/\\]/g, ' ')
    .replace(/^'+|'+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 31)
    .trim();
  return propre || 'Import';
}
