// Édition d'une cellule : le petit champ de saisie posé sur la cellule et la
// barre de formule en haut de l'écran. Les deux montrent toujours le même
// texte ; on peut taper dans l'un ou dans l'autre.
//
// Deux façons de commencer :
//   - « saisie » : on tape directement sur une cellule, ce qui remplace son
//     contenu (comme dans Excel). Les flèches valident et déplacent.
//   - « modification » : double-clic, F2, second appui au doigt ou appui
//     dans la barre de formule. Le contenu est gardé et les flèches
//     déplacent le curseur dans le texte.

export class Edition {
  #champCellule;
  #champBarre;
  #grille;
  #racine;

  /**
   * @param {object} options
   * @param {HTMLInputElement} options.champCellule  champ posé sur la cellule
   * @param {HTMLInputElement} options.champBarre  champ de la barre de formule
   * @param {import('./grille.js').Grille} options.grille
   * @param {HTMLElement} options.racine  élément qui reçoit la classe « en-edition »
   */
  constructor({ champCellule, champBarre, grille, racine }) {
    this.#champCellule = champCellule;
    this.#champBarre = champBarre;
    this.#grille = grille;
    this.#racine = racine;
    /** null, ou { ligne, colonne, mode, origine, initial } pendant l'édition */
    this.enCours = null;

    // Ce qui est tapé dans un champ est recopié dans l'autre.
    champCellule.addEventListener('input', () => {
      if (this.enCours) champBarre.value = champCellule.value;
      this.#ajusterLargeur();
    });
    champBarre.addEventListener('input', () => {
      if (this.enCours) champCellule.value = champBarre.value;
      this.#ajusterLargeur();
    });
  }

  get champCellule() {
    return this.#champCellule;
  }

  get champBarre() {
    return this.#champBarre;
  }

  /** Texte en cours de saisie. */
  get texte() {
    return this.enCours?.origine === 'barre' ? this.#champBarre.value : this.#champCellule.value;
  }

  /**
   * Hors édition : place le champ (invisible) sur la cellule active et montre
   * son contenu dans la barre de formule.
   */
  suivre(ligne, colonne, brut) {
    if (this.enCours) return;
    this.#champCellule.value = '';
    this.#champBarre.value = brut;
    this.placer(ligne, colonne);
  }

  /** Pose le champ de saisie exactement sur la cellule. */
  placer(ligne, colonne) {
    const r = this.#grille.rectangleContenu(ligne, colonne);
    if (!r) return;
    const champ = this.#champCellule;
    // La ligne figée a son propre conteneur (voir grille.js).
    this.#grille.accueillir(champ, ligne, colonne);
    champ.style.transform = `translate(${r.gauche}px, ${r.haut}px)`;
    champ.style.height = `${r.bas - r.haut}px`;
    champ.style.minWidth = `${r.droite - r.gauche}px`;
    champ.style.width = `${r.droite - r.gauche}px`;
    this.#ajusterLargeur();
  }

  /** Élargit le champ si le texte dépasse de la cellule (sans sortir de l'écran). */
  #ajusterLargeur() {
    const champ = this.#champCellule;
    if (!this.enCours) return;
    const minimum = parseFloat(champ.style.minWidth) || 0;
    champ.style.width = `${minimum}px`;
    const maximum = Math.max(minimum, this.#grille.racine.clientWidth - 8);
    if (champ.scrollWidth > champ.clientWidth) champ.style.width = `${Math.min(maximum, champ.scrollWidth + 12)}px`;
  }

  /**
   * Commence l'édition de la cellule (ligne, colonne).
   * @param {object} options
   * @param {string} options.texte  texte de départ
   * @param {'saisie'|'modification'} options.mode
   * @param {'cellule'|'barre'} options.origine  champ où l'on tape
   * @param {string} options.initial  contenu de la cellule avant édition
   */
  commencer(ligne, colonne, { texte, mode, origine, initial }) {
    this.enCours = { ligne, colonne, mode, origine, initial };
    this.#champCellule.value = texte;
    this.#champBarre.value = texte;
    this.#racine.classList.add('en-edition');
    this.placer(ligne, colonne);
    this.#grille.rendreVisible(ligne, colonne);
    const champ = origine === 'barre' ? this.#champBarre : this.#champCellule;
    if (document.activeElement !== champ) champ.focus({ preventScroll: true });
    // Curseur à la fin du texte.
    const fin = champ.value.length;
    champ.setSelectionRange(fin, fin);
  }

  /** Change le champ où l'on tape (clic dans la barre de formule pendant l'édition). */
  changerOrigine(origine) {
    if (this.enCours) this.enCours.origine = origine;
  }

  /**
   * Termine l'édition et renvoie { ligne, colonne, texte, modifie }
   * (ou null s'il n'y avait pas d'édition en cours).
   */
  terminer() {
    if (!this.enCours) return null;
    const { ligne, colonne, initial } = this.enCours;
    const texte = this.texte;
    this.enCours = null;
    this.#racine.classList.remove('en-edition');
    this.#champCellule.value = '';
    return { ligne, colonne, texte, modifie: texte !== initial };
  }
}
