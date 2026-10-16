// (c) L'AFFICHAGE DE LA GRILLE
//
// Ce module dessine le tableau (en-têtes A, B, C… et 1, 2, 3…, cellules),
// met à jour les cellules modifiées et dessine le cadre de sélection.
// Il ne décide de rien : les clics et les touches sont traités par
// interactions.js, et le contenu de chaque cellule lui est fourni par la
// fonction `presenterCellule` (voir app.js).

import { lettresColonne, lireAdresse } from '../donnees/adresses.js';

/** Largeur de la colonne des numéros de ligne (1, 2, 3…), en pixels. */
const LARGEUR_NUMEROS = 52;

export class Grille {
  #racine; // zone qui défile (div.zone-grille)
  #contenu; // tout ce qui défile avec le tableau
  #table;
  #colonnes = []; // éléments <col>, index = numéro de colonne
  #cellules = []; // #cellules[ligne][colonne] = <td>
  #entetesColonnes = []; // <th> du haut, index = numéro de colonne
  #entetesLignes = []; // <th> de gauche, index = numéro de ligne
  #coin;
  #cadrePlage;
  #cadreActif;
  #poignee;
  #enTeteSurlignees = [];

  /**
   * @param {object} options
   * @param {HTMLElement} options.racine  conteneur qui défile
   * @param {import('../donnees/classeur.js').Feuille} options.feuille
   * @param {(adresse: string) => {texte: string, genre: string, explication?: string, gras?: boolean, fond?: string|null}} options.presenterCellule
   */
  constructor({ racine, feuille, presenterCellule }) {
    this.#racine = racine;
    this.feuille = feuille;
    this.presenterCellule = presenterCellule;
    this.construire();
  }

  get racine() {
    return this.#racine;
  }

  /** Dessine tout le tableau (au démarrage, ou quand on ajoute des lignes ou des colonnes). */
  construire() {
    const { lignes, colonnes } = this.feuille;
    const contenu = document.createElement('div');
    contenu.className = 'grille-contenu';

    const table = document.createElement('table');
    table.className = 'grille';

    // Largeurs des colonnes : un <col> par colonne.
    const groupe = document.createElement('colgroup');
    const colEntete = document.createElement('col');
    colEntete.className = 'col-entete';
    colEntete.style.width = `${LARGEUR_NUMEROS}px`;
    groupe.append(colEntete);
    this.#colonnes = [null];
    for (let c = 1; c <= colonnes; c++) {
      const col = document.createElement('col');
      col.style.width = `${this.feuille.largeur(c)}px`;
      this.#colonnes.push(col);
      groupe.append(col);
    }

    // Ligne d'en-tête : A, B, C…
    const entete = document.createElement('thead');
    const ligneEntete = document.createElement('tr');
    this.#coin = document.createElement('th');
    this.#coin.className = 'coin';
    this.#coin.title = 'Tout sélectionner';
    ligneEntete.append(this.#coin);
    this.#entetesColonnes = [null];
    for (let c = 1; c <= colonnes; c++) {
      const th = document.createElement('th');
      th.className = 'entete-colonne';
      th.scope = 'col';
      th.dataset.colonne = c;
      th.textContent = lettresColonne(c);
      // Poignée pour changer la largeur de la colonne (à glisser).
      const poignee = document.createElement('span');
      poignee.className = 'poignee-largeur';
      poignee.dataset.colonne = c;
      poignee.title = 'Glisser pour changer la largeur (double-clic : ajuster au contenu)';
      th.append(poignee);
      this.#entetesColonnes.push(th);
      ligneEntete.append(th);
    }
    entete.append(ligneEntete);

    // Corps : une ligne <tr> par ligne du tableur, avec son numéro à gauche.
    const corps = document.createElement('tbody');
    this.#cellules = [null];
    this.#entetesLignes = [null];
    for (let l = 1; l <= lignes; l++) {
      const tr = document.createElement('tr');
      const th = document.createElement('th');
      th.className = 'entete-ligne';
      th.scope = 'row';
      th.dataset.ligne = l;
      th.textContent = l;
      tr.append(th);
      this.#entetesLignes.push(th);
      const rangee = [null];
      for (let c = 1; c <= colonnes; c++) {
        const td = document.createElement('td');
        td.dataset.ligne = l;
        td.dataset.colonne = c;
        rangee.push(td);
        tr.append(td);
      }
      this.#cellules.push(rangee);
      corps.append(tr);
    }

    table.append(groupe, entete, corps);

    // Cadres de sélection, dessinés par-dessus les cellules.
    this.#cadrePlage = document.createElement('div');
    this.#cadrePlage.className = 'cadre-plage';
    this.#cadreActif = document.createElement('div');
    this.#cadreActif.className = 'cadre-actif';
    this.#poignee = document.createElement('div');
    this.#poignee.className = 'poignee-selection';
    this.#poignee.title = 'Glisser pour étendre la sélection';
    contenu.append(table, this.#cadrePlage, this.#cadreActif, this.#poignee);

    // On garde l'éditeur de cellule (s'il est déjà là) et on remplace l'ancien tableau.
    this.#contenu?.remove();
    this.#racine.prepend(contenu);
    this.#contenu = contenu;
    this.#table = table;
    this.#enTeteSurlignees = [];
    this.#ajusterLargeurTable();

    // Remplissage des cellules non vides.
    for (const adresse of this.feuille.adresses()) this.rafraichirCellule(adresse);
  }

  /** Le <td> d'une cellule (ou undefined si elle est hors de la grille). */
  td(ligne, colonne) {
    return this.#cellules[ligne]?.[colonne];
  }

  get contenu() {
    return this.#contenu;
  }

  /** Redessine une cellule à partir de son adresse ("B3"). */
  rafraichirCellule(adresse) {
    const position = lireAdresse(adresse);
    const td = position && this.td(position.ligne, position.colonne);
    if (!td) return;
    const vue = this.presenterCellule(adresse);
    td.textContent = vue.texte;
    td.className = vue.genre === 'vide' ? '' : vue.genre;
    if (vue.gras) td.classList.add('gras');
    if (vue.fond) td.dataset.fond = vue.fond;
    else delete td.dataset.fond;
    if (vue.explication) td.title = vue.explication;
    else td.removeAttribute('title');
  }

  rafraichirCellules(adresses) {
    for (const adresse of adresses) this.rafraichirCellule(adresse);
  }

  /** Applique les largeurs de colonnes enregistrées dans la feuille. */
  rafraichirLargeurs(colonnes = null) {
    const liste = colonnes ?? this.#colonnes.keys();
    for (const c of liste) {
      if (this.#colonnes[c]) this.#colonnes[c].style.width = `${this.feuille.largeur(c)}px`;
    }
    this.#ajusterLargeurTable();
  }

  /** Largeur provisoire d'une colonne pendant qu'on la fait glisser. */
  apercuLargeur(colonne, largeur) {
    if (this.#colonnes[colonne]) this.#colonnes[colonne].style.width = `${largeur}px`;
    this.#ajusterLargeurTable();
  }

  /**
   * La largeur du tableau doit être la somme exacte des colonnes : c'est ce
   * qui oblige le navigateur à respecter la largeur de chaque colonne, même
   * si un texte est plus long (il est alors coupé avec « … »).
   */
  #ajusterLargeurTable() {
    let total = LARGEUR_NUMEROS;
    for (let c = 1; c < this.#colonnes.length; c++) total += parseFloat(this.#colonnes[c].style.width);
    this.#table.style.width = `${total}px`;
  }

  /** Position d'une cellule dans la zone qui défile (en pixels). */
  #rectangle(ligne, colonne) {
    const td = this.td(ligne, colonne);
    const origine = this.#contenu.getBoundingClientRect();
    const r = td.getBoundingClientRect();
    return { gauche: r.left - origine.left, haut: r.top - origine.top, droite: r.right - origine.left, bas: r.bottom - origine.top };
  }

  /** Dessine la sélection : cadre de la plage, cadre de la cellule active, en-têtes surlignés. */
  afficherSelection(selection) {
    const { debut, fin } = selection.plage;
    const active = selection.active;
    if (!this.td(debut.ligne, debut.colonne) || !this.td(fin.ligne, fin.colonne)) return;

    const a = this.#rectangle(debut.ligne, debut.colonne);
    const b = this.#rectangle(fin.ligne, fin.colonne);
    const placer = (element, r) => {
      element.style.transform = `translate(${r.gauche}px, ${r.haut}px)`;
      element.style.width = `${r.droite - r.gauche}px`;
      element.style.height = `${r.bas - r.haut}px`;
    };
    placer(this.#cadrePlage, { gauche: a.gauche, haut: a.haut, droite: b.droite, bas: b.bas });
    this.#cadrePlage.hidden = selection.unique;
    placer(this.#cadreActif, this.#rectangle(active.ligne, active.colonne));
    this.#poignee.style.transform = `translate(${b.droite}px, ${b.bas}px)`;

    // En-têtes des lignes et colonnes sélectionnées.
    for (const th of this.#enTeteSurlignees) th.classList.remove('surligne');
    this.#enTeteSurlignees = [];
    for (let c = debut.colonne; c <= fin.colonne; c++) this.#enTeteSurlignees.push(this.#entetesColonnes[c]);
    for (let l = debut.ligne; l <= fin.ligne; l++) this.#enTeteSurlignees.push(this.#entetesLignes[l]);
    for (const th of this.#enTeteSurlignees) th.classList.add('surligne');
  }

  /** Fait défiler la grille pour que la cellule soit visible (sans passer sous les en-têtes). */
  rendreVisible(ligne, colonne) {
    const td = this.td(ligne, colonne);
    if (!td) return;
    const zone = this.#racine;
    const bords = zone.getBoundingClientRect();
    const r = td.getBoundingClientRect();
    const hautEntetes = this.#coin.getBoundingClientRect().height;
    const largeurEntetes = this.#coin.getBoundingClientRect().width;

    const hautVisible = bords.top + zone.clientTop + hautEntetes;
    const basVisible = bords.top + zone.clientTop + zone.clientHeight;
    if (r.top < hautVisible) zone.scrollTop -= hautVisible - r.top;
    else if (r.bottom > basVisible) zone.scrollTop += r.bottom - basVisible;

    const gaucheVisible = bords.left + zone.clientLeft + largeurEntetes;
    const droiteVisible = bords.left + zone.clientLeft + zone.clientWidth;
    if (r.left < gaucheVisible) zone.scrollLeft -= gaucheVisible - r.left;
    else if (r.right > droiteVisible) zone.scrollLeft += Math.min(r.right - droiteVisible, r.left - gaucheVisible);
  }

  /**
   * Indique ce qui se trouve sous un élément cliqué :
   * { type: 'cellule', ligne, colonne } | { type: 'colonne', colonne } | { type: 'ligne', ligne }
   * | { type: 'coin' } | { type: 'largeur', colonne } | null
   */
  cible(element) {
    if (!(element instanceof Element)) return null;
    const poignee = element.closest('.poignee-largeur');
    if (poignee) return { type: 'largeur', colonne: Number(poignee.dataset.colonne) };
    if (element.closest('.poignee-selection')) return { type: 'poignee' };
    const td = element.closest('td[data-ligne]');
    if (td) return { type: 'cellule', ligne: Number(td.dataset.ligne), colonne: Number(td.dataset.colonne) };
    const thColonne = element.closest('th.entete-colonne');
    if (thColonne) return { type: 'colonne', colonne: Number(thColonne.dataset.colonne) };
    const thLigne = element.closest('th.entete-ligne');
    if (thLigne) return { type: 'ligne', ligne: Number(thLigne.dataset.ligne) };
    if (element.closest('th.coin')) return { type: 'coin' };
    return null;
  }

  /** La cellule qui se trouve sous un point de l'écran (pour le glisser). */
  celluleSousPoint(x, y) {
    const element = document.elementFromPoint(x, y);
    const trouve = this.cible(element);
    if (trouve?.type === 'cellule') return trouve;
    // Au-dessus d'un en-tête : on prend la ligne ou la colonne correspondante.
    if (trouve?.type === 'colonne' || trouve?.type === 'largeur') return { type: 'cellule', ligne: null, colonne: trouve.colonne };
    if (trouve?.type === 'ligne') return { type: 'cellule', ligne: trouve.ligne, colonne: null };
    return null;
  }

  /** Rectangle (à l'écran) d'une cellule. */
  rectangleEcran(ligne, colonne) {
    return this.td(ligne, colonne)?.getBoundingClientRect() ?? null;
  }

  /** Rectangle d'une cellule dans la zone qui défile (pour placer l'éditeur). */
  rectangleContenu(ligne, colonne) {
    return this.td(ligne, colonne) ? this.#rectangle(ligne, colonne) : null;
  }
}
