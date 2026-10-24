// Commandes de l'onglet « Édition » : recopier vers le bas ou vers la droite,
// insérer et supprimer des lignes ou des colonnes, effacer le contenu.
//
// Ces commandes partent de la sélection, calculent ce qu'il faut changer et
// le confient au classeur (donnees/classeur.js), qui le rend annulable.

import { adresse, dansPlage, lettresColonne, lireAdresse, plage as creerPlage, taillePlage } from '../donnees/adresses.js';
import { calculerRecopie } from '../donnees/recopie.js';

export class CommandesEdition {
  /**
   * @param {object} options
   * @param {import('../donnees/classeur.js').Classeur} options.classeur
   * @param {import('./selection.js').Selection} options.selection
   * @param {() => void} options.avantAction  termine la saisie en cours
   * @param {() => void} options.apresAction  rend le focus à la grille
   * @param {(texte: string, erreur?: boolean) => void} options.signaler  court message en bas de l'écran
   */
  constructor({ classeur, selection, avantAction, apresAction, signaler }) {
    this.classeur = classeur;
    this.selection = selection;
    this.avantAction = avantAction;
    this.apresAction = apresAction;
    this.signaler = signaler;

    const element = (id) => document.getElementById(id);
    const brancher = (id, action) =>
      element(id).addEventListener('click', () => {
        element(id).closest('[popover]')?.hidePopover();
        action();
      });
    brancher('bouton-recopier-bas', () => this.recopier('bas'));
    brancher('bouton-recopier-droite', () => this.recopier('droite'));
    brancher('bouton-effacer', () => this.effacer());
    brancher('inserer-lignes-dessus', () => this.inserer('lignes', 'avant'));
    brancher('inserer-lignes-dessous', () => this.inserer('lignes', 'apres'));
    brancher('inserer-colonnes-gauche', () => this.inserer('colonnes', 'avant'));
    brancher('inserer-colonnes-droite', () => this.inserer('colonnes', 'apres'));
    brancher('supprimer-lignes', () => this.supprimer('lignes'));
    brancher('supprimer-colonnes', () => this.supprimer('colonnes'));

    // Les textes des panneaux décrivent ce qui va se passer (ex. « Supprimer les lignes 3 à 5 »).
    element('panneau-inserer').addEventListener('beforetoggle', (e) => {
      if (e.newState === 'open') this.#libellerInsertion();
    });
    element('panneau-supprimer').addEventListener('beforetoggle', (e) => {
      if (e.newState === 'open') this.#libellerSuppression();
    });
  }

  get feuille() {
    return this.classeur.feuilleActive;
  }

  // --- Recopie --------------------------------------------------------------------

  /**
   * Recopie vers le bas (ou vers la droite), comme Ctrl+D (Ctrl+R) dans Excel :
   *   - une seule ligne sélectionnée : la ligne du dessus y est recopiée ;
   *   - sinon, les premières lignes remplies de la sélection sont recopiées
   *     dans les lignes vides qui suivent (une suite 1, 2 continue : 3, 4…) ;
   *   - si toute la sélection est remplie, la première ligne est recopiée partout.
   */
  recopier(direction) {
    this.avantAction();
    const vertical = direction === 'bas';
    const zone = this.selection.plage;
    const { debut, fin } = zone;
    const taille = vertical ? fin.ligne - debut.ligne + 1 : fin.colonne - debut.colonne + 1;
    let source;
    let nombre;
    if (taille === 1) {
      // Une seule ligne (ou colonne) : on prend celle d'avant.
      if ((vertical ? debut.ligne : debut.colonne) === 1) {
        this.signaler(vertical ? 'Rien au-dessus à recopier.' : 'Rien à gauche à recopier.');
        this.apresAction();
        return;
      }
      source = vertical
        ? creerPlage({ ligne: debut.ligne - 1, colonne: debut.colonne }, { ligne: debut.ligne - 1, colonne: fin.colonne })
        : creerPlage({ ligne: debut.ligne, colonne: debut.colonne - 1 }, { ligne: fin.ligne, colonne: debut.colonne - 1 });
      nombre = 1;
    } else {
      // Nombre de lignes (ou colonnes) remplies au début de la sélection.
      let remplies = 0;
      while (remplies < taille && !this.#fileVide(zone, vertical, remplies)) remplies++;
      if (remplies === 0) {
        this.signaler('La première ligne de la sélection est vide : rien à recopier.');
        this.apresAction();
        return;
      }
      if (remplies === taille) remplies = 1;
      source = vertical
        ? creerPlage(debut, { ligne: debut.ligne + remplies - 1, colonne: fin.colonne })
        : creerPlage(debut, { ligne: fin.ligne, colonne: debut.colonne + remplies - 1 });
      nombre = taille - remplies;
    }
    const modifications = calculerRecopie(this.feuille, source, direction, nombre);
    const resultat = vertical
      ? creerPlage(source.debut, { ligne: source.fin.ligne + nombre, colonne: source.fin.colonne })
      : creerPlage(source.debut, { ligne: source.fin.ligne, colonne: source.fin.colonne + nombre });
    this.classeur.modifierCellules(this.feuille, modifications, resultat);
    this.selection.choisirPlage(resultat);
    this.apresAction();
  }

  /** Vrai si la `rang`-ième ligne (ou colonne) de la zone ne contient rien. */
  #fileVide(zone, vertical, rang) {
    const { debut, fin } = zone;
    if (vertical) {
      for (let c = debut.colonne; c <= fin.colonne; c++) if (this.feuille.brut(adresse(debut.ligne + rang, c)) !== '') return false;
    } else {
      for (let l = debut.ligne; l <= fin.ligne; l++) if (this.feuille.brut(adresse(l, debut.colonne + rang)) !== '') return false;
    }
    return true;
  }

  /**
   * Recopie avec la poignée (à la souris) : la sélection `source` est
   * prolongée de `nombre` lignes ou colonnes dans la `direction` donnée.
   */
  recopierPoignee(source, direction, nombre) {
    if (nombre <= 0) return;
    const modifications = calculerRecopie(this.feuille, source, direction, nombre);
    const { debut, fin } = source;
    const resultat = {
      bas: creerPlage(debut, { ligne: fin.ligne + nombre, colonne: fin.colonne }),
      haut: creerPlage({ ligne: debut.ligne - nombre, colonne: debut.colonne }, fin),
      droite: creerPlage(debut, { ligne: fin.ligne, colonne: fin.colonne + nombre }),
      gauche: creerPlage({ ligne: debut.ligne, colonne: debut.colonne - nombre }, fin),
    }[direction];
    this.classeur.modifierCellules(this.feuille, modifications, resultat);
    this.selection.choisirPlage(resultat, this.selection.active);
  }

  // --- Effacer ---------------------------------------------------------------------------

  /** Vide le texte des cellules sélectionnées (la mise en forme est gardée, comme dans Excel). */
  effacer() {
    this.avantAction();
    const zone = this.selection.plage;
    const modifications = [];
    for (const adr of this.feuille.adresses()) {
      const { ligne, colonne } = lireAdresse(adr);
      if (this.feuille.brut(adr) !== '' && dansPlage(zone, ligne, colonne)) modifications.push({ adresse: adr, brut: '' });
    }
    this.classeur.modifierCellules(this.feuille, modifications, zone);
    this.apresAction();
  }

  // --- Insérer et supprimer ---------------------------------------------------------------

  /**
   * Insère autant de lignes (ou de colonnes) qu'il y en a de sélectionnées,
   * avant ou après la sélection.
   * @param {'lignes'|'colonnes'} axe
   * @param {'avant'|'apres'} ou
   */
  inserer(axe, ou) {
    this.avantAction();
    const zone = this.selection.plage;
    const { lignes, colonnes } = taillePlage(zone);
    const nombre = axe === 'lignes' ? lignes : colonnes;
    const position = axe === 'lignes' ? (ou === 'avant' ? zone.debut.ligne : zone.fin.ligne + 1) : ou === 'avant' ? zone.debut.colonne : zone.fin.colonne + 1;
    const resultat = this.classeur.inserer(this.feuille, axe, position, nombre, zone);
    if (!resultat.ok) {
      this.signaler(resultat.message, true);
    } else {
      // Les lignes (ou colonnes) insérées sont sélectionnées.
      const nouvelle =
        axe === 'lignes'
          ? creerPlage({ ligne: position, colonne: zone.debut.colonne }, { ligne: position + nombre - 1, colonne: zone.fin.colonne })
          : creerPlage({ ligne: zone.debut.ligne, colonne: position }, { ligne: zone.fin.ligne, colonne: position + nombre - 1 });
      this.selection.choisirPlage(nouvelle);
      this.signaler(this.#texteNombre(axe, nombre, 'insérée'));
    }
    this.apresAction();
  }

  /** Supprime les lignes (ou les colonnes) de la sélection. */
  supprimer(axe) {
    this.avantAction();
    const zone = this.selection.plage;
    const { lignes, colonnes } = taillePlage(zone);
    const nombre = axe === 'lignes' ? lignes : colonnes;
    const position = axe === 'lignes' ? zone.debut.ligne : zone.debut.colonne;
    this.classeur.supprimer(this.feuille, axe, position, nombre, zone);
    this.selection.choisirPlage(zone);
    this.signaler(this.#texteNombre(axe, nombre, 'supprimée'));
    this.apresAction();
  }

  #texteNombre(axe, nombre, participe) {
    const nom = axe === 'lignes' ? 'ligne' : 'colonne';
    return nombre > 1 ? `${nombre} ${nom}s ${participe}s.` : `${nom[0].toUpperCase()}${nom.slice(1)} ${participe}.`;
  }

  /**
   * Ce que couvre la sélection : 'colonnes' si des colonnes entières sont
   * sélectionnées (clic sur A, B…), 'lignes' pour des lignes entières (clic
   * sur 1, 2…), 'tout' pour toute la feuille, sinon null.
   */
  #entieres() {
    const { debut, fin } = this.selection.plage;
    const colonnesEntieres = debut.ligne === 1 && fin.ligne === this.feuille.lignes;
    const lignesEntieres = debut.colonne === 1 && fin.colonne === this.feuille.colonnes;
    if (colonnesEntieres && lignesEntieres) return 'tout';
    if (colonnesEntieres) return 'colonnes';
    if (lignesEntieres) return 'lignes';
    return null;
  }

  /**
   * Colonnes entières sélectionnées : seuls les choix « colonnes » sont
   * proposés (et inversement pour des lignes entières). On évite ainsi
   * d'insérer 100 lignes, ou de supprimer toutes les lignes, par erreur.
   */
  #montrerChoix(idsLignes, idsColonnes) {
    const entieres = this.#entieres();
    for (const id of idsLignes) document.getElementById(id).hidden = entieres === 'colonnes';
    for (const id of idsColonnes) document.getElementById(id).hidden = entieres === 'lignes';
  }

  #libellerInsertion() {
    this.#montrerChoix(['inserer-lignes-dessus', 'inserer-lignes-dessous'], ['inserer-colonnes-gauche', 'inserer-colonnes-droite']);
    const { lignes, colonnes } = taillePlage(this.selection.plage);
    const texte = (id, nombre, singulier, pluriel, ou) => {
      document.getElementById(id).textContent = nombre > 1 ? `${nombre} ${pluriel} ${ou}` : `${singulier} ${ou}`;
    };
    texte('inserer-lignes-dessus', lignes, 'Ligne', 'lignes', 'au-dessus');
    texte('inserer-lignes-dessous', lignes, 'Ligne', 'lignes', 'en dessous');
    texte('inserer-colonnes-gauche', colonnes, 'Colonne', 'colonnes', 'à gauche');
    texte('inserer-colonnes-droite', colonnes, 'Colonne', 'colonnes', 'à droite');
  }

  #libellerSuppression() {
    this.#montrerChoix(['supprimer-lignes'], ['supprimer-colonnes']);
    const { debut, fin } = this.selection.plage;
    document.getElementById('supprimer-lignes').textContent =
      debut.ligne === fin.ligne ? `Supprimer la ligne ${debut.ligne}` : `Supprimer les lignes ${debut.ligne} à ${fin.ligne}`;
    const premiere = lettresColonne(debut.colonne);
    const derniere = lettresColonne(fin.colonne);
    document.getElementById('supprimer-colonnes').textContent =
      debut.colonne === fin.colonne ? `Supprimer la colonne ${premiere}` : `Supprimer les colonnes ${premiere} à ${derniere}`;
  }
}

