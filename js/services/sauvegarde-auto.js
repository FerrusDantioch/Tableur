// Sauvegarde automatique : après chaque modification, le classeur est
// enregistré sur l'appareil, sans aucune action de la personne.
//
// - On attend un court instant (DELAI) après la dernière modification, pour
//   ne pas enregistrer à chaque lettre tapée.
// - On enregistre tout de suite quand l'application passe en arrière-plan ou
//   se ferme (changement d'onglet, d'application sur le téléphone…).

const DELAI = 700; // millisecondes

/** Types d'événements du classeur qui modifient son contenu. */
const MODIFICATIONS = new Set(['cellules', 'largeurs', 'dimensions', 'structure', 'onglets', 'active', 'titre']);

export class SauvegardeAuto {
  #minuterie = null;
  #enAttente = false;
  #enCours = null;

  /**
   * @param {object} options
   * @param {import('../donnees/classeur.js').Classeur} options.classeur
   * @param {(donnees: object) => Promise<void>} options.enregistrer
   * @param {(etat: 'modifie'|'enregistrement'|'enregistre'|'erreur') => void} options.surEtat
   */
  constructor({ classeur, enregistrer, surEtat }) {
    this.classeur = classeur;
    this.enregistrer = enregistrer;
    this.surEtat = surEtat;

    classeur.abonner((evenement) => {
      if (MODIFICATIONS.has(evenement.type)) this.planifier();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.maintenant();
    });
    window.addEventListener('pagehide', () => this.maintenant());
  }

  /** Vrai si des modifications ne sont pas encore enregistrées. */
  get enAttente() {
    return this.#enAttente;
  }

  planifier() {
    this.#enAttente = true;
    this.surEtat('modifie');
    clearTimeout(this.#minuterie);
    this.#minuterie = setTimeout(() => this.maintenant(), DELAI);
  }

  /** Enregistre tout de suite s'il y a des modifications en attente. */
  async maintenant() {
    clearTimeout(this.#minuterie);
    // Un enregistrement est déjà en cours : on attend qu'il finisse.
    if (this.#enCours) await this.#enCours;
    if (!this.#enAttente) return;
    this.#enAttente = false;
    this.surEtat('enregistrement');
    this.#enCours = this.enregistrer(this.classeur.versJSON())
      .then(() => this.surEtat(this.#enAttente ? 'modifie' : 'enregistre'))
      .catch((erreur) => {
        console.warn('Enregistrement impossible :', erreur);
        this.#enAttente = true;
        this.surEtat('erreur');
      })
      .finally(() => {
        this.#enCours = null;
      });
    await this.#enCours;
  }
}
