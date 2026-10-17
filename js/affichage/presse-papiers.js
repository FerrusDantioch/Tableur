// Copier, couper, coller (Ctrl+C, Ctrl+X, Ctrl+V), comme dans Excel.
//
// - Copier met dans le presse-papiers le TEXTE affiché des cellules
//   (séparé par des tabulations), ce qui permet de coller dans un autre
//   logiciel. L'application garde aussi pour elle le contenu exact des
//   cellules (formules, gras, couleur).
// - Coller ce qu'on vient de copier ici recopie les formules en décalant
//   leurs références : =A1*2 collée une ligne plus bas devient =A2*2.
//   Une seule cellule copiée puis collée sur une plage remplit toute la
//   plage (pratique pour recopier une formule vers le bas).
// - Coller un texte venu d'ailleurs (Excel, une page web…) le répartit dans
//   les cellules : tabulation = colonne suivante, retour à la ligne = ligne suivante.
// - Couper vide tout de suite les cellules ; on peut les coller ailleurs
//   (les formules gardent alors leurs références, comme pour un déplacement).

import { adresse, plage as creerPlage, taillePlage } from '../donnees/adresses.js';
import { COLONNES_MAX, LIGNES_MAX } from '../donnees/classeur.js';
import { decalerReferences } from '../calcul/traduction.js';

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
  #interne = null; // { texte, origine, cellules, couper }

  /**
   * @param {object} options
   * @param {import('../donnees/classeur.js').Classeur} options.classeur
   * @param {import('../donnees/classeur.js').Feuille} options.feuille
   * @param {import('./selection.js').Selection} options.selection
   * @param {(adresse: string) => {texte: string}} options.presenterCellule
   * @param {() => boolean} options.estActif  vrai si la grille a le focus et qu'aucune saisie n'est en cours
   */
  constructor({ classeur, feuille, selection, presenterCellule, estActif }) {
    this.classeur = classeur;
    this.feuille = feuille;
    this.selection = selection;
    this.presenterCellule = presenterCellule;
    this.estActif = estActif;
    document.addEventListener('copy', (e) => this.#copier(e, false));
    document.addEventListener('cut', (e) => this.#copier(e, true));
    document.addEventListener('paste', (e) => this.#coller(e));
  }

  #copier(evenement, couper) {
    if (!this.estActif()) return;
    evenement.preventDefault();
    const zone = this.selection.plage;
    const textes = [];
    const cellules = [];
    for (let l = zone.debut.ligne; l <= zone.fin.ligne; l++) {
      const ligneTextes = [];
      const ligneCellules = [];
      for (let c = zone.debut.colonne; c <= zone.fin.colonne; c++) {
        const adr = adresse(l, c);
        ligneTextes.push(this.presenterCellule(adr).texte);
        ligneCellules.push(this.feuille.cellule(adr));
      }
      textes.push(ligneTextes);
      cellules.push(ligneCellules);
    }
    const texte = ecrireTexteTabule(textes);
    evenement.clipboardData.setData('text/plain', texte);
    this.#interne = { texte, origine: zone.debut, cellules, couper };
    if (couper) {
      const modifications = [];
      for (const ligne of cellules.keys()) {
        for (const colonne of cellules[ligne].keys()) {
          if (!cellules[ligne][colonne]) continue;
          modifications.push({
            adresse: adresse(zone.debut.ligne + ligne, zone.debut.colonne + colonne),
            brut: '',
            gras: false,
            fond: null,
          });
        }
      }
      this.classeur.modifierCellules(this.feuille, modifications, zone);
    }
  }

  #coller(evenement) {
    if (!this.estActif()) return;
    evenement.preventDefault();
    const texte = evenement.clipboardData.getData('text/plain');
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
    if (finLigne > this.feuille.lignes || finColonne > this.feuille.colonnes) {
      this.classeur.agrandir(this.feuille, {
        lignes: Math.max(0, finLigne - this.feuille.lignes),
        colonnes: Math.max(0, finColonne - this.feuille.colonnes),
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
          adresse: adresse(l, c),
          brut: interne.couper ? brut : decalerReferences(brut, l - ligneOrigine, c - colonneOrigine),
          gras: cellule?.gras ?? false,
          fond: cellule?.fond ?? null,
        });
      }
    }
    const collee = creerPlage(debut, { ligne: finLigne, colonne: finColonne });
    this.classeur.modifierCellules(this.feuille, modifications, collee);
    this.selection.choisirPlage(collee);
  }
}
