// Mise en forme des cellules : gras, italique, couleur du texte, couleur de
// fond, alignement, format des nombres (décimales, euros, pourcentage, date)
// et largeur des colonnes.
//
// Les boutons de la barre d'outils et les gestes (glisser le bord d'une
// colonne, double-cliquer dessus) appellent ces fonctions, qui modifient le
// classeur. L'affichage se met ensuite à jour tout seul.

import { adresse, adressesDePlage, lettresColonne, lireAdresse } from '../donnees/adresses.js';
import { COULEURS_FOND, DECIMALES_MAX, ENCRES, LARGEUR_MAX, LARGEUR_MIN, LARGEUR_PAR_DEFAUT } from '../donnees/classeur.js';
import { interpreterSaisie } from '../donnees/saisie.js';
import { decimalesAffichees, formaterSelonFormat } from './format.js';

/** Écart ajouté ou retiré par les boutons « − » et « + » de la largeur. */
const PAS_LARGEUR = 20;

/** Nom affiché de chaque couleur (pour les lecteurs d'écran et les infobulles). */
export const NOMS_COULEURS = {
  jaune: 'Jaune',
  orange: 'Orange',
  rouge: 'Rouge',
  rose: 'Rose',
  violet: 'Violet',
  bleu: 'Bleu',
  vert: 'Vert',
  gris: 'Gris',
};

/** Décimales proposées quand on choisit un format (comme Excel). */
const DECIMALES_PAR_DEFAUT = { nombre: 2, euro: 2, pourcent: 0, date: 0 };

/**
 * Crée un nuancier : une pastille par couleur, plus « aucune » (ou « automatique »).
 * @param {HTMLElement} conteneur
 * @param {string[]} couleurs
 * @param {'fond'|'encre'} genre  fond de cellule, ou couleur de texte / de bordure
 * @param {string} nomAucune  texte de la pastille « sans couleur »
 * @param {(couleur: string|null) => void} choisir
 */
export function creerNuancier(conteneur, couleurs, genre, nomAucune, choisir) {
  for (const couleur of ['', ...couleurs]) {
    const pastille = document.createElement('button');
    pastille.type = 'button';
    pastille.className = genre === 'fond' ? 'pastille' : 'pastille pastille-encre';
    if (couleur) pastille.dataset[genre] = couleur;
    else pastille.classList.add('aucune');
    pastille.dataset.couleur = couleur;
    const nom = couleur ? NOMS_COULEURS[couleur] : nomAucune;
    pastille.title = nom;
    pastille.setAttribute('aria-label', nom);
    if (genre === 'encre') pastille.textContent = couleur ? 'Abc' : nomAucune;
    pastille.addEventListener('click', () => {
      conteneur.closest('[popover]')?.hidePopover();
      choisir(couleur || null);
    });
    conteneur.append(pastille);
  }
}

/** Marque la pastille de la couleur actuelle. */
export function marquerNuancier(conteneur, couleur) {
  for (const pastille of conteneur.querySelectorAll('.pastille')) {
    pastille.setAttribute('aria-pressed', String((pastille.dataset.couleur || null) === (couleur ?? null)));
  }
}

export class MiseEnForme {
  /**
   * @param {object} options
   * @param {import('../donnees/classeur.js').Classeur} options.classeur
   * @param {import('./selection.js').Selection} options.selection
   * @param {import('./grille.js').Grille} options.grille
   * @param {(adresse: string) => *} options.valeurCellule  valeur calculée d'une cellule de la feuille affichée
   * @param {() => void} options.avantAction  termine la saisie en cours
   * @param {() => void} options.apresAction  rend le focus à la grille
   * @param {() => void} options.redessinerSelection
   */
  constructor({ classeur, selection, grille, valeurCellule, avantAction, apresAction, redessinerSelection }) {
    this.classeur = classeur;
    this.selection = selection;
    this.grille = grille;
    this.valeurCellule = valeurCellule;
    this.avantAction = avantAction;
    this.apresAction = apresAction;
    this.redessinerSelection = redessinerSelection;

    const element = (id) => document.getElementById(id);
    this.boutonGras = element('bouton-gras');
    this.boutonItalique = element('bouton-italique');
    this.boutonsAlignement = [...document.querySelectorAll('[data-alignement]')];
    this.temoinFond = element('temoin-fond');
    this.temoinEncre = element('temoin-encre');
    this.panneauFond = element('panneau-fond');
    this.panneauEncre = element('panneau-encre');
    this.panneauFormat = element('panneau-format');
    this.panneauLargeur = element('panneau-largeur');
    this.valeurLargeur = element('largeur-valeur');
    this.nomColonnes = element('largeur-colonnes');
    this.valeurDecimales = element('decimales-valeur');

    this.boutonGras.addEventListener('click', () => this.gras());
    this.boutonItalique.addEventListener('click', () => this.italique());
    for (const bouton of this.boutonsAlignement) {
      bouton.addEventListener('click', () => this.aligner(bouton.dataset.alignement));
    }

    // Nuanciers : couleur de fond et couleur du texte.
    creerNuancier(this.panneauFond.querySelector('.nuancier'), COULEURS_FOND, 'fond', 'Aucune couleur', (couleur) => this.fond(couleur));
    creerNuancier(this.panneauEncre.querySelector('.nuancier'), ENCRES, 'encre', 'Automatique', (couleur) => this.encre(couleur));

    // Panneau « Format ».
    for (const bouton of this.panneauFormat.querySelectorAll('[data-format]')) {
      bouton.addEventListener('click', () => {
        this.panneauFormat.hidePopover();
        this.choisirFormat(bouton.dataset.format || null);
      });
    }
    element('decimales-moins').addEventListener('click', () => this.decimales(-1));
    element('decimales-plus').addEventListener('click', () => this.decimales(1));

    // Panneau « Largeur ».
    element('largeur-moins').addEventListener('click', () => this.changerLargeur(-PAS_LARGEUR));
    element('largeur-plus').addEventListener('click', () => this.changerLargeur(PAS_LARGEUR));
    element('largeur-ajuster').addEventListener('click', () => {
      this.ajusterLargeur(this.#colonnesSelectionnees());
      this.panneauLargeur.hidePopover();
    });
    element('largeur-normale').addEventListener('click', () => {
      this.#appliquerLargeur(this.#colonnesSelectionnees(), LARGEUR_PAR_DEFAUT);
      this.panneauLargeur.hidePopover();
    });

    // À l'ouverture d'un panneau, ses boutons montrent l'état de la cellule active.
    for (const panneau of [this.panneauFond, this.panneauEncre, this.panneauFormat, this.panneauLargeur]) {
      panneau.addEventListener('beforetoggle', (e) => {
        if (e.newState === 'open') this.actualiser();
      });
    }
  }

  /** La feuille affichée (onglet sélectionné). */
  get feuille() {
    return this.classeur.feuilleActive;
  }

  /** La cellule active (ou null si elle est vide). */
  #celluleActive() {
    const { ligne, colonne } = this.selection.active;
    return this.feuille.cellule(adresse(ligne, colonne));
  }

  /** Met à jour l'état des boutons d'après la cellule active. */
  actualiser() {
    const cellule = this.#celluleActive();
    this.boutonGras.setAttribute('aria-pressed', String(Boolean(cellule?.gras)));
    this.boutonItalique.setAttribute('aria-pressed', String(Boolean(cellule?.italique)));
    for (const bouton of this.boutonsAlignement) {
      bouton.setAttribute('aria-pressed', String(cellule?.alignement === bouton.dataset.alignement));
    }
    const temoin = (element, nom, valeur) => {
      if (valeur) element.dataset[nom] = valeur;
      else delete element.dataset[nom];
    };
    temoin(this.temoinFond, 'fond', cellule?.fond);
    temoin(this.temoinEncre, 'encre', cellule?.couleur);
    marquerNuancier(this.panneauFond.querySelector('.nuancier'), cellule?.fond);
    marquerNuancier(this.panneauEncre.querySelector('.nuancier'), cellule?.couleur);

    // Format : bouton du format actuel, nombre de décimales, exemples.
    const { type, decimales } = this.#formatActuel();
    for (const bouton of this.panneauFormat.querySelectorAll('[data-format]')) {
      bouton.setAttribute('aria-pressed', String((bouton.dataset.format || null) === (cellule?.format?.type ?? null)));
    }
    this.valeurDecimales.value = type === 'date' ? '—' : `${decimales} décimale${decimales > 1 ? 's' : ''}`;
    const exemple = (id, format) => {
      document.getElementById(id).textContent = formaterSelonFormat(format.type === 'pourcent' ? 0.125 : 1234.5, format);
    };
    const d = type === 'date' ? 2 : decimales;
    exemple('exemple-nombre', { type: 'nombre', decimales: d });
    exemple('exemple-euro', { type: 'euro', decimales: d });
    exemple('exemple-pourcent', { type: 'pourcent', decimales: d });

    const colonnes = this.#colonnesSelectionnees();
    const lettres = this.#nomPlageColonnes(colonnes);
    this.nomColonnes.textContent = colonnes.length > 1 ? `des colonnes ${lettres}` : `de la colonne ${lettres}`;
    this.valeurLargeur.value = `${this.feuille.largeur(this.selection.active.colonne)} px`;
  }

  #nomPlageColonnes(colonnes) {
    const premiere = lettresColonne(colonnes[0]);
    return colonnes.length > 1 ? `${premiere} à ${lettresColonne(colonnes.at(-1))}` : premiere;
  }

  #colonnesSelectionnees() {
    const { debut, fin } = this.selection.plage;
    const colonnes = [];
    for (let c = debut.colonne; c <= fin.colonne; c++) colonnes.push(c);
    return colonnes;
  }

  // --- Gras, italique, couleurs, alignement ------------------------------------

  /** Met en gras la sélection (ou enlève le gras si la cellule active l'est déjà). */
  gras() {
    this.#basculer('gras');
  }

  /** Met en italique la sélection (ou l'enlève si la cellule active l'est déjà). */
  italique() {
    this.#basculer('italique');
  }

  #basculer(propriete) {
    this.avantAction();
    this.#appliquer({ [propriete]: !this.#celluleActive()?.[propriete] });
    this.apresAction();
  }

  /** Colore le fond de la sélection (null : aucune couleur). */
  fond(couleur) {
    this.avantAction();
    this.#appliquer({ fond: couleur });
    this.apresAction();
  }

  /** Colore le texte de la sélection (null : couleur automatique du thème). */
  encre(couleur) {
    this.avantAction();
    this.#appliquer({ couleur });
    this.apresAction();
  }

  /** Aligne le texte ; un second appui sur le même bouton revient à l'alignement automatique. */
  aligner(alignement) {
    this.avantAction();
    const actuel = this.#celluleActive()?.alignement ?? null;
    this.#appliquer({ alignement: actuel === alignement ? null : alignement });
    this.apresAction();
  }

  // --- Format des nombres ---------------------------------------------------------

  /**
   * Format de la cellule active, tel qu'il s'affiche : le format choisi, ou
   * celui qui découle de la saisie (12,5 → nombre à 1 décimale, 20 % → pourcentage…).
   */
  #formatActuel() {
    const cellule = this.#celluleActive();
    if (cellule?.format) return cellule.format;
    const saisie = interpreterSaisie(cellule?.brut ?? '');
    const valeur = this.valeurCellule(adresse(this.selection.active.ligne, this.selection.active.colonne));
    const type = { pourcent: 'pourcent', euro: 'euro', date: 'date' }[saisie.style] ?? 'nombre';
    const decimales = typeof valeur === 'number' ? decimalesAffichees(valeur, saisie.style) : DECIMALES_PAR_DEFAUT[type];
    return { type, decimales };
  }

  /** Choisit un format pour la sélection (null : automatique). */
  choisirFormat(type) {
    this.avantAction();
    if (!type) {
      this.#appliquer({ format: null });
    } else {
      const actuel = this.#celluleActive()?.format;
      const decimales = actuel && actuel.type !== 'date' && type !== 'date' ? actuel.decimales : DECIMALES_PAR_DEFAUT[type];
      this.#appliquer({ format: { type, decimales } });
    }
    this.apresAction();
  }

  /** Une décimale de plus (+1) ou de moins (-1) pour la sélection. */
  decimales(ecart) {
    this.avantAction();
    const { type, decimales } = this.#formatActuel();
    if (type !== 'date') {
      const nouvelles = Math.min(DECIMALES_MAX, Math.max(0, decimales + ecart));
      this.#appliquer({ format: { type, decimales: nouvelles } });
    }
    this.actualiser();
  }

  #appliquer(proprietes) {
    const plage = this.selection.plage;
    const modifications = [];
    for (const adr of adressesDePlage(plage)) modifications.push({ adresse: adr, ...proprietes });
    this.classeur.modifierCellules(this.feuille, modifications, plage);
    this.actualiser();
  }

  // --- Largeur des colonnes ----------------------------------------------------------

  #appliquerLargeur(colonnes, largeur) {
    this.classeur.modifierLargeurs(this.feuille, colonnes, largeur);
    this.actualiser();
  }

  /** Bouton − ou + : élargit ou rétrécit les colonnes sélectionnées. */
  changerLargeur(ecart) {
    const colonnes = this.#colonnesSelectionnees();
    const largeur = this.feuille.largeur(this.selection.active.colonne) + ecart;
    this.#appliquerLargeur(colonnes, Math.min(LARGEUR_MAX, Math.max(LARGEUR_MIN, largeur)));
  }

  /**
   * Ajuste chaque colonne à son contenu le plus large. Le texte de chaque
   * cellule est mesuré d'après les données (les lignes hors de l'écran ne
   * sont pas dessinées), avec la police des cellules.
   */
  ajusterLargeur(colonnes) {
    this.avantAction();
    const mesureur = document.createElement('canvas').getContext('2d');
    const style = getComputedStyle(this.grille.contenu.querySelector('table.grille'));
    const parColonne = new Map(colonnes.map((colonne) => [colonne, []]));
    for (const adr of this.feuille.adresses()) {
      const position = lireAdresse(adr);
      parColonne.get(position.colonne)?.push(position);
    }
    for (const colonne of colonnes) {
      let largeurTexte = 0;
      for (const { ligne } of parColonne.get(colonne)) {
        const vue = this.grille.presenterCellule(adresse(ligne, colonne), ligne, colonne);
        if (!vue.texte) continue;
        mesureur.font = `${vue.italique ? 'italic ' : ''}${vue.gras ? 700 : style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        largeurTexte = Math.max(largeurTexte, mesureur.measureText(vue.texte).width);
      }
      // Le texte est mesuré avec la taille affichée (zoom compris) : on revient à 100 %.
      largeurTexte /= this.grille.zoom;
      // Marges intérieures de la cellule (8 px de chaque côté) et trait de séparation.
      const largeur = largeurTexte ? Math.ceil(largeurTexte) + 20 : LARGEUR_PAR_DEFAUT;
      this.classeur.modifierLargeurs(this.feuille, [colonne], Math.min(LARGEUR_MAX, Math.max(LARGEUR_MIN, largeur)));
    }
    this.actualiser();
    this.apresAction();
  }

  /**
   * Glisser le bord droit de l'en-tête d'une colonne (souris ou doigt).
   * Si plusieurs colonnes sont sélectionnées et que celle-ci en fait partie,
   * elles prennent toutes la même largeur.
   */
  redimensionner(evenement, colonne) {
    const poignee = evenement.target;
    const { debut, fin } = this.selection.plage;
    const colonnes =
      colonne >= debut.colonne && colonne <= fin.colonne && fin.colonne > debut.colonne
        ? this.#colonnesSelectionnees()
        : [colonne];
    const depart = evenement.clientX;
    const largeurDepart = this.feuille.largeur(colonne);
    let largeur = largeurDepart;
    poignee.setPointerCapture(evenement.pointerId);
    evenement.preventDefault();

    const deplacer = (e) => {
      if (e.pointerId !== evenement.pointerId) return;
      // Le déplacement à l'écran est divisé par le zoom : la largeur enregistrée est celle à 100 %.
      const ecart = (e.clientX - depart) / this.grille.zoom;
      largeur = Math.min(LARGEUR_MAX, Math.max(LARGEUR_MIN, Math.round(largeurDepart + ecart)));
      for (const c of colonnes) this.grille.apercuLargeur(c, largeur);
      this.redessinerSelection();
    };
    const terminer = (e) => {
      if (e.pointerId !== evenement.pointerId) return;
      poignee.removeEventListener('pointermove', deplacer);
      poignee.removeEventListener('pointerup', terminer);
      poignee.removeEventListener('pointercancel', terminer);
      if (largeur !== largeurDepart) this.#appliquerLargeur(colonnes, largeur);
      else this.grille.rafraichirLargeurs(colonnes);
      this.apresAction();
    };
    poignee.addEventListener('pointermove', deplacer);
    poignee.addEventListener('pointerup', terminer);
    poignee.addEventListener('pointercancel', terminer);
  }
}
