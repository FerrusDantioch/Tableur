// Les onglets des feuilles, en bas de l'écran : Feuille1, Feuille2…
//
//   - un appui sur un onglet affiche sa feuille ;
//   - un appui sur l'onglet de la feuille affichée ouvre un petit menu :
//     « Renommer… » et « Supprimer… » (aussi : double-clic pour renommer) ;
//   - le bouton « + » ajoute une feuille.
// Toutes ces actions passent par le classeur et sont annulables.

import { NOM_FEUILLE_MAX } from '../donnees/classeur.js';

export class OngletsFeuilles {
  /**
   * @param {object} options
   * @param {import('../donnees/classeur.js').Classeur} options.classeur
   * @param {() => void} options.avantAction  termine la saisie en cours
   * @param {() => void} options.apresAction  rend le focus à la grille
   * @param {(fenetre: HTMLDialogElement) => Promise<string>} options.demander  ouvre une fenêtre et attend la réponse
   * @param {(fenetre: HTMLDialogElement) => void} options.ouvrirFenetre
   * @param {(texte: string, erreur?: boolean) => void} options.signaler
   */
  constructor({ classeur, avantAction, apresAction, demander, ouvrirFenetre, signaler }) {
    this.classeur = classeur;
    this.avantAction = avantAction;
    this.apresAction = apresAction;
    this.demander = demander;
    this.ouvrirFenetre = ouvrirFenetre;
    this.signaler = signaler;

    const element = (id) => document.getElementById(id);
    this.liste = element('liste-feuilles');
    this.panneau = element('panneau-feuille');
    this.fenetreRenommer = element('fenetre-renommer-feuille');
    this.champNom = element('nom-feuille');
    this.erreurNom = element('erreur-nom-feuille');
    this.fenetreSupprimer = element('fenetre-supprimer-feuille');
    this.feuilleRenommee = null;

    element('ajouter-feuille').addEventListener('click', () => {
      this.avantAction();
      const feuille = this.classeur.ajouterFeuille();
      this.signaler(`Feuille « ${feuille.nom} » ajoutée.`);
      this.apresAction();
    });

    element('feuille-renommer').addEventListener('click', () => {
      this.panneau.hidePopover();
      this.renommer(this.classeur.feuilleActive);
    });
    element('feuille-supprimer').addEventListener('click', () => {
      this.panneau.hidePopover();
      this.supprimer(this.classeur.feuilleActive);
    });

    // Fenêtre « Renommer » : Entrée valide, Échap ferme (comportement normal des fenêtres).
    element('valider-nom-feuille').addEventListener('click', () => this.#validerNom());
    this.champNom.maxLength = NOM_FEUILLE_MAX;
    this.champNom.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.#validerNom();
      }
    });
    this.champNom.addEventListener('input', () => {
      this.erreurNom.textContent = '';
    });

    classeur.abonner((evenement) => {
      if (evenement.type === 'onglets' || evenement.type === 'active') this.afficher();
    });
    this.afficher();
  }

  /** Dessine les onglets. */
  afficher() {
    const active = this.classeur.feuilleActive;
    const onglets = this.classeur.feuilles.map((feuille) => {
      const onglet = document.createElement('button');
      onglet.type = 'button';
      onglet.className = 'onglet-feuille';
      onglet.setAttribute('role', 'tab');
      onglet.setAttribute('aria-selected', String(feuille === active));
      onglet.textContent = feuille.nom;
      onglet.title = feuille === active ? 'Feuille affichée — appuyer pour la renommer ou la supprimer' : `Afficher la feuille « ${feuille.nom} »`;
      let auDoigt = false;
      onglet.addEventListener('pointerdown', (e) => {
        auDoigt = e.pointerType === 'touch';
        if (e.pointerType === 'mouse') e.preventDefault(); // la grille garde le focus
      });
      onglet.addEventListener('click', () => this.#choisir(feuille, onglet));
      // Double-clic (à la souris seulement : au doigt, deux appuis rapides
      // ouvrent simplement le petit menu).
      onglet.addEventListener('dblclick', () => {
        if (auDoigt) return;
        this.panneau.hidePopover();
        this.renommer(feuille);
      });
      return onglet;
    });
    this.liste.replaceChildren(...onglets);
    onglets[this.classeur.feuilles.indexOf(active)]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  #choisir(feuille, onglet) {
    this.avantAction();
    if (feuille !== this.classeur.feuilleActive) {
      this.classeur.activer(feuille);
      this.apresAction();
      return;
    }
    // Feuille déjà affichée : petit menu au-dessus de l'onglet.
    document.getElementById('panneau-feuille-titre').textContent = `Feuille « ${feuille.nom} »`;
    const seule = this.classeur.feuilles.length <= 1;
    const boutonSupprimer = document.getElementById('feuille-supprimer');
    boutonSupprimer.disabled = seule;
    boutonSupprimer.title = seule ? 'Le classeur doit garder au moins une feuille.' : '';
    const r = onglet.getBoundingClientRect();
    const largeur = Math.min(300, window.innerWidth - 16);
    this.panneau.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - largeur - 8))}px`;
    this.panneau.style.top = 'auto';
    this.panneau.style.bottom = `${window.innerHeight - r.top + 6}px`;
    this.panneau.showPopover();
  }

  /** Ouvre la fenêtre « Renommer la feuille ». */
  renommer(feuille) {
    this.avantAction();
    this.feuilleRenommee = feuille;
    this.champNom.value = feuille.nom;
    this.erreurNom.textContent = '';
    this.ouvrirFenetre(this.fenetreRenommer);
    this.champNom.focus();
    this.champNom.select();
  }

  #validerNom() {
    const feuille = this.feuilleRenommee;
    if (!feuille) return;
    const erreur = this.classeur.renommerFeuille(feuille, this.champNom.value);
    if (erreur) {
      this.erreurNom.textContent = erreur;
      this.champNom.focus();
      return;
    }
    this.fenetreRenommer.close('renommee');
    this.signaler(`Feuille renommée en « ${feuille.nom} ».`);
  }

  /** Demande confirmation, puis supprime la feuille. */
  async supprimer(feuille) {
    if (this.classeur.feuilles.length <= 1) {
      this.signaler('Le classeur doit garder au moins une feuille.', true);
      return;
    }
    document.getElementById('nom-feuille-supprimee').textContent = feuille.nom;
    const reponse = await this.demander(this.fenetreSupprimer);
    if (reponse !== 'supprimer') return;
    const nom = feuille.nom;
    this.classeur.supprimerFeuille(feuille);
    this.signaler(`Feuille « ${nom} » supprimée. « Annuler » permet de la récupérer.`);
  }
}
