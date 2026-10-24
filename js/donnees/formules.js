// Le TEXTE des formules : découpage en morceaux et réécriture des références.
//
// Ce module ne calcule rien. Il sait seulement lire une formule comme
// =SOMME(A1:B3)+Feuille2!$C$1 et retrouver ses « références » (les cellules
// et plages qu'elle désigne), pour les réécrire quand :
//   - on recopie ou colle une formule ailleurs (=A1*2 une ligne plus bas devient =A2*2) ;
//   - on insère ou supprime des lignes ou des colonnes (les références suivent les cellules) ;
//   - on renomme ou supprime une feuille (=Feuille2!A1 devient ='Ventes 2026'!A1, ou #REF!).
//
// Forme d'une référence :
//   [feuille!]partie[:partie]
// où une « partie » est une cellule (B3, $B$3), une colonne seule (B, dans B:D)
// ou une ligne seule (3, dans 3:5). Le « $ » fige la colonne ou la ligne.

import { COLONNES_MAX, LIGNES_MAX, lettresColonne, numeroColonne } from './adresses.js';

const LETTRE = /[A-Za-z_$À-ſ]/;
const CARACTERE_NOM = /[A-Za-z0-9_.$À-ſ]/;
const CHIFFRE = /[0-9]/;
// Jetons après lesquels un « ,5 » ou « .5 » est un nombre (et pas un séparateur).
const AVANT_NOMBRE = new Set(['debut', 'separateur', 'ouvrante', 'operateur']);

/**
 * Découpe une formule (sans le « = ») en jetons :
 *   { type: 'texte', source }                   "entre guillemets"
 *   { type: 'feuille', source, nom }            'Nom de feuille'!  ou  Feuille2!
 *   { type: 'nombre', source, nombre }          12   3,5   1E3
 *   { type: 'nom', source, fonction }           A1, SOMME (fonction: vrai si suivi de « ( »), VRAI…
 *   { type: 'separateur', source }              ;  ou  ,
 *   { type: 'ouvrante' | 'fermante', source }   ( )
 *   { type: 'operateur', source }               + - * / ^ & = < > % :
 *   { type: 'espace' | 'autre', source }
 * En recollant les « source », on retrouve exactement le texte de départ.
 */
export function decouper(formule) {
  const jetons = [];
  let i = 0;
  let precedent = 'debut'; // type du dernier jeton qui n'est pas une espace

  const ajouter = (jeton) => {
    jetons.push(jeton);
    if (jeton.type !== 'espace') precedent = jeton.type;
  };

  while (i < formule.length) {
    const c = formule[i];
    const suivant = formule[i + 1] ?? '';

    // Texte entre guillemets ("" à l'intérieur = un guillemet), ou nom de
    // feuille entre apostrophes ('' à l'intérieur = une apostrophe).
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < formule.length) {
        if (formule[j] === c && formule[j + 1] === c) j += 2;
        else if (formule[j] === c) break;
        else j++;
      }
      j = Math.min(j + 1, formule.length);
      if (c === "'" && formule[j] === '!') {
        const source = formule.slice(i, j + 1);
        ajouter({ type: 'feuille', source, nom: source.slice(1, -2).replace(/''/g, "'") });
        i = j + 1;
        continue;
      }
      ajouter({ type: c === '"' ? 'texte' : 'feuille', source: formule.slice(i, j), nom: '' });
      i = j;
      continue;
    }

    // Nombre : 12   3,5   3.5   1E3   1,5E-2   et aussi ,5 ou .5 en début d'argument.
    const debutDecimal = (c === ',' || c === '.') && CHIFFRE.test(suivant) && AVANT_NOMBRE.has(precedent);
    if (CHIFFRE.test(c) || debutDecimal) {
      let j = i;
      while (CHIFFRE.test(formule[j] ?? '')) j++;
      if ((formule[j] === ',' || formule[j] === '.') && CHIFFRE.test(formule[j + 1] ?? '')) {
        j++;
        while (CHIFFRE.test(formule[j] ?? '')) j++;
      }
      const exposant = /^[eE][+-]?[0-9]+/.exec(formule.slice(j));
      if (exposant) j += exposant[0].length;
      const source = formule.slice(i, j);
      ajouter({ type: 'nombre', source, nombre: Number(source.replace(',', '.')) });
      i = j;
      continue;
    }

    // Nom : référence de cellule (A1, $B$2), fonction (SOMME, NB.SI), VRAI, FAUX…
    // Suivi d'un « ! », c'est un nom de feuille (Feuille2!A1).
    if (LETTRE.test(c)) {
      let j = i + 1;
      while (CARACTERE_NOM.test(formule[j] ?? '')) j++;
      if (formule[j] === '!' && formule[i - 1] !== '#') {
        ajouter({ type: 'feuille', source: formule.slice(i, j + 1), nom: formule.slice(i, j) });
        i = j + 1;
        continue;
      }
      let k = j;
      while (formule[k] === ' ') k++;
      ajouter({ type: 'nom', source: formule.slice(i, j), fonction: formule[k] === '(' });
      i = j;
      continue;
    }

    if (c === ';' || c === ',') ajouter({ type: 'separateur', source: c });
    else if (c === '(') ajouter({ type: 'ouvrante', source: c });
    else if (c === ')') ajouter({ type: 'fermante', source: c });
    else if (/\s/.test(c)) ajouter({ type: 'espace', source: c });
    else if ('+-*/^&=<>%:'.includes(c)) ajouter({ type: 'operateur', source: c });
    else ajouter({ type: 'autre', source: c });
    i++;
  }
  return jetons;
}

// --- Lecture des références ------------------------------------------------------

const MOTIF_CELLULE = /^(\$?)([A-Za-z]{1,3})(\$?)([0-9]+)$/;
const MOTIF_COLONNE = /^(\$?)([A-Za-z]{1,3})$/;
const MOTIF_LIGNE = /^(\$?)([0-9]+)$/;

/**
 * @typedef {object} Partie  un bout de référence
 * @property {number|null} colonne  null pour une ligne entière (3:5)
 * @property {number|null} ligne  null pour une colonne entière (B:D)
 * @property {boolean} colonneFixe  « $ » devant la colonne
 * @property {boolean} ligneFixe  « $ » devant la ligne
 *
 * @typedef {object} Reference
 * @property {string|null} feuille  nom de la feuille désignée (null : celle de la formule)
 * @property {Partie} debut
 * @property {Partie|null} fin  null pour une seule cellule
 */

/** Lit un jeton comme une partie de référence (cellule, ou colonne / ligne seule si `seule`). */
function lirePartie(jeton, seule) {
  if (!jeton) return null;
  if (jeton.type === 'nom' && !jeton.fonction) {
    const cellule = MOTIF_CELLULE.exec(jeton.source);
    if (cellule && Number(cellule[4]) >= 1) {
      return { colonne: numeroColonne(cellule[2]), ligne: Number(cellule[4]), colonneFixe: cellule[1] === '$', ligneFixe: cellule[3] === '$' };
    }
    if (seule) {
      const colonne = MOTIF_COLONNE.exec(jeton.source);
      if (colonne) return { colonne: numeroColonne(colonne[2]), ligne: null, colonneFixe: colonne[1] === '$', ligneFixe: false };
      const ligne = MOTIF_LIGNE.exec(jeton.source);
      if (ligne) return { colonne: null, ligne: Number(ligne[2]), colonneFixe: false, ligneFixe: ligne[1] === '$' };
    }
  }
  if (seule && jeton.type === 'nombre' && /^[0-9]+$/.test(jeton.source)) {
    return { colonne: null, ligne: Number(jeton.source), colonneFixe: false, ligneFixe: false };
  }
  return null;
}

const estCellule = (partie) => partie.colonne !== null && partie.ligne !== null;
const memeGenre = (a, b) => (a.colonne === null) === (b.colonne === null) && (a.ligne === null) === (b.ligne === null);

/**
 * Découpe une formule (sans le « = ») en morceaux : du texte inchangé, ou une
 * référence. Chaque morceau : { source } ou { source, reference }.
 */
export function segmenter(formule) {
  const jetons = decouper(formule);
  const morceaux = [];
  let i = 0;
  while (i < jetons.length) {
    const jeton = jetons[i];
    let j = i;
    let feuille = null;
    if (jeton.type === 'feuille' && jeton.source.endsWith('!')) {
      feuille = jeton.nom;
      j++;
    }
    const debut = lirePartie(jetons[j], true);
    let reference = null;
    let fin = j;
    if (debut) {
      const deuxPoints = jetons[j + 1]?.type === 'operateur' && jetons[j + 1].source === ':';
      const autre = deuxPoints ? lirePartie(jetons[j + 2], true) : null;
      if (autre && memeGenre(debut, autre)) {
        reference = { feuille, debut, fin: autre };
        fin = j + 2;
      } else if (estCellule(debut)) {
        reference = { feuille, debut, fin: null };
      }
    }
    if (reference) {
      const source = jetons
        .slice(i, fin + 1)
        .map((morceau) => morceau.source)
        .join('');
      morceaux.push({ source, reference, prefixe: feuille === null ? '' : jeton.source });
      i = fin + 1;
    } else {
      morceaux.push({ source: jeton.source, jeton });
      i++;
    }
  }
  return morceaux;
}

/** Toutes les références d'une formule (avec ou sans « = »). */
export function referencesDe(formule) {
  return segmenter(corps(formule))
    .filter((morceau) => morceau.reference)
    .map((morceau) => morceau.reference);
}

// --- Écriture des références --------------------------------------------------------

const NOM_SIMPLE = /^[A-Za-zÀ-ÖØ-öø-ÿ_][A-Za-z0-9À-ÖØ-öø-ÿ_.]*$/;

/**
 * Nom de feuille tel qu'il s'écrit dans une formule : tel quel s'il est
 * simple (Feuille2), entre apostrophes sinon ('Ventes 2026', 'L''été').
 */
export function nomFeuillePourFormule(nom) {
  const simple =
    NOM_SIMPLE.test(nom) &&
    !/^[A-Za-z]{1,3}[0-9]+$/.test(nom) && // ressemblerait à une cellule (AB12)
    !['VRAI', 'FAUX', 'TRUE', 'FALSE'].includes(nom.toUpperCase());
  return simple ? nom : `'${nom.replace(/'/g, "''")}'`;
}

function ecrirePartie(partie) {
  const colonne = partie.colonne === null ? '' : `${partie.colonneFixe ? '$' : ''}${lettresColonne(partie.colonne)}`;
  const ligne = partie.ligne === null ? '' : `${partie.ligneFixe ? '$' : ''}${partie.ligne}`;
  return colonne + ligne;
}

/** Référence → texte, ex. 'Ma feuille'!$A$1:B3. */
export function ecrireReference(reference, prefixe = null) {
  const debutTexte = prefixe ?? (reference.feuille === null ? '' : `${nomFeuillePourFormule(reference.feuille)}!`);
  return debutTexte + ecrirePartie(reference.debut) + (reference.fin ? `:${ecrirePartie(reference.fin)}` : '');
}

/** Retire le « = » du début (et les espaces autour). */
function corps(formule) {
  return String(formule).trim().replace(/^=/, '');
}

/**
 * Réécrit chaque référence d'une formule. La fonction reçoit la référence et
 * renvoie : undefined (inchangée), null (devient #REF!) ou une nouvelle référence.
 * Le texte qui n'est pas une référence n'est jamais modifié. Un texte qui
 * n'est pas une formule (sans « = ») est renvoyé tel quel.
 */
export function remplacerReferences(formule, fonction) {
  const texte = String(formule);
  if (!texte.trim().startsWith('=')) return formule;
  let change = false;
  const resultat = segmenter(corps(texte))
    .map((morceau) => {
      if (!morceau.reference) return morceau.source;
      const nouvelle = fonction(morceau.reference);
      if (nouvelle === undefined) return morceau.source;
      change = true;
      if (nouvelle === null) return '#REF!';
      // Le préfixe d'origine (« feuille! ») est gardé tel qu'il était écrit, sauf si la feuille change.
      const prefixe = nouvelle.feuille === morceau.reference.feuille ? morceau.prefixe : null;
      return ecrireReference(nouvelle, prefixe);
    })
    .join('');
  return change ? `=${resultat}` : formule;
}

// --- Transformations ---------------------------------------------------------------------

const ligneValide = (ligne) => ligne === null || (ligne >= 1 && ligne <= LIGNES_MAX);
const colonneValide = (colonne) => colonne === null || (colonne >= 1 && colonne <= COLONNES_MAX);
const partieValide = (partie) => ligneValide(partie.ligne) && colonneValide(partie.colonne);

/**
 * Décale les références d'une formule, comme lors d'un copier-coller ou d'une
 * recopie dans Excel : =A1*2 copiée une ligne plus bas devient =A2*2.
 * Les parties précédées d'un « $ » ne bougent pas ($A$1 reste $A$1).
 * Une référence qui sortirait de la grille devient #REF!.
 */
export function decalerReferences(formule, dLignes, dColonnes) {
  if (dLignes === 0 && dColonnes === 0) return formule;
  const decaler = (partie) => ({
    ...partie,
    ligne: partie.ligne === null || partie.ligneFixe ? partie.ligne : partie.ligne + dLignes,
    colonne: partie.colonne === null || partie.colonneFixe ? partie.colonne : partie.colonne + dColonnes,
  });
  return remplacerReferences(formule, (reference) => {
    const debut = decaler(reference.debut);
    const fin = reference.fin && decaler(reference.fin);
    if (!partieValide(debut) || (fin && !partieValide(fin))) return null;
    if (ecrireReference({ ...reference, debut, fin }) === ecrireReference(reference)) return undefined;
    return { ...reference, debut, fin };
  });
}

/** Deux noms de feuille désignent-ils la même feuille ? (Les majuscules ne comptent pas.) */
export function memeFeuille(a, b) {
  return String(a).toLocaleLowerCase('fr') === String(b).toLocaleLowerCase('fr');
}

/**
 * Met à jour les références après l'insertion ou la suppression de lignes ou
 * de colonnes, comme Excel :
 *   - insérer 2 lignes au-dessus de la ligne 5 : =A7 devient =A9, =SOMME(A1:A10) devient =SOMME(A1:A12) ;
 *   - supprimer les lignes 5 à 6 : =A7 devient =A5, =A5 devient #REF!, =SOMME(A1:A10) devient =SOMME(A1:A8).
 * Les « $ » n'empêchent pas la mise à jour (la cellule a vraiment bougé).
 *
 * @param {string} formule  texte de la cellule (rien ne change si ce n'est pas une formule)
 * @param {string} feuilleFormule  nom de la feuille qui contient la formule
 * @param {object} changement
 * @param {string} changement.feuille  nom de la feuille modifiée
 * @param {'lignes'|'colonnes'} changement.axe
 * @param {'insertion'|'suppression'} changement.type
 * @param {number} changement.position  première ligne (ou colonne) insérée ou supprimée
 * @param {number} changement.nombre  combien
 */
export function ajusterReferences(formule, feuilleFormule, { feuille, axe, type, position, nombre }) {
  const cle = axe === 'lignes' ? 'ligne' : 'colonne';
  const maximum = axe === 'lignes' ? LIGNES_MAX : COLONNES_MAX;
  const derniere = position + nombre - 1; // dernière supprimée

  return remplacerReferences(formule, (reference) => {
    if (!memeFeuille(reference.feuille ?? feuilleFormule, feuille)) return undefined;
    const a = reference.debut[cle];
    if (a === null) return undefined; // colonne entière (pour les lignes), ou ligne entière
    const b = reference.fin ? reference.fin[cle] : a;
    const haut = Math.min(a, b);
    const bas = Math.max(a, b);
    let nouveauHaut;
    let nouveauBas;
    if (type === 'insertion') {
      nouveauHaut = haut >= position ? haut + nombre : haut;
      nouveauBas = bas >= position ? bas + nombre : bas;
      if (nouveauHaut > maximum) return null;
      nouveauBas = Math.min(nouveauBas, maximum);
    } else {
      if (haut >= position && bas <= derniere) return null; // tout a été supprimé
      nouveauHaut = haut < position ? haut : haut > derniere ? haut - nombre : position;
      nouveauBas = bas < position ? bas : bas > derniere ? bas - nombre : position - 1;
    }
    if (nouveauHaut === haut && nouveauBas === bas) return undefined;
    const debut = { ...reference.debut, [cle]: a <= b ? nouveauHaut : nouveauBas };
    const fin = reference.fin && { ...reference.fin, [cle]: a <= b ? nouveauBas : nouveauHaut };
    return { ...reference, debut, fin };
  });
}

/** Une feuille est renommée : =Ancien!A1 devient =Nouveau!A1 dans toutes les formules. */
export function renommerFeuilleDansFormule(formule, ancien, nouveau) {
  return remplacerReferences(formule, (reference) =>
    reference.feuille !== null && memeFeuille(reference.feuille, ancien) ? { ...reference, feuille: nouveau } : undefined,
  );
}

/** Une feuille est supprimée : les références vers elle deviennent #REF!. */
export function oublierFeuilleDansFormule(formule, nom) {
  return remplacerReferences(formule, (reference) =>
    reference.feuille !== null && memeFeuille(reference.feuille, nom) ? null : undefined,
  );
}
