// Données d'un graphique : comment lire un tableau de cellules (comme Excel).
//
// Exemple : la sélection A1:C4
//          A          B        C
//   1   Mois       Courses   Loyer       ← noms des séries (pas de nombre)
//   2   janvier      120      600
//   3   février       95      600
//   4   mars          80      600
//        ↑ noms des catégories (du texte)
// donne les catégories « janvier, février, mars » et deux séries,
// « Courses » (120, 95, 80) et « Loyer » (600, 600, 600).
//
// Règles :
//   - les lignes et colonnes entièrement vides au bord sont ignorées (on peut
//     donc sélectionner des colonnes entières) ;
//   - si le tableau a plus de colonnes que de lignes, chaque LIGNE est une
//     série (les mois sont alors en titre des colonnes) ;
//   - la première colonne donne les noms des catégories si elle contient du
//     texte (ou si le coin en haut à gauche est vide, au-dessus de titres) ;
//   - la première ligne donne les noms des séries si elle ne contient aucun nombre ;
//   - dans les séries, seuls les nombres comptent (texte, case vide, erreur :
//     un trou) ; une colonne sans aucun nombre (des commentaires…) est ignorée.
//
// Ce module ne connaît ni la page ni le dessin : il reçoit des cellules
// { valeur, texte } (valeur calculée et texte affiché) et rend des nombres.

/** Types de graphiques proposés. */
export const TYPES_GRAPHIQUE = Object.freeze(['colonnes', 'courbe', 'secteurs']);

/**
 * Au-delà, le graphique serait illisible : on ne garde que le début. Sept
 * séries au plus, comme les sept couleurs bien distinctes du dessin.
 */
export const SERIES_MAX = 7;
export const CATEGORIES_MAX = 200;

/** Parts d'un camembert : au-delà de 7, les plus petites sont regroupées dans « Autres ». */
export const PARTS_MAX = 7;

const estNombre = (valeur) => typeof valeur === 'number' && Number.isFinite(valeur);
const estTexte = (valeur) => typeof valeur === 'string' && valeur.trim() !== '';
const estVide = (cellule) => cellule.valeur === null || cellule.valeur === undefined || cellule.valeur === '';

/** Retire les lignes et les colonnes entièrement vides au bord du tableau. */
function rogner(cellules) {
  const lignes = [...cellules];
  const ligneVide = (ligne) => ligne.every(estVide);
  while (lignes.length && ligneVide(lignes[0])) lignes.shift();
  while (lignes.length && ligneVide(lignes.at(-1))) lignes.pop();
  if (!lignes.length) return [];
  const largeur = Math.max(...lignes.map((ligne) => ligne.length));
  const colonneVide = (c) => lignes.every((ligne) => !ligne[c] || estVide(ligne[c]));
  let debut = 0;
  let fin = largeur - 1;
  while (debut <= fin && colonneVide(debut)) debut++;
  while (fin >= debut && colonneVide(fin)) fin--;
  const vide = { valeur: null, texte: '' };
  return lignes.map((ligne) => Array.from({ length: fin - debut + 1 }, (_, i) => ligne[debut + i] ?? vide));
}

/** Échange lignes et colonnes. */
function transposer(cellules) {
  return cellules[0].map((_, c) => cellules.map((ligne) => ligne[c]));
}

/**
 * Prépare un graphique à partir de cellules (tableau de lignes de
 * { valeur, texte }). Renvoie { ok: true, categories, series, notes } ou
 * { ok: false, message } s'il n'y a rien à dessiner.
 *   categories : noms affichés sous l'axe (ou dans la légende d'un camembert)
 *   series     : [{ nom, valeurs }] ; valeurs[i] = nombre ou null (trou)
 *   notes      : remarques à montrer (séries ou catégories laissées de côté)
 */
export function preparerGraphique(cellules) {
  let tableau = rogner(cellules);
  if (!tableau.length) return { ok: false, message: 'Les cellules choisies sont vides.' };
  if (tableau[0].length > tableau.length) tableau = transposer(tableau);
  const nbLignes = tableau.length;
  const nbColonnes = tableau[0].length;

  // Première ligne = noms des séries ? (aucun nombre, au moins un texte)
  const ligneDeTitres = (debutColonne) =>
    nbLignes > 1 && tableau[0].slice(debutColonne).every((c) => !estNombre(c.valeur)) && tableau[0].slice(debutColonne).some((c) => estTexte(c.valeur));
  let titres = ligneDeTitres(nbColonnes > 1 ? 1 : 0);
  // Première colonne = noms des catégories ?
  const debutDonnees = titres ? 1 : 0;
  const colonneTexte = tableau.slice(debutDonnees).some((ligne) => estTexte(ligne[0].valeur));
  const etiquettes = nbColonnes > 1 && (colonneTexte || (estVide(tableau[0][0]) && titres));
  if (!etiquettes) titres = ligneDeTitres(0);

  const premiereLigne = titres ? 1 : 0;
  const premiereColonne = etiquettes ? 1 : 0;
  const lignesDonnees = tableau.slice(premiereLigne);
  const notes = [];

  let categories = lignesDonnees.map((ligne, i) => (etiquettes ? ligne[0].texte : String(i + 1)));
  let series = [];
  for (let c = premiereColonne; c < nbColonnes; c++) {
    const valeurs = lignesDonnees.map((ligne) => (estNombre(ligne[c].valeur) ? ligne[c].valeur : null));
    if (valeurs.every((v) => v === null)) continue; // colonne sans nombre : ignorée
    const nom = titres && tableau[0][c].texte.trim() ? tableau[0][c].texte.trim() : `Série ${series.length + 1}`;
    series.push({ nom, valeurs });
  }
  if (!series.length) {
    return {
      ok: false,
      message: 'Aucun nombre dans les cellules choisies. Sélectionnez un tableau avec des noms dans la 1re colonne et des nombres à côté.',
    };
  }
  if (series.length > SERIES_MAX) {
    notes.push(`Seules les ${SERIES_MAX} premières séries sont montrées (sur ${series.length}).`);
    series = series.slice(0, SERIES_MAX);
  }
  if (categories.length > CATEGORIES_MAX) {
    notes.push(`Seules les ${CATEGORIES_MAX} premières lignes sont montrées (sur ${categories.length}).`);
    categories = categories.slice(0, CATEGORIES_MAX);
    series = series.map((serie) => ({ ...serie, valeurs: serie.valeurs.slice(0, CATEGORIES_MAX) }));
  }
  return { ok: true, categories, series, notes };
}

/** Arrondi qui supprime les « miettes » des calculs (0,1 + 0,2 → 0,3). */
const propre = (nombre) => Number(nombre.toPrecision(12)) + 0;

/**
 * Graduations « rondes » d'un axe qui couvre min…max et toujours 0 :
 * pas de 1, 2, 2,5 ou 5 × une puissance de 10. Exemple : 0 → 650 donne
 * 0, 200, 400, 600, 800.
 * @returns {{ debut: number, fin: number, pas: number, valeurs: number[] }}
 */
export function graduations(min, max, nombre = 5) {
  let bas = Math.min(0, min);
  let haut = Math.max(0, max);
  if (bas === haut) haut = bas + 1;
  const brut = (haut - bas) / nombre;
  const puissance = 10 ** Math.floor(Math.log10(brut));
  const pas = propre([1, 2, 2.5, 5, 10].map((m) => m * puissance).find((p) => p >= brut * 0.999));
  const debut = propre(Math.floor(bas / pas) * pas);
  const fin = propre(Math.ceil(haut / pas) * pas);
  const valeurs = [];
  for (let i = 0; propre(debut + i * pas) <= fin; i++) valeurs.push(propre(debut + i * pas));
  return { debut, fin, pas, valeurs };
}

/**
 * Parts d'un camembert : la première série seulement, nombres positifs
 * seulement (une part négative ou nulle n'a pas de sens). Au-delà de
 * PARTS_MAX parts, les plus petites sont regroupées dans « Autres ».
 * @returns {{ parts: Array<{ nom: string, valeur: number, part: number }>, notes: string[] }}
 */
export function partsSecteurs({ categories, series }) {
  const notes = [];
  if (series.length > 1) notes.push(`Un camembert ne montre qu'une série : « ${series[0].nom} ».`);
  let parts = [];
  let ignorees = 0;
  series[0].valeurs.forEach((valeur, i) => {
    if (valeur === null) return;
    if (valeur > 0) parts.push({ nom: categories[i], valeur });
    else ignorees++;
  });
  if (ignorees) notes.push(`${ignorees} valeur${ignorees > 1 ? 's' : ''} négative${ignorees > 1 ? 's' : ''} ou nulle${ignorees > 1 ? 's' : ''} laissée${ignorees > 1 ? 's' : ''} de côté.`);
  if (parts.length > PARTS_MAX) {
    const triees = [...parts].sort((a, b) => b.valeur - a.valeur);
    const gardees = new Set(triees.slice(0, PARTS_MAX - 1));
    const autres = triees.slice(PARTS_MAX - 1).reduce((somme, p) => somme + p.valeur, 0);
    parts = parts.filter((p) => gardees.has(p));
    parts.push({ nom: 'Autres', valeur: autres });
  }
  const total = parts.reduce((somme, p) => somme + p.valeur, 0);
  return { parts: parts.map((p) => ({ ...p, part: total ? p.valeur / total : 0 })), notes };
}
