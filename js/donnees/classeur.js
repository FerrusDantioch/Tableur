// (a) LES DONNÉES DU TABLEUR
//
// Ce module ne sait rien de l'affichage ni des calculs : il garde seulement
// ce que la personne a saisi (le texte « brut » de chaque cellule), la mise
// en forme (gras, couleurs, bordures…), la largeur des colonnes, et la liste
// des feuilles (onglets).
//
//  - Une `Feuille` est une grille de cellules.
//  - Un `Classeur` regroupe les feuilles. Toute modification passe par le
//    classeur, qui la mémorise pour « Annuler / Rétablir » et prévient les
//    autres parties de l'application (affichage, calcul, sauvegarde).
//
// Plus tard, les graphiques ou l'import Excel s'appuieront sur ces mêmes
// fonctions : ils n'auront pas besoin de toucher à l'affichage.

import { COLONNES_MAX, LIGNES_MAX, adresse as versAdresse, lireAdresse, lettresColonne, numeroColonne } from './adresses.js';
import { ajusterReferences, decalerReferences, oublierFeuilleDansFormule, renommerFeuilleDansFormule } from './formules.js';

export { COLONNES_MAX, LIGNES_MAX };
export const LIGNES_PAR_DEFAUT = 100;
export const COLONNES_PAR_DEFAUT = 26; // de A à Z

export const LARGEUR_PAR_DEFAUT = 100; // en pixels
export const LARGEUR_MIN = 40;
export const LARGEUR_MAX = 600;

/** Couleurs de fond proposées. Leur teinte exacte dépend du thème (voir css/themes.css). */
export const COULEURS_FOND = ['jaune', 'orange', 'rouge', 'rose', 'violet', 'bleu', 'vert', 'gris'];

/** Couleurs du texte et des bordures (« encres »), elles aussi adaptées à chaque thème. */
export const ENCRES = ['rouge', 'orange', 'jaune', 'vert', 'bleu', 'violet', 'gris'];

/** Alignements possibles (null : automatique, nombres à droite et texte à gauche). */
export const ALIGNEMENTS = ['gauche', 'centre', 'droite'];

/** Formats de nombre (null : automatique, d'après ce qui a été tapé). */
export const FORMATS = ['nombre', 'euro', 'pourcent', 'date'];
export const DECIMALES_MAX = 10;

/** Les quatre côtés d'une cellule, et les traits possibles pour une bordure. */
export const COTES = ['haut', 'bas', 'gauche', 'droite'];
export const TRAITS = ['fin', 'epais'];

/** Nombre maximal d'actions mémorisées pour « Annuler ». */
const TAILLE_HISTORIQUE = 200;

/** Longueur maximale d'un nom de feuille (comme dans Excel). */
export const NOM_FEUILLE_MAX = 31;

/**
 * Marque écrite dans chaque classeur enregistré. Les classeurs enregistrés
 * avant le renommage en « Omni-Tableur » portent l'ancienne marque, « tableur ».
 */
export const FORMAT_CLASSEUR = 'omni-tableur';
const FORMATS_ACCEPTES = [FORMAT_CLASSEUR, 'tableur'];

const bornes = (valeur, min, max) => Math.min(max, Math.max(min, Math.round(valeur)));

// ---------------------------------------------------------------------------
// Mise en forme d'une cellule
// ---------------------------------------------------------------------------

/** Une bordure propre ({ style, couleur }), ou null si elle est invalide. */
function nettoyerBordure(bordure) {
  if (!bordure || typeof bordure !== 'object') return null;
  return {
    style: TRAITS.includes(bordure.style) ? bordure.style : 'fin',
    couleur: ENCRES.includes(bordure.couleur) ? bordure.couleur : 'auto',
  };
}

/** Les bordures propres d'une cellule ({ haut, bas, gauche, droite }), ou null s'il n'y en a aucune. */
function nettoyerBordures(bordures) {
  if (!bordures || typeof bordures !== 'object') return null;
  const propres = {};
  for (const cote of COTES) {
    const bordure = nettoyerBordure(bordures[cote]);
    if (bordure) propres[cote] = bordure;
  }
  return Object.keys(propres).length ? propres : null;
}

function nettoyerFormat(format) {
  if (!format || !FORMATS.includes(format.type)) return null;
  const decimales = format.type === 'date' ? 0 : bornes(Number(format.decimales) || 0, 0, DECIMALES_MAX);
  return { type: format.type, decimales };
}

/**
 * Propriétés de mise en forme d'une cellule : nom → fonction qui rend une
 * valeur propre (la valeur par défaut est celle d'une cellule sans mise en forme).
 */
const STYLES = {
  gras: (valeur) => valeur === true,
  italique: (valeur) => valeur === true,
  couleur: (valeur) => (ENCRES.includes(valeur) ? valeur : null),
  fond: (valeur) => (COULEURS_FOND.includes(valeur) ? valeur : null),
  alignement: (valeur) => (ALIGNEMENTS.includes(valeur) ? valeur : null),
  format: nettoyerFormat,
  bordures: nettoyerBordures,
};

/** Noms des propriétés de mise en forme. */
export const PROPRIETES_STYLE = Object.keys(STYLES);

const estParDefaut = (valeur) => valeur === null || valeur === false;

/**
 * Remet une cellule en forme : { brut, gras, italique, couleur, fond,
 * alignement, format, bordures }, ou null si elle est entièrement vide
 * (pas de texte et pas de mise en forme).
 */
export function nettoyerCellule(cellule) {
  if (!cellule) return null;
  const propre = { brut: typeof cellule.brut === 'string' ? cellule.brut : String(cellule.brut ?? '') };
  let vide = propre.brut === '';
  for (const [nom, nettoyer] of Object.entries(STYLES)) {
    propre[nom] = nettoyer(cellule[nom]);
    if (!estParDefaut(propre[nom])) vide = false;
  }
  if (vide) return null;
  // La cellule est « gelée » : personne ne peut la modifier par erreur sans
  // passer par le classeur (qui mémorise tout pour Annuler).
  if (propre.bordures) for (const cote of Object.keys(propre.bordures)) Object.freeze(propre.bordures[cote]);
  Object.freeze(propre.bordures);
  Object.freeze(propre.format);
  return Object.freeze(propre);
}

/** Version compacte d'une cellule pour l'enregistrement (sans les valeurs par défaut). */
function compacter(cellule) {
  const copie = { brut: cellule.brut };
  for (const nom of PROPRIETES_STYLE) if (!estParDefaut(cellule[nom])) copie[nom] = cellule[nom];
  return copie;
}

const memesCellules = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---------------------------------------------------------------------------
// Feuille
// ---------------------------------------------------------------------------

let compteurFeuilles = 0;

export class Feuille {
  /** @type {Map<string, object>} adresse → cellule (voir nettoyerCellule) */
  #cellules = new Map();
  /** @type {Map<number, number>} numéro de colonne → largeur en pixels */
  #largeurs = new Map();

  constructor({ nom = 'Feuille1', lignes = LIGNES_PAR_DEFAUT, colonnes = COLONNES_PAR_DEFAUT } = {}) {
    /** Identifiant fixe pendant la session (le nom, lui, peut changer). */
    this.id = ++compteurFeuilles;
    this.nom = nom;
    this.lignes = bornes(lignes, 1, LIGNES_MAX);
    this.colonnes = bornes(colonnes, 1, COLONNES_MAX);
    /** Vrai si la première ligne reste visible quand on fait défiler. */
    this.figee = false;
  }

  /**
   * La cellule (objet gelé, en lecture seule), ou null si elle est vide.
   * Pour la changer, passer par Classeur.modifierCellules.
   */
  cellule(adresse) {
    return this.#cellules.get(adresse) ?? null;
  }

  /** Texte brut de la cellule ("" si elle est vide). */
  brut(adresse) {
    return this.#cellules.get(adresse)?.brut ?? '';
  }

  /** Remplace une cellule (null pour la vider). Usage interne : passer par le Classeur. */
  poser(adresse, cellule) {
    const propre = nettoyerCellule(cellule);
    if (propre) this.#cellules.set(adresse, propre);
    else this.#cellules.delete(adresse);
  }

  /** Adresses de toutes les cellules non vides (texte ou mise en forme). */
  adresses() {
    return [...this.#cellules.keys()];
  }

  /**
   * Déplace toutes les cellules. `nouvellePosition(ligne, colonne)` renvoie
   * la nouvelle position { ligne, colonne }, ou null pour effacer la cellule.
   * Usage interne (insertion, suppression, tri).
   */
  deplacerCellules(nouvellePosition) {
    const anciennes = [...this.#cellules];
    this.#cellules.clear();
    for (const [adresse, cellule] of anciennes) {
      const { ligne, colonne } = lireAdresse(adresse);
      const cible = nouvellePosition(ligne, colonne);
      if (cible) this.#cellules.set(versAdresse(cible.ligne, cible.colonne), cellule);
    }
  }

  /** Largeur d'une colonne en pixels. */
  largeur(colonne) {
    return this.#largeurs.get(colonne) ?? LARGEUR_PAR_DEFAUT;
  }

  /** Change la largeur d'une colonne (undefined pour revenir à la largeur par défaut). */
  poserLargeur(colonne, largeur) {
    if (largeur === undefined || largeur === LARGEUR_PAR_DEFAUT) this.#largeurs.delete(colonne);
    else this.#largeurs.set(colonne, bornes(largeur, LARGEUR_MIN, LARGEUR_MAX));
  }

  /** Déplace les largeurs de colonnes (insertion ou suppression de colonnes). */
  deplacerLargeurs(nouvelleColonne) {
    const anciennes = [...this.#largeurs];
    this.#largeurs.clear();
    for (const [colonne, largeur] of anciennes) {
      const cible = nouvelleColonne(colonne);
      if (cible) this.#largeurs.set(cible, largeur);
    }
  }

  /**
   * Zone réellement utilisée : de A1 jusqu'à la dernière ligne et la dernière
   * colonne qui contiennent du texte. Sert aux exports. { lignes: 0, colonnes: 0 } si tout est vide.
   * Avec `miseEnForme`, les cellules seulement mises en forme comptent aussi.
   */
  etendue({ miseEnForme = false } = {}) {
    let lignes = 0;
    let colonnes = 0;
    for (const [adresse, cellule] of this.#cellules) {
      if (!miseEnForme && cellule.brut.trim() === '') continue;
      const position = lireAdresse(adresse);
      lignes = Math.max(lignes, position.ligne);
      colonnes = Math.max(colonnes, position.colonne);
    }
    return { lignes, colonnes };
  }

  /** Photographie complète de la feuille (pour la sauvegarde ou l'annulation). */
  versJSON() {
    const cellules = {};
    for (const [adresse, cellule] of this.#cellules) cellules[adresse] = compacter(cellule);
    const largeurs = {};
    for (const [colonne, largeur] of this.#largeurs) largeurs[lettresColonne(colonne)] = largeur;
    const donnees = { nom: this.nom, lignes: this.lignes, colonnes: this.colonnes, largeurs, cellules };
    if (this.figee) donnees.figee = true;
    return donnees;
  }

  /** Remplace tout le contenu de la feuille par une photographie (voir versJSON). */
  restaurer(donnees = {}) {
    this.nom = typeof donnees.nom === 'string' && donnees.nom.trim() ? donnees.nom : 'Feuille1';
    this.lignes = bornes(Number(donnees.lignes) || LIGNES_PAR_DEFAUT, 1, LIGNES_MAX);
    this.colonnes = bornes(Number(donnees.colonnes) || COLONNES_PAR_DEFAUT, 1, COLONNES_MAX);
    this.figee = donnees.figee === true;
    this.#cellules.clear();
    this.#largeurs.clear();
    for (const [adresse, cellule] of Object.entries(donnees.cellules ?? {})) {
      const position = lireAdresse(adresse);
      if (!position || position.ligne > LIGNES_MAX || position.colonne > COLONNES_MAX) continue;
      // L'adresse est réécrite proprement (majuscules, sans « $ »).
      this.poser(versAdresse(position.ligne, position.colonne), cellule);
      // Une cellule remplie agrandit la grille si besoin.
      this.lignes = Math.max(this.lignes, position.ligne);
      this.colonnes = Math.max(this.colonnes, position.colonne);
    }
    for (const [lettres, largeur] of Object.entries(donnees.largeurs ?? {})) {
      const colonne = numeroColonne(lettres);
      if (colonne >= 1 && colonne <= COLONNES_MAX && Number.isFinite(largeur)) this.poserLargeur(colonne, largeur);
    }
  }

  static depuisJSON(donnees) {
    const feuille = new Feuille();
    feuille.restaurer(donnees);
    return feuille;
  }
}

// ---------------------------------------------------------------------------
// Classeur
// ---------------------------------------------------------------------------

/**
 * Événements envoyés aux abonnés (fonction appelée avec un objet) :
 *   { type: 'cellules', feuille, adresses, contenus }  cellules modifiées ;
 *        `contenus` ne garde que celles dont le TEXTE a changé (utile au calcul)
 *   { type: 'largeurs', feuille, colonnes }     largeur de colonnes modifiée
 *   { type: 'dimensions', feuille }             lignes ou colonnes ajoutées en bas ou à droite
 *   { type: 'structure', feuilles }             contenu de ces feuilles entièrement remplacé
 *        (insertion ou suppression de lignes, tri, chargement…)
 *   { type: 'onglets' }                         liste ou noms des feuilles modifiés
 *   { type: 'active', feuille }                 autre feuille affichée
 *   { type: 'titre' }                           titre du classeur modifié
 *   { type: 'historique' }                      « Annuler / Rétablir » a changé
 */
export class Classeur {
  #abonnes = new Set();
  #passe = []; // actions que l'on peut annuler
  #futur = []; // actions annulées que l'on peut rétablir
  #active; // feuille affichée

  constructor({ titre = 'Sans titre', feuilles } = {}) {
    this.titre = titre;
    /** @type {Feuille[]} */
    this.feuilles = feuilles?.length ? feuilles : [new Feuille()];
    this.#active = this.feuilles[0];
  }

  /** S'abonne aux modifications. Renvoie une fonction qui annule l'abonnement. */
  abonner(fonction) {
    this.#abonnes.add(fonction);
    return () => this.#abonnes.delete(fonction);
  }

  #annoncer(evenement) {
    for (const fonction of this.#abonnes) fonction(evenement);
  }

  // --- Feuille affichée ----------------------------------------------------------

  /** La feuille affichée à l'écran (onglet sélectionné). */
  get feuilleActive() {
    return this.#active;
  }

  /** Affiche une autre feuille (ce n'est pas une modification : rien à annuler). */
  activer(feuille) {
    if (!this.feuilles.includes(feuille) || feuille === this.#active) return;
    this.#active = feuille;
    this.#annoncer({ type: 'active', feuille });
  }

  /** La feuille qui porte ce nom (sans tenir compte des majuscules), ou undefined. */
  feuilleNommee(nom) {
    const cherche = String(nom).toLocaleLowerCase('fr');
    return this.feuilles.find((feuille) => feuille.nom.toLocaleLowerCase('fr') === cherche);
  }

  // --- Historique (Annuler / Rétablir) -------------------------------------

  get peutAnnuler() {
    return this.#passe.length > 0;
  }

  get peutRetablir() {
    return this.#futur.length > 0;
  }

  /**
   * Exécute une action et la mémorise. Une action est un objet
   * { faire(), defaire(), feuille, selection } ; `feuille` et `selection`
   * (facultatives) indiquent la feuille à afficher et la plage à sélectionner
   * après une annulation, pour montrer ce qui a changé.
   * Avec `dejaFaite`, la modification a déjà eu lieu : seul l'historique est mis à jour.
   */
  #executer(action, { dejaFaite = false } = {}) {
    if (!dejaFaite) action.faire();
    this.#passe.push(action);
    if (this.#passe.length > TAILLE_HISTORIQUE) this.#passe.shift();
    this.#futur = [];
    this.#annoncer({ type: 'historique' });
  }

  /** Annule la dernière action. Renvoie l'action annulée, ou null. */
  annuler() {
    const action = this.#passe.pop();
    if (!action) return null;
    action.defaire();
    this.#futur.push(action);
    this.#annoncer({ type: 'historique' });
    return action;
  }

  /** Rétablit la dernière action annulée. Renvoie l'action, ou null. */
  retablir() {
    const action = this.#futur.pop();
    if (!action) return null;
    action.faire();
    this.#passe.push(action);
    this.#annoncer({ type: 'historique' });
    return action;
  }

  // --- Cellules ------------------------------------------------------------

  /**
   * Modifie des cellules en une seule action (annulable d'un coup).
   * @param {Feuille} feuille
   * @param {Array<object>} modifications  { adresse, brut?, gras?, italique?, couleur?, fond?,
   *        alignement?, format?, bordures?, remplacer? } : les propriétés absentes restent
   *        inchangées. `bordures` ne change que les côtés indiqués (null efface un côté ;
   *        bordures: null efface tout). Avec `remplacer: true`, la cellule est entièrement
   *        remplacée (les propriétés absentes reviennent à leur valeur par défaut).
   * @param {object} [selection]  plage à resélectionner en cas d'annulation
   * @returns {boolean} vrai si quelque chose a changé
   */
  modifierCellules(feuille, modifications, selection = null) {
    const avant = [];
    const apres = [];
    const dejaVues = new Set();
    for (const modification of modifications) {
      if (dejaVues.has(modification.adresse)) continue;
      dejaVues.add(modification.adresse);
      const ancienne = feuille.cellule(modification.adresse);
      const nouvelle = nettoyerCellule(modification.remplacer ? modification : fusionner(ancienne, modification));
      if (memesCellules(ancienne, nouvelle)) continue;
      avant.push({ adresse: modification.adresse, cellule: ancienne });
      apres.push({ adresse: modification.adresse, cellule: nouvelle });
    }
    if (apres.length === 0) return false;
    this.#executer({
      feuille,
      selection,
      faire: () => this.#poserCellules(feuille, apres),
      defaire: () => this.#poserCellules(feuille, avant),
    });
    return true;
  }

  #poserCellules(feuille, liste) {
    const adresses = [];
    const contenus = [];
    for (const { adresse, cellule } of liste) {
      const ancienBrut = feuille.brut(adresse);
      feuille.poser(adresse, cellule);
      adresses.push(adresse);
      if (feuille.brut(adresse) !== ancienBrut) contenus.push(adresse);
    }
    this.#annoncer({ type: 'cellules', feuille, adresses, contenus });
  }

  // --- Colonnes et dimensions ------------------------------------------------

  /** Donne la même largeur (en pixels) à plusieurs colonnes, en une action. */
  modifierLargeurs(feuille, colonnes, largeur) {
    const avant = new Map(colonnes.map((colonne) => [colonne, feuille.largeur(colonne)]));
    const cible = bornes(largeur, LARGEUR_MIN, LARGEUR_MAX);
    if (colonnes.every((colonne) => avant.get(colonne) === cible)) return false;
    const poser = (valeurs) => {
      for (const [colonne, valeur] of valeurs) feuille.poserLargeur(colonne, valeur);
      this.#annoncer({ type: 'largeurs', feuille, colonnes: [...valeurs.keys()] });
    };
    this.#executer({
      feuille,
      faire: () => poser(new Map(colonnes.map((colonne) => [colonne, cible]))),
      defaire: () => poser(avant),
    });
    return true;
  }

  /** Ajoute des lignes et/ou des colonnes en bas et à droite (dans la limite du maximum). */
  agrandir(feuille, { lignes = 0, colonnes = 0 }) {
    const avant = { lignes: feuille.lignes, colonnes: feuille.colonnes };
    const apres = {
      lignes: bornes(feuille.lignes + lignes, 1, LIGNES_MAX),
      colonnes: bornes(feuille.colonnes + colonnes, 1, COLONNES_MAX),
    };
    if (apres.lignes === avant.lignes && apres.colonnes === avant.colonnes) return false;
    const poser = (dimensions) => {
      feuille.lignes = dimensions.lignes;
      feuille.colonnes = dimensions.colonnes;
      this.#annoncer({ type: 'dimensions', feuille });
    };
    this.#executer({ feuille, faire: () => poser(apres), defaire: () => poser(avant) });
    return true;
  }

  // --- Modifications de structure (annulables) ------------------------------------

  /** Photographie du classeur : ordre des feuilles, feuille active, contenu de chaque feuille. */
  #photographier() {
    return {
      ordre: [...this.feuilles],
      active: this.#active,
      donnees: new Map(this.feuilles.map((feuille) => [feuille, feuille.versJSON()])),
    };
  }

  #restaurer(photo) {
    this.feuilles = [...photo.ordre];
    for (const [feuille, donnees] of photo.donnees) feuille.restaurer(donnees);
    const ancienne = this.#active;
    this.#active = this.feuilles.includes(photo.active) ? photo.active : this.feuilles[0];
    this.#annoncer({ type: 'onglets' });
    this.#annoncer({ type: 'structure', feuilles: [...photo.donnees.keys()].filter((f) => this.feuilles.includes(f)) });
    if (this.#active !== ancienne) this.#annoncer({ type: 'active', feuille: this.#active });
  }

  /**
   * Fait une modification de structure et la rend annulable : on photographie
   * le classeur avant et après (seules les feuilles qui ont changé sont
   * gardées en mémoire). `travail()` fait la modification ; s'il renvoie
   * false, rien n'est enregistré.
   */
  #modifierStructure({ feuille = null, selection = null }, travail) {
    const avant = this.#photographier();
    if (travail() === false) return false;
    const apres = this.#photographier();
    for (const f of [...avant.donnees.keys()]) {
      if (apres.donnees.has(f) && JSON.stringify(avant.donnees.get(f)) === JSON.stringify(apres.donnees.get(f))) {
        avant.donnees.delete(f);
        apres.donnees.delete(f);
      }
    }
    const action = { feuille, selection, faire: () => this.#restaurer(apres), defaire: () => this.#restaurer(avant) };
    // Les abonnés sont prévenus comme pour un « Rétablir » (la feuille active
    // d'avant est remise un instant, pour que son changement soit annoncé).
    this.#active = avant.active;
    action.faire();
    this.#executer(action, { dejaFaite: true });
    return true;
  }

  /** Réécrit le texte de toutes les formules du classeur avec `reecrire(brut, feuilleDeLaFormule)`. */
  #reecrireFormules(reecrire) {
    for (const feuille of this.feuilles) {
      for (const adresse of feuille.adresses()) {
        const cellule = feuille.cellule(adresse);
        if (!cellule.brut.trim().startsWith('=')) continue;
        const nouveau = reecrire(cellule.brut, feuille);
        if (nouveau !== cellule.brut) feuille.poser(adresse, { ...cellule, brut: nouveau });
      }
    }
  }

  /**
   * Insère des lignes vides (ou des colonnes vides) avant la ligne (ou la
   * colonne) `position`. Les cellules en dessous (ou à droite) se décalent et
   * les formules de tout le classeur sont mises à jour.
   * @param {'lignes'|'colonnes'} axe
   * @returns {{ok: boolean, message?: string}}
   */
  inserer(feuille, axe, position, nombre, selection = null) {
    const lignes = axe === 'lignes';
    const maximum = lignes ? LIGNES_MAX : COLONNES_MAX;
    const occupe = feuille.etendue({ miseEnForme: true })[axe];
    if (occupe >= position && occupe + nombre > maximum) {
      return {
        ok: false,
        message: lignes
          ? `Impossible d’insérer : des cellules seraient poussées au-delà de la ligne ${LIGNES_MAX}.`
          : `Impossible d’insérer : des cellules seraient poussées au-delà de la colonne ${lettresColonne(COLONNES_MAX)}.`,
      };
    }
    this.#modifierStructure({ feuille, selection }, () => {
      const decaler = (valeur) => (valeur >= position ? valeur + nombre : valeur);
      feuille.deplacerCellules((ligne, colonne) => (lignes ? { ligne: decaler(ligne), colonne } : { ligne, colonne: decaler(colonne) }));
      if (lignes) feuille.lignes = Math.min(LIGNES_MAX, feuille.lignes + nombre);
      else {
        feuille.colonnes = Math.min(COLONNES_MAX, feuille.colonnes + nombre);
        feuille.deplacerLargeurs((colonne) => (decaler(colonne) <= COLONNES_MAX ? decaler(colonne) : null));
      }
      const changement = { feuille: feuille.nom, axe, type: 'insertion', position, nombre };
      this.#reecrireFormules((brut, f) => ajusterReferences(brut, f.nom, changement));
    });
    return { ok: true };
  }

  /**
   * Supprime des lignes (ou des colonnes) à partir de `position`. Les
   * cellules en dessous (ou à droite) remontent ; les formules qui
   * utilisaient les cellules supprimées affichent #REF!. La feuille garde sa taille.
   * @param {'lignes'|'colonnes'} axe
   */
  supprimer(feuille, axe, position, nombre, selection = null) {
    const lignes = axe === 'lignes';
    const derniere = position + nombre - 1;
    this.#modifierStructure({ feuille, selection }, () => {
      const nouvelle = (valeur) => (valeur < position ? valeur : valeur > derniere ? valeur - nombre : null);
      feuille.deplacerCellules((ligne, colonne) => {
        const valeur = nouvelle(lignes ? ligne : colonne);
        if (valeur === null) return null;
        return lignes ? { ligne: valeur, colonne } : { ligne, colonne: valeur };
      });
      if (!lignes) feuille.deplacerLargeurs(nouvelle);
      const changement = { feuille: feuille.nom, axe, type: 'suppression', position, nombre };
      this.#reecrireFormules((brut, f) => ajusterReferences(brut, f.nom, changement));
    });
    return { ok: true };
  }

  /**
   * Réordonne les lignes d'une zone (tri). `ordre[i]` est l'ancienne ligne qui
   * vient se placer à la ligne `zone.debut.ligne + i`. Seules les colonnes de
   * la zone bougent. Les cellules gardent leur mise en forme ; les formules
   * déplacées s'adaptent comme lors d'un copier-coller (=A5*2 qui descend de
   * 3 lignes devient =A8*2).
   * @returns {boolean} vrai si l'ordre a changé
   */
  reordonnerLignes(feuille, zone, ordre, selection = null) {
    const premiere = zone.debut.ligne;
    if (ordre.every((ancienne, i) => ancienne === premiere + i)) return false;
    const derniere = premiere + ordre.length - 1;
    const destination = new Map(ordre.map((ancienne, i) => [ancienne, premiere + i]));
    const dansZone = (ligne, colonne) =>
      ligne >= premiere && ligne <= derniere && colonne >= zone.debut.colonne && colonne <= zone.fin.colonne;
    return this.#modifierStructure({ feuille, selection }, () => {
      const deplacees = [];
      feuille.deplacerCellules((ligne, colonne) => {
        if (!dansZone(ligne, colonne)) return { ligne, colonne };
        const nouvelle = destination.get(ligne);
        if (nouvelle !== ligne) deplacees.push({ adresse: versAdresse(nouvelle, colonne), dLignes: nouvelle - ligne });
        return { ligne: nouvelle, colonne };
      });
      for (const { adresse, dLignes } of deplacees) {
        const cellule = feuille.cellule(adresse);
        const brut = decalerReferences(cellule.brut, dLignes, 0);
        if (brut !== cellule.brut) feuille.poser(adresse, { ...cellule, brut });
      }
    });
  }

  /** Vide entièrement une feuille (texte, mise en forme, largeurs). Annulable. */
  viderFeuille(feuille) {
    this.#modifierStructure({ feuille }, () => {
      feuille.restaurer({ nom: feuille.nom });
    });
  }

  /** Remet le classeur à zéro : une seule feuille vide, sans titre. Annulable. */
  reinitialiser() {
    const titreAvant = this.titre;
    const premiere = this.feuilles[0];
    this.#modifierStructure({}, () => {
      this.feuilles = [premiere];
      premiere.restaurer({ nom: 'Feuille1' });
      this.#active = premiere;
    });
    this.renommer('Sans titre');
    return titreAvant;
  }

  /** Fige (ou libère) la première ligne d'une feuille. Annulable. */
  figerPremiereLigne(feuille, figee) {
    if (feuille.figee === figee) return false;
    return this.#modifierStructure({ feuille }, () => {
      feuille.figee = figee;
    });
  }

  // --- Feuilles (onglets) ------------------------------------------------------------

  /** Un nom libre pour une nouvelle feuille : Feuille2, Feuille3… */
  nomLibre(base = 'Feuille') {
    for (let n = this.feuilles.length + 1; ; n++) {
      const nom = `${base}${n}`;
      if (!this.feuilleNommee(nom)) return nom;
    }
  }

  /**
   * Vérifie un nom de feuille. Renvoie un message d'erreur en français, ou
   * null si le nom convient. `feuille` : la feuille renommée (son nom actuel est permis).
   */
  verifierNomFeuille(nom, feuille = null) {
    const propre = String(nom ?? '').trim();
    if (!propre) return 'Le nom ne peut pas être vide.';
    if (propre.length > NOM_FEUILLE_MAX) return `Le nom ne peut pas dépasser ${NOM_FEUILLE_MAX} caractères.`;
    if (/[[\]:*?/\\]/.test(propre)) return 'Le nom ne peut pas contenir ces caractères : [ ] : * ? / \\';
    if (propre.startsWith("'") || propre.endsWith("'")) return 'Le nom ne peut pas commencer ni finir par une apostrophe.';
    const existante = this.feuilleNommee(propre);
    if (existante && existante !== feuille) return 'Une autre feuille porte déjà ce nom.';
    return null;
  }

  /**
   * Ajoute une feuille (vide, ou remplie avec `donnees`, voir Feuille.versJSON)
   * après la feuille active, et l'affiche. Annulable.
   * @returns {Feuille}
   */
  ajouterFeuille({ nom = null, donnees = null } = {}) {
    const feuille = new Feuille();
    feuille.restaurer({ ...(donnees ?? {}), nom: nom && !this.verifierNomFeuille(nom) ? nom.trim() : this.nomLibre() });
    this.#modifierStructure({ feuille }, () => {
      this.feuilles.splice(this.feuilles.indexOf(this.#active) + 1, 0, feuille);
      this.#active = feuille;
    });
    return feuille;
  }

  /**
   * Renomme une feuille ; les formules qui la désignent sont mises à jour.
   * @returns {string|null} message d'erreur, ou null si c'est fait
   */
  renommerFeuille(feuille, nom) {
    const erreur = this.verifierNomFeuille(nom, feuille);
    if (erreur) return erreur;
    const propre = String(nom).trim();
    if (propre === feuille.nom) return null;
    const ancien = feuille.nom;
    this.#modifierStructure({ feuille }, () => {
      this.#reecrireFormules((brut) => renommerFeuilleDansFormule(brut, ancien, propre));
      feuille.nom = propre;
    });
    return null;
  }

  /**
   * Supprime une feuille (il en reste toujours au moins une). Les formules qui
   * la désignaient affichent #REF!. Annulable.
   */
  supprimerFeuille(feuille) {
    if (this.feuilles.length <= 1 || !this.feuilles.includes(feuille)) return false;
    const index = this.feuilles.indexOf(feuille);
    return this.#modifierStructure({}, () => {
      this.feuilles.splice(index, 1);
      if (this.#active === feuille) this.#active = this.feuilles[Math.max(0, index - 1)];
      this.#reecrireFormules((brut) => oublierFeuilleDansFormule(brut, feuille.nom));
    });
  }

  // --- Titre -------------------------------------------------------------------

  /** Change le titre du classeur (sert aussi de nom aux fichiers exportés). */
  renommer(titre) {
    const propre = String(titre ?? '').trim() || 'Sans titre';
    if (propre === this.titre) return;
    this.titre = propre;
    this.#annoncer({ type: 'titre' });
  }

  // --- Sauvegarde --------------------------------------------------------------

  /** Le classeur entier sous forme d'objet simple, prêt à être enregistré. */
  versJSON() {
    return {
      format: FORMAT_CLASSEUR,
      version: 2,
      titre: this.titre,
      active: Math.max(0, this.feuilles.indexOf(this.#active)),
      feuilles: this.feuilles.map((feuille) => feuille.versJSON()),
    };
  }

  /**
   * Remplace tout le contenu par un classeur enregistré (version 1 ou 2).
   * Les objets Feuille existants sont réutilisés quand c'est possible, et
   * l'historique d'annulation est vidé.
   */
  charger(donnees) {
    if (!donnees || !FORMATS_ACCEPTES.includes(donnees.format)) throw new Error('Ce fichier n’est pas un classeur Omni-Tableur.');
    this.titre = typeof donnees.titre === 'string' && donnees.titre.trim() ? donnees.titre : 'Sans titre';
    const liste = Array.isArray(donnees.feuilles) && donnees.feuilles.length ? donnees.feuilles : [{}];
    const feuilles = liste.map((donneesFeuille, index) => {
      const feuille = this.feuilles[index] ?? new Feuille();
      feuille.restaurer(donneesFeuille);
      return feuille;
    });
    // Version 1 : une seule feuille, nommée « Feuille 1 » et invisible. Elle
    // prend le nom des nouvelles feuilles (Feuille1), plus simple dans les formules.
    if ((donnees.version ?? 1) < 2 && feuilles.length === 1 && feuilles[0].nom === 'Feuille 1') feuilles[0].nom = 'Feuille1';
    // Deux feuilles du même nom (fichier abîmé) : la seconde est renommée.
    for (const [index, feuille] of feuilles.entries()) {
      const doublon = feuilles.slice(0, index).some((autre) => autre.nom.toLocaleLowerCase('fr') === feuille.nom.toLocaleLowerCase('fr'));
      if (doublon) feuille.nom = `${feuille.nom.slice(0, NOM_FEUILLE_MAX - 4)} (${index + 1})`;
    }
    this.feuilles = feuilles;
    this.#active = feuilles[Math.min(feuilles.length - 1, Math.max(0, Number(donnees.active) || 0))];
    this.#passe = [];
    this.#futur = [];
    this.#annoncer({ type: 'titre' });
    this.#annoncer({ type: 'onglets' });
    this.#annoncer({ type: 'structure', feuilles: [...this.feuilles] });
    this.#annoncer({ type: 'active', feuille: this.#active });
    this.#annoncer({ type: 'historique' });
  }
}

/**
 * Applique une modification partielle à une cellule : les propriétés
 * absentes de la modification gardent leur valeur ; pour les bordures, seuls
 * les côtés indiqués changent.
 */
function fusionner(ancienne, modification) {
  const base = ancienne ?? { brut: '' };
  const resultat = { ...base };
  if (modification.brut !== undefined) resultat.brut = modification.brut;
  for (const nom of PROPRIETES_STYLE) {
    if (nom === 'bordures' || modification[nom] === undefined) continue;
    resultat[nom] = modification[nom];
  }
  if (modification.bordures === null) resultat.bordures = null;
  else if (modification.bordures) {
    const bordures = { ...(base.bordures ?? {}) };
    for (const cote of COTES) {
      if (modification.bordures[cote] === null) delete bordures[cote];
      else if (modification.bordures[cote]) bordures[cote] = modification.bordures[cote];
    }
    resultat.bordures = bordures;
  }
  return resultat;
}
