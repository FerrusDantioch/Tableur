// Export PDF par l'impression du navigateur (window.print).
//
// Le navigateur propose « Enregistrer au format PDF » comme imprimante :
// cela marche hors ligne, sur ordinateur comme sur téléphone, garde le texte
// sélectionnable et ne demande aucune bibliothèque. On prépare pour cela une
// copie imprimable du tableau (de A1 à la dernière cellule remplie), mise en
// page par css/impression.css : feuille claire, texte noir, couleurs de fond
// adoucies, gras et largeurs de colonnes conservés.

import { adresse } from '../donnees/adresses.js';
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

  /** La feuille exportée : celle qui est affichée. */
  get feuille() {
    return this.classeur.feuilleActive;
  }

  /** Bouton « Exporter en PDF ». */
  async exporter() {
    if (this.feuille.etendue().lignes === 0) {
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
    this.#zone = construireImpression(this.classeur.titre, this.feuille, this.presenterCellule);
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
 * Crée la section imprimable : le titre, puis le tableau des cellules utilisées.
 * (Fonction séparée pour pouvoir la tester.)
 */
export function construireImpression(titre, feuille, presenterCellule) {
  const { lignes, colonnes } = feuille.etendue();
  const zone = document.createElement('section');
  zone.id = 'impression';
  zone.className = 'impression';

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

  const corps = document.createElement('tbody');
  for (let l = 1; l <= lignes; l++) {
    const tr = document.createElement('tr');
    for (let c = 1; c <= colonnes; c++) {
      const td = document.createElement('td');
      const vue = presenterCellule(adresse(l, c));
      td.textContent = vue.texte;
      if (vue.genre !== 'vide') td.className = vue.genre;
      if (vue.gras) td.classList.add('gras');
      if (vue.fond) td.dataset.fond = vue.fond;
      tr.append(td);
    }
    corps.append(tr);
  }
  table.append(corps);
  zone.append(table);
  return zone;
}
