// Fenêtre « Graphique » (bouton « Graphique » de l'onglet « Données ») : le
// graphique des cellules sélectionnées, en colonnes, en courbe ou en
// secteurs, avec un titre ; « Enregistrer l'image » le télécharge en PNG.
//
// Le graphique n'est pas enregistré dans le classeur : c'est une « photo »
// des valeurs au moment où la fenêtre s'ouvre (on la rouvre pour le mettre à
// jour). Si une seule cellule est sélectionnée, on prend tout le tableau
// autour d'elle (comme pour le tri).

import { adresse, lirePlage, plage as creerPlage, textePlage } from '../donnees/adresses.js';
import { preparerGraphique, TYPES_GRAPHIQUE } from '../donnees/graphique.js';
import { zoneAutour } from '../donnees/tri.js';
import { nomDeFichier, telecharger } from '../services/fichiers.js';
import { COULEURS_IMAGE, HAUTEUR, LARGEUR, TAILLE_ETROITE, couleursDuTheme, dessinerGraphique } from './dessin-graphique.js';

export class FenetreGraphique {
  #type = 'colonnes';
  #donnees = null; // résultat de preparerGraphique

  /**
   * @param {object} options
   * @param {import('../donnees/classeur.js').Classeur} options.classeur
   * @param {import('./selection.js').Selection} options.selection
   * @param {(adresse: string) => *} options.valeur  valeur calculée d'une cellule de la feuille affichée
   * @param {(adresse: string) => {texte: string}} options.presenterCellule  texte affiché d'une cellule
   * @param {(fenetre: HTMLDialogElement) => void} options.ouvrirFenetre
   * @param {() => void} options.avantAction  termine la saisie en cours
   */
  constructor({ classeur, selection, valeur, presenterCellule, ouvrirFenetre, avantAction }) {
    this.classeur = classeur;
    this.selection = selection;
    this.valeur = valeur;
    this.presenterCellule = presenterCellule;
    this.ouvrirFenetre = ouvrirFenetre;
    this.avantAction = avantAction;

    const element = (id) => document.getElementById(id);
    this.fenetre = element('fenetre-graphique');
    this.champPlage = element('graphique-plage');
    this.champTitre = element('graphique-titre');
    this.zone = element('zone-graphique');
    this.note = element('note-graphique');
    this.boutonImage = element('graphique-image');
    this.boutonsType = [...this.fenetre.querySelectorAll('[data-type-graphique]')];

    element('bouton-graphique').addEventListener('click', () => this.ouvrir());
    for (const bouton of this.boutonsType) {
      bouton.addEventListener('click', () => this.choisirType(bouton.dataset.typeGraphique));
    }
    this.champPlage.addEventListener('input', () => this.#lireCellules());
    this.champTitre.addEventListener('input', () => this.#dessiner());
    for (const champ of [this.champPlage, this.champTitre]) {
      champ.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.isComposing) e.preventDefault();
      });
    }
    this.boutonImage.addEventListener('click', () => this.enregistrerImage());
  }

  get feuille() {
    return this.classeur.feuilleActive;
  }

  /** Ouvre la fenêtre avec le graphique des cellules sélectionnées. */
  ouvrir() {
    this.avantAction();
    const zone = this.#zoneDeDepart();
    this.champPlage.value = zone ? textePlage(zone) : '';
    this.champTitre.value = '';
    this.#lireCellules();
    // Une seule série avec un nom (ex. « Montant ») : il sert de titre, comme dans Excel.
    const series = this.#donnees?.ok ? this.#donnees.series : [];
    if (series.length === 1 && !/^Série \d+$/.test(series[0].nom)) {
      this.champTitre.value = series[0].nom;
      this.#dessiner();
    }
    this.ouvrirFenetre(this.fenetre);
  }

  /** Colonnes, courbe ou secteurs. */
  choisirType(type) {
    if (!TYPES_GRAPHIQUE.includes(type)) return;
    this.#type = type;
    this.#dessiner();
  }

  /**
   * Les cellules de départ : la sélection, ou le tableau autour de la cellule
   * active si une seule cellule est sélectionnée (sans un titre fusionné
   * posé au-dessus du tableau).
   */
  #zoneDeDepart() {
    const feuille = this.feuille;
    if (!this.selection.unique) return this.selection.plage;
    const { ligne, colonne } = this.selection.active;
    let zone = zoneAutour((a) => feuille.brut(a), feuille, ligne, colonne);
    while (zone && zone.fin.ligne > zone.debut.ligne) {
      const titre = feuille.fusions.find(
        (f) => f.debut.ligne === zone.debut.ligne && f.fin.ligne === zone.debut.ligne && f.fin.colonne > f.debut.colonne && f.debut.colonne <= zone.debut.colonne,
      );
      if (!titre) break;
      zone = creerPlage({ ligne: zone.debut.ligne + 1, colonne: zone.debut.colonne }, zone.fin);
    }
    return zone;
  }

  /** Lit les cellules indiquées dans le champ « Cellules », puis dessine. */
  #lireCellules() {
    const zone = lirePlage(this.champPlage.value.trim().toUpperCase());
    const feuille = this.feuille;
    if (!zone || zone.debut.ligne > feuille.lignes || zone.debut.colonne > feuille.colonnes) {
      this.#donnees = { ok: false, message: 'Indiquez des cellules, par exemple A1:B6 (ou sélectionnez-les avant d’ouvrir cette fenêtre).' };
    } else {
      const cellules = [];
      for (let l = zone.debut.ligne; l <= Math.min(zone.fin.ligne, feuille.lignes); l++) {
        const ligne = [];
        for (let c = zone.debut.colonne; c <= Math.min(zone.fin.colonne, feuille.colonnes); c++) {
          const adr = adresse(l, c);
          ligne.push({ valeur: this.valeur(adr), texte: this.presenterCellule(adr).texte });
        }
        cellules.push(ligne);
      }
      this.#donnees = preparerGraphique(cellules);
    }
    this.#dessiner();
  }

  /** Dessine le graphique avec les couleurs du thème (ou affiche ce qui manque). */
  #dessiner() {
    for (const bouton of this.boutonsType) {
      bouton.setAttribute('aria-pressed', String(bouton.dataset.typeGraphique === this.#type));
    }
    const donnees = this.#donnees;
    let message = donnees?.ok ? null : donnees?.message;
    let notes = [];
    this.zone.replaceChildren();
    if (donnees?.ok) {
      // Sur un téléphone, un dessin plus étroit : ses textes restent lisibles.
      const taille = window.innerWidth < 560 ? TAILLE_ETROITE : {};
      const dessin = dessinerGraphique(donnees, { type: this.#type, titre: this.champTitre.value, couleurs: couleursDuTheme(), ...taille });
      message = dessin.message ?? null;
      notes = [...donnees.notes, ...dessin.notes];
      if (!message) this.zone.append(dessin.svg);
    }
    if (message) {
      const texte = document.createElement('p');
      texte.className = 'message-graphique';
      texte.textContent = message;
      this.zone.append(texte);
    }
    this.note.textContent = notes.join(' ');
    this.boutonImage.disabled = Boolean(message);
  }

  /**
   * Enregistre le graphique en image PNG (fond blanc, deux fois plus grande
   * que le dessin pour rester nette) : le dessin SVG est « photographié »
   * dans un canevas, sans rien envoyer sur internet.
   */
  async enregistrerImage() {
    if (!this.#donnees?.ok) return;
    const titre = this.champTitre.value.trim();
    const { svg, message } = dessinerGraphique(this.#donnees, { type: this.#type, titre, couleurs: COULEURS_IMAGE });
    if (message) return;
    const lien = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }));
    try {
      const image = new Image();
      await new Promise((resoudre, rejeter) => {
        image.onload = resoudre;
        image.onerror = rejeter;
        image.src = lien;
      });
      const canevas = document.createElement('canvas');
      canevas.width = LARGEUR * 2;
      canevas.height = HAUTEUR * 2;
      canevas.getContext('2d').drawImage(image, 0, 0, canevas.width, canevas.height);
      const png = await new Promise((resoudre) => canevas.toBlob(resoudre, 'image/png'));
      telecharger(`${nomDeFichier(titre || this.classeur.titre)} (graphique).png`, png, 'image/png');
      this.note.textContent = 'Image enregistrée dans les téléchargements.';
    } catch {
      this.note.textContent = 'L’image n’a pas pu être créée sur cet appareil.';
    } finally {
      URL.revokeObjectURL(lien);
    }
  }
}
