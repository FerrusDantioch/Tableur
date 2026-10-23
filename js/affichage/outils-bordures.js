// Onglet « Bordures » : poser des bordures sur la sélection pour construire
// de vrais tableaux.
//
// On choisit d'abord le trait (fin ou épais) et la couleur — ce choix est
// mémorisé — puis le type de bordure : toutes, extérieure, haut, bas,
// gauche, droite, ou aucune.

import { ENCRES } from '../donnees/classeur.js';
import { calculerBordures } from '../donnees/bordures.js';
import { creerNuancier, marquerNuancier } from './mise-en-forme.js';

export class OutilsBordures {
  /**
   * @param {object} options
   * @param {import('../donnees/classeur.js').Classeur} options.classeur
   * @param {import('./selection.js').Selection} options.selection
   * @param {object} options.preferences  préférences mémorisées (trait et couleur choisis)
   * @param {() => void} options.avantAction  termine la saisie en cours
   * @param {() => void} options.apresAction  rend le focus à la grille
   */
  constructor({ classeur, selection, preferences, avantAction, apresAction }) {
    this.classeur = classeur;
    this.selection = selection;
    this.preferences = preferences;
    this.avantAction = avantAction;
    this.apresAction = apresAction;

    const memoire = preferences.lire('bordure', { style: 'fin', couleur: 'auto' });
    this.style = memoire.style === 'epais' ? 'epais' : 'fin';
    this.couleur = ENCRES.includes(memoire.couleur) ? memoire.couleur : 'auto';

    for (const bouton of document.querySelectorAll('[data-bordures]')) {
      bouton.addEventListener('click', () => this.poser(bouton.dataset.bordures));
    }
    this.boutonsTrait = [...document.querySelectorAll('[data-trait]')];
    for (const bouton of this.boutonsTrait) {
      bouton.addEventListener('click', () => {
        this.style = bouton.dataset.trait;
        this.#memoriser();
      });
    }
    this.panneau = document.getElementById('panneau-couleur-bordure');
    this.nuancier = this.panneau.querySelector('.nuancier');
    this.temoin = document.getElementById('temoin-bordure');
    creerNuancier(this.nuancier, ENCRES, 'encre', 'Automatique', (couleur) => {
      this.couleur = couleur ?? 'auto';
      this.#memoriser();
    });
    this.#afficher();
  }

  get feuille() {
    return this.classeur.feuilleActive;
  }

  #memoriser() {
    this.preferences.ecrire('bordure', { style: this.style, couleur: this.couleur });
    this.#afficher();
  }

  /** Montre le trait et la couleur choisis. */
  #afficher() {
    for (const bouton of this.boutonsTrait) bouton.setAttribute('aria-pressed', String(bouton.dataset.trait === this.style));
    if (this.couleur === 'auto') delete this.temoin.dataset.encre;
    else this.temoin.dataset.encre = this.couleur;
    marquerNuancier(this.nuancier, this.couleur === 'auto' ? null : this.couleur);
  }

  /** Pose des bordures sur la sélection ('toutes', 'exterieur', 'haut', 'bas', 'gauche', 'droite', 'aucune'). */
  poser(type) {
    this.avantAction();
    const plage = this.selection.plage;
    const modifications = calculerBordures(plage, type, { style: this.style, couleur: this.couleur }, this.feuille);
    this.classeur.modifierCellules(this.feuille, modifications, plage);
    this.apresAction();
  }
}
