// Compléments à la bibliothèque de formules.
//
// fast-formula-parser 1.0.19 sait lire toutes les formules, mais :
//   - MIN et MAX n'y sont pas encore écrites (elles renvoient « fonction inconnue ») ;
//   - MOYENNE d'une plage sans aucun nombre donne #VALEUR! au lieu de #DIV/0! ;
//   - SOMME, MOYENNE… ignorent une cellule en erreur au lieu de signaler l'erreur.
// On complète donc la bibliothèque par son mécanisme prévu pour cela
// (ajout de fonctions), sans modifier son fichier.

/**
 * Ajoute ou remplace des fonctions dans un « parseur » de la bibliothèque.
 * @param {object} parseur  instance de FormulaParser
 * @param {Function} FormulaParser  la bibliothèque elle-même
 */
export function completerFonctions(parseur, FormulaParser) {
  const { FormulaHelpers: aide, Types, FormulaError } = FormulaParser;

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

  /** Première erreur trouvée dans les arguments (cellule ou plage en erreur), ou null. */
  const premiereErreur = (parametres) => {
    for (const parametre of parametres) {
      const valeur = parametre?.value;
      if (valeur instanceof FormulaError) return valeur;
      if (Array.isArray(valeur)) {
        for (const ligne of valeur) {
          for (const element of Array.isArray(ligne) ? ligne : [ligne]) {
            if (element instanceof FormulaError) return element;
          }
        }
      }
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
}
