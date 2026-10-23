// (b) LE CALCUL DES FORMULES
//
// Le moteur de calcul lit le texte des cellules (dans le classeur), calcule
// la valeur de chacune et la garde en mémoire. Il ne s'occupe pas de
// l'affichage : il annonce seulement quelles cellules ont changé de valeur.
//
// Il connaît toutes les feuilles du classeur : une formule peut utiliser une
// cellule d'une autre feuille (=Feuille2!A1, ='Mes ventes'!B2:B10).
//
// Recalcul automatique :
//   1. pour chaque formule, on note les cellules et plages qu'elle utilise
//      (ses « précédents ») grâce à l'analyseur de la bibliothèque ;
//   2. quand une cellule change, on cherche toutes les formules qui en
//      dépendent, directement ou en cascade (même sur d'autres feuilles) ;
//   3. on les recalcule dans le bon ordre (une formule après celles dont elle
//      a besoin). S'il reste des formules qui s'attendent les unes les autres,
//      c'est une boucle : elles affichent #CIRC!.
//
// Chaque cellule est repérée par une « clé » : numéro de sa feuille + adresse
// (ex. « 2:B3 »), car le nom d'une feuille peut changer.
//
// Pour les futurs graphiques : `valeursPlage(feuille, "A1:B10")` donne les
// valeurs d'une plage, et `abonner()` prévient à chaque changement de valeur.

import { COLONNES_MAX, LIGNES_MAX, adresse, dansPlage, lireAdresse, lirePlage } from '../donnees/adresses.js';
import { interpreterSaisie } from '../donnees/saisie.js';
import { bibliothequeFormules } from './bibliotheque.js';
import { ErreurCalcul } from './erreurs.js';
import { completerFonctions } from './fonctions.js';
import { nomsInconnus, traduireFormule } from './traduction.js';

/** Nombre maximal d'analyses de formules gardées en mémoire (pour aller plus vite). */
const TAILLE_CACHE = 5000;

const cle = (feuille, adr) => `${feuille.id}:${adr}`;

/** Clé → { idFeuille, adresse, ligne, colonne }. */
function lireCle(texte) {
  const separateur = texte.indexOf(':');
  const adr = texte.slice(separateur + 1);
  return { idFeuille: Number(texte.slice(0, separateur)), adresse: adr, ...lireAdresse(adr) };
}

export class MoteurCalcul {
  #classeur;
  #bibliotheque;
  #parseur; // calcule une formule
  #analyseur; // trouve les cellules utilisées par une formule
  /** @type {Map<string, *>} clé → valeur calculée (cellules non vides seulement) */
  #valeurs = new Map();
  /** @type {Map<string, {feuille: object, traduite: string, inconnus: string[], cellules: string[], plages: object[]}>} */
  #formules = new Map();
  /** @type {Map<string, Set<string>>} clé → formules qui l'utilisent directement */
  #dependants = new Map();
  /** @type {Set<string>} formules qui utilisent au moins une plage (A1:B5) */
  #formulesAvecPlages = new Set();
  /** @type {Map<string, Array>} analyses déjà faites : « feuille|formule » → références */
  #cacheAnalyses = new Map();
  #abonnes = new Set();

  /**
   * @param {import('../donnees/classeur.js').Classeur} classeur
   * @param {object} [options]
   * @param {Function} [options.FormulaParser]  la bibliothèque (par défaut, la variable globale)
   */
  constructor(classeur, { FormulaParser = bibliothequeFormules() } = {}) {
    this.#classeur = classeur;
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
      if (evenement.type === 'cellules' && evenement.contenus.length) this.recalculer(evenement.feuille, evenement.contenus);
      else if (evenement.type === 'structure') this.toutRecalculer();
    });
    this.toutRecalculer();
  }

  /** S'abonne aux changements de valeurs : fonction({ type: 'valeurs', feuille, adresses }). */
  abonner(fonction) {
    this.#abonnes.add(fonction);
    return () => this.#abonnes.delete(fonction);
  }

  // --- Lecture des résultats ------------------------------------------------------

  /** Valeur d'une cellule : nombre, texte, booléen, ErreurCalcul, ou null si elle est vide. */
  valeur(feuille, adr) {
    return this.#valeurs.get(cle(feuille, adr)) ?? null;
  }

  /** Vrai si la cellule contient une formule. */
  estFormule(feuille, adr) {
    return this.#formules.has(cle(feuille, adr));
  }

  /**
   * Valeurs d'une plage, ligne par ligne (tableau de tableaux).
   * Prévu pour les graphiques : valeursPlage(feuille, "A1:B10").
   */
  valeursPlage(feuille, plage) {
    const zone = typeof plage === 'string' ? lirePlage(plage) : plage;
    if (!zone) return [];
    const lignes = [];
    for (let l = zone.debut.ligne; l <= zone.fin.ligne; l++) {
      const ligne = [];
      for (let c = zone.debut.colonne; c <= zone.fin.colonne; c++) ligne.push(this.valeur(feuille, adresse(l, c)));
      lignes.push(ligne);
    }
    return lignes;
  }

  /**
   * Résumé des nombres d'une plage (pour la barre d'état) :
   * { remplies, nombres, somme, moyenne, min, max }.
   */
  resumer(feuille, plage) {
    let remplies = 0;
    let nombres = 0;
    let somme = 0;
    let min = Infinity;
    let max = -Infinity;
    for (const adr of feuille.adresses()) {
      const { ligne, colonne } = lireAdresse(adr);
      if (!dansPlage(plage, ligne, colonne)) continue;
      const valeur = this.valeur(feuille, adr);
      if (valeur === null) continue;
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

  /** Recalcule tout le classeur (au chargement, après une insertion de lignes, un tri…). */
  toutRecalculer() {
    const anciennes = [...this.#valeurs.keys()];
    this.#valeurs.clear();
    this.#formules.clear();
    this.#dependants.clear();
    this.#formulesAvecPlages.clear();
    const cles = [];
    for (const feuille of this.#classeur.feuilles) {
      for (const adr of feuille.adresses()) {
        const c = cle(feuille, adr);
        cles.push(c);
        this.#enregistrer(feuille, adr, c);
      }
    }
    this.#calculer(new Set(this.#formules.keys()));
    this.#annoncer(new Set([...anciennes, ...cles]));
  }

  /** Recalcule après la modification du texte de certaines cellules d'une feuille. */
  recalculer(feuille, adressesModifiees) {
    const cles = adressesModifiees.map((adr) => cle(feuille, adr));
    adressesModifiees.forEach((adr, i) => this.#enregistrer(feuille, adr, cles[i]));
    const aRecalculer = this.#dependantsDe(cles);
    this.#calculer(aRecalculer);
    this.#annoncer(new Set([...cles, ...aRecalculer]));
  }

  /** Recalcule les formules qui utilisent AUJOURDHUI() (au changement de jour). */
  recalculerVolatiles() {
    const volatiles = new Set([...this.#formules].filter(([, formule]) => /\bTODAY\s*\(/i.test(formule.traduite)).map(([c]) => c));
    if (volatiles.size === 0) return;
    const aRecalculer = this.#dependantsDe([...volatiles]);
    this.#calculer(aRecalculer);
    this.#annoncer(aRecalculer);
  }

  /** Prévient les abonnés, feuille par feuille. */
  #annoncer(cles) {
    const parFeuille = new Map();
    for (const c of cles) {
      const { idFeuille, adresse: adr } = lireCle(c);
      if (!parFeuille.has(idFeuille)) parFeuille.set(idFeuille, []);
      parFeuille.get(idFeuille).push(adr);
    }
    for (const feuille of this.#classeur.feuilles) {
      const adresses = parFeuille.get(feuille.id);
      if (!adresses?.length) continue;
      for (const fonction of this.#abonnes) fonction({ type: 'valeurs', feuille, adresses });
    }
  }

  /** Lit le texte d'une cellule et met à jour sa valeur (constante) ou sa formule. */
  #enregistrer(feuille, adr, c) {
    this.#oublierFormule(c);
    const saisie = interpreterSaisie(feuille.brut(adr));
    if (saisie.type === 'formule') {
      const traduite = traduireFormule(saisie.formule);
      const inconnus = nomsInconnus(saisie.formule);
      const { cellules, plages } = this.#analyser(traduite, feuille, adr);
      this.#formules.set(c, { feuille, traduite, inconnus, cellules, plages });
      for (const precedent of cellules) {
        if (!this.#dependants.has(precedent)) this.#dependants.set(precedent, new Set());
        this.#dependants.get(precedent).add(c);
      }
      if (plages.length) this.#formulesAvecPlages.add(c);
      this.#valeurs.delete(c); // calculée ensuite
    } else if (saisie.type === 'vide') {
      this.#valeurs.delete(c);
    } else {
      this.#valeurs.set(c, saisie.valeur);
    }
  }

  #oublierFormule(c) {
    const formule = this.#formules.get(c);
    if (!formule) return;
    for (const precedent of formule.cellules) {
      const ensemble = this.#dependants.get(precedent);
      ensemble?.delete(c);
      if (ensemble?.size === 0) this.#dependants.delete(precedent);
    }
    this.#formulesAvecPlages.delete(c);
    this.#formules.delete(c);
  }

  /** Références (cellules et plages, avec le nom de leur feuille) d'une formule déjà traduite. */
  #references(traduite, feuille, adr) {
    const cleCache = `${feuille.nom}|${traduite}`;
    const connue = this.#cacheAnalyses.get(cleCache);
    if (connue) return connue;
    const { ligne, colonne } = lireAdresse(adr);
    let references = [];
    try {
      // `true` : en cas de formule mal écrite, on garde ce qui a pu être lu.
      references = this.#analyseur.parse(traduite, { sheet: feuille.nom, row: ligne, col: colonne }, true);
    } catch {
      references = [];
    }
    if (this.#cacheAnalyses.size >= TAILLE_CACHE) this.#cacheAnalyses.clear();
    this.#cacheAnalyses.set(cleCache, references);
    return references;
  }

  /** Cellules (clés) et plages ({ idFeuille, plage }) utilisées par une formule. */
  #analyser(traduite, feuille, adr) {
    const cellules = [];
    const plages = [];
    if (!traduite.trim()) return { cellules, plages };
    for (const reference of this.#references(traduite, feuille, adr)) {
      const cible = reference.sheet ? this.#classeur.feuilleNommee(reference.sheet) : feuille;
      if (!cible) continue; // feuille inconnue : la formule affichera #REF!
      if (reference.from) {
        plages.push({
          idFeuille: cible.id,
          plage: {
            debut: { ligne: reference.from.row, colonne: reference.from.col },
            fin: { ligne: reference.to.row, colonne: reference.to.col },
          },
        });
      } else {
        cellules.push(cle(cible, adresse(reference.row, reference.col)));
      }
    }
    return { cellules, plages };
  }

  /** Toutes les formules à recalculer quand ces cellules changent (en cascade). */
  #dependantsDe(clesModifiees) {
    const resultat = new Set();
    for (const c of clesModifiees) if (this.#formules.has(c)) resultat.add(c);
    const aVisiter = [...clesModifiees];
    while (aVisiter.length) {
      const c = aVisiter.pop();
      const ajouter = (formule) => {
        if (resultat.has(formule)) return;
        resultat.add(formule);
        aVisiter.push(formule);
      };
      for (const formule of this.#dependants.get(c) ?? []) ajouter(formule);
      const { idFeuille, ligne, colonne } = lireCle(c);
      for (const formule of this.#formulesAvecPlages) {
        if (resultat.has(formule)) continue;
        const touchee = this.#formules
          .get(formule)
          .plages.some((p) => p.idFeuille === idFeuille && dansPlage(p.plage, ligne, colonne));
        if (touchee) ajouter(formule);
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
    const positions = new Map([...formules].map((c) => [c, lireCle(c)]));
    for (const c of formules) attentes.set(c, 0);
    for (const c of formules) {
      const { cellules, plages } = this.#formules.get(c);
      for (const precedent of cellules) if (formules.has(precedent)) lien(precedent, c);
      for (const { idFeuille, plage } of plages) {
        for (const [autre, position] of positions) {
          if (position.idFeuille === idFeuille && dansPlage(plage, position.ligne, position.colonne)) lien(autre, c);
        }
      }
    }

    const pretes = [...formules].filter((c) => attentes.get(c) === 0);
    while (pretes.length) {
      const c = pretes.pop();
      this.#valeurs.set(c, this.#evaluer(c));
      attentes.delete(c);
      for (const suivante of suivantes.get(c) ?? []) {
        const reste = attentes.get(suivante) - 1;
        attentes.set(suivante, reste);
        if (reste === 0) pretes.push(suivante);
      }
    }
    // Formules jamais prêtes : elles dépendent d'elles-mêmes (boucle).
    for (const c of attentes.keys()) this.#valeurs.set(c, new ErreurCalcul('#CIRC!'));
  }

  /** Calcule une formule avec la bibliothèque. */
  #evaluer(c) {
    const { feuille, traduite, inconnus } = this.#formules.get(c);
    if (!traduite.trim()) return new ErreurCalcul('#ERROR!');
    if (inconnus.length) {
      return new ErreurCalcul('#NAME?', `« ${inconnus[0]} » n’est ni une cellule ni une fonction connue.`);
    }
    const { ligne, colonne } = lireCle(c);
    try {
      const resultat = this.#parseur.parse(traduite, { sheet: feuille.nom, row: ligne, col: colonne });
      return this.#depuisBibliotheque(resultat);
    } catch (exception) {
      return this.#erreurDepuisException(exception);
    }
  }

  // --- Échanges avec la bibliothèque --------------------------------------------

  /** Feuille désignée par la bibliothèque (par son nom), ou undefined si elle n'existe pas. */
  #feuille(nom) {
    return this.#classeur.feuilleNommee(nom);
  }

  /** Valeur d'une cellule demandée par la bibliothèque pendant un calcul. */
  #lireCellule({ sheet, row, col }) {
    const feuille = this.#feuille(sheet);
    if (!feuille || row > LIGNES_MAX || col > COLONNES_MAX) return this.#bibliotheque.FormulaError.REF;
    return this.#versBibliotheque(this.#valeurs.get(cle(feuille, adresse(row, col))));
  }

  /** Valeurs d'une plage demandées par la bibliothèque (tableau de lignes). */
  #lirePlage({ sheet, from, to }) {
    const { MAX_ROW, MAX_COLUMN, FormulaError } = this.#bibliotheque;
    const feuille = this.#feuille(sheet);
    if (!feuille) throw FormulaError.REF;
    // Colonne entière (A:A) ou ligne entière (1:1) : limitée à la taille de la feuille.
    const derniereLigne = to.row === MAX_ROW ? feuille.lignes : to.row;
    const derniereColonne = to.col === MAX_COLUMN ? feuille.colonnes : to.col;
    if (derniereLigne > LIGNES_MAX || derniereColonne > COLONNES_MAX) throw FormulaError.REF;
    const lignes = [];
    for (let l = from.row; l <= derniereLigne; l++) {
      const ligne = [];
      for (let c = from.col; c <= derniereColonne; c++) ligne.push(this.#versBibliotheque(this.#valeurs.get(cle(feuille, adresse(l, c)))));
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
