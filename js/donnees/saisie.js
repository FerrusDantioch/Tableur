// Interprétation de ce que la personne tape dans une cellule.
//
// Le texte tapé (appelé « brut ») est toujours conservé tel quel : c'est lui
// qui est enregistré et réaffiché quand on modifie la cellule. Cette fonction
// en déduit seulement :
//   - le TYPE de contenu : vide, nombre, texte, booléen (VRAI/FAUX) ou formule ;
//   - la VALEUR utilisée par les calculs (ex. "3,5" → 3.5) ;
//   - le STYLE d'affichage des nombres : général, pourcentage, euros ou date.
//
// Les dates sont des nombres, comme dans Excel : le nombre de jours depuis
// le 30 décembre 1899 (le 1er janvier 2026 vaut 46023). On peut donc les
// trier, les soustraire (écart en jours) ou leur ajouter des jours.

/**
 * @typedef {object} Saisie
 * @property {'vide'|'nombre'|'texte'|'booleen'|'formule'} type
 * @property {number|string|boolean|null} valeur  valeur pour les calculs (null pour vide et formule)
 * @property {'general'|'pourcent'|'euro'|'date'} style  façon d'afficher un nombre
 * @property {string} [formule]  texte de la formule, avec le « = » (type formule seulement)
 */

// --- Dates -------------------------------------------------------------------------

const JOUR_MS = 86_400_000;
const ORIGINE = Date.UTC(1899, 11, 30); // jour 0 des dates (comme Excel)

/** (année, mois 1-12, jour) → numéro de série de la date, ou null si la date n'existe pas. */
export function serieDate(annee, mois, jour) {
  if (annee < 1900 || annee > 9999 || mois < 1 || mois > 12 || jour < 1) return null;
  const date = new Date(Date.UTC(annee, mois - 1, jour));
  if (date.getUTCMonth() !== mois - 1) return null; // 31/02 n'existe pas
  return Math.round((date.getTime() - ORIGINE) / JOUR_MS);
}

/** Numéro de série → { annee, mois, jour }. */
export function dateDepuisSerie(serie) {
  const date = new Date(ORIGINE + Math.floor(serie) * JOUR_MS);
  return { annee: date.getUTCFullYear(), mois: date.getUTCMonth() + 1, jour: date.getUTCDate() };
}

/** Numéro de série → « jj/mm/aaaa » (ex. 46023 → « 01/01/2026 »). */
export function dateVersTexte(serie) {
  const { annee, mois, jour } = dateDepuisSerie(serie);
  return `${String(jour).padStart(2, '0')}/${String(mois).padStart(2, '0')}/${annee}`;
}

/** Le numéro de série d'aujourd'hui (date de l'appareil). */
export function serieAujourdhui(maintenant = new Date()) {
  return serieDate(maintenant.getFullYear(), maintenant.getMonth() + 1, maintenant.getDate());
}

/**
 * « jj/mm/aaaa » (ou « jj/mm/aa ») → numéro de série, ou null si ce n'est
 * pas une date. Années sur deux chiffres comme Excel : 00 à 29 → 2000 à 2029,
 * 30 à 99 → 1930 à 1999.
 */
export function lireDate(texte) {
  const morceaux = /^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})$/.exec(String(texte).trim());
  if (!morceaux) return null;
  let annee = Number(morceaux[3]);
  if (morceaux[3].length === 2) annee += annee < 30 ? 2000 : 1900;
  return serieDate(annee, Number(morceaux[2]), Number(morceaux[1]));
}

// Espaces acceptés entre les milliers : espace normale, insécable, fine insécable.
const ESPACES = '[ \\u00A0\\u202F]';

// Un nombre « à la française » ou « à l'anglaise » :
//   12   -7   3,5   3.5   1 234,56   ,5   2,   1E3   1,5e-2
// Les espaces ne sont acceptées qu'entre des groupes de trois chiffres.
const MOTIF_NOMBRE = new RegExp(
  `^[+-]?(?:\\d{1,3}(?:${ESPACES}\\d{3})+|\\d+)?(?:[.,]\\d*)?(?:[eE][+-]?\\d+)?$`,
);

/**
 * Convertit un texte en nombre, ou renvoie null si ce n'est pas un nombre.
 * Exemples : "3,5" → 3.5, "1 234" → 1234, "abc" → null.
 */
export function lireNombre(texte) {
  const propre = String(texte).trim();
  // Il faut au moins un chiffre (sinon "," ou "+" seraient des nombres).
  if (!/\d/.test(propre) || !MOTIF_NOMBRE.test(propre)) return null;
  const normalise = propre.replace(new RegExp(ESPACES, 'g'), '').replace(',', '.');
  // Le motif peut s'arrêter sur un séparateur décimal seul (ex. « 2, » ou
  // « 1,E3 ») : on retire ce séparateur orphelin avant la conversion.
  const nombre = Number(normalise.replace(/\.(?=$|[eE])/, ''));
  return Number.isFinite(nombre) ? nombre : null;
}

/** Interprète le texte brut d'une cellule. */
export function interpreterSaisie(brut) {
  const texte = String(brut ?? '');
  const sansEspaces = texte.trim();

  if (sansEspaces === '') return { type: 'vide', valeur: null, style: 'general' };

  // Une apostrophe au début force le texte (comme dans Excel) : '0123 reste « 0123 ».
  if (texte.startsWith("'")) return { type: 'texte', valeur: texte.slice(1), style: 'general' };

  // Le signe « = » au début annonce une formule, calculée par le moteur de calcul.
  // Comme dans Excel, =AUJOURDHUI() ou =DATE(…) s'affichent en date.
  if (sansEspaces.startsWith('=')) {
    const style = /^=\s*(AUJOURDHUI|TODAY|DATE)\s*\(/i.test(sansEspaces) ? 'date' : 'general';
    return { type: 'formule', valeur: null, style, formule: sansEspaces };
  }

  const majuscules = sansEspaces.toUpperCase();
  if (majuscules === 'VRAI') return { type: 'booleen', valeur: true, style: 'general' };
  if (majuscules === 'FAUX') return { type: 'booleen', valeur: false, style: 'general' };

  // Pourcentage (« 20 % ») ou montant en euros (« 12,50 € »).
  const unite = /^(.*?)[   ]*([%€])$/.exec(sansEspaces);
  if (unite) {
    const nombre = lireNombre(unite[1]);
    if (nombre !== null) {
      return unite[2] === '%'
        ? { type: 'nombre', valeur: nombre / 100, style: 'pourcent' }
        : { type: 'nombre', valeur: nombre, style: 'euro' };
    }
  }

  const nombre = lireNombre(sansEspaces);
  if (nombre !== null) return { type: 'nombre', valeur: nombre, style: 'general' };

  // Date « jj/mm/aaaa » : gardée comme un nombre de jours, affichée en date.
  const date = lireDate(sansEspaces);
  if (date !== null) return { type: 'nombre', valeur: date, style: 'date' };

  return { type: 'texte', valeur: texte, style: 'general' };
}
