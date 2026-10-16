// (a) LES DONNÉES DU TABLEUR
//
// Ce module ne sait rien de l'affichage ni des calculs : il garde seulement
// ce que la personne a saisi (le texte « brut » de chaque cellule), la mise
// en forme (gras, couleur de fond) et la largeur des colonnes.
//
//  - Une `Feuille` est une grille de cellules.
//  - Un `Classeur` regroupe les feuilles (une seule pour l'instant, mais le
//    format est prêt pour en avoir plusieurs). Toute modification passe par
//    le classeur, qui la mémorise pour « Annuler / Rétablir » et prévient
//    les autres parties de l'application (affichage, calcul, sauvegarde).
//
// Plus tard, les graphiques, le tri ou l'import Excel s'appuieront sur ces
// mêmes fonctions : ils n'auront pas besoin de toucher à l'affichage.

import { adresse as versAdresse, lireAdresse, lettresColonne, numeroColonne } from './adresses.js';

export const LIGNES_PAR_DEFAUT = 100;
export const COLONNES_PAR_DEFAUT = 26; // de A à Z
export const LIGNES_MAX = 1000;
export const COLONNES_MAX = 52; // jusqu'à AZ

export const LARGEUR_PAR_DEFAUT = 100; // en pixels
export const LARGEUR_MIN = 40;
export const LARGEUR_MAX = 600;

/** Couleurs de fond proposées. Leur teinte exacte dépend du thème (voir css/themes.css). */
export const COULEURS_FOND = ['jaune', 'orange', 'rouge', 'rose', 'violet', 'bleu', 'vert', 'gris'];

/** Nombre maximal d'actions mémorisées pour « Annuler ». */
const TAILLE_HISTORIQUE = 200;

const bornes = (valeur, min, max) => Math.min(max, Math.max(min, Math.round(valeur)));

/**
 * Remet une cellule en forme : { brut, gras, fond }, ou null si elle est
 * entièrement vide (pas de texte et pas de mise en forme).
 */
function nettoyerCellule(cellule) {
  if (!cellule) return null;
  const propre = {
    brut: typeof cellule.brut === 'string' ? cellule.brut : String(cellule.brut ?? ''),
    gras: cellule.gras === true,
    fond: COULEURS_FOND.includes(cellule.fond) ? cellule.fond : null,
  };
  if (propre.brut === '' && !propre.gras && !propre.fond) return null;
  return propre;
}

const memesCellules = (a, b) =>
  (a === null && b === null) || (a !== null && b !== null && a.brut === b.brut && a.gras === b.gras && a.fond === b.fond);

// ---------------------------------------------------------------------------
// Feuille
// ---------------------------------------------------------------------------

export class Feuille {
  /** @type {Map<string, {brut: string, gras: boolean, fond: string|null}>} adresse → cellule */
  #cellules = new Map();
  /** @type {Map<number, number>} numéro de colonne → largeur en pixels */
  #largeurs = new Map();

  constructor({ nom = 'Feuille 1', lignes = LIGNES_PAR_DEFAUT, colonnes = COLONNES_PAR_DEFAUT } = {}) {
    this.nom = nom;
    this.lignes = bornes(lignes, 1, LIGNES_MAX);
    this.colonnes = bornes(colonnes, 1, COLONNES_MAX);
  }

  /** Copie de la cellule, ou null si elle est vide. */
  cellule(adresse) {
    const cellule = this.#cellules.get(adresse);
    return cellule ? { ...cellule } : null;
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

  /** Largeur d'une colonne en pixels. */
  largeur(colonne) {
    return this.#largeurs.get(colonne) ?? LARGEUR_PAR_DEFAUT;
  }

  /** Change la largeur d'une colonne (undefined pour revenir à la largeur par défaut). */
  poserLargeur(colonne, largeur) {
    if (largeur === undefined || largeur === LARGEUR_PAR_DEFAUT) this.#largeurs.delete(colonne);
    else this.#largeurs.set(colonne, bornes(largeur, LARGEUR_MIN, LARGEUR_MAX));
  }

  /**
   * Zone réellement utilisée : de A1 jusqu'à la dernière ligne et la dernière
   * colonne qui contiennent du texte. Sert aux exports. { lignes: 0, colonnes: 0 } si tout est vide.
   */
  etendue() {
    let lignes = 0;
    let colonnes = 0;
    for (const [adresse, cellule] of this.#cellules) {
      if (cellule.brut.trim() === '') continue;
      const position = lireAdresse(adresse);
      lignes = Math.max(lignes, position.ligne);
      colonnes = Math.max(colonnes, position.colonne);
    }
    return { lignes, colonnes };
  }

  /** Photographie complète de la feuille (pour la sauvegarde ou l'annulation). */
  versJSON() {
    const cellules = {};
    for (const [adresse, cellule] of this.#cellules) {
      const copie = { brut: cellule.brut };
      if (cellule.gras) copie.gras = true;
      if (cellule.fond) copie.fond = cellule.fond;
      cellules[adresse] = copie;
    }
    const largeurs = {};
    for (const [colonne, largeur] of this.#largeurs) largeurs[lettresColonne(colonne)] = largeur;
    return { nom: this.nom, lignes: this.lignes, colonnes: this.colonnes, largeurs, cellules };
  }

  /** Remplace tout le contenu de la feuille par une photographie (voir versJSON). */
  restaurer(donnees = {}) {
    this.nom = typeof donnees.nom === 'string' && donnees.nom ? donnees.nom : 'Feuille 1';
    this.lignes = bornes(Number(donnees.lignes) || LIGNES_PAR_DEFAUT, 1, LIGNES_MAX);
    this.colonnes = bornes(Number(donnees.colonnes) || COLONNES_PAR_DEFAUT, 1, COLONNES_MAX);
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
 *   { type: 'dimensions', feuille }             lignes ou colonnes ajoutées
 *   { type: 'feuille', feuille }                feuille entièrement remplacée
 *   { type: 'titre' }                           titre du classeur modifié
 *   { type: 'historique' }                      « Annuler / Rétablir » a changé
 */
export class Classeur {
  #abonnes = new Set();
  #passe = []; // actions que l'on peut annuler
  #futur = []; // actions annulées que l'on peut rétablir

  constructor({ titre = 'Sans titre', feuilles } = {}) {
    this.titre = titre;
    /** @type {Feuille[]} */
    this.feuilles = feuilles?.length ? feuilles : [new Feuille()];
  }

  /** S'abonne aux modifications. Renvoie une fonction qui annule l'abonnement. */
  abonner(fonction) {
    this.#abonnes.add(fonction);
    return () => this.#abonnes.delete(fonction);
  }

  #annoncer(evenement) {
    for (const fonction of this.#abonnes) fonction(evenement);
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
   * { faire(), defaire(), selection } ; `selection` (facultative) indique la
   * plage à sélectionner après une annulation, pour montrer ce qui a changé.
   */
  #executer(action) {
    action.faire();
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
   * @param {Array<{adresse: string, brut?: string, gras?: boolean, fond?: string|null}>} modifications
   *        les propriétés absentes restent inchangées
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
      const base = ancienne ?? { brut: '', gras: false, fond: null };
      const nouvelle = nettoyerCellule({
        brut: modification.brut ?? base.brut,
        gras: modification.gras ?? base.gras,
        fond: modification.fond !== undefined ? modification.fond : base.fond,
      });
      if (memesCellules(ancienne, nouvelle)) continue;
      avant.push({ adresse: modification.adresse, cellule: ancienne });
      apres.push({ adresse: modification.adresse, cellule: nouvelle });
    }
    if (apres.length === 0) return false;
    this.#executer({
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
    this.#executer({ faire: () => poser(apres), defaire: () => poser(avant) });
    return true;
  }

  /** Vide entièrement une feuille (texte, mise en forme, largeurs). Annulable. */
  viderFeuille(feuille) {
    const avant = feuille.versJSON();
    const apres = new Feuille({ nom: feuille.nom }).versJSON();
    const restaurer = (donnees) => {
      feuille.restaurer(donnees);
      this.#annoncer({ type: 'feuille', feuille });
    };
    this.#executer({ faire: () => restaurer(apres), defaire: () => restaurer(avant) });
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
      format: 'tableur',
      version: 1,
      titre: this.titre,
      feuilles: this.feuilles.map((feuille) => feuille.versJSON()),
    };
  }

  /**
   * Remplace tout le contenu par un classeur enregistré. Les objets Feuille
   * existants sont conservés (l'affichage et le calcul gardent leurs repères)
   * et l'historique d'annulation est vidé.
   */
  charger(donnees) {
    if (!donnees || donnees.format !== 'tableur') throw new Error('Ce fichier n’est pas un classeur Tableur.');
    this.titre = typeof donnees.titre === 'string' && donnees.titre.trim() ? donnees.titre : 'Sans titre';
    const feuilles = Array.isArray(donnees.feuilles) && donnees.feuilles.length ? donnees.feuilles : [{}];
    feuilles.forEach((donneesFeuille, index) => {
      if (this.feuilles[index]) this.feuilles[index].restaurer(donneesFeuille);
      else this.feuilles.push(Feuille.depuisJSON(donneesFeuille));
    });
    this.feuilles.length = feuilles.length;
    this.#passe = [];
    this.#futur = [];
    this.#annoncer({ type: 'titre' });
    for (const feuille of this.feuilles) this.#annoncer({ type: 'feuille', feuille });
    this.#annoncer({ type: 'historique' });
  }
}
