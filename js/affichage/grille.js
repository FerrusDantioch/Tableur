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
// Les lignes ont toutes la même hauteur, sauf celles qui contiennent du texte
// « renvoyé à la ligne » : elles grandissent pour le montrer en entier. Le
// haut de chaque ligne est calculé une fois pour toutes (#hauts) : la
// position d'une cellule se lit donc directement, sans la chercher dans la page.
//
// Cellules fusionnées : chacune est dessinée par-dessus les cellules qu'elle
// couvre (un bloc posé sur la grille, avec le texte et la mise en forme de
// la cellule en haut à gauche). Le tableau lui-même ne change pas.
//
// Zoom : toutes les tailles (hauteur des lignes, largeur des colonnes, texte)
// sont multipliées par le même facteur. Le classeur, lui, garde les largeurs
// « à 100 % » : le zoom ne change que l'affichage.
//
// Première ligne figée : elle reste toujours dessinée, collée sous les
// en-têtes A, B, C… (CSS « position: sticky »). Les cadres de sélection et
// le champ de saisie qui la concernent sont placés dans une « couche figée »
// qui reste, elle aussi, collée en haut.

import { adresse, lettresColonne, lireAdresse } from '../donnees/adresses.js';

/** Largeur de la colonne des numéros de ligne (1, 2, 3…), en pixels, à 100 %. */
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
  #hauteur = 32; // hauteur d'une ligne (et des en-têtes), en pixels, zoom compris
  #zoom = 1; // 1 = 100 %
  #largeurNumeros = LARGEUR_NUMEROS; // colonne des numéros, zoom compris
  #positions = [0]; // #positions[c] = bord gauche de la colonne c, dans le contenu
  #figee = false; // première ligne figée ?
  #couche; // couche figée (cadres et saisie de la ligne 1 quand elle est figée)
  #cadres; // { plage, actif, plageFige, actifFige }
  #poignee; // poignée ronde (au doigt) : étend la sélection
  #poigneeRecopie; // petit carré (à la souris) : recopie la sélection
  #cadreRecopie; // contour pointillé pendant une recopie
  #plageSelection = null; // dernière plage dessinée (pour surligner les en-têtes)
  #selection = null; // dernière sélection dessinée (redessinée quand une ligne change de hauteur)
  #blocsFusion = []; // blocs qui dessinent les cellules fusionnées
  /** @type {Map<number, number>} lignes plus hautes que les autres (retour à la ligne) : ligne → hauteur, zoom compris */
  #hauteursLignes = new Map();
  #hauts = [0, 0]; // #hauts[l] = haut de la ligne l dans le contenu ; #hauts[nombre de lignes + 1] = bas du tableau
  #mesureur = null; // zone invisible où le navigateur mesure le texte renvoyé à la ligne

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
    this.#mesureur = document.createElement('div');
    this.#mesureur.className = 'mesure-retour';
    this.#mesureur.setAttribute('aria-hidden', 'true');
    racine.append(this.#mesureur);

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

  /** Hauteur d'une ligne ordinaire en pixels (zoom compris). */
  get hauteurLigne() {
    return this.#hauteur;
  }

  /** Hauteur à l'écran d'une ligne précise (plus grande si elle contient du texte renvoyé à la ligne). */
  hauteurDe(ligne) {
    return this.#hauteursLignes.get(ligne) ?? this.#hauteur;
  }

  /** Zoom actuel (1 = 100 %). */
  get zoom() {
    return this.#zoom;
  }

  /**
   * Change le zoom (0,5 à 2) et redessine. Le point `point` de l'écran
   * ({ x, y }, par exemple entre les deux doigts) reste au même endroit ;
   * sans point, c'est le coin en haut à gauche de la grille.
   */
  changerZoom(facteur, point = null) {
    if (facteur === this.#zoom) return;
    const zone = this.#racine;
    const bords = zone.getBoundingClientRect();
    const vx = point ? point.x - bords.left : 0;
    const vy = point ? point.y - bords.top : 0;
    const rapport = facteur / this.#zoom;
    const x = zone.scrollLeft + vx;
    const y = zone.scrollTop + vy;
    this.#zoom = facteur;
    zone.style.setProperty('--zoom', String(facteur));
    this.construire();
    zone.scrollLeft = x * rapport - vx;
    zone.scrollTop = y * rapport - vy;
    this.#mettreAJourFenetre();
  }

  /** Largeur à l'écran d'une colonne (largeur enregistrée × zoom), en pixels entiers. */
  #largeurEcran(largeur) {
    return Math.round(largeur * this.#zoom);
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
    // Hauteur à 100 % (32 px, ou 36 px au doigt, voir css/grille.css), puis zoom.
    const base = parseFloat(getComputedStyle(this.#racine).getPropertyValue('--hauteur-base')) || 32;
    this.#hauteur = Math.round(base * this.#zoom);
    this.#racine.style.setProperty('--hauteur-ligne', `${this.#hauteur}px`);
    this.#largeurNumeros = this.#largeurEcran(LARGEUR_NUMEROS);
    this.#figee = this.feuille.figee === true;

    const contenu = document.createElement('div');
    contenu.className = 'grille-contenu';

    const table = document.createElement('table');
    table.className = 'grille';

    // Largeurs des colonnes : un <col> par colonne.
    const groupe = document.createElement('colgroup');
    const colEntete = document.createElement('col');
    colEntete.style.width = `${this.#largeurNumeros}px`;
    groupe.append(colEntete);
    this.#colonnes = [null];
    for (let c = 1; c <= colonnes; c++) {
      const col = document.createElement('col');
      col.style.width = `${this.#largeurEcran(this.feuille.largeur(c))}px`;
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
    this.#mesurerLignes();
    this.#calculerHauts();
    this.#couche.style.setProperty('--hauteur-figee', `${this.hauteurDe(1)}px`);

    // Ligne 1 figée : toujours dessinée, en premier.
    if (this.#figee) corps.prepend(this.#creerLigne(1).tr);
    this.#mettreAJourFenetre(true);
    this.#blocsFusion = [];
    this.#dessinerFusions();
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
    if (this.#hauteursLignes.has(l)) tr.style.height = `${this.#hauteursLignes.get(l)}px`;
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
    const haut = this.#racine.scrollTop;
    const hauteurVue = this.#racine.clientHeight || 800;
    const premiereVisible = Math.max(debutFeuille, this.#ligneA(haut));
    const derniereVisible = Math.min(total, this.#ligneA(haut + hauteurVue));

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
    // Les lignes d'espacement ont la hauteur des lignes qu'elles remplacent.
    this.#espaceHaut.hidden = premiere <= debutFeuille;
    this.#espaceHaut.style.height = `${Math.max(0, this.#hauts[premiere] - this.#hauts[debutFeuille])}px`;
    this.#espaceBas.hidden = derniere >= total;
    this.#espaceBas.style.height = `${Math.max(0, this.#hauts[total + 1] - this.#hauts[derniere + 1])}px`;
  }

  /** Numéro de la ligne qui se trouve à la hauteur `y` du contenu (recherche par dichotomie). */
  #ligneA(y) {
    let bas = 1;
    let haut = this.feuille.lignes;
    while (bas < haut) {
      const milieu = Math.ceil((bas + haut) / 2);
      if (this.#hauts[milieu] <= y) bas = milieu;
      else haut = milieu - 1;
    }
    return bas;
  }

  // --- Hauteur des lignes (retour à la ligne) --------------------------------------------

  /** Calcule le haut de chaque ligne : la ligne 1 commence sous les en-têtes A, B, C… */
  #calculerHauts() {
    const total = this.feuille.lignes;
    const hauts = new Array(total + 2);
    hauts[0] = 0;
    hauts[1] = this.#hauteur;
    for (let l = 1; l <= total; l++) hauts[l + 1] = hauts[l] + this.hauteurDe(l);
    this.#hauts = hauts;
  }

  /**
   * Mesure les cellules « retour à la ligne » des lignes données (toutes si
   * `lignes` vaut null) : le navigateur écrit leur texte dans une zone
   * invisible, à la largeur de leur colonne, et la ligne prend la hauteur
   * du texte le plus haut (jamais moins qu'une ligne ordinaire). Une cellule
   * fusionnée ne fait pas grandir ses lignes (comme dans Excel).
   * Renvoie vrai si une hauteur a changé.
   */
  #mesurerLignes(lignes = null) {
    const feuille = this.feuille;
    const boites = [];
    for (const adr of feuille.adresses()) {
      if (!feuille.cellule(adr)?.retour) continue;
      const { ligne, colonne } = lireAdresse(adr);
      if ((lignes && !lignes.has(ligne)) || ligne > feuille.lignes || colonne > feuille.colonnes) continue;
      if (feuille.fusionEn(ligne, colonne)) continue;
      const vue = this.presenterCellule(adr, ligne, colonne);
      if (!vue.texte) continue;
      const boite = document.createElement('div');
      boite.textContent = vue.texte;
      if (vue.genre === 'erreur') boite.classList.add('erreur');
      if (vue.gras) boite.classList.add('gras');
      if (vue.italique) boite.classList.add('italique');
      boite.style.width = this.#colonnes[colonne].style.width;
      boite.dataset.ligne = ligne;
      boites.push(boite);
    }
    // Toutes les boîtes sont mesurées d'un coup (une seule mise en page).
    const mesurees = new Map();
    if (boites.length) {
      this.#mesureur.replaceChildren(...boites);
      for (const boite of boites) {
        const ligne = Number(boite.dataset.ligne);
        const hauteur = Math.ceil(boite.getBoundingClientRect().height);
        if (hauteur > (mesurees.get(ligne) ?? this.#hauteur)) mesurees.set(ligne, hauteur);
      }
      this.#mesureur.replaceChildren();
    }
    const avant = this.#hauteursLignes;
    const apres = new Map(lignes ? [...avant].filter(([l]) => !lignes.has(l)) : []);
    for (const [l, hauteur] of mesurees) apres.set(l, hauteur);
    this.#hauteursLignes = apres;
    return apres.size !== avant.size || [...apres].some(([l, hauteur]) => avant.get(l) !== hauteur);
  }

  /** Après un changement de hauteur : replace les lignes dessinées, les fusions et la sélection. */
  #appliquerHauteurs() {
    this.#calculerHauts();
    for (const [l, { tr }] of this.#lignes) {
      tr.style.height = this.#hauteursLignes.has(l) ? `${this.#hauteursLignes.get(l)}px` : '';
    }
    this.#couche.style.setProperty('--hauteur-figee', `${this.hauteurDe(1)}px`);
    this.#mettreAJourFenetre(true);
    this.#dessinerFusions();
    if (this.#selection) this.afficherSelection(this.#selection);
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

  /** Redessine des cellules ; leurs lignes changent de hauteur si un texte renvoyé à la ligne a changé. */
  rafraichirCellules(adresses) {
    const lignes = new Set();
    for (const adr of adresses) {
      this.rafraichirCellule(adr);
      const position = lireAdresse(adr);
      if (position) lignes.add(position.ligne);
    }
    if (this.#mesurerLignes(lignes)) this.#appliquerHauteurs();
    else this.#dessinerFusions();
  }

  /** Redessine toutes les cellules dessinées (après un changement de thème de bordures, etc.). */
  rafraichirTout() {
    for (const [l, { tds }] of this.#lignes) {
      for (let c = 1; c < tds.length; c++) this.#remplir(tds[c], l, c);
    }
    if (this.#mesurerLignes()) this.#appliquerHauteurs();
    else this.#dessinerFusions();
  }

  /**
   * Dessine les cellules fusionnées : un bloc par fusion, posé sur les
   * cellules qu'elle couvre, avec le texte, la mise en forme et les bordures
   * extérieures (le bas pris à la cellule en bas à gauche, la droite à celle
   * en haut à droite).
   */
  #dessinerFusions() {
    for (const bloc of this.#blocsFusion) bloc.remove();
    this.#blocsFusion = [];
    for (const { debut, fin } of this.feuille.fusions) {
      const bloc = document.createElement('div');
      bloc.className = 'cellule-fusionnee';
      bloc.dataset.ligne = debut.ligne;
      bloc.dataset.colonne = debut.colonne;
      const vue = this.presenterCellule(adresse(debut.ligne, debut.colonne), debut.ligne, debut.colonne);
      const texte = document.createElement('span');
      texte.textContent = vue.texte;
      bloc.append(texte);
      if (vue.genre !== 'vide') bloc.classList.add(vue.genre);
      if (vue.gras) bloc.classList.add('gras');
      if (vue.italique) bloc.classList.add('italique');
      if (vue.retour) bloc.classList.add('retour');
      if (vue.fond) bloc.dataset.fond = vue.fond;
      if (vue.couleur) bloc.dataset.encre = vue.couleur;
      if (vue.alignement) bloc.dataset.align = vue.alignement;
      if (vue.explication) bloc.title = vue.explication;
      const basGauche = this.presenterCellule(adresse(fin.ligne, debut.colonne), fin.ligne, debut.colonne);
      const hautDroite = this.presenterCellule(adresse(debut.ligne, fin.colonne), debut.ligne, fin.colonne);
      this.#dessinerBordures(bloc, {
        haut: vue.bordures?.haut,
        gauche: vue.bordures?.gauche,
        bas: basGauche.bordures?.bas,
        droite: hautDroite.bordures?.droite,
      });
      const zone = this.#zoneCellule(debut.ligne, debut.colonne);
      bloc.style.transform = `translate(${zone.gauche}px, ${zone.haut}px)`;
      bloc.style.width = `${zone.droite - zone.gauche}px`;
      bloc.style.height = `${zone.bas - zone.haut}px`;
      // Sous les cadres de sélection (dans la couche figée pour la ligne 1 figée).
      if (zone.couche) this.#couche.prepend(bloc);
      else this.#contenu.insertBefore(bloc, this.#cadres.plage);
      this.#blocsFusion.push(bloc);
    }
  }

  /** Remplit un <td> avec ce qu'affiche la cellule (texte, mise en forme, bordures). */
  #remplir(td, ligne, colonne) {
    const vue = this.presenterCellule(lettresColonne(colonne) + ligne, ligne, colonne);
    td.textContent = vue.texte;
    td.className = vue.genre === 'vide' ? '' : vue.genre;
    if (vue.gras) td.classList.add('gras');
    if (vue.italique) td.classList.add('italique');
    if (vue.retour) td.classList.add('retour');
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
    this.#positions = [0, this.#largeurNumeros];
    for (let c = 1; c < this.#colonnes.length; c++) {
      this.#positions.push(this.#positions[c] + parseFloat(this.#colonnes[c].style.width));
    }
    // La largeur du tableau doit être la somme exacte des colonnes : c'est ce
    // qui oblige le navigateur à respecter la largeur de chaque colonne, même
    // si un texte est plus long (il est alors coupé avec « … »).
    this.#table.style.width = `${this.#positions.at(-1)}px`;
  }

  /**
   * Applique les largeurs de colonnes enregistrées dans la feuille. Le texte
   * renvoyé à la ligne occupe alors plus ou moins de lignes : on le remesure.
   */
  rafraichirLargeurs(colonnes = null) {
    const liste = colonnes ?? this.#colonnes.keys();
    for (const c of liste) {
      if (this.#colonnes[c]) this.#colonnes[c].style.width = `${this.#largeurEcran(this.feuille.largeur(c))}px`;
    }
    this.#calculerPositions();
    if (this.#mesurerLignes()) this.#appliquerHauteurs();
    else this.#dessinerFusions();
  }

  /** Largeur provisoire d'une colonne pendant qu'on la fait glisser (largeur à 100 %). */
  apercuLargeur(colonne, largeur) {
    if (this.#colonnes[colonne]) this.#colonnes[colonne].style.width = `${this.#largeurEcran(largeur)}px`;
    this.#calculerPositions();
    this.#dessinerFusions();
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
    const haut = this.#estFigee(ligne) ? 0 : (this.#hauts[ligne] ?? this.#hauteur * ligne);
    const gauche = this.#positions[colonne] ?? 0;
    const droite = this.#positions[colonne + 1] ?? gauche;
    return { gauche, haut, droite, bas: haut + this.hauteurDe(ligne) };
  }

  /**
   * Rectangle d'une cellule, ou de toute sa fusion si elle est fusionnée.
   * `couche` : vrai s'il est dans la couche figée (ligne 1 figée).
   */
  #zoneCellule(ligne, colonne) {
    const fusion = this.feuille.fusionEn(ligne, colonne);
    const debut = fusion?.debut ?? { ligne, colonne };
    const fin = fusion?.fin ?? { ligne, colonne };
    const couche = this.#figee && fin.ligne === 1;
    const gauche = this.#positions[debut.colonne] ?? 0;
    return {
      couche,
      gauche,
      droite: this.#positions[fin.colonne + 1] ?? gauche,
      haut: couche ? 0 : this.#hauts[debut.ligne],
      bas: couche ? this.hauteurDe(1) : this.#hauts[fin.ligne + 1],
    };
  }

  /** Rectangle d'une cellule (ou de sa fusion) dans son conteneur (pour placer l'éditeur). */
  rectangleContenu(ligne, colonne) {
    if (ligne < 1 || colonne < 1 || ligne > this.feuille.lignes || colonne > this.feuille.colonnes) return null;
    return this.#zoneCellule(ligne, colonne);
  }

  /** Rectangle d'une cellule (ou de sa fusion) à l'écran (coordonnées de la fenêtre). */
  rectangleEcran(ligne, colonne) {
    const r = this.rectangleContenu(ligne, colonne);
    if (!r) return null;
    const origine = (r.couche ? this.#couche : this.#contenu).getBoundingClientRect();
    return new DOMRect(origine.left + r.gauche, origine.top + r.haut, r.droite - r.gauche, r.bas - r.haut);
  }

  /**
   * Place un élément (le champ de saisie) dans le bon conteneur pour la
   * cellule donnée : la couche figée pour la ligne 1 figée, le contenu sinon.
   * Le focus est conservé si l'élément change de conteneur.
   */
  accueillir(element, ligne, colonne = null) {
    const couche = colonne === null ? this.#estFigee(ligne) : this.#zoneCellule(ligne, colonne).couche;
    const conteneur = couche ? this.#couche : this.#contenu;
    if (element.parentElement === conteneur) return;
    const avaitLeFocus = document.activeElement === element;
    conteneur.append(element);
    if (avaitLeFocus) element.focus({ preventScroll: true });
  }

  // --- Sélection ------------------------------------------------------------------------------

  /** Dessine la sélection : cadre de la plage, cadre de la cellule active, en-têtes surlignés. */
  afficherSelection(selection) {
    this.#selection = selection;
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
    // Cellule active (toute sa fusion si elle est fusionnée).
    const rActive = this.#zoneCellule(active.ligne, active.colonne);
    placer(rActive.couche ? actifFige : actif, rActive, rActive);

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
    // Dessiné dans le contenu qui défile (sous les en-têtes A, B, C…).
    const gauche = this.#positions[plage.debut.colonne];
    const droite = this.#positions[plage.fin.colonne + 1];
    const haut = this.#hauts[plage.debut.ligne];
    const bas = this.#hauts[plage.fin.ligne + 1];
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
      const haut = this.#hauts[ligne];
      const bas = haut + this.hauteurDe(ligne);
      const hautVisible = zone.scrollTop + h + (this.#figee ? this.hauteurDe(1) : 0);
      const basVisible = zone.scrollTop + zone.clientHeight;
      if (haut < hautVisible) zone.scrollTop -= hautVisible - haut;
      else if (bas > basVisible) zone.scrollTop += bas - basVisible;
    }
    if (colonne >= 1 && colonne <= this.feuille.colonnes) {
      const gauche = this.#positions[colonne];
      const droite = this.#positions[colonne + 1];
      const gaucheVisible = zone.scrollLeft + this.#largeurNumeros;
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
    const td = element.closest('td[data-ligne], .cellule-fusionnee');
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
      if (this.#figee && vy < h + this.hauteurDe(1)) ligne = 1;
      else ligne = this.#ligneA(vy + zone.scrollTop);
    }
    let colonne = null;
    if (vx >= this.#largeurNumeros) {
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
