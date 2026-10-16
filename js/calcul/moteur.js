// (b) LE CALCUL DES FORMULES
//
// Le moteur de calcul lit le texte des cellules (dans le classeur), calcule
// la valeur de chacune et la garde en mémoire. Il ne s'occupe pas de
// l'affichage : il annonce seulement quelles cellules ont changé de valeur.
//
// Recalcul automatique :
//   1. pour chaque formule, on note les cellules et plages qu'elle utilise
//      (ses « précédents ») grâce à l'analyseur de la bibliothèque ;
//   2. quand une cellule change, on cherche toutes les formules qui en
//      dépendent, directement ou en cascade ;
//   3. on les recalcule dans le bon ordre (une formule après celles dont elle
//      a besoin). S'il reste des formules qui s'attendent les unes les autres,
//      c'est une boucle : elles affichent #CIRC!.
//
// Pour les futurs graphiques : `valeursPlage("A1:B10")` donne les valeurs
// d'une plage, et `abonner()` prévient à chaque changement de valeur.

import { adresse, dansPlage, lireAdresse, lirePlage } from '../donnees/adresses.js';
import { interpreterSaisie } from '../donnees/saisie.js';
import { COLONNES_MAX, LIGNES_MAX } from '../donnees/classeur.js';
import { bibliothequeFormules } from './bibliotheque.js';
import { ErreurCalcul } from './erreurs.js';
import { completerFonctions } from './fonctions.js';
import { nomsInconnus, traduireFormule } from './traduction.js';

export class MoteurCalcul {
  #feuille;
  #bibliotheque;
  #parseur; // calcule une formule
  #analyseur; // trouve les cellules utilisées par une formule
  /** @type {Map<string, *>} adresse → valeur calculée (cellules non vides seulement) */
  #valeurs = new Map();
  /** @type {Map<string, {traduite: string, inconnus: string[], cellules: string[], plages: object[]}>} formules de la feuille */
  #formules = new Map();
  /** @type {Map<string, Set<string>>} adresse → formules qui l'utilisent directement */
  #dependants = new Map();
  /** @type {Set<string>} formules qui utilisent au moins une plage (A1:B5) */
  #formulesAvecPlages = new Set();
  #abonnes = new Set();

  /**
   * @param {import('../donnees/classeur.js').Classeur} classeur
   * @param {import('../donnees/classeur.js').Feuille} feuille
   * @param {object} [options]
   * @param {Function} [options.FormulaParser]  la bibliothèque (par défaut, la variable globale)
   */
  constructor(classeur, feuille, { FormulaParser = bibliothequeFormules() } = {}) {
    this.#feuille = feuille;
    this.#bibliotheque = FormulaParser;
    this.#parseur = new FormulaParser({
      onCell: (reference) => this.#lireCellule(reference),
      onRange: (reference) => this.#lirePlage(reference),
      // Les « noms » (plages nommées) ne sont pas gérés : ils donnent #NOM?.
      onVariable: () => null,
    });
    completerFonctions(this.#parseur, FormulaParser);
    this.#analyseur = new FormulaParser.DepParser();

    classeur.abonner((evenement) => {
      if (evenement.feuille !== feuille) return;
      if (evenement.type === 'cellules' && evenement.contenus.length) this.recalculer(evenement.contenus);
      else if (evenement.type === 'feuille') this.toutRecalculer();
    });
    this.toutRecalculer();
  }

  /** S'abonne aux changements de valeurs : fonction({ type: 'valeurs', adresses }). */
  abonner(fonction) {
    this.#abonnes.add(fonction);
    return () => this.#abonnes.delete(fonction);
  }

  // --- Lecture des résultats ------------------------------------------------------

  /** Valeur d'une cellule : nombre, texte, booléen, ErreurCalcul, ou null si elle est vide. */
  valeur(adr) {
    return this.#valeurs.get(adr) ?? null;
  }

  /** Vrai si la cellule contient une formule. */
  estFormule(adr) {
    return this.#formules.has(adr);
  }

  /**
   * Valeurs d'une plage, ligne par ligne (tableau de tableaux).
   * Prévu pour les graphiques : valeursPlage("A1:B10").
   */
  valeursPlage(plage) {
    const zone = typeof plage === 'string' ? lirePlage(plage) : plage;
    if (!zone) return [];
    const lignes = [];
    for (let l = zone.debut.ligne; l <= zone.fin.ligne; l++) {
      const ligne = [];
      for (let c = zone.debut.colonne; c <= zone.fin.colonne; c++) ligne.push(this.valeur(adresse(l, c)));
      lignes.push(ligne);
    }
    return lignes;
  }

  /**
   * Résumé des nombres d'une plage (pour la barre d'état) :
   * { remplies, nombres, somme, moyenne, min, max }.
   */
  resumer(plage) {
    let remplies = 0;
    let nombres = 0;
    let somme = 0;
    let min = Infinity;
    let max = -Infinity;
    for (const [adr, valeur] of this.#valeurs) {
      const { ligne, colonne } = lireAdresse(adr);
      if (!dansPlage(plage, ligne, colonne)) continue;
      remplies++;
      if (typeof valeur === 'number') {
        nombres++;
        somme += valeur;
        min = Math.min(min, valeur);
        max = Math.max(max, valeur);
      }
    }
    return { remplies, nombres, somme, moyenne: nombres ? somme / nombres : null, min, max };
  }

  // --- Recalcul -----------------------------------------------------------------

  /** Recalcule toute la feuille (au chargement d'un classeur). */
  toutRecalculer() {
    const anciennes = [...this.#valeurs.keys()];
    this.#valeurs.clear();
    this.#formules.clear();
    this.#dependants.clear();
    this.#formulesAvecPlages.clear();
    const adresses = this.#feuille.adresses();
    for (const adr of adresses) this.#enregistrer(adr);
    this.#calculer(new Set(this.#formules.keys()));
    this.#annoncer([...new Set([...anciennes, ...adresses])]);
  }

  /** Recalcule après la modification du texte de certaines cellules. */
  recalculer(adressesModifiees) {
    for (const adr of adressesModifiees) this.#enregistrer(adr);
    const aRecalculer = this.#dependantsDe(adressesModifiees);
    this.#calculer(aRecalculer);
    this.#annoncer([...new Set([...adressesModifiees, ...aRecalculer])]);
  }

  #annoncer(adresses) {
    if (adresses.length === 0) return;
    for (const fonction of this.#abonnes) fonction({ type: 'valeurs', adresses });
  }

  /** Lit le texte d'une cellule et met à jour sa valeur (constante) ou sa formule. */
  #enregistrer(adr) {
    this.#oublierFormule(adr);
    const saisie = interpreterSaisie(this.#feuille.brut(adr));
    if (saisie.type === 'formule') {
      const traduite = traduireFormule(saisie.formule);
      const inconnus = nomsInconnus(saisie.formule);
      const { cellules, plages } = this.#analyser(traduite, adr);
      this.#formules.set(adr, { traduite, inconnus, cellules, plages });
      for (const precedent of cellules) {
        if (!this.#dependants.has(precedent)) this.#dependants.set(precedent, new Set());
        this.#dependants.get(precedent).add(adr);
      }
      if (plages.length) this.#formulesAvecPlages.add(adr);
      this.#valeurs.delete(adr); // calculée ensuite
    } else if (saisie.type === 'vide') {
      this.#valeurs.delete(adr);
    } else {
      this.#valeurs.set(adr, saisie.valeur);
    }
  }

  #oublierFormule(adr) {
    const formule = this.#formules.get(adr);
    if (!formule) return;
    for (const precedent of formule.cellules) {
      const ensemble = this.#dependants.get(precedent);
      ensemble?.delete(adr);
      if (ensemble?.size === 0) this.#dependants.delete(precedent);
    }
    this.#formulesAvecPlages.delete(adr);
    this.#formules.delete(adr);
  }

  /** Cellules et plages utilisées par une formule (déjà traduite). */
  #analyser(traduite, adr) {
    const cellules = [];
    const plages = [];
    if (!traduite.trim()) return { cellules, plages };
    const { ligne, colonne } = lireAdresse(adr);
    let references = [];
    try {
      // `true` : en cas de formule mal écrite, on garde ce qui a pu être lu.
      references = this.#analyseur.parse(traduite, { sheet: this.#feuille.nom, row: ligne, col: colonne }, true);
    } catch {
      references = [];
    }
    for (const reference of references) {
      if (reference.from) {
        plages.push({
          debut: { ligne: reference.from.row, colonne: reference.from.col },
          fin: { ligne: reference.to.row, colonne: reference.to.col },
        });
      } else {
        cellules.push(adresse(reference.row, reference.col));
      }
    }
    return { cellules, plages };
  }

  /** Toutes les formules à recalculer quand ces cellules changent (en cascade). */
  #dependantsDe(adressesModifiees) {
    const resultat = new Set();
    for (const adr of adressesModifiees) if (this.#formules.has(adr)) resultat.add(adr);
    const aVisiter = [...adressesModifiees];
    while (aVisiter.length) {
      const adr = aVisiter.pop();
      const ajouter = (formule) => {
        if (resultat.has(formule)) return;
        resultat.add(formule);
        aVisiter.push(formule);
      };
      for (const formule of this.#dependants.get(adr) ?? []) ajouter(formule);
      const { ligne, colonne } = lireAdresse(adr);
      for (const formule of this.#formulesAvecPlages) {
        if (!resultat.has(formule) && this.#formules.get(formule).plages.some((p) => dansPlage(p, ligne, colonne))) {
          ajouter(formule);
        }
      }
    }
    return resultat;
  }

  /**
   * Calcule les formules données, chacune après celles dont elle dépend
   * (« tri topologique »). Celles qui restent bloquées forment une boucle.
   */
  #calculer(formules) {
    const attentes = new Map(); // formule → nombre de précédents pas encore calculés
    const suivantes = new Map(); // formule → formules qui l'attendent
    const lien = (precedent, formule) => {
      attentes.set(formule, attentes.get(formule) + 1);
      if (!suivantes.has(precedent)) suivantes.set(precedent, []);
      suivantes.get(precedent).push(formule);
    };
    const positions = new Map([...formules].map((adr) => [adr, lireAdresse(adr)]));
    for (const adr of formules) attentes.set(adr, 0);
    for (const adr of formules) {
      const { cellules, plages } = this.#formules.get(adr);
      for (const precedent of cellules) if (formules.has(precedent)) lien(precedent, adr);
      for (const plage of plages) {
        for (const [autre, position] of positions) {
          if (dansPlage(plage, position.ligne, position.colonne)) lien(autre, adr);
        }
      }
    }

    const pretes = [...formules].filter((adr) => attentes.get(adr) === 0);
    while (pretes.length) {
      const adr = pretes.pop();
      this.#valeurs.set(adr, this.#evaluer(adr));
      attentes.delete(adr);
      for (const suivante of suivantes.get(adr) ?? []) {
        const reste = attentes.get(suivante) - 1;
        attentes.set(suivante, reste);
        if (reste === 0) pretes.push(suivante);
      }
    }
    // Formules jamais prêtes : elles dépendent d'elles-mêmes (boucle).
    for (const adr of attentes.keys()) this.#valeurs.set(adr, new ErreurCalcul('#CIRC!'));
  }

  /** Calcule une formule avec la bibliothèque. */
  #evaluer(adr) {
    const { traduite, inconnus } = this.#formules.get(adr);
    if (!traduite.trim()) return new ErreurCalcul('#ERROR!');
    if (inconnus.length) {
      return new ErreurCalcul('#NAME?', `« ${inconnus[0]} » n’est ni une cellule ni une fonction connue.`);
    }
    const { ligne, colonne } = lireAdresse(adr);
    try {
      const resultat = this.#parseur.parse(traduite, { sheet: this.#feuille.nom, row: ligne, col: colonne });
      return this.#depuisBibliotheque(resultat);
    } catch (exception) {
      return this.#erreurDepuisException(exception);
    }
  }

  // --- Échanges avec la bibliothèque --------------------------------------------

  /** Valeur d'une cellule demandée par la bibliothèque pendant un calcul. */
  #lireCellule({ row, col }) {
    if (row > LIGNES_MAX || col > COLONNES_MAX) return this.#bibliotheque.FormulaError.REF;
    return this.#versBibliotheque(this.#valeurs.get(adresse(row, col)));
  }

  /** Valeurs d'une plage demandées par la bibliothèque (tableau de lignes). */
  #lirePlage({ from, to }) {
    const { MAX_ROW, MAX_COLUMN, FormulaError } = this.#bibliotheque;
    // Colonne entière (A:A) ou ligne entière (1:1) : limitée à la taille de la feuille.
    const derniereLigne = to.row === MAX_ROW ? this.#feuille.lignes : to.row;
    const derniereColonne = to.col === MAX_COLUMN ? this.#feuille.colonnes : to.col;
    if (derniereLigne > LIGNES_MAX || derniereColonne > COLONNES_MAX) throw FormulaError.REF;
    const lignes = [];
    for (let l = from.row; l <= derniereLigne; l++) {
      const ligne = [];
      for (let c = from.col; c <= derniereColonne; c++) ligne.push(this.#versBibliotheque(this.#valeurs.get(adresse(l, c))));
      lignes.push(ligne);
    }
    return lignes.length ? lignes : [[null]];
  }

  /** Nos valeurs → valeurs de la bibliothèque (une erreur devient une FormulaError). */
  #versBibliotheque(valeur) {
    if (valeur === undefined) return null;
    if (valeur instanceof ErreurCalcul) return new this.#bibliotheque.FormulaError(valeur.code);
    return valeur;
  }

  /** Résultat de la bibliothèque → valeur de cellule. */
  #depuisBibliotheque(resultat) {
    const { FormulaError } = this.#bibliotheque;
    if (resultat instanceof FormulaError) return this.#erreur(resultat);
    if (Array.isArray(resultat)) return this.#depuisBibliotheque(resultat[0]?.[0] ?? null);
    if (resultat === null || resultat === undefined) return 0; // =A1 avec A1 vide donne 0, comme Excel
    if (typeof resultat === 'number') {
      if (Number.isNaN(resultat)) return new ErreurCalcul('#VALUE!');
      if (!Number.isFinite(resultat)) return new ErreurCalcul('#NUM!');
      return resultat + 0; // -0 devient 0
    }
    if (typeof resultat === 'string' || typeof resultat === 'boolean') return resultat;
    return new ErreurCalcul('#VALUE!');
  }

  /** Une exception pendant le calcul : formule mal écrite, fonction inconnue… */
  #erreurDepuisException(exception) {
    const { FormulaError } = this.#bibliotheque;
    if (exception instanceof FormulaError) {
      // La bibliothèque emballe souvent l'erreur d'origine dans « details ».
      if (exception.details instanceof FormulaError) return this.#erreur(exception.details);
      return this.#erreur(exception);
    }
    return new ErreurCalcul('#ERROR!');
  }

  /** FormulaError → ErreurCalcul, avec une précision en français quand c'est utile. */
  #erreur(erreurBibliotheque) {
    const message = erreurBibliotheque.message ?? '';
    const inconnue = /Function (\S+) is not implemented/.exec(message);
    if (inconnue) return new ErreurCalcul('#NAME?', `La fonction ${inconnue[1]} n’existe pas dans Tableur.`);
    const tropArguments = /Function (\S+) has too many arguments/.exec(message);
    if (tropArguments) return new ErreurCalcul('#N/A', `Trop d’arguments pour la fonction ${tropArguments[1]}.`);
    if (/is missing/.test(message)) return new ErreurCalcul('#N/A', 'Il manque un argument à une fonction.');
    if (erreurBibliotheque.error === '#ERROR!') return new ErreurCalcul('#ERROR!');
    return new ErreurCalcul(erreurBibliotheque.error);
  }
}
