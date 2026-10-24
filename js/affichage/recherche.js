// Barre « Rechercher et remplacer » (bouton « Rechercher » de l'onglet
// « Édition », ou Ctrl + F / Ctrl + H). Elle s'ouvre sous la barre d'outils,
// sans cacher la grille : on voit chaque résultat se sélectionner.
//
//   - Suivant : sélectionne la prochaine cellule qui contient le texte ;
//   - Remplacer : remplace le texte dans la cellule sélectionnée (si elle
//     le contient), puis passe à la suivante ;
//   - Tout remplacer : remplace partout, en une seule étape (un seul « Annuler »).
//
// La recherche elle-même est dans donnees/recherche.js.

import { motifRecherche, preparerRemplacements, rangSuivant, rechercher } from '../donnees/recherche.js';
import { ouvrirOngletOutils, replierBarreOutils } from './barre-outils.js';

/** Écran étroit (téléphone) : la barre d'outils est repliée pendant la recherche. */
const ECRAN_ETROIT = '(max-width: 760px)';

export class RechercheRemplacement {
  #resultats = []; // cellules trouvées (voir rechercher)
  #aJour = false; // faux quand le classeur ou la recherche ont changé
  #ongletReplie = null; // onglet d'outils replié à l'ouverture (téléphone), rouvert à la fermeture

  /**
   * @param {object} options
   * @param {import('../donnees/classeur.js').Classeur} options.classeur
   * @param {import('./selection.js').Selection} options.selection
   * @param {import('./grille.js').Grille} options.grille
   * @param {() => void} options.avantAction  termine la saisie en cours
   * @param {() => void} options.apresAction  rend le focus à la grille
   * @param {(texte: string, erreur?: boolean) => void} options.signaler
   */
  constructor({ classeur, selection, grille, avantAction, apresAction, signaler }) {
    this.classeur = classeur;
    this.selection = selection;
    this.grille = grille;
    this.avantAction = avantAction;
    this.apresAction = apresAction;
    this.signaler = signaler;

    const element = (id) => document.getElementById(id);
    this.barre = element('barre-recherche');
    this.champTexte = element('recherche-texte');
    this.champRemplacement = element('recherche-remplacement');
    this.caseCasse = element('recherche-casse');
    this.caseToutes = element('recherche-toutes-feuilles');
    this.compte = element('recherche-compte');
    this.boutonSuivant = element('recherche-suivant');
    this.boutonRemplacer = element('recherche-remplacer');
    this.boutonToutRemplacer = element('recherche-tout-remplacer');
    this.boutonOutil = element('bouton-rechercher');

    this.boutonOutil.addEventListener('click', () => (this.ouverte ? this.fermer() : this.ouvrir()));
    element('recherche-fermer').addEventListener('click', () => this.fermer());
    this.boutonSuivant.addEventListener('click', () => this.suivant());
    this.boutonRemplacer.addEventListener('click', () => this.remplacer());
    this.boutonToutRemplacer.addEventListener('click', () => this.toutRemplacer());
    // À la souris, les boutons ne prennent pas le focus : Entrée relance « Suivant ».
    for (const bouton of this.barre.querySelectorAll('button')) {
      bouton.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse') e.preventDefault();
      });
    }

    for (const champ of [this.champTexte, this.caseCasse, this.caseToutes]) {
      champ.addEventListener('input', () => this.#invalider());
      champ.addEventListener('change', () => this.#invalider());
    }
    // Entrée : « Suivant » (dans « Rechercher ») ou « Remplacer » (dans « Remplacer par »).
    // Échap ferme la barre. Ctrl + F dans la barre resélectionne le texte cherché.
    this.barre.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.fermer();
      } else if (e.key === 'Enter' && !e.isComposing && e.target === this.champTexte) {
        e.preventDefault();
        this.suivant();
      } else if (e.key === 'Enter' && !e.isComposing && e.target === this.champRemplacement) {
        e.preventDefault();
        this.remplacer();
      } else if ((e.ctrlKey || e.metaKey) && ['f', 'h'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        this.ouvrir({ remplacer: e.key.toLowerCase() === 'h' });
      }
    });

    // Le classeur change (saisie, Annuler, autre feuille…) : les résultats sont à recompter.
    classeur.abonner((evenement) => {
      if (['cellules', 'structure', 'onglets', 'active'].includes(evenement.type)) this.#invalider();
    });
    // La sélection change : la position « 2 sur 5 » aussi.
    selection.abonner(() => {
      if (this.ouverte) this.#afficherCompte();
    });
  }

  get ouverte() {
    return !this.barre.hidden;
  }

  /** Ouvre la barre et place le curseur dans « Rechercher » (ou « Remplacer par »). */
  ouvrir({ remplacer = false } = {}) {
    this.avantAction();
    if (!this.ouverte && window.matchMedia(ECRAN_ETROIT).matches) {
      // Sur téléphone, on replie la barre d'outils : la grille garde de la place.
      this.#ongletReplie = replierBarreOutils();
    }
    this.barre.hidden = false;
    this.boutonOutil.setAttribute('aria-pressed', 'true');
    const champ = remplacer && this.champTexte.value ? this.champRemplacement : this.champTexte;
    champ.focus();
    champ.select();
    this.#invalider();
  }

  fermer() {
    this.barre.hidden = true;
    this.boutonOutil.setAttribute('aria-pressed', 'false');
    if (this.#ongletReplie) ouvrirOngletOutils(this.#ongletReplie);
    this.#ongletReplie = null;
    this.apresAction();
  }

  // --- Résultats -----------------------------------------------------------------

  #motif() {
    return motifRecherche(this.champTexte.value, { casse: this.caseCasse.checked });
  }

  #invalider() {
    this.#aJour = false;
    if (this.ouverte) this.#afficherCompte();
  }

  /** Les cellules trouvées (recalculées seulement si quelque chose a changé). */
  #trouver() {
    if (!this.#aJour) {
      const motif = this.#motif();
      const feuilles = this.caseToutes.checked ? this.classeur.feuilles : [this.classeur.feuilleActive];
      this.#resultats = motif ? rechercher(this.classeur, motif, feuilles) : [];
      this.#aJour = true;
    }
    return this.#resultats;
  }

  /** Rang du résultat qui correspond à la cellule active (ou -1). */
  #rangActuel() {
    const feuille = this.classeur.feuilleActive;
    const { ligne, colonne } = this.selection.active;
    return this.#trouver().findIndex((r) => r.feuille === feuille && r.ligne === ligne && r.colonne === colonne);
  }

  #afficherCompte() {
    const resultats = this.#trouver();
    const vide = !this.champTexte.value;
    const total = resultats.length;
    const rang = this.#rangActuel();
    let texte = '';
    if (!vide) {
      if (total === 0) texte = 'Aucun résultat';
      else if (rang >= 0) texte = `${rang + 1} sur ${total}`;
      else texte = `${total} résultat${total > 1 ? 's' : ''}`;
    }
    this.compte.textContent = texte;
    this.compte.classList.toggle('aucun', !vide && total === 0);
    for (const bouton of [this.boutonSuivant, this.boutonRemplacer, this.boutonToutRemplacer]) bouton.disabled = total === 0;
  }

  // --- Actions ------------------------------------------------------------------

  /** Sélectionne la prochaine cellule qui contient le texte (passe d'une feuille à l'autre si besoin). */
  suivant() {
    const resultats = this.#trouver();
    if (resultats.length === 0) return;
    const { ligne, colonne } = this.selection.active;
    const rang = rangSuivant(resultats, { rangFeuille: this.classeur.feuilles.indexOf(this.classeur.feuilleActive), ligne, colonne });
    this.#aller(resultats[rang]);
  }

  #aller(resultat) {
    if (resultat.feuille !== this.classeur.feuilleActive) this.classeur.activer(resultat.feuille);
    this.selection.choisir(resultat.ligne, resultat.colonne);
    this.grille.rendreVisible(resultat.ligne, resultat.colonne);
    this.#afficherCompte();
  }

  /** Remplace dans la cellule sélectionnée si elle contient le texte, puis passe à la suivante. */
  remplacer() {
    const rang = this.#rangActuel();
    if (rang === -1) {
      // La cellule sélectionnée ne contient pas le texte : on va d'abord au résultat suivant.
      this.suivant();
      return;
    }
    const resultat = this.#resultats[rang];
    const { liste, remplacements } = preparerRemplacements([resultat], this.#motif(), this.champRemplacement.value);
    const cible = { ligne: resultat.ligne, colonne: resultat.colonne };
    this.classeur.modifierFeuilles(liste, { debut: cible, fin: cible });
    this.suivant();
    // (Après « Suivant » : le message reste affiché tant que la sélection ne bouge plus.)
    this.signaler(`${remplacements} remplacement${remplacements > 1 ? 's' : ''} dans ${resultat.adresse}.`);
  }

  /** Remplace partout (feuille affichée, ou toutes les feuilles), en une seule étape. */
  toutRemplacer() {
    const resultats = this.#trouver();
    if (resultats.length === 0) return;
    const { liste, remplacements, cellules } = preparerRemplacements(resultats, this.#motif(), this.champRemplacement.value);
    this.classeur.modifierFeuilles(liste, this.selection.plage);
    const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;
    this.signaler(`${pluriel(remplacements, 'remplacement')} dans ${pluriel(cellules, 'cellule')}. « Annuler » remet tout comme avant.`);
    this.#afficherCompte();
  }
}
