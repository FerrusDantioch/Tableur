// Recopie de cellules, comme la « poignée de recopie » d'Excel : on étire une
// sélection vers le bas, le haut, la droite ou la gauche.
//
// Ce qui est recopié, colonne par colonne (ou ligne par ligne) :
//   - une formule : ses références s'adaptent (=A1*2 devient =A2*2, puis =A3*2…) ;
//   - plusieurs nombres : la suite continue (1, 2 → 3, 4, 5 ; 10, 20 → 30, 40) ;
//   - une date seule : le jour suivant, puis le suivant… ;
//   - un texte qui finit par un nombre : « Semaine 1 » → « Semaine 2 », « Semaine 3 » ;
//   - un jour ou un mois : lundi → mardi, mercredi… ; janvier → février… ;
//   - sinon, les cellules sont répétées telles quelles.
// La mise en forme est recopiée avec le contenu.
//
// Ce module ne modifie rien : il calcule la liste des cellules à écrire,
// que l'appelant donne ensuite à Classeur.modifierCellules (annulable).

import { adresse } from './adresses.js';
import { decalerReferences } from './formules.js';
import { dateVersTexte, interpreterSaisie } from './saisie.js';

const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** Garde la façon d'écrire du modèle : « Lundi », « lundi » ou « LUNDI ». */
function memeCasse(mot, modele) {
  if (modele === modele.toUpperCase() && modele !== modele.toLowerCase()) return mot.toUpperCase();
  if (modele[0] === modele[0].toUpperCase()) return mot[0].toUpperCase() + mot.slice(1);
  return mot;
}

/** Nombre → texte de cellule, dans le même style que celui tapé (12,5 ; 20 % ; 12,50 € ; 01/02/2026). */
function nombreVersBrut(nombre, style) {
  const propre = Number(nombre.toPrecision(15)) + 0;
  if (style === 'date') return dateVersTexte(propre);
  if (style === 'pourcent') return `${String(Number((propre * 100).toPrecision(15))).replace('.', ',')} %`;
  if (style === 'euro') return `${String(propre).replace('.', ',')} €`;
  return String(propre).replace('.', ',');
}

/**
 * Cherche une « suite » dans les cellules source (dans l'ordre). Renvoie une
 * fonction position → texte brut (position 0 = première source, n = juste
 * après la dernière, -1 = juste avant la première), ou null s'il n'y a pas
 * de suite (les cellules sont alors répétées).
 */
function trouverSuite(cellules) {
  const bruts = cellules.map((cellule) => cellule?.brut ?? '');
  if (bruts.some((brut) => brut.trim() === '')) return null;
  const saisies = bruts.map((brut) => interpreterSaisie(brut));
  const n = bruts.length;

  // Nombres (au moins deux) : droite qui passe au plus près (comme Excel).
  if (n >= 2 && saisies.every((saisie) => saisie.type === 'nombre')) {
    const xMoyen = (n - 1) / 2;
    const yMoyen = saisies.reduce((somme, saisie) => somme + saisie.valeur, 0) / n;
    let haut = 0;
    let bas = 0;
    saisies.forEach((saisie, x) => {
      haut += (x - xMoyen) * (saisie.valeur - yMoyen);
      bas += (x - xMoyen) ** 2;
    });
    const pente = haut / bas;
    const style = saisies[n - 1].style;
    return (position) => nombreVersBrut(yMoyen + pente * (position - xMoyen), style);
  }

  // Une date seule : un jour de plus à chaque cellule.
  if (n === 1 && saisies[0].type === 'nombre' && saisies[0].style === 'date') {
    return (position) => nombreVersBrut(saisies[0].valeur + position, 'date');
  }

  // Jours de la semaine ou mois de l'année.
  for (const liste of [JOURS, MOIS]) {
    const index = bruts.map((brut) => liste.indexOf(brut.trim().toLowerCase()));
    if (index.some((i) => i < 0)) continue;
    const pas = n >= 2 ? (index[1] - index[0] + liste.length) % liste.length || 1 : 1;
    const modele = bruts[n - 1].trim();
    return (position) => {
      const i = (((index[0] + pas * position) % liste.length) + liste.length) % liste.length;
      return memeCasse(liste[i], modele);
    };
  }

  // Un texte qui finit par un nombre : « Semaine 1 » → « Semaine 2 ».
  if (n === 1 && saisies[0].type === 'texte') {
    const morceaux = /^(.*?)(\d+)$/.exec(bruts[0]);
    if (morceaux) {
      const [, debut, chiffres] = morceaux;
      return (position) => {
        const nombre = String(Math.abs(Number(chiffres) + position));
        return debut + nombre.padStart(chiffres.length, '0');
      };
    }
  }
  return null;
}

/**
 * Calcule la recopie de la plage `source` sur `nombre` lignes (ou colonnes)
 * dans la direction donnée.
 * @param {import('./classeur.js').Feuille} feuille
 * @param {{debut: object, fin: object}} source
 * @param {'bas'|'haut'|'droite'|'gauche'} direction
 * @param {number} nombre  nombre de lignes (ou colonnes) à remplir
 * @param {object} [options]
 * @param {boolean} [options.suites=true]  faux : simple copie, sans suite (comme Ctrl+D dans Excel)
 * @returns {Array<object>} modifications pour Classeur.modifierCellules
 */
export function calculerRecopie(feuille, source, direction, nombre, { suites = true } = {}) {
  const verticale = direction === 'bas' || direction === 'haut';
  const versLaFin = direction === 'bas' || direction === 'droite';
  const { debut, fin } = source;
  const longueur = verticale ? fin.ligne - debut.ligne + 1 : fin.colonne - debut.colonne + 1;
  const [premiereFile, derniereFile] = verticale ? [debut.colonne, fin.colonne] : [debut.ligne, fin.ligne];
  const modifications = [];

  // Une « file » : une colonne (recopie verticale) ou une ligne (horizontale).
  for (let file = premiereFile; file <= derniereFile; file++) {
    const position = (i) => (verticale ? { ligne: debut.ligne + i, colonne: file } : { ligne: file, colonne: debut.colonne + i });
    const cellules = [];
    for (let i = 0; i < longueur; i++) {
      const p = position(i);
      cellules.push(feuille.cellule(adresse(p.ligne, p.colonne)));
    }
    const suite = suites ? trouverSuite(cellules) : null;

    for (let k = 1; k <= nombre; k++) {
      // Rang de la cellule à remplir, compté depuis la première source.
      const rang = versLaFin ? longueur - 1 + k : -k;
      const cible = position(rang);
      // Cellule source dont on reprend la mise en forme (et la formule) : on répète le motif.
      const modeleRang = ((rang % longueur) + longueur) % longueur;
      const modele = cellules[modeleRang];
      const origine = position(modeleRang);
      let brut = modele?.brut ?? '';
      if (suite) brut = suite(rang);
      else brut = decalerReferences(brut, cible.ligne - origine.ligne, cible.colonne - origine.colonne);
      modifications.push({ ...(modele ?? {}), adresse: adresse(cible.ligne, cible.colonne), brut, remplacer: true });
    }
  }
  return modifications;
}
