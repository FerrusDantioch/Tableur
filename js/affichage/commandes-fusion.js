// Bouton « Fusionner » / « Défusionner » (onglet « Mise en forme »).
//
// - Plusieurs cellules sélectionnées : « Fusionner » en fait une seule
//   (pratique pour un titre au-dessus d'un tableau). Si d'autres cellules que
//   celle en haut à gauche contiennent quelque chose, on demande d'abord
//   confirmation, car leur contenu sera effacé.
// - La sélection contient une cellule fusionnée : le bouton devient
//   « Défusionner » et rend les cellules séparées.
// Les règles elles-mêmes sont dans donnees/fusions.js et Classeur.fusionner.

import { adresse, dansPlage, lireAdresse, textePlage } from '../donnees/adresses.js';
import { nombreCellules } from '../donnees/fusions.js';

export class CommandesFusion {
  /**
   * @param {object} options
   * @param {import('../donnees/classeur.js').Classeur} options.classeur
   * @param {import('./selection.js').Selection} options.selection
   * @param {(fenetre: HTMLDialogElement) => Promise<string>} options.demander
   * @param {() => void} options.avantAction  termine la saisie en cours
   * @param {() => void} options.apresAction  rend le focus à la grille
   * @param {(texte: string, erreur?: boolean) => void} options.signaler
   */
  constructor({ classeur, selection, demander, avantAction, apresAction, signaler }) {
    this.classeur = classeur;
    this.selection = selection;
    this.demander = demander;
    this.avantAction = avantAction;
    this.apresAction = apresAction;
    this.signaler = signaler;

    const element = (id) => document.getElementById(id);
    this.bouton = element('bouton-fusionner');
    this.libelle = this.bouton.querySelector('.libelle');
    this.fenetre = element('fenetre-fusion');
    this.texteFenetre = element('texte-fusion');

    this.bouton.addEventListener('click', () => this.basculer());
    selection.abonner(() => this.actualiser());
    classeur.abonner((evenement) => {
      if (['structure', 'active'].includes(evenement.type)) this.actualiser();
    });
    this.actualiser();
  }

  get feuille() {
    return this.classeur.feuilleActive;
  }

  /** Fusions touchées par la sélection. */
  #fusionsSelectionnees() {
    const plage = this.selection.plage;
    return this.feuille.fusions.filter((f) => dansPlage(plage, f.debut.ligne, f.debut.colonne));
  }

  /** Texte et état du bouton selon la sélection. */
  actualiser() {
    const defusionner = this.#fusionsSelectionnees().length > 0;
    this.bouton.setAttribute('aria-pressed', String(defusionner));
    this.libelle.textContent = defusionner ? 'Défusionner' : 'Fusionner';
    this.bouton.title = defusionner
      ? 'Défusionner : les cellules redeviennent séparées'
      : 'Fusionner les cellules sélectionnées en une seule (idéal pour un titre)';
    this.bouton.disabled = !defusionner && nombreCellules(this.selection.plage) < 2;
  }

  /** Fusionne la sélection, ou la défusionne si elle contient déjà une fusion. */
  async basculer() {
    this.avantAction();
    const plage = this.selection.plage;
    if (this.#fusionsSelectionnees().length > 0) {
      const nombre = this.classeur.defusionner(this.feuille, plage, plage);
      this.signaler(nombre > 1 ? `${nombre} cellules fusionnées ont été défusionnées.` : 'Cellules défusionnées.');
      this.actualiser();
      this.apresAction();
      return;
    }
    const refus = this.classeur.pourquoiPasFusionner(this.feuille, plage);
    if (refus) {
      this.signaler(refus, true);
      this.apresAction();
      return;
    }

    // Contenus qui seraient effacés (toutes les cellules sauf celle en haut à gauche).
    const coin = adresse(plage.debut.ligne, plage.debut.colonne);
    const effacees = this.feuille.adresses().filter((adr) => {
      const { ligne, colonne } = lireAdresse(adr);
      return adr !== coin && dansPlage(plage, ligne, colonne) && this.feuille.brut(adr) !== '';
    });
    if (effacees.length > 0) {
      this.texteFenetre.textContent =
        `Seul le contenu de la cellule en haut à gauche (${coin}) sera conservé. ` +
        `${effacees.length > 1 ? `Les ${effacees.length} autres cellules remplies seront vidées` : 'L’autre cellule remplie sera vidée'} (${effacees.slice(0, 5).join(', ')}${effacees.length > 5 ? '…' : ''}).`;
      if ((await this.demander(this.fenetre)) !== 'fusionner') {
        this.apresAction();
        return;
      }
    }
    const resultat = this.classeur.fusionner(this.feuille, plage, plage);
    if (!resultat.ok) {
      this.signaler(resultat.message, true);
    } else {
      this.selection.choisir(plage.debut.ligne, plage.debut.colonne);
      this.signaler(`Cellules ${textePlage(plage)} fusionnées. « Défusionner » ou « Annuler » les sépare de nouveau.`);
    }
    this.actualiser();
    this.apresAction();
  }
}
