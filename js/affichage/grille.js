// (c) L'AFFICHAGE DE LA GRILLE
//
// Ce module dessine le tableau (en-têtes A, B, C… et 1, 2, 3…, cellules),
// met à jour les cellules modifiées et dessine le cadre de sélection.
// Il ne décide de rien : les clics et les touches sont traités par
// interactions.js, et le contenu de chaque cellule lui est fourni par la
// fonction `presenterCellule` (voir app.js).
//
// « Grille virtuelle » : pour rester fluide sur téléphone, seules les lignes
// visibles à l'écran (plus une marge au-dessus et en dessous) existent
// réellement dans la page. Deux lignes vides « d'espacement », en haut et en
// bas, ont la hauteur des lignes non dessinées : la barre de défilement
// garde ainsi sa taille normale. Quand on fait défiler, les lignes qui
// sortent de la zone sont retirées et celles qui arrivent sont dessinées.
//
// Toutes les lignes ont la même hauteur : la position d'une cellule se
// calcule donc directement (ligne × hauteur), sans la chercher dans la page.
//
// Première ligne figée : elle reste toujours dessinée, collée sous les
// en-têtes A, B, C… (CSS « position: sticky »). Les cadres de sélection et
// le champ de saisie qui la concernent sont placés dans une « couche figée »
// qui reste, elle aussi, collée en haut.

import { lettresColonne, lireAdresse } from '../donnees/adresses.js';

/** Largeur de la colonne des numéros de ligne (1, 2, 3…), en pixels. */
const LARGEUR_NUMEROS = 52;

/** Nombre de lignes dessinées en plus, au-dessus et en dessous de la partie visible. */
const MARGE = 30;

/** On redessine quand il reste moins de SEUIL lignes d'avance d'un côté. */
const SEUIL = 10;

export class Grille {
  #racine; // zone qui défile (main.zone-grille)
  #contenu; // tout ce qui défile avec le tableau
  #table;
  #corps; // <tbody>
  #colonnes = []; // éléments <col>, index = numéro de colonne
  #entetesColonnes = []; // <th> du haut, index = numéro de colonne
  #coin;
  #espaceHaut; // ligne vide qui remplace les lignes non dessinées au-dessus
  #espaceBas; // … et en dessous
  /** @type {Map<number, {tr: HTMLTableRowElement, th: HTMLTableCellElement, tds: HTMLTableCellElement[]}>} */
  #lignes = new Map(); // lignes dessinées, par numéro
  #premiere = 1; // fenêtre de lignes dessinées (sans compter la ligne figée)
  #derniere = 0;
  #hauteur = 32; // hauteur d'une ligne (et des en-têtes), en pixels
  #positions = [0]; // #positions[c] = bord gauche de la colonne c, dans le contenu
  #figee = false; // première ligne figée ?
  #couche; // couche figée (cadres et saisie de la ligne 1 quand elle est figée)
  #cadres; // { plage, actif, plageFige, actifFige }
  #poignee; // poignée ronde (au doigt) : étend la sélection
  #poigneeRecopie; // petit carré (à la souris) : recopie la sélection
  #cadreRecopie; // contour pointillé pendant une recopie
  #plageSelection = null; // dernière plage dessinée (pour surligner les en-têtes)

  /**
   * @param {object} options
   * @param {HTMLElement} options.racine  conteneur qui défile
   * @param {import('../donnees/classeur.js').Feuille} options.feuille
   * @param {(adresse: string, ligne: number, colonne: number) => object} options.presenterCellule
   *        ce qu'affiche une cellule : { texte, genre, explication?, gras?, italique?,
   *        couleur?, fond?, alignement?, bordures? } (voir app.js)
   */
  constructor({ racine, feuille, presenterCellule }) {
    this.#racine = racine;
    this.feuille = feuille;
    this.presenterCellule = presenterCellule;

    // Le défilement dessine les lignes qui arrivent à l'écran.
    racine.addEventListener('scroll', () => this.#mettreAJourFenetre(), { passive: true });
    // La zone change de taille (fenêtre redimensionnée, clavier du téléphone ouvert…).
    if ('ResizeObserver' in window) new ResizeObserver(() => this.#mettreAJourFenetre()).observe(racine);
    // Passage souris ↔ doigt : la hauteur des lignes change (voir css/grille.css).
    window.matchMedia('(pointer: coarse)').addEventListener?.('change', () => this.construire());

    this.construire();
  }

  get racine() {
    return this.#racine;
  }

  get contenu() {
    return this.#contenu;
  }

  /** Hauteur d'une ligne en pixels. */
  get hauteurLigne() {
    return this.#hauteur;
  }

  /** Change la feuille affichée (onglets) et redessine tout. */
  changerFeuille(feuille) {
    this.feuille = feuille;
    this.construire();
  }

  // --- Construction ---------------------------------------------------------------

  /**
   * Dessine tout le tableau : au démarrage, au changement de feuille, ou quand
   * des lignes ou des colonnes sont ajoutées ou retirées.
   */
  construire() {
    const { colonnes } = this.feuille;
    this.#hauteur = parseFloat(getComputedStyle(this.#racine).getPropertyValue('--hauteur-ligne')) || 32;
    this.#figee = this.feuille.figee === true;

    const contenu = document.createElement('div');
    contenu.className = 'grille-contenu';

    const table = document.createElement('table');
    table.className = 'grille';

    // Largeurs des colonnes : un <col> par colonne.
    const groupe = document.createElement('colgroup');
    const colEntete = document.createElement('col');
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

    // Corps : les lignes d'espacement, entre lesquelles viendront les lignes dessinées.
    const corps = document.createElement('tbody');
    this.#espaceHaut = this.#creerEspace();
    this.#espaceBas = this.#creerEspace();
    corps.append(this.#espaceHaut, this.#espaceBas);

    table.append(groupe, entete, corps);

    // Couche figée (collée sous les en-têtes), puis cadres de sélection,
    // dessinés par-dessus les cellules.
    this.#couche = document.createElement('div');
    this.#couche.className = 'couche-figee';
    this.#couche.hidden = !this.#figee;
    const cadre = (classe) => {
      const element = document.createElement('div');
      element.className = classe;
      return element;
    };
    this.#cadres = {
      plage: cadre('cadre-plage'),
      actif: cadre('cadre-actif'),
      plageFige: cadre('cadre-plage'),
      actifFige: cadre('cadre-actif'),
    };
    this.#couche.append(this.#cadres.plageFige, this.#cadres.actifFige);
    this.#poignee = cadre('poignee-selection');
    this.#poignee.title = 'Glisser pour étendre la sélection';
    this.#poigneeRecopie = cadre('poignee-recopie');
    this.#poigneeRecopie.title = 'Glisser pour recopier (les formules s’adaptent, les suites continuent)';
    this.#cadreRecopie = cadre('cadre-recopie');
    this.#cadreRecopie.hidden = true;
    contenu.append(this.#couche, table, this.#cadres.plage, this.#cadres.actif, this.#cadreRecopie, this.#poignee, this.#poigneeRecopie);

    // On garde l'éditeur de cellule (s'il est dans l'ancien tableau, avec son
    // focus) et on remplace l'ancien tableau.
    const editeur = this.#contenu?.querySelector('.editeur-cellule');
    if (editeur) {
      const avaitLeFocus = document.activeElement === editeur;
      this.#racine.append(editeur);
      if (avaitLeFocus) editeur.focus({ preventScroll: true });
    }
    this.#contenu?.remove();
    this.#racine.prepend(contenu);
    this.#contenu = contenu;
    this.#table = table;
    this.#corps = corps;
    this.#lignes = new Map();
    this.#premiere = 1;
    this.#derniere = 0;
    this.#calculerPositions();

    // Ligne 1 figée : toujours dessinée, en premier.
    if (this.#figee) corps.prepend(this.#creerLigne(1).tr);
    this.#mettreAJourFenetre(true);
  }

  #creerEspace() {
    const tr = document.createElement('tr');
    tr.className = 'espace';
    tr.setAttribute('aria-hidden', 'true');
    const td = document.createElement('td');
    td.colSpan = this.feuille.colonnes + 1;
    tr.append(td);
    tr.hidden = true;
    return tr;
  }

  /** Crée (sans l'insérer) la ligne `l` du tableau, remplie. */
  #creerLigne(l) {
    const tr = document.createElement('tr');
    if (this.#figee && l === 1) tr.className = 'ligne-figee';
    const th = document.createElement('th');
    th.className = 'entete-ligne';
    th.scope = 'row';
    th.dataset.ligne = l;
    th.textContent = l;
    tr.append(th);
    const tds = [null];
    for (let c = 1; c <= this.feuille.colonnes; c++) {
      const td = document.createElement('td');
      td.dataset.ligne = l;
      td.dataset.colonne = c;
      tds.push(td);
      tr.append(td);
    }
    const ligne = { tr, th, tds };
    this.#lignes.set(l, ligne);
    for (let c = 1; c <= this.feuille.colonnes; c++) this.#remplir(tds[c], l, c);
    this.#surlignerEntete(th, this.#plageSelection && l >= this.#plageSelection.debut.ligne && l <= this.#plageSelection.fin.ligne);
    return ligne;
  }

  // --- Fenêtre de lignes dessinées ----------------------------------------------------

  /**
   * Dessine les lignes qui arrivent à l'écran et retire celles qui en sont
   * loin. Appelée à chaque défilement : ne fait rien tant qu'il reste assez
   * de lignes d'avance.
   */
  #mettreAJourFenetre(forcer = false) {
    if (!this.#corps) return;
    const total = this.feuille.lignes;
    const debutFeuille = this.#figee ? 2 : 1; // la ligne 1 figée est dessinée à part
    const h = this.#hauteur;
    const haut = this.#racine.scrollTop;
    const hauteurVue = this.#racine.clientHeight || 800;
    const premiereVisible = Math.max(debutFeuille, Math.floor(haut / h) + 1);
    const derniereVisible = Math.min(total, Math.ceil((haut + hauteurVue) / h));

    const assez =
      !forcer &&
      this.#derniere >= this.#premiere &&
      (premiereVisible - this.#premiere >= SEUIL || this.#premiere <= debutFeuille) &&
      (this.#derniere - derniereVisible >= SEUIL || this.#derniere >= total);
    if (assez) return;

    const premiere = Math.max(debutFeuille, premiereVisible - MARGE);
    const derniere = Math.min(total, Math.max(premiere - 1, derniereVisible + MARGE));

    // Retire les lignes sorties de la fenêtre.
    for (const [l, ligne] of this.#lignes) {
      if (this.#figee && l === 1) continue;
      if (l < premiere || l > derniere) {
        ligne.tr.remove();
        this.#lignes.delete(l);
      }
    }
    // Ajoute les lignes manquantes, au bon endroit.
    const avant = document.createDocumentFragment();
    const apres = document.createDocumentFragment();
    const dejaLa = (l) => this.#lignes.has(l);
    const premiereDejaLa = [...this.#lignes.keys()].filter((l) => !(this.#figee && l === 1)).sort((a, b) => a - b)[0];
    for (let l = premiere; l <= derniere; l++) {
      if (dejaLa(l)) continue;
      const { tr } = this.#creerLigne(l);
      if (premiereDejaLa !== undefined && l < premiereDejaLa) avant.append(tr);
      else apres.append(tr);
    }
    this.#espaceHaut.after(avant);
    this.#espaceBas.before(apres);

    this.#premiere = premiere;
    this.#derniere = derniere;
    const lignesAuDessus = premiere - debutFeuille;
    const lignesEnDessous = total - derniere;
    this.#espaceHaut.hidden = lignesAuDessus <= 0;
    this.#espaceHaut.style.height = `${Math.max(0, lignesAuDessus) * h}px`;
    this.#espaceBas.hidden = lignesEnDessous <= 0;
    this.#espaceBas.style.height = `${Math.max(0, lignesEnDessous) * h}px`;
  }

  /** Le <td> d'une cellule, ou undefined si sa ligne n'est pas dessinée (hors de l'écran). */
  td(ligne, colonne) {
    return this.#lignes.get(ligne)?.tds[colonne];
  }

  // --- Contenu des cellules --------------------------------------------------------------

  /** Redessine une cellule à partir de son adresse ("B3"), si elle est dessinée. */
  rafraichirCellule(adresse) {
    const position = lireAdresse(adresse);
    if (!position) return;
    const td = this.td(position.ligne, position.colonne);
    if (td) this.#remplir(td, position.ligne, position.colonne);
  }

  rafraichirCellules(adresses) {
    for (const adresse of adresses) this.rafraichirCellule(adresse);
  }

  /** Redessine toutes les cellules dessinées (après un changement de thème de bordures, etc.). */
  rafraichirTout() {
    for (const [l, { tds }] of this.#lignes) {
      for (let c = 1; c < tds.length; c++) this.#remplir(tds[c], l, c);
    }
  }

  /** Remplit un <td> avec ce qu'affiche la cellule (texte, mise en forme, bordures). */
  #remplir(td, ligne, colonne) {
    const vue = this.presenterCellule(lettresColonne(colonne) + ligne, ligne, colonne);
    td.textContent = vue.texte;
    td.className = vue.genre === 'vide' ? '' : vue.genre;
    if (vue.gras) td.classList.add('gras');
    if (vue.italique) td.classList.add('italique');
    const attribut = (nom, valeur) => {
      if (valeur) td.dataset[nom] = valeur;
      else delete td.dataset[nom];
    };
    attribut('fond', vue.fond);
    attribut('encre', vue.couleur);
    attribut('align', vue.alignement);
    if (vue.explication) td.title = vue.explication;
    else td.removeAttribute('title');
    this.#dessinerBordures(td, vue.bordures);
  }

  /**
   * Bordures choisies par la personne. Le bas et la droite remplacent le
   * quadrillage de la cellule ; le haut (ligne 1) et la gauche (colonne A),
   * qui n'ont pas de voisine pour les dessiner, sont tracés à l'intérieur.
   */
  #dessinerBordures(td, bordures) {
    const trait = (bordure) => `${bordure.style === 'epais' ? 2 : 1}px solid ${couleurBordure(bordure.couleur)}`;
    td.style.borderBottom = bordures?.bas ? trait(bordures.bas) : '';
    td.style.borderRight = bordures?.droite ? trait(bordures.droite) : '';
    const ombres = [];
    if (bordures?.haut) ombres.push(`inset 0 ${bordures.haut.style === 'epais' ? 2 : 1}px 0 ${couleurBordure(bordures.haut.couleur)}`);
    if (bordures?.gauche) ombres.push(`inset ${bordures.gauche.style === 'epais' ? 2 : 1}px 0 0 ${couleurBordure(bordures.gauche.couleur)}`);
    td.style.boxShadow = ombres.join(', ');
  }

  // --- Largeur des colonnes ---------------------------------------------------------------

  /** Calcule le bord gauche de chaque colonne et la largeur totale du tableau. */
  #calculerPositions() {
    this.#positions = [0, LARGEUR_NUMEROS];
    for (let c = 1; c < this.#colonnes.length; c++) {
      this.#positions.push(this.#positions[c] + parseFloat(this.#colonnes[c].style.width));
    }
    // La largeur du tableau doit être la somme exacte des colonnes : c'est ce
    // qui oblige le navigateur à respecter la largeur de chaque colonne, même
    // si un texte est plus long (il est alors coupé avec « … »).
    this.#table.style.width = `${this.#positions.at(-1)}px`;
  }

  /** Applique les largeurs de colonnes enregistrées dans la feuille. */
  rafraichirLargeurs(colonnes = null) {
    const liste = colonnes ?? this.#colonnes.keys();
    for (const c of liste) {
      if (this.#colonnes[c]) this.#colonnes[c].style.width = `${this.feuille.largeur(c)}px`;
    }
    this.#calculerPositions();
  }

  /** Largeur provisoire d'une colonne pendant qu'on la fait glisser. */
  apercuLargeur(colonne, largeur) {
    if (this.#colonnes[colonne]) this.#colonnes[colonne].style.width = `${largeur}px`;
    this.#calculerPositions();
  }

  // --- Positions ----------------------------------------------------------------------------

  /** Vrai si la ligne est la ligne figée (ligne 1 quand la première ligne est figée). */
  #estFigee(ligne) {
    return this.#figee && ligne === 1;
  }

  /**
   * Position d'une cellule, en pixels : dans la couche figée pour la ligne 1
   * figée, dans le contenu qui défile sinon.
   */
  #rectangle(ligne, colonne) {
    const haut = this.#estFigee(ligne) ? 0 : this.#hauteur * ligne; // la ligne d'en-tête a la même hauteur
    const gauche = this.#positions[colonne] ?? 0;
    const droite = this.#positions[colonne + 1] ?? gauche;
    return { gauche, haut, droite, bas: haut + this.#hauteur };
  }

  /** Rectangle d'une cellule dans son conteneur (pour placer l'éditeur). */
  rectangleContenu(ligne, colonne) {
    if (ligne < 1 || colonne < 1 || ligne > this.feuille.lignes || colonne > this.feuille.colonnes) return null;
    return this.#rectangle(ligne, colonne);
  }

  /** Rectangle d'une cellule à l'écran (coordonnées de la fenêtre). */
  rectangleEcran(ligne, colonne) {
    const r = this.rectangleContenu(ligne, colonne);
    if (!r) return null;
    const origine = (this.#estFigee(ligne) ? this.#couche : this.#contenu).getBoundingClientRect();
    return new DOMRect(origine.left + r.gauche, origine.top + r.haut, r.droite - r.gauche, r.bas - r.haut);
  }

  /**
   * Place un élément (le champ de saisie) dans le bon conteneur pour la ligne
   * donnée : la couche figée pour la ligne 1 figée, le contenu sinon. Le focus
   * est conservé si l'élément change de conteneur.
   */
  accueillir(element, ligne) {
    const conteneur = this.#estFigee(ligne) ? this.#couche : this.#contenu;
    if (element.parentElement === conteneur) return;
    const avaitLeFocus = document.activeElement === element;
    conteneur.append(element);
    if (avaitLeFocus) element.focus({ preventScroll: true });
  }

  // --- Sélection ------------------------------------------------------------------------------

  /** Dessine la sélection : cadre de la plage, cadre de la cellule active, en-têtes surlignés. */
  afficherSelection(selection) {
    const { debut, fin } = selection.plage;
    const active = selection.active;
    const placer = (element, a, b, sansHaut = false, sansBas = false) => {
      element.hidden = false;
      element.style.transform = `translate(${a.gauche}px, ${a.haut}px)`;
      element.style.width = `${b.droite - a.gauche}px`;
      element.style.height = `${b.bas - a.haut}px`;
      element.classList.toggle('sans-haut', sansHaut);
      element.classList.toggle('sans-bas', sansBas);
    };
    const { plage, actif, plageFige, actifFige } = this.#cadres;
    plage.hidden = plageFige.hidden = actif.hidden = actifFige.hidden = true;

    // Plage : partie figée (ligne 1) et partie qui défile (lignes suivantes).
    if (!selection.unique) {
      const partieFigee = this.#figee && debut.ligne === 1;
      if (partieFigee) {
        placer(plageFige, this.#rectangle(1, debut.colonne), this.#rectangle(1, fin.colonne), false, fin.ligne > 1);
      }
      if (!partieFigee || fin.ligne > 1) {
        const ligneDebut = partieFigee ? 2 : debut.ligne;
        placer(plage, this.#rectangle(ligneDebut, debut.colonne), this.#rectangle(fin.ligne, fin.colonne), partieFigee, false);
      }
    }
    const rActive = this.#rectangle(active.ligne, active.colonne);
    placer(this.#estFigee(active.ligne) ? actifFige : actif, rActive, rActive);

    // Poignées (ronde au doigt, carrée à la souris) dans le coin en bas à droite.
    const coin = this.#rectangle(fin.ligne, fin.colonne);
    for (const poignee of [this.#poignee, this.#poigneeRecopie]) {
      this.accueillir(poignee, fin.ligne);
      poignee.style.transform = `translate(${coin.droite}px, ${coin.bas}px)`;
    }

    // En-têtes des lignes et colonnes sélectionnées.
    this.#plageSelection = { debut: { ...debut }, fin: { ...fin } };
    for (let c = 1; c < this.#entetesColonnes.length; c++) {
      this.#surlignerEntete(this.#entetesColonnes[c], c >= debut.colonne && c <= fin.colonne);
    }
    for (const [l, { th }] of this.#lignes) this.#surlignerEntete(th, l >= debut.ligne && l <= fin.ligne);
  }

  /** Contour pointillé de la zone qui sera remplie par la recopie (null pour l'effacer). */
  afficherRecopie(plage) {
    const cadre = this.#cadreRecopie;
    cadre.hidden = !plage;
    if (!plage) return;
    // Dessiné dans le contenu qui défile : la ligne l commence à l × hauteur
    // (la ligne des en-têtes A, B, C… a la même hauteur).
    const gauche = this.#positions[plage.debut.colonne];
    const droite = this.#positions[plage.fin.colonne + 1];
    const haut = this.#hauteur * plage.debut.ligne;
    const bas = this.#hauteur * (plage.fin.ligne + 1);
    cadre.style.transform = `translate(${gauche}px, ${haut}px)`;
    cadre.style.width = `${droite - gauche}px`;
    cadre.style.height = `${bas - haut}px`;
  }

  #surlignerEntete(th, oui) {
    if (th.classList.contains('surligne') !== Boolean(oui)) th.classList.toggle('surligne', Boolean(oui));
  }

  /** Fait défiler la grille pour que la cellule soit visible (sans passer sous les en-têtes). */
  rendreVisible(ligne, colonne) {
    const zone = this.#racine;
    const h = this.#hauteur;
    if (ligne >= 1 && ligne <= this.feuille.lignes && !this.#estFigee(ligne)) {
      const haut = h * ligne;
      const bas = haut + h;
      const hautVisible = zone.scrollTop + h + (this.#figee ? h : 0);
      const basVisible = zone.scrollTop + zone.clientHeight;
      if (haut < hautVisible) zone.scrollTop -= hautVisible - haut;
      else if (bas > basVisible) zone.scrollTop += bas - basVisible;
    }
    if (colonne >= 1 && colonne <= this.feuille.colonnes) {
      const gauche = this.#positions[colonne];
      const droite = this.#positions[colonne + 1];
      const gaucheVisible = zone.scrollLeft + LARGEUR_NUMEROS;
      const droiteVisible = zone.scrollLeft + zone.clientWidth;
      if (gauche < gaucheVisible) zone.scrollLeft -= gaucheVisible - gauche;
      else if (droite > droiteVisible) zone.scrollLeft += Math.min(droite - droiteVisible, gauche - gaucheVisible);
    }
    // Les lignes qui arrivent à l'écran sont dessinées tout de suite.
    this.#mettreAJourFenetre();
  }

  // --- Ce qui se trouve sous le doigt ou la souris -------------------------------------------

  /**
   * Indique ce qui se trouve sous un élément cliqué :
   * { type: 'cellule', ligne, colonne } | { type: 'colonne', colonne } | { type: 'ligne', ligne }
   * | { type: 'coin' } | { type: 'largeur', colonne } | { type: 'poignee' } | { type: 'recopie' } | null
   */
  cible(element) {
    if (!(element instanceof Element)) return null;
    const poignee = element.closest('.poignee-largeur');
    if (poignee) return { type: 'largeur', colonne: Number(poignee.dataset.colonne) };
    if (element.closest('.poignee-selection')) return { type: 'poignee' };
    if (element.closest('.poignee-recopie')) return { type: 'recopie' };
    const td = element.closest('td[data-ligne]');
    if (td) return { type: 'cellule', ligne: Number(td.dataset.ligne), colonne: Number(td.dataset.colonne) };
    const thColonne = element.closest('th.entete-colonne');
    if (thColonne) return { type: 'colonne', colonne: Number(thColonne.dataset.colonne) };
    const thLigne = element.closest('th.entete-ligne');
    if (thLigne) return { type: 'ligne', ligne: Number(thLigne.dataset.ligne) };
    if (element.closest('th.coin')) return { type: 'coin' };
    return null;
  }

  /**
   * La cellule qui se trouve sous un point de l'écran (pour le glisser),
   * calculée d'après les positions. Au-dessus des en-têtes, `ligne` ou
   * `colonne` vaut null.
   */
  celluleSousPoint(x, y) {
    const zone = this.#racine;
    const bords = zone.getBoundingClientRect();
    const h = this.#hauteur;
    const vy = y - bords.top - zone.clientTop; // position dans la partie visible
    const vx = x - bords.left - zone.clientLeft;

    let ligne = null;
    if (vy >= h) {
      if (this.#figee && vy < 2 * h) ligne = 1;
      else ligne = Math.floor((vy + zone.scrollTop) / h);
      ligne = Math.min(this.feuille.lignes, Math.max(1, ligne));
    }
    let colonne = null;
    if (vx >= LARGEUR_NUMEROS) {
      const cx = vx + zone.scrollLeft;
      colonne = this.feuille.colonnes;
      for (let c = 1; c <= this.feuille.colonnes; c++) {
        if (cx < this.#positions[c + 1]) {
          colonne = c;
          break;
        }
      }
    }
    if (ligne === null && colonne === null) return null;
    return { type: 'cellule', ligne, colonne };
  }
}

/** Couleur CSS d'une bordure : « auto » suit la couleur du texte du thème. */
export function couleurBordure(couleur) {
  return !couleur || couleur === 'auto' ? 'var(--bordure-auto)' : `var(--encre-${couleur})`;
}
