// Compléments à la bibliothèque de formules.
//
// fast-formula-parser 1.0.19 sait lire toutes les formules, mais certaines
// fonctions manquent ou ne se comportent pas comme dans Excel en français :
//   - MIN, MAX, MAJUSCULE (UPPER) et NBVAL (COUNTA) n'y sont pas écrites ;
//   - MOYENNE d'une plage sans aucun nombre donne #VALEUR! au lieu de #DIV/0! ;
//   - SOMME, MOYENNE… ignorent une cellule en erreur au lieu de signaler l'erreur ;
//   - NB.SI(A1:A9;">5") compte aussi les cellules de texte ;
//   - RECHERCHEV distingue les majuscules (« POMME » ≠ « pomme ») ;
//   - CONCATENER et « & » écrivent 2.5 et TRUE au lieu de 2,5 et VRAI ;
//   - les comparaisons de texte distinguent les majuscules (="a"="A" donne FAUX).
// On complète donc la bibliothèque par son mécanisme prévu pour cela
// (ajout ou remplacement de fonctions), sans modifier son fichier.
//
// Deux fonctions « internes » servent à la traduction des formules (voir
// traduction.js) : TABLEUR.CONCAT remplace l'opérateur « & », et
// TABLEUR.COMPARER remplace les comparaisons (=, <>, <, >, <=, >=).

import { serieAujourdhui } from '../donnees/saisie.js';
import { comparer, creerCritere, ordre, texteDe, textesEgaux } from './comparaisons.js';

/**
 * Ajoute ou remplace des fonctions dans un « parseur » de la bibliothèque.
 * @param {object} parseur  instance de FormulaParser
 * @param {Function} FormulaParser  la bibliothèque elle-même
 */
export function completerFonctions(parseur, FormulaParser) {
  const { FormulaHelpers: aide, Types, FormulaError } = FormulaParser;
  const estErreur = (valeur) => valeur instanceof FormulaError;

  /**
   * Rassemble les nombres des arguments, en suivant les règles d'Excel :
   * dans une plage ou une cellule, seuls les nombres comptent (le texte et
   * les cellules vides sont ignorés) ; un argument écrit directement dans la
   * formule est converti en nombre ("3" → 3, VRAI → 1) ou donne #VALEUR!.
   */
  const nombres = (parametres) => {
    const liste = [];
    aide.flattenParams(parametres, Types.NUMBER, true, (valeur) => {
      if (typeof valeur === 'number') liste.push(valeur);
    });
    return liste;
  };

  /** Toutes les valeurs d'un argument (plage → liste de ses cellules, ligne par ligne). */
  const valeursDe = (parametre) => {
    const valeur = parametre?.value;
    if (!Array.isArray(valeur)) return [valeur ?? null];
    return valeur.flatMap((ligne) => (Array.isArray(ligne) ? ligne : [ligne]));
  };

  /** Une seule valeur (la première cellule si c'est une plage). */
  const valeurSimple = (parametre) => valeursDe(parametre)[0] ?? null;

  /** Première erreur trouvée dans les arguments (cellule ou plage en erreur), ou null. */
  const premiereErreur = (parametres) => {
    for (const parametre of parametres) {
      for (const valeur of valeursDe(parametre)) if (estErreur(valeur)) return valeur;
    }
    return null;
  };

  /** Fait remonter l'erreur d'une cellule au lieu de l'ignorer (comme Excel). */
  const avecErreurs =
    (fonction) =>
    (...parametres) => {
      const erreur = premiereErreur(parametres);
      if (erreur) throw erreur;
      return fonction(...parametres);
    };

  const f = parseur.functions;

  // La bibliothèque appelle certaines de ses fonctions d'une façon spéciale
  // (cellules vides changées en 0, références au lieu des valeurs…). Nos
  // versions de ces fonctions reçoivent simplement les valeurs.
  const remplacees = ['COUNTIF', 'SUMIF', 'AVERAGEIF', 'VLOOKUP', 'TODAY'];
  for (const liste of ['funsNullAs0', 'funsNeedContext', 'funsNeedContextAndNoDataRetrieve']) {
    if (Array.isArray(parseur[liste])) parseur[liste] = parseur[liste].filter((nom) => !remplacees.includes(nom));
  }

  // --- Calcul ---------------------------------------------------------------------

  f.MIN = avecErreurs((...parametres) => {
    const liste = nombres(parametres);
    return liste.length ? liste.reduce((a, b) => Math.min(a, b)) : 0;
  });

  f.MAX = avecErreurs((...parametres) => {
    const liste = nombres(parametres);
    return liste.length ? liste.reduce((a, b) => Math.max(a, b)) : 0;
  });

  f.AVERAGE = avecErreurs((...parametres) => {
    const liste = nombres(parametres);
    if (liste.length === 0) throw FormulaError.DIV0;
    return liste.reduce((somme, valeur) => somme + valeur, 0) / liste.length;
  });

  f.SUM = avecErreurs(f.SUM);
  f.PRODUCT = avecErreurs(f.PRODUCT);

  /** NBVAL : nombre de cellules non vides (texte, nombres, VRAI/FAUX, erreurs). */
  f.COUNTA = (...parametres) => {
    let total = 0;
    for (const parametre of parametres) {
      for (const valeur of valeursDe(parametre)) if (valeur !== null && valeur !== undefined && valeur !== '') total++;
    }
    return total;
  };

  // --- Conditions -------------------------------------------------------------------

  /** NB.SI(plage ; critère) : nombre de cellules qui respectent le critère. */
  f.COUNTIF = (plage, critere) => {
    if (critere === undefined) throw FormulaError.NA;
    const valeurCritere = valeurSimple(critere);
    if (estErreur(valeurCritere)) return valeurCritere;
    const respecte = creerCritere(valeurCritere);
    return valeursDe(plage).filter((valeur) => !estErreur(valeur) && respecte(valeur)).length;
  };

  /**
   * Parcourt les cellules de `plage` qui respectent le critère et donne, pour
   * chacune, la cellule correspondante de `plageCalcul` (même position).
   */
  const correspondances = (plage, critere, plageCalcul) => {
    const valeurCritere = valeurSimple(critere);
    if (estErreur(valeurCritere)) throw valeurCritere;
    const respecte = creerCritere(valeurCritere);
    const lignes = Array.isArray(plage.value) ? plage.value : [[plage.value]];
    const lignesCalcul = plageCalcul ? (Array.isArray(plageCalcul.value) ? plageCalcul.value : [[plageCalcul.value]]) : lignes;
    const trouvees = [];
    lignes.forEach((ligne, i) => {
      (Array.isArray(ligne) ? ligne : [ligne]).forEach((valeur, j) => {
        if (!estErreur(valeur) && respecte(valeur)) trouvees.push(lignesCalcul[i]?.[j] ?? null);
      });
    });
    return trouvees;
  };

  /** SOMME.SI(plage ; critère ; [plage à additionner]). */
  f.SUMIF = (plage, critere, plageSomme) => {
    if (critere === undefined) throw FormulaError.NA;
    let somme = 0;
    for (const valeur of correspondances(plage, critere, plageSomme)) {
      if (estErreur(valeur)) return valeur;
      if (typeof valeur === 'number') somme += valeur;
    }
    return somme;
  };

  /** MOYENNE.SI(plage ; critère ; [plage pour la moyenne]). */
  f.AVERAGEIF = (plage, critere, plageMoyenne) => {
    if (critere === undefined) throw FormulaError.NA;
    const liste = [];
    for (const valeur of correspondances(plage, critere, plageMoyenne)) {
      if (estErreur(valeur)) return valeur;
      if (typeof valeur === 'number') liste.push(valeur);
    }
    if (liste.length === 0) return FormulaError.DIV0;
    return liste.reduce((a, b) => a + b, 0) / liste.length;
  };

  // --- Texte --------------------------------------------------------------------------

  /** Assemble des textes (CONCATENER, et l'opérateur « & »), à la française. */
  const assembler = (...parametres) => {
    let texte = '';
    for (const parametre of parametres) {
      for (const valeur of valeursDe(parametre)) {
        if (estErreur(valeur)) return valeur;
        texte += texteDe(valeur);
      }
    }
    return texte;
  };
  f.CONCATENATE = assembler;
  f['TABLEUR.CONCAT'] = assembler;

  /** MAJUSCULE et MINUSCULE (avec les accents : « é » → « É »). */
  const changerCasse = (majuscules) => (parametre) => {
    if (parametre === undefined) throw FormulaError.NA;
    const valeur = valeurSimple(parametre);
    if (estErreur(valeur)) return valeur;
    const texte = texteDe(valeur);
    return majuscules ? texte.toLocaleUpperCase('fr') : texte.toLocaleLowerCase('fr');
  };
  f.UPPER = changerCasse(true);
  f.LOWER = changerCasse(false);

  // --- Comparaisons ---------------------------------------------------------------------

  /** TABLEUR.COMPARER(a ; "opérateur" ; b) : remplace =, <>, <, >, <=, >= dans les formules. */
  f['TABLEUR.COMPARER'] = (a, operateur, b) => {
    const gauche = valeurSimple(a);
    const droite = valeurSimple(b);
    if (estErreur(gauche)) return gauche;
    if (estErreur(droite)) return droite;
    return comparer(gauche, valeurSimple(operateur), droite);
  };

  // --- Date -----------------------------------------------------------------------------

  /** AUJOURDHUI() : la date du jour (nombre de jours depuis le 30/12/1899). */
  f.TODAY = () => serieAujourdhui();

  // --- Recherche ------------------------------------------------------------------------

  /**
   * RECHERCHEV(valeur cherchée ; tableau ; n° de colonne ; [valeur proche])
   *   - valeur proche = FAUX : cherche exactement la valeur dans la première
   *     colonne (majuscules ignorées, jokers * et ? permis pour le texte) ;
   *   - valeur proche = VRAI (par défaut) : la première colonne doit être triée
   *     par ordre croissant ; on prend la dernière ligne inférieure ou égale.
   * Renvoie la valeur de la colonne demandée sur la ligne trouvée, ou #N/A.
   */
  f.VLOOKUP = (cherche, tableau, colonne, proche) => {
    if (colonne === undefined) throw FormulaError.NA;
    const valeur = valeurSimple(cherche);
    if (estErreur(valeur)) return valeur;
    const lignes = Array.isArray(tableau.value) ? tableau.value : [[tableau.value]];
    const numero = Math.trunc(Number(valeurSimple(colonne)));
    if (!Number.isFinite(numero) || numero < 1) return FormulaError.VALUE;
    if (numero > (lignes[0]?.length ?? 0)) return FormulaError.REF;
    const modeProche = proche === undefined ? true : Boolean(valeurSimple(proche));

    let trouvee = -1;
    if (!modeProche) {
      trouvee = lignes.findIndex((ligne) => {
        const premiere = ligne[0];
        if (typeof valeur === 'string' && typeof premiere === 'string') return textesEgaux(valeur, premiere);
        return premiere !== null && typeof premiere === typeof valeur && ordre(premiere, valeur) === 0;
      });
    } else {
      // Première colonne triée : on avance tant que les valeurs restent ≤ à la valeur cherchée.
      for (let i = 0; i < lignes.length; i++) {
        const premiere = lignes[i][0];
        if (premiere === null || typeof premiere !== typeof valeur) continue;
        if (ordre(premiere, valeur) <= 0) trouvee = i;
        else break;
      }
    }
    if (trouvee < 0) return FormulaError.NA;
    return lignes[trouvee][numero - 1] ?? 0;
  };
}
