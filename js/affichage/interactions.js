// Interactions avec la grille : clavier, souris et doigt.
//
// Ce module traduit les gestes de la personne en actions :
//   - flèches, Tab, Entrée → déplacer la sélection ;
//   - taper du texte → saisir dans la cellule active ;
//   - clic, glisser, Maj + clic → sélectionner ;
//   - au doigt : un appui sélectionne, un second appui sur la même cellule
//     ouvre l'édition (et le clavier du téléphone) ;
//   - Suppr → vider les cellules sélectionnées.
//
// Les modifications passent toujours par le classeur (donnees/classeur.js),
// jamais directement par l'affichage.

import { adresse, dansPlage, lireAdresse, lirePlage, textePlage } from '../donnees/adresses.js';

// Direction de déplacement associée à chaque flèche : [lignes, colonnes].
const FLECHES = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

export class Interactions {
  #glisser = null; // geste de glisser en cours : { type, pointerId }
  #modeToucher = false;

  /**
   * @param {object} options
   * @param {import('../donnees/classeur.js').Classeur} options.classeur
   * @param {import('../donnees/classeur.js').Feuille} options.feuille
   * @param {import('./selection.js').Selection} options.selection
   * @param {import('./grille.js').Grille} options.grille
   * @param {import('./edition.js').Edition} options.edition
   * @param {HTMLInputElement} options.nomCellule  case « A1 » de la barre de formule
   * @param {HTMLButtonElement} options.boutonValider
   * @param {HTMLButtonElement} options.boutonAnnuler
   * @param {object} options.commandes  actions partagées avec la barre d'outils
   *        ({ annuler, retablir, gras, … }, chacune facultative)
   */
  constructor({ classeur, feuille, selection, grille, edition, nomCellule, boutonValider, boutonAnnuler, commandes }) {
    this.classeur = classeur;
    this.feuille = feuille;
    this.selection = selection;
    this.grille = grille;
    this.edition = edition;
    this.nomCellule = nomCellule;
    this.commandes = commandes;

    const racine = grille.racine;
    this.#modeToucher = window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(pointer: fine)').matches;
    racine.classList.toggle('mode-toucher', this.#modeToucher);

    selection.abonner(() => this.actualiser());

    // --- Clavier ---
    edition.champCellule.addEventListener('keydown', (e) => this.#toucheChampCellule(e));
    edition.champBarre.addEventListener('keydown', (e) => this.#toucheChampBarre(e));
    racine.addEventListener('keydown', (e) => {
      // Mode toucher avec un clavier branché : la grille elle-même a le focus.
      if (e.target === racine) this.#toucheNavigation(e, true);
    });

    // Taper sur la cellule active (champ invisible) commence la saisie.
    edition.champCellule.addEventListener('input', () => {
      if (!edition.enCours) this.#commencer('saisie', edition.champCellule.value);
    });
    edition.champCellule.addEventListener('compositionstart', () => {
      if (!edition.enCours) this.#commencer('saisie', edition.champCellule.value);
    });

    // Un appui dans la barre de formule commence la modification de la cellule active.
    edition.champBarre.addEventListener('focus', () => {
      if (!edition.enCours) {
        const { ligne, colonne } = selection.active;
        const brut = feuille.brut(adresse(ligne, colonne));
        edition.commencer(ligne, colonne, { texte: brut, mode: 'modification', origine: 'barre', initial: brut });
      } else {
        edition.changerOrigine('barre');
      }
    });
    edition.champCellule.addEventListener('focus', () => {
      if (edition.enCours) edition.changerOrigine('cellule');
    });

    // Quitter le champ (clic ailleurs) valide la saisie, sauf si l'on passe
    // simplement d'un champ à l'autre.
    const surSortie = (e) => {
      if (!edition.enCours) return;
      if (e.relatedTarget === edition.champCellule || e.relatedTarget === edition.champBarre) return;
      this.validerEdition(null, { refocaliser: false });
    };
    edition.champCellule.addEventListener('blur', surSortie);
    edition.champBarre.addEventListener('blur', surSortie);

    // Boutons ✓ et ✕ : ils ne doivent pas prendre le focus (sinon la sortie
    // du champ validerait la saisie avant le clic sur ✕).
    for (const bouton of [boutonValider, boutonAnnuler]) {
      bouton.addEventListener('pointerdown', (e) => e.preventDefault());
    }
    boutonValider.addEventListener('click', () => this.validerEdition(null));
    boutonAnnuler.addEventListener('click', () => this.annulerEdition());

    // Case « A1 » : taper une adresse ou une plage puis Entrée pour y aller.
    nomCellule.addEventListener('focus', () => nomCellule.select());
    nomCellule.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const cible = lirePlage(nomCellule.value);
        if (cible) {
          selection.choisirPlage(cible);
          this.#montrer();
        }
        this.focaliser();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.focaliser();
      }
    });
    nomCellule.addEventListener('blur', () => {
      nomCellule.value = textePlage(selection.plage);
    });

    // --- Souris et doigt ---
    racine.addEventListener('pointerdown', (e) => this.#appui(e));
    racine.addEventListener('pointermove', (e) => this.#glissement(e));
    racine.addEventListener('pointerup', (e) => this.#relachement(e));
    racine.addEventListener('pointercancel', (e) => this.#relachement(e));
    racine.addEventListener('click', (e) => this.#clicToucher(e));
    racine.addEventListener('dblclick', (e) => {
      // (Pendant un glisser, la grille « capture » la souris : on retrouve donc
      // la cellule par la position du pointeur plutôt que par e.target.)
      const cible = grille.cible(document.elementFromPoint(e.clientX, e.clientY));
      if (cible?.type === 'cellule' && !edition.enCours) this.#commencer('modification');
      // Double-clic sur le bord d'une colonne : largeur ajustée au contenu.
      if (cible?.type === 'largeur') this.commandes.ajusterLargeur?.([cible.colonne]);
    });
    racine.addEventListener('focus', () => {
      // Au clavier, le focus doit être dans le champ invisible de la cellule active.
      if (!this.#modeToucher && !edition.enCours) edition.champCellule.focus({ preventScroll: true });
    });

    this.actualiser();
  }

  get modeToucher() {
    return this.#modeToucher;
  }

  #changerMode(toucher) {
    if (toucher === this.#modeToucher) return;
    this.#modeToucher = toucher;
    this.grille.racine.classList.toggle('mode-toucher', toucher);
  }

  /**
   * Met le focus sur la grille. Au doigt, on évite de focaliser le champ de
   * saisie, sinon le clavier du téléphone s'ouvrirait à chaque appui.
   */
  focaliser() {
    if (this.#modeToucher) this.grille.racine.focus({ preventScroll: true });
    else this.edition.champCellule.focus({ preventScroll: true });
  }

  /** Redessine la sélection et la barre de formule (après un changement de sélection ou de contenu). */
  actualiser() {
    const { ligne, colonne } = this.selection.active;
    this.grille.afficherSelection(this.selection);
    this.edition.suivre(ligne, colonne, this.feuille.brut(adresse(ligne, colonne)));
    if (document.activeElement !== this.nomCellule) this.nomCellule.value = textePlage(this.selection.plage);
    this.commandes.selectionChangee?.(this.selection);
  }

  /** Fait défiler la grille jusqu'au coin de la sélection qui vient de bouger. */
  #montrer() {
    this.grille.rendreVisible(this.selection.bout.ligne, this.selection.bout.colonne);
  }

  // --- Édition -----------------------------------------------------------------

  #commencer(mode, texte) {
    const { ligne, colonne } = this.selection.active;
    // La sélection se réduit à la cellule active.
    if (!this.selection.unique) this.selection.choisir(ligne, colonne);
    const initial = this.feuille.brut(adresse(ligne, colonne));
    this.edition.commencer(ligne, colonne, {
      texte: texte ?? initial,
      mode,
      origine: 'cellule',
      initial,
    });
  }

  /**
   * Enregistre la saisie en cours dans le classeur, puis déplace éventuellement
   * la sélection ([lignes, colonnes], ex. [1, 0] pour descendre).
   */
  validerEdition(deplacement = null, { refocaliser = true } = {}) {
    const fin = this.edition.terminer();
    if (!fin) return false;
    if (fin.modifie) {
      const brut = fin.texte.trim() === '' ? '' : fin.texte;
      const cible = { ligne: fin.ligne, colonne: fin.colonne };
      this.classeur.modifierCellules(this.feuille, [{ adresse: adresse(fin.ligne, fin.colonne), brut }], {
        debut: cible,
        fin: cible,
      });
    }
    if (deplacement) {
      this.selection.deplacer(deplacement[0], deplacement[1]);
      this.#montrer();
    } else {
      this.actualiser();
    }
    if (refocaliser) this.focaliser();
    return true;
  }

  /** Abandonne la saisie en cours : la cellule garde son ancien contenu. */
  annulerEdition() {
    if (!this.edition.terminer()) return;
    this.actualiser();
    this.focaliser();
  }

  /** Vide le texte des cellules sélectionnées (la mise en forme est gardée, comme dans Excel). */
  effacerSelection() {
    const plage = this.selection.plage;
    const modifications = [];
    for (const adr of this.feuille.adresses()) {
      const position = lireAdresse(adr);
      if (dansPlage(plage, position.ligne, position.colonne) && this.feuille.brut(adr) !== '') {
        modifications.push({ adresse: adr, brut: '' });
      }
    }
    this.classeur.modifierCellules(this.feuille, modifications, plage);
  }

  // --- Clavier -------------------------------------------------------------------

  /** Touches dans le champ de la cellule (sert aussi de « récepteur » hors édition). */
  #toucheChampCellule(e) {
    if (!this.edition.enCours) {
      this.#toucheNavigation(e, false);
      return;
    }
    if (e.isComposing) return;
    const maj = e.shiftKey;
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        this.validerEdition(maj ? [-1, 0] : [1, 0]);
        return;
      case 'Tab':
        e.preventDefault();
        this.validerEdition(maj ? [0, -1] : [0, 1]);
        return;
      case 'Escape':
        e.preventDefault();
        this.annulerEdition();
        return;
      default:
        break;
    }
    // En mode « saisie », les flèches valident et déplacent (comme dans Excel),
    // sauf dans une formule, où elles servent à corriger le texte.
    const fleche = FLECHES[e.key];
    if (fleche && !e.ctrlKey && !e.metaKey && !e.altKey && this.edition.enCours.mode === 'saisie') {
      if (!this.edition.texte.trimStart().startsWith('=')) {
        e.preventDefault();
        this.validerEdition(fleche);
      }
    }
  }

  /** Touches dans la barre de formule. */
  #toucheChampBarre(e) {
    if (e.isComposing || !this.edition.enCours) return;
    const maj = e.shiftKey;
    if (e.key === 'Enter') {
      e.preventDefault();
      this.validerEdition(maj ? [-1, 0] : [1, 0]);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      this.validerEdition(maj ? [0, -1] : [0, 1]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.annulerEdition();
    }
  }

  /**
   * Touches hors édition : déplacements, raccourcis, effacement.
   * @param {KeyboardEvent} e
   * @param {boolean} depuisGrille  vrai si le focus est sur la grille (mode toucher) :
   *        une lettre tapée doit alors ouvrir l'édition à la main.
   */
  #toucheNavigation(e, depuisGrille) {
    if (e.isComposing) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const maj = e.shiftKey;
    const selection = this.selection;
    const fleche = FLECHES[e.key];

    if (ctrl && !e.altKey) {
      let action = null;
      const lettre = e.key.length === 1 ? e.key.toLowerCase() : null;
      if (lettre === 'z') action = maj ? this.commandes.retablir : this.commandes.annuler;
      else if (lettre === 'y') action = this.commandes.retablir;
      else if (lettre === 'b') action = this.commandes.gras;
      else if (lettre === 'a') action = () => selection.tout();
      else if (fleche) action = () => selection.allerAuBord(fleche[0], fleche[1], maj);
      else if (e.key === 'Home') action = () => selection.choisir(1, 1);
      // Les autres raccourcis (copier, coller, imprimer…) restent au navigateur.
      if (!action) return;
      e.preventDefault();
      action();
      this.#montrer();
      return;
    }
    if (e.altKey) return;

    if (fleche) {
      e.preventDefault();
      selection.deplacer(fleche[0], fleche[1], maj);
      this.#montrer();
      return;
    }

    switch (e.key) {
      case 'Tab':
        e.preventDefault();
        selection.deplacer(0, maj ? -1 : 1);
        break;
      case 'Enter':
        e.preventDefault();
        selection.deplacer(maj ? -1 : 1, 0);
        break;
      case 'PageDown':
      case 'PageUp': {
        e.preventDefault();
        const td = this.grille.td(1, 1);
        const hauteur = td ? td.getBoundingClientRect().height : 32;
        const pas = Math.max(1, Math.floor(this.grille.racine.clientHeight / hauteur) - 2);
        selection.deplacer(e.key === 'PageDown' ? pas : -pas, 0, maj);
        break;
      }
      case 'Home':
        e.preventDefault();
        selection.choisir(selection.active.ligne, 1, maj);
        break;
      case 'F2':
        e.preventDefault();
        this.#commencer('modification');
        return;
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        this.effacerSelection();
        return;
      case 'Escape':
        if (!selection.unique) {
          e.preventDefault();
          selection.choisir(selection.active.ligne, selection.active.colonne);
        }
        return;
      default:
        // Une lettre, un chiffre… : on commence la saisie avec ce caractère.
        // (Dans le champ invisible, le navigateur l'insère tout seul et
        // l'événement « input » ouvre l'édition.)
        if (depuisGrille && e.key.length === 1) {
          e.preventDefault();
          this.#commencer('saisie', e.key);
        }
        return;
    }
    this.#montrer();
  }

  // --- Souris et doigt ---------------------------------------------------------------

  #appui(e) {
    this.#changerMode(e.pointerType === 'touch');
    const cible = this.grille.cible(e.target);
    if (!cible) return;

    if (e.pointerType === 'touch') {
      // Au doigt, la sélection se fait au « clic » (après l'appui), pour laisser
      // le doigt faire défiler la grille. Seule la poignée se glisse tout de suite.
      if (cible.type === 'poignee') {
        e.preventDefault();
        this.#commencerGlisser(e, 'cellules');
      } else if (cible.type === 'largeur') {
        this.commandes.redimensionner?.(e, cible.colonne);
      }
      return;
    }

    if (e.button !== 0) return;
    // Garde le focus dans le champ de saisie et évite de surligner du texte.
    e.preventDefault();
    if (cible.type === 'largeur') {
      this.validerEdition(null, { refocaliser: false });
      this.commandes.redimensionner?.(e, cible.colonne);
      return;
    }
    this.validerEdition(null, { refocaliser: false });
    const etendre = e.shiftKey;
    switch (cible.type) {
      case 'cellule':
        this.selection.choisir(cible.ligne, cible.colonne, etendre);
        this.#commencerGlisser(e, 'cellules');
        break;
      case 'colonne':
        this.selection.colonneEntiere(cible.colonne, etendre);
        this.#commencerGlisser(e, 'colonnes');
        break;
      case 'ligne':
        this.selection.ligneEntiere(cible.ligne, etendre);
        this.#commencerGlisser(e, 'lignes');
        break;
      case 'coin':
        this.selection.tout();
        break;
      default:
        break;
    }
    this.focaliser();
  }

  #commencerGlisser(e, type) {
    this.#glisser = { type, pointerId: e.pointerId };
    this.grille.racine.setPointerCapture(e.pointerId);
  }

  #glissement(e) {
    const glisser = this.#glisser;
    if (!glisser || e.pointerId !== glisser.pointerId) return;
    // Défilement automatique quand on approche du bord de la grille.
    const zone = this.grille.racine;
    const bords = zone.getBoundingClientRect();
    if (e.clientY > bords.bottom - 24) zone.scrollTop += 24;
    else if (e.clientY < bords.top + 40) zone.scrollTop -= 24;
    if (e.clientX > bords.right - 24) zone.scrollLeft += 24;
    else if (e.clientX < bords.left + 40) zone.scrollLeft -= 24;

    const sous = this.grille.celluleSousPoint(e.clientX, e.clientY);
    if (!sous) return;
    const active = this.selection.bout;
    if (glisser.type === 'cellules') {
      this.selection.choisir(sous.ligne ?? active.ligne, sous.colonne ?? active.colonne, true);
    } else if (glisser.type === 'colonnes' && sous.colonne) {
      this.selection.colonneEntiere(sous.colonne, true);
    } else if (glisser.type === 'lignes' && sous.ligne) {
      this.selection.ligneEntiere(sous.ligne, true);
    }
  }

  #relachement(e) {
    if (this.#glisser && e.pointerId === this.#glisser.pointerId) this.#glisser = null;
  }

  /** Appui au doigt (le navigateur envoie « click » quand le doigt n'a pas fait défiler). */
  #clicToucher(e) {
    if (!this.#modeToucher) return;
    const cible = this.grille.cible(e.target);
    if (!cible) return;
    switch (cible.type) {
      case 'cellule': {
        const { ligne, colonne } = this.selection.active;
        if (this.selection.unique && ligne === cible.ligne && colonne === cible.colonne && !this.edition.enCours) {
          // Second appui sur la cellule active : on ouvre l'édition.
          this.#commencer('modification');
        } else {
          this.validerEdition(null, { refocaliser: false });
          this.selection.choisir(cible.ligne, cible.colonne);
          this.focaliser();
        }
        break;
      }
      case 'colonne':
        this.validerEdition(null, { refocaliser: false });
        this.selection.colonneEntiere(cible.colonne);
        this.focaliser();
        break;
      case 'ligne':
        this.validerEdition(null, { refocaliser: false });
        this.selection.ligneEntiere(cible.ligne);
        this.focaliser();
        break;
      case 'coin':
        this.validerEdition(null, { refocaliser: false });
        this.selection.tout();
        this.focaliser();
        break;
      default:
        break;
    }
  }
}
