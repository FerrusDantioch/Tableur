// Copier, couper, coller, comme dans Excel : au clavier (Ctrl+C, Ctrl+X,
// Ctrl+V) ou avec les boutons de la barre d'outils (pratique au doigt).
//
// - Copier met dans le presse-papiers le TEXTE affiché des cellules
//   (séparé par des tabulations), ce qui permet de coller dans un autre
//   logiciel. L'application garde aussi pour elle le contenu exact des
//   cellules (formules, mise en forme, bordures).
// - Coller ce qu'on vient de copier ici recopie les formules en décalant
//   leurs références : =A1*2 collée une ligne plus bas devient =A2*2.
//   Une seule cellule copiée puis collée sur une plage remplit toute la
//   plage (pratique pour recopier une formule vers le bas).
// - Coller un texte venu d'ailleurs (Excel, une page web…) le répartit dans
//   les cellules : tabulation = colonne suivante, retour à la ligne = ligne suivante.
// - Couper vide tout de suite les cellules ; on peut les coller ailleurs
//   (les formules gardent alors leurs références, comme pour un déplacement).
//
// Avec les boutons, le navigateur peut demander l'autorisation de lire le
// presse-papiers (pour coller un texte venu d'une autre application). Sans
// cette autorisation, « Coller » colle ce qui a été copié dans Tableur.

import { adresse, plage as creerPlage, taillePlage } from '../donnees/adresses.js';
import { COLONNES_MAX, LIGNES_MAX } from '../donnees/classeur.js';
import { decalerReferences } from '../donnees/formules.js';

/** Texte tabulé → tableau de lignes (gère les champs entre guillemets d'Excel). */
export function lireTexteTabule(texte) {
  const lignes = [];
  let ligne = [];
  let champ = '';
  let i = 0;
  const source = String(texte).replace(/\r\n?/g, '\n');
  while (i < source.length) {
    const c = source[i];
    if (c === '"' && champ === '') {
      // Champ entre guillemets : peut contenir tabulations et retours à la ligne.
      let j = i + 1;
      let contenu = '';
      while (j < source.length) {
        if (source[j] === '"' && source[j + 1] === '"') {
          contenu += '"';
          j += 2;
        } else if (source[j] === '"') {
          break;
        } else {
          contenu += source[j++];
        }
      }
      if (j < source.length && (source[j + 1] === '\t' || source[j + 1] === '\n' || j + 1 === source.length)) {
        champ = contenu;
        i = j + 1;
        continue;
      }
    }
    if (c === '\t') {
      ligne.push(champ);
      champ = '';
    } else if (c === '\n') {
      ligne.push(champ);
      lignes.push(ligne);
      ligne = [];
      champ = '';
    } else {
      champ += c;
    }
    i++;
  }
  if (champ !== '' || ligne.length) {
    ligne.push(champ);
    lignes.push(ligne);
  }
  return lignes;
}

/** Tableau de lignes → texte tabulé (guillemets si le champ contient tabulation ou retour). */
function ecrireTexteTabule(lignes) {
  const proteger = (champ) => (/[\t\n"]/.test(champ) ? `"${champ.replace(/"/g, '""')}"` : champ);
  return lignes.map((ligne) => ligne.map(proteger).join('\t')).join('\r\n');
}

export class PressePapiers {
  #interne = null; // { texte, feuille, origine, cellules, couper }

  /**
   * @param {object} options
   * @param {import('../donnees/classeur.js').Classeur} options.classeur
   * @param {import('./selection.js').Selection} options.selection
   * @param {(adresse: string) => {texte: string}} options.presenterCellule  (feuille active)
   * @param {() => boolean} options.estActif  vrai si la grille a le focus et qu'aucune saisie n'est en cours
   * @param {(texte: string) => void} options.signaler  affiche un court message
   */
  constructor({ classeur, selection, presenterCellule, estActif, signaler }) {
    this.classeur = classeur;
    this.selection = selection;
    this.presenterCellule = presenterCellule;
    this.estActif = estActif;
    this.signaler = signaler;
    document.addEventListener('copy', (e) => this.#evenementCopier(e, false));
    document.addEventListener('cut', (e) => this.#evenementCopier(e, true));
    document.addEventListener('paste', (e) => this.#evenementColler(e));
  }

  get feuille() {
    return this.classeur.feuilleActive;
  }

  /** Vrai si quelque chose a été copié dans Tableur. */
  get contientQuelqueChose() {
    return this.#interne !== null;
  }

  // --- Clavier (événements du navigateur) -------------------------------------------

  #evenementCopier(evenement, couper) {
    if (!this.estActif()) return;
    evenement.preventDefault();
    evenement.clipboardData.setData('text/plain', this.#preparer(couper));
  }

  #evenementColler(evenement) {
    if (!this.estActif()) return;
    evenement.preventDefault();
    this.#collerTexte(evenement.clipboardData.getData('text/plain'));
  }

  // --- Boutons -----------------------------------------------------------------------

  /** Bouton « Copier » (ou « Couper »). */
  async copier(couper = false) {
    const texte = this.#preparer(couper);
    try {
      await navigator.clipboard.writeText(texte);
    } catch {
      // Le navigateur refuse : la copie reste utilisable dans Tableur.
    }
    const { lignes, colonnes } = taillePlage(this.selection.plage);
    const nombre = lignes * colonnes;
    this.signaler(
      `${nombre > 1 ? `${nombre} cellules ${couper ? 'coupées' : 'copiées'}` : `Cellule ${couper ? 'coupée' : 'copiée'}`}. Choisissez où coller, puis « Coller ».`,
    );
  }

  /** Bouton « Coller » : texte du presse-papiers si le navigateur le permet, sinon la dernière copie faite ici. */
  async coller() {
    let texte = null;
    try {
      texte = await navigator.clipboard.readText();
    } catch {
      texte = null;
    }
    if (texte === null || texte === '') {
      if (!this.#interne) {
        this.signaler('Rien à coller : copiez d’abord des cellules.');
        return;
      }
      texte = this.#interne.texte;
    }
    this.#collerTexte(texte);
  }

  // --- Copier ----------------------------------------------------------------------

  /** Mémorise la sélection (et la vide si on coupe). Renvoie le texte pour le presse-papiers. */
  #preparer(couper) {
    const feuille = this.feuille;
    const zone = this.selection.plage;
    const textes = [];
    const cellules = [];
    for (let l = zone.debut.ligne; l <= zone.fin.ligne; l++) {
      const ligneTextes = [];
      const ligneCellules = [];
      for (let c = zone.debut.colonne; c <= zone.fin.colonne; c++) {
        const adr = adresse(l, c);
        ligneTextes.push(this.presenterCellule(adr).texte);
        ligneCellules.push(feuille.cellule(adr));
      }
      textes.push(ligneTextes);
      cellules.push(ligneCellules);
    }
    const texte = ecrireTexteTabule(textes);
    this.#interne = { texte, feuille, origine: zone.debut, cellules, couper };
    if (couper) {
      const modifications = [];
      for (const ligne of cellules.keys()) {
        for (const colonne of cellules[ligne].keys()) {
          if (!cellules[ligne][colonne]) continue;
          modifications.push({ adresse: adresse(zone.debut.ligne + ligne, zone.debut.colonne + colonne), brut: '', remplacer: true });
        }
      }
      this.classeur.modifierCellules(feuille, modifications, zone);
    }
    return texte;
  }

  // --- Coller ----------------------------------------------------------------------

  #collerTexte(texte) {
    const feuille = this.feuille;
    const interne = this.#interne && this.#interne.texte === texte.replace(/\r?\n$/, '') ? this.#interne : null;
    const source = interne ? interne.cellules : lireTexteTabule(texte).map((ligne) => ligne.map((brut) => ({ brut })));
    if (source.length === 0) return;

    // Où coller : à partir de la cellule active ; une seule cellule copiée
    // remplit toute la plage sélectionnée.
    const zone = this.selection.plage;
    const debut = zone.debut;
    const remplir = source.length === 1 && source[0].length === 1 && !this.selection.unique;
    const taille = remplir ? taillePlage(zone) : { lignes: source.length, colonnes: Math.max(...source.map((l) => l.length)) };

    // Agrandit la grille si besoin (dans la limite du maximum).
    const finLigne = Math.min(LIGNES_MAX, debut.ligne + taille.lignes - 1);
    const finColonne = Math.min(COLONNES_MAX, debut.colonne + taille.colonnes - 1);
    if (finLigne > feuille.lignes || finColonne > feuille.colonnes) {
      this.classeur.agrandir(feuille, {
        lignes: Math.max(0, finLigne - feuille.lignes),
        colonnes: Math.max(0, finColonne - feuille.colonnes),
      });
    }

    const modifications = [];
    for (let l = debut.ligne; l <= finLigne; l++) {
      for (let c = debut.colonne; c <= finColonne; c++) {
        const i = remplir ? 0 : l - debut.ligne;
        const j = remplir ? 0 : c - debut.colonne;
        const cellule = source[i]?.[j];
        if (!interne) {
          if (cellule !== undefined) modifications.push({ adresse: adresse(l, c), brut: cellule.brut });
          continue;
        }
        // Copie interne : formules décalées (sauf après « couper »), mise en forme recopiée.
        const ligneOrigine = interne.origine.ligne + i;
        const colonneOrigine = interne.origine.colonne + j;
        const brut = cellule?.brut ?? '';
        modifications.push({
          ...(cellule ?? {}),
          adresse: adresse(l, c),
          brut: interne.couper ? brut : decalerReferences(brut, l - ligneOrigine, c - colonneOrigine),
          remplacer: true,
        });
      }
    }
    const collee = creerPlage(debut, { ligne: finLigne, colonne: finColonne });
    this.classeur.modifierCellules(feuille, modifications, collee);
    this.selection.choisirPlage(collee);
  }
}
