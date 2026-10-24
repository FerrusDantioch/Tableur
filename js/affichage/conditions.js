// Fenêtre « Mise en forme conditionnelle » (bouton « Conditions » de
// l'onglet « Mise en forme ») : la liste des règles de la feuille affichée,
// avec « Modifier » et « Supprimer », et un formulaire pour en créer une.
//
// Exemple : cellules B2:B20, « si la valeur est supérieure à 100 » → fond
// rouge. Les couleurs se recalculent toutes seules quand les valeurs
// changent (voir app.js, presenterCellule, et calcul/conditions.js).

import { textePlage } from '../donnees/adresses.js';
import { COULEURS_FOND, ENCRES } from '../donnees/classeur.js';
import { LIBELLES_REGLES, TYPES_REGLES, decrireRegle, verifierRegle } from '../donnees/regles.js';
import { NOMS_COULEURS, creerNuancier, marquerNuancier } from './mise-en-forme.js';

export class MiseEnFormeConditionnelle {
  #enModification = null; // numéro de la règle modifiée (null : nouvelle règle)
  #fond = null;
  #encre = null;

  /**
   * @param {object} options
   * @param {import('../donnees/classeur.js').Classeur} options.classeur
   * @param {import('./selection.js').Selection} options.selection
   * @param {(fenetre: HTMLDialogElement) => void} options.ouvrirFenetre
   * @param {() => void} options.avantAction  termine la saisie en cours
   */
  constructor({ classeur, selection, ouvrirFenetre, avantAction }) {
    this.classeur = classeur;
    this.selection = selection;
    this.ouvrirFenetre = ouvrirFenetre;
    this.avantAction = avantAction;

    const element = (id) => document.getElementById(id);
    this.fenetre = element('fenetre-conditions');
    this.liste = element('liste-regles');
    this.aucune = element('aucune-regle');
    this.titreListe = element('titre-liste-regles');
    this.titreFormulaire = element('titre-formulaire-regle');
    this.champPlage = element('regle-plage');
    this.champType = element('regle-type');
    this.champValeur = element('regle-valeur');
    this.champValeur2 = element('regle-valeur2');
    this.blocValeur = element('bloc-valeur');
    this.blocValeur2 = element('bloc-valeur2');
    this.erreur = element('erreur-regle');
    this.etat = element('etat-regles');
    this.boutonEnregistrer = element('regle-enregistrer');
    this.boutonAbandonner = element('regle-abandonner');
    this.nuancierFond = element('regle-fond');
    this.nuancierEncre = element('regle-encre');

    for (const type of TYPES_REGLES) {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = LIBELLES_REGLES[type];
      this.champType.append(option);
    }
    creerNuancier(this.nuancierFond, COULEURS_FOND, 'fond', 'Aucune', (couleur) => {
      this.#fond = couleur;
      marquerNuancier(this.nuancierFond, couleur);
    });
    creerNuancier(this.nuancierEncre, ENCRES, 'encre', 'Aucune', (couleur) => {
      this.#encre = couleur;
      marquerNuancier(this.nuancierEncre, couleur);
    });

    element('bouton-conditions').addEventListener('click', () => this.ouvrir());
    this.champType.addEventListener('change', () => this.#adapterChamps());
    this.boutonEnregistrer.addEventListener('click', () => this.enregistrer());
    this.boutonAbandonner.addEventListener('click', () => this.#nouvelleRegle());
    // Entrée dans un champ : comme « Ajouter » / « Enregistrer ».
    for (const champ of [this.champPlage, this.champValeur, this.champValeur2]) {
      champ.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.isComposing) {
          e.preventDefault();
          this.enregistrer();
        }
      });
    }
    // La liste suit les changements (Annuler, autre feuille…).
    classeur.abonner((evenement) => {
      if (this.fenetre.open && ['structure', 'active', 'onglets'].includes(evenement.type)) this.#afficherListe();
    });
  }

  get feuille() {
    return this.classeur.feuilleActive;
  }

  /** Ouvre la fenêtre, prête à créer une règle pour les cellules sélectionnées. */
  ouvrir() {
    this.avantAction();
    this.etat.textContent = '';
    this.#nouvelleRegle();
    this.#afficherListe();
    this.ouvrirFenetre(this.fenetre);
  }

  /** Formulaire vide (nouvelle règle sur la sélection). */
  #nouvelleRegle() {
    this.#enModification = null;
    this.titreFormulaire.textContent = 'Nouvelle règle';
    this.boutonEnregistrer.textContent = 'Ajouter la règle';
    this.boutonAbandonner.hidden = true;
    this.champPlage.value = textePlage(this.selection.plage);
    this.champType.value = 'superieur';
    this.champValeur.value = '';
    this.champValeur2.value = '';
    this.#choisirCouleurs('rouge', null);
    this.erreur.textContent = '';
    this.#adapterChamps();
  }

  #choisirCouleurs(fond, encre) {
    this.#fond = fond;
    this.#encre = encre;
    marquerNuancier(this.nuancierFond, fond);
    marquerNuancier(this.nuancierEncre, encre);
  }

  /** « négative » n'a pas de valeur ; « entre » en a deux. */
  #adapterChamps() {
    const type = this.champType.value;
    this.blocValeur.hidden = type === 'negatif';
    this.blocValeur2.hidden = type !== 'entre';
    this.champValeur.placeholder = type === 'contient' ? 'texte (ex. payé)' : type === 'egal' ? 'nombre ou texte' : 'nombre (ex. 100)';
  }

  /** La règle décrite par le formulaire. */
  #lireFormulaire() {
    return {
      plage: this.champPlage.value.trim(),
      type: this.champType.value,
      valeur: this.champValeur.value.trim(),
      valeur2: this.champValeur2.value.trim(),
      fond: this.#fond,
      encre: this.#encre,
    };
  }

  /** « Ajouter la règle » ou « Enregistrer » (modification). */
  enregistrer() {
    const regle = this.#lireFormulaire();
    const refus = verifierRegle(regle);
    if (refus) {
      this.erreur.textContent = refus;
      return;
    }
    const resultat =
      this.#enModification === null
        ? this.classeur.ajouterRegle(this.feuille, regle)
        : this.classeur.modifierRegle(this.feuille, this.#enModification, regle);
    if (!resultat.ok) {
      this.erreur.textContent = resultat.message;
      return;
    }
    this.etat.textContent = this.#enModification === null ? 'Règle ajoutée.' : 'Règle modifiée.';
    this.#nouvelleRegle();
    this.#afficherListe();
  }

  /** Remplit le formulaire avec une règle existante. */
  #modifier(regle) {
    this.#enModification = regle.id;
    this.titreFormulaire.textContent = `Modifier la règle (${regle.plage})`;
    this.boutonEnregistrer.textContent = 'Enregistrer';
    this.boutonAbandonner.hidden = false;
    this.champPlage.value = regle.plage;
    this.champType.value = regle.type;
    this.champValeur.value = regle.valeur;
    this.champValeur2.value = regle.valeur2;
    this.#choisirCouleurs(regle.fond, regle.encre);
    this.erreur.textContent = '';
    this.etat.textContent = '';
    this.#adapterChamps();
    this.champValeur.focus();
  }

  #supprimer(regle) {
    this.classeur.supprimerRegle(this.feuille, regle.id);
    if (this.#enModification === regle.id) this.#nouvelleRegle();
    this.etat.textContent = 'Règle supprimée (le bouton « Annuler » la remet).';
    this.#afficherListe();
  }

  /** Liste des règles de la feuille affichée. */
  #afficherListe() {
    const regles = this.feuille.regles;
    this.titreListe.textContent = `Règles de la feuille « ${this.feuille.nom} »`;
    this.liste.replaceChildren();
    this.aucune.hidden = regles.length > 0;
    for (const regle of regles) {
      const li = document.createElement('li');
      li.className = 'regle';
      // Aperçu des couleurs de la règle.
      const apercu = document.createElement('span');
      apercu.className = 'apercu-regle';
      apercu.textContent = 'Abc';
      if (regle.fond) apercu.dataset.fond = regle.fond;
      if (regle.encre) apercu.dataset.encre = regle.encre;
      apercu.setAttribute('aria-hidden', 'true');
      const texte = document.createElement('span');
      texte.className = 'texte-regle';
      const plage = document.createElement('strong');
      plage.textContent = regle.plage;
      const couleurs = [regle.fond && `fond ${NOMS_COULEURS[regle.fond].toLowerCase()}`, regle.encre && `texte ${NOMS_COULEURS[regle.encre].toLowerCase()}`]
        .filter(Boolean)
        .join(', ');
      texte.append(plage, ` : si ${decrireRegle(regle)} → ${couleurs}`);
      const modifier = document.createElement('button');
      modifier.type = 'button';
      modifier.className = 'outil';
      modifier.textContent = 'Modifier';
      modifier.setAttribute('aria-label', `Modifier la règle ${regle.plage} : ${decrireRegle(regle)}`);
      modifier.addEventListener('click', () => this.#modifier(regle));
      const supprimer = document.createElement('button');
      supprimer.type = 'button';
      supprimer.className = 'outil';
      supprimer.textContent = 'Supprimer';
      supprimer.setAttribute('aria-label', `Supprimer la règle ${regle.plage} : ${decrireRegle(regle)}`);
      supprimer.addEventListener('click', () => this.#supprimer(regle));
      const boutons = document.createElement('span');
      boutons.className = 'boutons-regle';
      boutons.append(modifier, supprimer);
      li.append(apercu, texte, boutons);
      this.liste.append(li);
    }
  }
}
