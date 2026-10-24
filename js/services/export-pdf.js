// Export PDF par l'impression du navigateur (window.print).
//
// Le navigateur propose « Enregistrer au format PDF » comme imprimante :
// cela marche hors ligne, sur ordinateur comme sur téléphone, garde le texte
// sélectionnable et ne demande aucune bibliothèque. On prépare pour cela une
// copie imprimable du tableau (de A1 à la dernière cellule remplie), mise en
// page par css/impression.css : feuille claire, texte noir, couleurs de fond
// adoucies, gras et largeurs de colonnes conservés.

import { adresse, lireAdresse } from '../donnees/adresses.js';
import { couleurBordure } from '../affichage/grille.js';
import { nomDeFichier } from './fichiers.js';

// Largeur utile d'une page A4 à 96 points par pouce, marges de 12 mm comprises.
const LARGEUR_PORTRAIT = 700;
const LARGEUR_PAYSAGE = 1030;

export class ExportPdf {
  #zone = null;
  #titreOrigine = null;

  /**
   * @param {object} options
   * @param {import('../donnees/classeur.js').Classeur} options.classeur  (la feuille affichée est exportée)
   * @param {(adresse: string) => {texte: string, genre: string, gras?: boolean, fond?: string|null}} options.presenterCellule
   * @param {object} options.preferences
   * @param {HTMLDialogElement} options.fenetreAide  explication affichée avant la première impression
   * @param {(fenetre: HTMLDialogElement) => Promise<string>} options.demander
   * @param {(texte: string) => void} options.signaler  affiche un court message
   */
  constructor({ classeur, presenterCellule, preferences, fenetreAide, demander, signaler }) {
    this.classeur = classeur;
    this.presenterCellule = presenterCellule;
    this.preferences = preferences;
    this.fenetreAide = fenetreAide;
    this.demander = demander;
    this.signaler = signaler;
    // Aussi quand l'impression est lancée depuis le menu du navigateur.
    window.addEventListener('beforeprint', () => this.preparer());
    window.addEventListener('afterprint', () => this.terminer());
  }

  /**
   * Imprimer le quadrillage gris ? Choix mémorisé ; par défaut, oui sauf si
   * la feuille a des bordures (le tableau construit se lit alors mieux seul).
   */
  get quadrillage() {
    const choix = this.preferences.lire('quadrillagePdf', null);
    return typeof choix === 'boolean' ? choix : !zoneImprimee(this.feuille).bordures;
  }

  set quadrillage(oui) {
    this.preferences.ecrire('quadrillagePdf', Boolean(oui));
  }

  /** La feuille exportée : celle qui est affichée. */
  get feuille() {
    return this.classeur.feuilleActive;
  }

  /** Bouton « Exporter en PDF ». */
  async exporter() {
    if (zoneImprimee(this.feuille).lignes === 0) {
      this.signaler('La feuille est vide : il n’y a rien à exporter.');
      return;
    }
    if (!this.preferences.lire('aidePdfMasquee', false)) {
      const caseMasquer = this.fenetreAide.querySelector('input[type="checkbox"]');
      caseMasquer.checked = false;
      const reponse = await this.demander(this.fenetreAide);
      if (reponse !== 'continuer') return;
      if (caseMasquer.checked) this.preferences.ecrire('aidePdfMasquee', true);
    }
    // Laisse le temps à la fenêtre d'aide de disparaître avant l'impression.
    setTimeout(() => {
      this.preparer();
      window.print();
    }, 80);
  }

  /** Construit la copie imprimable du tableau. */
  preparer() {
    if (this.#zone) return;
    this.#titreOrigine = document.title;
    // Le navigateur nomme le fichier PDF d'après le titre de la page.
    document.title = nomDeFichier(this.classeur.titre);
    this.#zone = construireImpression(this.classeur.titre, this.feuille, this.presenterCellule, {
      quadrillage: this.quadrillage,
    });
    document.body.append(this.#zone);
  }

  /** Retire la copie imprimable après l'impression. */
  terminer() {
    this.#zone?.remove();
    this.#zone = null;
    if (this.#titreOrigine !== null) document.title = this.#titreOrigine;
    this.#titreOrigine = null;
  }
}

/**
 * Zone à imprimer : de A1 jusqu'à la dernière cellule qui contient du texte,
 * une bordure ou une couleur de fond. Indique aussi s'il y a des bordures.
 */
export function zoneImprimee(feuille) {
  let lignes = 0;
  let colonnes = 0;
  let bordures = false;
  for (const adr of feuille.adresses()) {
    const cellule = feuille.cellule(adr);
    if (cellule.bordures) bordures = true;
    if (cellule.brut.trim() === '' && !cellule.bordures && !cellule.fond) continue;
    const { ligne, colonne } = lireAdresse(adr);
    lignes = Math.max(lignes, ligne);
    colonnes = Math.max(colonnes, colonne);
  }
  // Une cellule fusionnée remplie est imprimée en entier.
  for (const { debut, fin } of feuille.fusions ?? []) {
    if (debut.ligne > lignes || debut.colonne > colonnes) continue;
    lignes = Math.max(lignes, fin.ligne);
    colonnes = Math.max(colonnes, fin.colonne);
  }
  return { lignes, colonnes, bordures };
}

/** Trait d'une bordure pour l'impression : 0,75 point (fin) ou 1,5 point (épais). */
function traitImprime(bordure) {
  return `${bordure.style === 'epais' ? 1.5 : 0.75}pt solid ${couleurBordure(bordure.couleur)}`;
}

/**
 * Crée la section imprimable : le titre, puis le tableau des cellules utilisées,
 * avec la mise en forme (gras, italique, couleurs, alignement, bordures).
 * (Fonction séparée pour pouvoir la tester.)
 * @param {object} [options]
 * @param {boolean} [options.quadrillage]  traits gris clair entre toutes les cellules
 *        (par défaut : seulement s'il n'y a aucune bordure choisie)
 */
export function construireImpression(titre, feuille, presenterCellule, { quadrillage } = {}) {
  const { lignes, colonnes, bordures } = zoneImprimee(feuille);
  const zone = document.createElement('section');
  zone.id = 'impression';
  zone.className = 'impression';
  if (!(quadrillage ?? !bordures)) zone.classList.add('sans-quadrillage');

  const entete = document.createElement('h1');
  entete.textContent = titre;
  zone.append(entete);

  const table = document.createElement('table');
  const groupe = document.createElement('colgroup');
  const largeurs = [];
  for (let c = 1; c <= colonnes; c++) largeurs.push(feuille.largeur(c));
  const total = largeurs.reduce((a, b) => a + b, 0);

  // Page en largeur (paysage) si le tableau est trop large pour la hauteur ;
  // s'il est encore trop large, il est réduit pour tenir dans la page.
  if (total > LARGEUR_PORTRAIT) zone.classList.add('paysage');
  const reduire = total > LARGEUR_PAYSAGE;
  if (reduire) zone.classList.add('reduit');
  for (const largeur of largeurs) {
    const col = document.createElement('col');
    col.style.width = reduire ? `${((largeur / total) * 100).toFixed(3)}%` : `${largeur}px`;
    groupe.append(col);
  }
  table.style.width = reduire ? '100%' : `${total}px`;
  table.append(groupe);

  // Cellules fusionnées : la cellule en haut à gauche s'étend (colspan,
  // rowspan) ; les cellules qu'elle couvre ne sont pas créées.
  const fusions = (feuille.fusions ?? []).filter((f) => f.debut.ligne <= lignes && f.debut.colonne <= colonnes);
  const couvertes = new Set();
  for (const { debut, fin } of fusions) {
    for (let l = debut.ligne; l <= Math.min(fin.ligne, lignes); l++) {
      for (let c = debut.colonne; c <= Math.min(fin.colonne, colonnes); c++) {
        if (l !== debut.ligne || c !== debut.colonne) couvertes.add(adresse(l, c));
      }
    }
  }

  const corps = document.createElement('tbody');
  for (let l = 1; l <= lignes; l++) {
    const tr = document.createElement('tr');
    for (let c = 1; c <= colonnes; c++) {
      if (couvertes.has(adresse(l, c))) continue;
      const td = document.createElement('td');
      const vue = presenterCellule(adresse(l, c), l, c);
      const fusion = fusions.find((f) => f.debut.ligne === l && f.debut.colonne === c);
      if (fusion) {
        td.colSpan = Math.min(fusion.fin.colonne, colonnes) - c + 1;
        td.rowSpan = Math.min(fusion.fin.ligne, lignes) - l + 1;
        // Bordures du bas et de droite : celles des cellules du bord de la fusion.
        const finL = l + td.rowSpan - 1;
        const finC = c + td.colSpan - 1;
        vue.bordures = {
          ...vue.bordures,
          bas: presenterCellule(adresse(finL, c), finL, c).bordures?.bas,
          droite: presenterCellule(adresse(l, finC), l, finC).bordures?.droite,
        };
      }
      td.textContent = vue.texte;
      if (vue.genre !== 'vide') td.className = vue.genre;
      if (vue.gras) td.classList.add('gras');
      if (vue.italique) td.classList.add('italique');
      if (vue.fond) td.dataset.fond = vue.fond;
      if (vue.couleur) td.dataset.encre = vue.couleur;
      if (vue.alignement) td.dataset.align = vue.alignement;
      // Bordures : le bas et la droite de chaque cellule (le haut et la gauche
      // pour la première ligne et la première colonne).
      const cotes = { bas: 'borderBottom', droite: 'borderRight', haut: 'borderTop', gauche: 'borderLeft' };
      for (const [cote, propriete] of Object.entries(cotes)) {
        if (vue.bordures?.[cote]) td.style[propriete] = traitImprime(vue.bordures[cote]);
      }
      tr.append(td);
    }
    corps.append(tr);
  }
  table.append(corps);
  zone.append(table);
  return zone;
}
