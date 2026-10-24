// Fichier de sauvegarde complète du classeur (.json).
//
// La sauvegarde automatique reste dans le navigateur : si l'on vide ses
// données ou si l'on change d'appareil, elle disparaît. Ce fichier, lui, se
// range où l'on veut (téléchargements, clé USB, cloud…) et se rouvre avec
// « Importer un classeur (.json) ».
//
// Contenu du fichier (texte JSON) :
//   {
//     "format": "omni-tableur/classeur",   ← reconnaît un fichier d'Omni-Tableur
//     "version": 1,                        ← version du FORMAT du fichier
//     "creePar": "Omni-Tableur 2.1.0",
//     "exporteLe": "2026-10-24T09:30:00.000Z",
//     "titre": "Budget",
//     "feuilleActive": 0,
//     "affichage": { "zoom": 100, "theme": "omni" },
//     "feuilles": [ { "nom", "lignes", "colonnes", "figee", "largeurs", "cellules" } ]
//   }
// Chaque feuille garde les noms et l'ordre des feuilles, le texte et les
// formules des cellules, toute la mise en forme et les bordures, la largeur
// des colonnes et la ligne figée (voir Feuille.versJSON dans classeur.js).
//
// Si le format change un jour, on augmentera VERSION_FICHIER et on gardera
// ici la lecture des anciennes versions : les anciens fichiers resteront lisibles.
//
// Sécurité : le fichier est lu avec JSON.parse (des données, jamais du code)
// puis vérifié entièrement AVANT de toucher au classeur. Au moindre doute, il
// est refusé avec une explication en français.

import { COLONNES_MAX, LIGNES_MAX, lireAdresse, numeroColonne } from './adresses.js';
import {
  ALIGNEMENTS,
  COTES,
  COULEURS_FOND,
  DECIMALES_MAX,
  ENCRES,
  FORMAT_CLASSEUR,
  FORMATS,
  NOM_FEUILLE_MAX,
  TRAITS,
} from './classeur.js';

export const FORMAT_FICHIER = 'omni-tableur/classeur';
export const VERSION_FICHIER = 1;

/** Taille maximale acceptée à l'import (un classeur plein fait quelques Mo). */
export const TAILLE_MAX_FICHIER = 50 * 1024 * 1024;
/** Garde-fous contre un fichier démesuré ou fabriqué. */
const FEUILLES_MAX = 500;
const TEXTE_CELLULE_MAX = 100_000;
const TITRE_MAX = 200;

const estObjet = (valeur) => Object.prototype.toString.call(valeur) === '[object Object]';
const estEntier = (valeur, min, max) => Number.isInteger(valeur) && valeur >= min && valeur <= max;

/** Nom de fichier proposé : omni-tableur-AAAA-MM-JJ.json (date du jour, heure locale). */
export function nomFichierClasseur(date = new Date()) {
  const deux = (n) => String(n).padStart(2, '0');
  return `omni-tableur-${date.getFullYear()}-${deux(date.getMonth() + 1)}-${deux(date.getDate())}.json`;
}

/**
 * Contenu du fichier pour un classeur (objet prêt pour JSON.stringify).
 * @param {import('./classeur.js').Classeur} classeur
 * @param {object} options
 * @param {{zoom?: number, theme?: string}} [options.affichage]  réglages d'affichage
 * @param {string} [options.application]  ex. « Omni-Tableur 2.1.0 »
 * @param {Date} [options.date]
 */
export function creerFichierClasseur(classeur, { affichage = {}, application = 'Omni-Tableur', date = new Date() } = {}) {
  const donnees = classeur.versJSON();
  return {
    format: FORMAT_FICHIER,
    version: VERSION_FICHIER,
    creePar: application,
    exporteLe: date.toISOString(),
    titre: donnees.titre,
    feuilleActive: donnees.active,
    affichage: { ...affichage },
    feuilles: donnees.feuilles,
  };
}

// --- Vérification ---------------------------------------------------------------

/** Erreur de vérification : son message est montré tel quel à la personne. */
class FichierInvalide extends Error {}

const abime = (detail) => new FichierInvalide(`Ce fichier est abîmé : ${detail}.`);

/** Vérifie la mise en forme d'une cellule ; lance FichierInvalide si une valeur est impossible. */
function verifierCellule(cellule, ou) {
  if (!estObjet(cellule)) throw abime(`${ou} est illisible`);
  if (typeof cellule.brut !== 'string') throw abime(`${ou} n'a pas de contenu valable`);
  if (cellule.brut.length > TEXTE_CELLULE_MAX) throw abime(`${ou} contient un texte beaucoup trop long`);
  const choix = (nom, valeurs) => {
    if (cellule[nom] !== undefined && cellule[nom] !== null && !valeurs.includes(cellule[nom])) {
      throw abime(`${ou} a une valeur inconnue (« ${nom} »)`);
    }
  };
  for (const nom of ['gras', 'italique']) {
    if (cellule[nom] !== undefined && typeof cellule[nom] !== 'boolean') throw abime(`${ou} a une valeur inconnue (« ${nom} »)`);
  }
  choix('couleur', ENCRES);
  choix('fond', COULEURS_FOND);
  choix('alignement', ALIGNEMENTS);
  if (cellule.format !== undefined && cellule.format !== null) {
    const { format } = cellule;
    if (!estObjet(format) || !FORMATS.includes(format.type) || !estEntier(format.decimales ?? 0, 0, DECIMALES_MAX)) {
      throw abime(`${ou} a un format de nombre inconnu`);
    }
  }
  if (cellule.bordures !== undefined && cellule.bordures !== null) {
    if (!estObjet(cellule.bordures)) throw abime(`${ou} a des bordures illisibles`);
    for (const [cote, bordure] of Object.entries(cellule.bordures)) {
      const valable =
        COTES.includes(cote) &&
        estObjet(bordure) &&
        TRAITS.includes(bordure.style) &&
        (bordure.couleur === 'auto' || ENCRES.includes(bordure.couleur));
      if (!valable) throw abime(`${ou} a une bordure inconnue`);
    }
  }
}

/** Vérifie une feuille ; lance FichierInvalide en cas de problème. */
function verifierFeuille(feuille, numero) {
  const nomAffiche = `la feuille n° ${numero}`;
  if (!estObjet(feuille)) throw abime(`${nomAffiche} est illisible`);
  const { nom } = feuille;
  // Mêmes règles que pour renommer une feuille (voir Classeur.verifierNomFeuille).
  const nomValable =
    typeof nom === 'string' &&
    nom.trim() !== '' &&
    nom.length <= NOM_FEUILLE_MAX &&
    !/[[\]:*?/\\]/.test(nom) &&
    !nom.trim().startsWith("'") &&
    !nom.trim().endsWith("'");
  if (!nomValable) {
    throw abime(`${nomAffiche} n'a pas de nom valable`);
  }
  const ici = `la feuille « ${nom} »`;
  if (!estEntier(feuille.lignes, 1, LIGNES_MAX) || !estEntier(feuille.colonnes, 1, COLONNES_MAX)) {
    throw abime(`${ici} a une taille impossible`);
  }
  if (feuille.figee !== undefined && typeof feuille.figee !== 'boolean') throw abime(`${ici} a un réglage « ligne figée » inconnu`);
  if (feuille.largeurs !== undefined) {
    if (!estObjet(feuille.largeurs)) throw abime(`${ici} a des largeurs de colonnes illisibles`);
    for (const [lettres, largeur] of Object.entries(feuille.largeurs)) {
      const colonne = /^[A-Z]{1,2}$/.test(lettres) ? numeroColonne(lettres) : 0;
      if (colonne < 1 || colonne > COLONNES_MAX || !Number.isFinite(largeur) || largeur <= 0) {
        throw abime(`${ici} a une largeur de colonne impossible (${lettres})`);
      }
    }
  }
  if (!estObjet(feuille.cellules)) throw abime(`les cellules de ${ici} sont illisibles`);
  for (const [adresse, cellule] of Object.entries(feuille.cellules)) {
    const position = /^[A-Z]{1,2}[1-9]\d{0,3}$/.test(adresse) ? lireAdresse(adresse) : null;
    if (!position || position.ligne > LIGNES_MAX || position.colonne > COLONNES_MAX) {
      throw abime(`${ici} contient une adresse de cellule impossible`);
    }
    verifierCellule(cellule, `la cellule ${adresse} de ${ici}`);
  }
}

/**
 * Lit le texte d'un fichier de classeur et le vérifie entièrement.
 * Ne modifie rien : c'est l'appelant qui remplace le classeur si tout va bien.
 *
 * @param {string} texte
 * @returns {{ok: true, classeur: object, affichage: {zoom?: number, theme?: string}, resume: {titre: string, feuilles: number}}
 *          | {ok: false, message: string}}
 *          `classeur` est prêt pour Classeur.remplacer().
 */
export function lireFichierClasseur(texte) {
  try {
    let objet;
    try {
      objet = JSON.parse(String(texte).replace(/^\uFEFF/, ''));
    } catch {
      throw new FichierInvalide(
        'Ce fichier n’est pas un classeur Omni-Tableur : son contenu est illisible (fichier abîmé, incomplet, ou d’un autre type).',
      );
    }
    if (!estObjet(objet) || objet.format !== FORMAT_FICHIER) {
      throw new FichierInvalide(
        'Ce fichier n’a pas été créé par Omni-Tableur. Seuls les fichiers enregistrés avec « Exporter le classeur (.json) » peuvent être importés ici (pour un fichier CSV, utilisez « Importer un CSV »).',
      );
    }
    if (!Number.isInteger(objet.version) || objet.version < 1) throw abime('son numéro de version est illisible');
    if (objet.version > VERSION_FICHIER) {
      throw new FichierInvalide(
        'Ce fichier vient d’une version plus récente d’Omni-Tableur. Mettez l’application à jour (bouton « Recharger » quand il apparaît, ou fermez-la puis rouvrez-la), puis réessayez.',
      );
    }
    if (objet.titre !== undefined && (typeof objet.titre !== 'string' || objet.titre.length > TITRE_MAX)) throw abime('son titre est illisible');
    if (!Array.isArray(objet.feuilles) || objet.feuilles.length === 0) throw abime('il ne contient aucune feuille');
    if (objet.feuilles.length > FEUILLES_MAX) throw abime('il contient beaucoup trop de feuilles');
    objet.feuilles.forEach((feuille, index) => verifierFeuille(feuille, index + 1));
    const noms = new Set();
    for (const { nom } of objet.feuilles) {
      const cle = nom.trim().toLocaleLowerCase('fr');
      if (noms.has(cle)) throw abime(`deux feuilles portent le nom « ${nom} »`);
      noms.add(cle);
    }
    if (objet.feuilleActive !== undefined && !estEntier(objet.feuilleActive, 0, objet.feuilles.length - 1)) {
      throw abime('la feuille à afficher n’existe pas');
    }

    // Réglages d'affichage : facultatifs, ignorés s'ils sont étranges.
    const affichage = {};
    if (estObjet(objet.affichage)) {
      if (Number.isFinite(objet.affichage.zoom)) affichage.zoom = objet.affichage.zoom;
      if (typeof objet.affichage.theme === 'string' && objet.affichage.theme.length <= 30) affichage.theme = objet.affichage.theme;
    }

    const titre = objet.titre?.trim() ? objet.titre : 'Sans titre';
    return {
      ok: true,
      classeur: { format: FORMAT_CLASSEUR, version: 2, titre, active: objet.feuilleActive ?? 0, feuilles: objet.feuilles },
      affichage,
      resume: { titre, feuilles: objet.feuilles.length },
    };
  } catch (erreur) {
    if (erreur instanceof FichierInvalide) return { ok: false, message: erreur.message };
    return { ok: false, message: 'Ce fichier n’a pas pu être lu (erreur inattendue). Votre classeur n’a pas été modifié.' };
  }
}
