// Mise en forme des cellules : gras, couleur de fond, largeur des colonnes.
//
// Les boutons de la barre d'outils et les gestes (glisser le bord d'une
// colonne, double-cliquer dessus) appellent ces fonctions, qui modifient le
// classeur. L'affichage se met ensuite à jour tout seul.

import { adresse, adressesDePlage, lettresColonne, lireAdresse } from '../donnees/adresses.js';
import { COULEURS_FOND, LARGEUR_MAX, LARGEUR_MIN, LARGEUR_PAR_DEFAUT } from '../donnees/classeur.js';

/** Écart ajouté ou retiré par les boutons « − » et « + » de la largeur. */
const PAS_LARGEUR = 20;

/** Nom affiché de chaque couleur (pour les lecteurs d'écran et les infobulles). */
const NOMS_COULEURS = {
  jaune: 'Jaune',
  orange: 'Orange',
  rouge: 'Rouge',
  rose: 'Rose',
  violet: 'Violet',
  bleu: 'Bleu',
  vert: 'Vert',
  gris: 'Gris',
};

export class MiseEnForme {
  /**
   * @param {object} options
   * @param {import('../donnees/classeur.js').Classeur} options.classeur
   * @param {import('../donnees/classeur.js').Feuille} options.feuille
   * @param {import('./selection.js').Selection} options.selection
   * @param {import('./grille.js').Grille} options.grille
   * @param {() => void} options.avantAction  termine la saisie en cours
   * @param {() => void} options.apresAction  rend le focus à la grille
   * @param {() => void} options.redessinerSelection
   */
  constructor({ classeur, feuille, selection, grille, avantAction, apresAction, redessinerSelection }) {
    this.classeur = classeur;
    this.feuille = feuille;
    this.selection = selection;
    this.grille = grille;
    this.avantAction = avantAction;
    this.apresAction = apresAction;
    this.redessinerSelection = redessinerSelection;

    this.boutonGras = document.getElementById('bouton-gras');
    this.temoinFond = document.getElementById('temoin-fond');
    this.panneauFond = document.getElementById('panneau-fond');
    this.panneauLargeur = document.getElementById('panneau-largeur');
    this.valeurLargeur = document.getElementById('largeur-valeur');
    this.nomColonnes = document.getElementById('largeur-colonnes');

    this.boutonGras.addEventListener('click', () => this.gras());

    // Nuancier : une pastille par couleur, plus « aucune couleur ».
    const nuancier = this.panneauFond.querySelector('.nuancier');
    for (const couleur of ['', ...COULEURS_FOND]) {
      const pastille = document.createElement('button');
      pastille.type = 'button';
      pastille.className = 'pastille';
      if (couleur) pastille.dataset.fond = couleur;
      else pastille.classList.add('aucune');
      const nom = couleur ? NOMS_COULEURS[couleur] : 'Aucune couleur';
      pastille.title = nom;
      pastille.setAttribute('aria-label', nom);
      pastille.addEventListener('click', () => {
        this.panneauFond.hidePopover();
        this.fond(couleur || null);
      });
      nuancier.append(pastille);
    }

    // Panneau « Largeur ».
    document.getElementById('largeur-moins').addEventListener('click', () => this.changerLargeur(-PAS_LARGEUR));
    document.getElementById('largeur-plus').addEventListener('click', () => this.changerLargeur(PAS_LARGEUR));
    document.getElementById('largeur-ajuster').addEventListener('click', () => {
      this.ajusterLargeur(this.#colonnesSelectionnees());
      this.panneauLargeur.hidePopover();
    });
    document.getElementById('largeur-normale').addEventListener('click', () => {
      this.#appliquerLargeur(this.#colonnesSelectionnees(), LARGEUR_PAR_DEFAUT);
      this.panneauLargeur.hidePopover();
    });

    // Les panneaux s'ouvrent juste sous leur bouton.
    for (const panneau of [this.panneauFond, this.panneauLargeur]) {
      panneau.addEventListener('beforetoggle', (e) => {
        if (e.newState !== 'open') return;
        this.avantAction();
        this.actualiser();
        const bouton = document.querySelector(`[popovertarget="${panneau.id}"]`);
        const r = bouton.getBoundingClientRect();
        panneau.style.top = `${r.bottom + 6}px`;
        panneau.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - 300))}px`;
      });
      panneau.addEventListener('toggle', (e) => {
        if (e.newState === 'closed') this.apresAction();
      });
    }
  }

  /** Met à jour l'état des boutons d'après la cellule active. */
  actualiser() {
    const { ligne, colonne } = this.selection.active;
    const cellule = this.feuille.cellule(adresse(ligne, colonne));
    this.boutonGras.setAttribute('aria-pressed', String(Boolean(cellule?.gras)));
    if (cellule?.fond) this.temoinFond.dataset.fond = cellule.fond;
    else delete this.temoinFond.dataset.fond;
    for (const pastille of this.panneauFond.querySelectorAll('.pastille')) {
      pastille.setAttribute('aria-pressed', String((pastille.dataset.fond ?? null) === (cellule?.fond ?? null)));
    }
    const colonnes = this.#colonnesSelectionnees();
    const lettres = this.#nomPlageColonnes(colonnes);
    this.nomColonnes.textContent = colonnes.length > 1 ? `des colonnes ${lettres}` : `de la colonne ${lettres}`;
    this.valeurLargeur.value = `${this.feuille.largeur(colonne)} px`;
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

  // --- Gras et couleur de fond --------------------------------------------------

  /** Met en gras la sélection (ou enlève le gras si la cellule active l'est déjà). */
  gras() {
    this.avantAction();
    const { ligne, colonne } = this.selection.active;
    const dejaGras = Boolean(this.feuille.cellule(adresse(ligne, colonne))?.gras);
    this.#appliquer({ gras: !dejaGras });
    this.apresAction();
  }

  /** Colore le fond de la sélection (null : aucune couleur). */
  fond(couleur) {
    this.avantAction();
    this.#appliquer({ fond: couleur });
    this.apresAction();
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
      largeur = Math.min(LARGEUR_MAX, Math.max(LARGEUR_MIN, Math.round(largeurDepart + e.clientX - depart)));
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
