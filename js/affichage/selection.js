// La sélection : la cellule active (où va la saisie) et, éventuellement, une
// plage de cellules autour d'elle (pour mettre en forme ou copier plusieurs
// cellules d'un coup).
//
// Comme dans Excel : la cellule active est l'« ancre » de la sélection ; en
// étendant la sélection (Maj + flèches, glisser), on déplace le coin opposé.
//
// Cellules fusionnées : choisir une cellule d'une fusion choisit sa cellule
// en haut à gauche ; une plage qui touche une fusion s'agrandit pour la
// contenir ; les flèches sautent par-dessus (voir donnees/fusions.js).

import { dansPlage, plage as creerPlage } from '../donnees/adresses.js';
import { etendreAuxFusions, fusionContenant } from '../donnees/fusions.js';

export class Selection {
  #abonnes = new Set();

  /**
   * @param {() => {lignes: number, colonnes: number}} dimensions  taille actuelle de la feuille
   * @param {() => Array<object>} [fusions]  cellules fusionnées de la feuille affichée
   */
  constructor(dimensions, fusions = () => []) {
    this.dimensions = dimensions;
    this.fusions = fusions;
    this.ancre = { ligne: 1, colonne: 1 }; // cellule active
    this.bout = { ligne: 1, colonne: 1 }; // coin opposé de la plage
  }

  abonner(fonction) {
    this.#abonnes.add(fonction);
    return () => this.#abonnes.delete(fonction);
  }

  #annoncer() {
    for (const fonction of this.#abonnes) fonction(this);
  }

  /** La cellule active. */
  get active() {
    return { ...this.ancre };
  }

  /** La plage sélectionnée, rangée (début en haut à gauche), agrandie aux cellules fusionnées. */
  get plage() {
    return etendreAuxFusions(this.fusions(), creerPlage(this.ancre, this.bout));
  }

  /** Vrai si une seule cellule (éventuellement fusionnée) est sélectionnée. */
  get unique() {
    const fusion = fusionContenant(this.fusions(), this.ancre.ligne, this.ancre.colonne);
    if (fusion) return dansPlage(fusion, this.bout.ligne, this.bout.colonne);
    return this.ancre.ligne === this.bout.ligne && this.ancre.colonne === this.bout.colonne;
  }

  /** La cellule elle-même, ou le coin en haut à gauche de sa fusion. */
  #coin(cellule) {
    const fusion = fusionContenant(this.fusions(), cellule.ligne, cellule.colonne);
    return fusion ? { ...fusion.debut } : cellule;
  }

  #borner({ ligne, colonne }) {
    const { lignes, colonnes } = this.dimensions();
    return {
      ligne: Math.min(lignes, Math.max(1, ligne)),
      colonne: Math.min(colonnes, Math.max(1, colonne)),
    };
  }

  /** Sélectionne une cellule ; avec `etendre`, étend la plage depuis l'ancre jusqu'à elle. */
  choisir(ligne, colonne, etendre = false) {
    const cible = this.#borner({ ligne, colonne });
    if (etendre) this.bout = cible;
    else this.ancre = this.bout = this.#coin(cible);
    this.#annoncer();
  }

  /** Sélectionne une plage entière ; l'ancre devient la cellule `ancre` (ou le début). */
  choisirPlage(plage, ancre = plage.debut) {
    this.ancre = this.#coin(this.#borner(ancre));
    const autre = ancre.ligne === plage.debut.ligne && ancre.colonne === plage.debut.colonne ? plage.fin : plage.debut;
    this.bout = this.#borner(autre);
    this.#annoncer();
  }

  /**
   * Déplace la sélection de (dLignes, dColonnes).
   * Sans `etendre` : la cellule active bouge et la plage se réduit à elle.
   * Avec `etendre` : seul le coin opposé bouge (la plage grandit ou rétrécit).
   */
  deplacer(dLignes, dColonnes, etendre = false) {
    let depart = etendre ? this.bout : this.ancre;
    // Depuis une cellule fusionnée, on part de son bord : la flèche droite
    // va à la première cellule après la fusion.
    const fusion = fusionContenant(this.fusions(), depart.ligne, depart.colonne);
    if (fusion) {
      depart = {
        ligne: dLignes > 0 ? fusion.fin.ligne : dLignes < 0 ? fusion.debut.ligne : depart.ligne,
        colonne: dColonnes > 0 ? fusion.fin.colonne : dColonnes < 0 ? fusion.debut.colonne : depart.colonne,
      };
    }
    this.choisir(depart.ligne + dLignes, depart.colonne + dColonnes, etendre);
  }

  /** Va au bord de la feuille dans une direction (Ctrl + flèche). */
  allerAuBord(dLignes, dColonnes, etendre = false) {
    const { lignes, colonnes } = this.dimensions();
    const depart = etendre ? this.bout : this.ancre;
    const ligne = dLignes < 0 ? 1 : dLignes > 0 ? lignes : depart.ligne;
    const colonne = dColonnes < 0 ? 1 : dColonnes > 0 ? colonnes : depart.colonne;
    this.choisir(ligne, colonne, etendre);
  }

  /** Sélectionne toute une colonne. */
  colonneEntiere(colonne, etendre = false) {
    const { lignes } = this.dimensions();
    if (etendre) {
      this.ancre = this.#borner({ ligne: 1, colonne: this.ancre.colonne });
      this.bout = this.#borner({ ligne: lignes, colonne });
    } else {
      this.ancre = this.#borner({ ligne: 1, colonne });
      this.bout = this.#borner({ ligne: lignes, colonne });
    }
    this.#annoncer();
  }

  /** Sélectionne toute une ligne. */
  ligneEntiere(ligne, etendre = false) {
    const { colonnes } = this.dimensions();
    if (etendre) {
      this.ancre = this.#borner({ ligne: this.ancre.ligne, colonne: 1 });
      this.bout = this.#borner({ ligne, colonne: colonnes });
    } else {
      this.ancre = this.#borner({ ligne, colonne: 1 });
      this.bout = this.#borner({ ligne, colonne: colonnes });
    }
    this.#annoncer();
  }

  /** Sélectionne toute la feuille. */
  tout() {
    const { lignes, colonnes } = this.dimensions();
    this.ancre = { ligne: 1, colonne: 1 };
    this.bout = { ligne: lignes, colonne: colonnes };
    this.#annoncer();
  }

  /** Reprend une sélection mémorisée ({ ancre, bout }), par exemple en revenant sur une feuille. */
  restaurer({ ancre, bout }) {
    this.ancre = this.#coin(this.#borner(ancre));
    this.bout = this.#borner(bout);
    this.#annoncer();
  }

  /** À appeler quand la feuille rétrécit (annulation d'un ajout de lignes). */
  reborner() {
    this.ancre = this.#coin(this.#borner(this.ancre));
    this.bout = this.#borner(this.bout);
    this.#annoncer();
  }
}
