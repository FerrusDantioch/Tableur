// Dessin d'un graphique en SVG (des formes décrites en texte, que le
// navigateur affiche nettes à toutes les tailles), sans aucune bibliothèque :
// colonnes, courbe ou secteurs (« camembert »).
//
// Les couleurs sont données par l'appelant : celles du thème pour l'écran,
// des couleurs fixes sur fond blanc pour l'image enregistrée (comme le PDF).
// Les textes trop longs sont raccourcis avec « … » (leur largeur est estimée
// d'après le nombre de lettres).

import { graduations, partsSecteurs } from '../donnees/graphique.js';
import { formaterNombre } from './format.js';

const NS = 'http://www.w3.org/2000/svg';

/** Taille du dessin (l'écran l'agrandit ou le réduit sans le déformer ; l'image fait le double). */
export const LARGEUR = 640;
export const HAUTEUR = 400;

/** Taille « étroite », pour un téléphone : les textes restent lisibles une fois le dessin réduit. */
export const TAILLE_ETROITE = Object.freeze({ largeur: 400, hauteur: 440 });

/** Police simple, présente partout (l'image enregistrée ne peut pas utiliser les polices de l'application). */
const POLICE = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** Couleurs de l'image enregistrée : fond blanc, couleurs foncées bien lisibles (celles du PDF). */
export const COULEURS_IMAGE = Object.freeze({
  fond: '#ffffff',
  texte: '#1c1a24',
  discret: '#5e5a6d',
  quadrillage: '#e1dee8',
  series: ['#1f5bb5', '#a14a00', '#1b6b3a', '#6a3fc0', '#b3261e', '#7a5d00', '#5e5a6d'],
});

/** Les couleurs du thème affiché (voir css/themes.css), pour dessiner à l'écran. */
export function couleursDuTheme(element = document.documentElement) {
  const style = getComputedStyle(element);
  const lire = (nom) => style.getPropertyValue(nom).trim();
  return {
    fond: lire('--cellule'),
    texte: lire('--texte'),
    discret: lire('--discret'),
    quadrillage: lire('--quadrillage'),
    series: ['bleu', 'orange', 'vert', 'violet', 'rouge', 'jaune', 'gris'].map((nom) => lire(`--encre-${nom}`)),
  };
}

const pourcentage = new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 1 });

/** Crée un élément SVG avec ses attributs (et son texte). */
function element(nom, attributs = {}, texte) {
  const e = document.createElementNS(NS, nom);
  for (const [cle, valeur] of Object.entries(attributs)) {
    if (valeur !== undefined && valeur !== null) e.setAttribute(cle, String(valeur));
  }
  if (texte !== undefined) e.textContent = texte;
  return e;
}

/** Infobulle (au survol de la souris, et lue par les lecteurs d'écran). */
function infobulle(forme, texte) {
  forme.append(element('title', {}, texte));
  return forme;
}

/** Largeur approximative d'un texte, en pixels. */
const largeurTexte = (texte, taille) => String(texte).length * taille * 0.56;

/** Raccourcit un texte avec « … » pour qu'il tienne dans la largeur donnée. */
function couper(texte, largeurMax, taille) {
  const propre = String(texte ?? '');
  if (largeurTexte(propre, taille) <= largeurMax) return propre;
  const lettres = Math.max(1, Math.floor(largeurMax / (taille * 0.56)) - 1);
  return `${propre.slice(0, lettres).trimEnd()}…`;
}

/**
 * Dessine un graphique.
 * @param {{ categories: string[], series: Array<{nom: string, valeurs: Array<number|null>}> }} donnees
 *        (voir donnees/graphique.js, preparerGraphique)
 * @param {object} options
 * @param {'colonnes'|'courbe'|'secteurs'} options.type
 * @param {string} [options.titre]
 * @param {object} options.couleurs  { fond, texte, discret, quadrillage, series: [...] }
 * @param {number} [options.largeur]  taille du dessin (TAILLE_ETROITE sur un téléphone)
 * @param {number} [options.hauteur]
 * @returns {{ svg: SVGSVGElement, notes: string[], message?: string }}
 *          notes : remarques à afficher sous le graphique ; message : rien à dessiner
 */
export function dessinerGraphique(donnees, { type, titre = '', couleurs, largeur = LARGEUR, hauteur = HAUTEUR }) {
  const svg = element('svg', { viewBox: `0 0 ${largeur} ${hauteur}`, width: largeur, height: hauteur, role: 'img', 'font-family': POLICE });
  svg.append(element('rect', { width: largeur, height: hauteur, fill: couleurs.fond }));
  // Le cadre à remplir : toute la largeur, sous le titre.
  const cadre = { largeur, hauteur, haut: 20 };
  if (titre.trim()) {
    svg.append(element('text', { x: largeur / 2, y: 32, 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 700, fill: couleurs.texte }, couper(titre.trim(), largeur - 40, 18)));
    cadre.haut = 52;
  }
  const resultat = type === 'secteurs' ? dessinerSecteurs(svg, donnees, couleurs, cadre) : dessinerAxes(svg, donnees, type, couleurs, cadre);
  const noms = type === 'secteurs' ? '' : ` ; séries : ${donnees.series.map((s) => s.nom).join(', ')}`;
  const genre = { colonnes: 'en colonnes', courbe: 'en courbe', secteurs: 'en secteurs' }[type];
  svg.setAttribute('aria-label', `Graphique ${genre}${titre.trim() ? ` « ${titre.trim()} »` : ''} : ${donnees.categories.length} catégories${noms}.`);
  return { svg, ...resultat };
}

/** Couleur de la série (ou de la part) numéro i. */
const couleurDe = (couleurs, i) => couleurs.series[i % couleurs.series.length];

/** Colonnes ou courbe : axe des valeurs à gauche, catégories en bas, légende sous le tout. */
function dessinerAxes(svg, { categories, series }, type, couleurs, { largeur, hauteur, haut }) {
  const toutes = series.flatMap((serie) => serie.valeurs).filter((v) => v !== null);
  const axe = graduations(Math.min(...toutes), Math.max(...toutes));
  const etiquettesValeurs = axe.valeurs.map((v) => formaterNombre(v));
  const gauche = 16 + Math.max(...etiquettesValeurs.map((t) => largeurTexte(t, 12)));
  const droite = largeur - 16;
  const legende = series.length > 1 ? placerLegende(series.map((s) => s.nom), largeur - 32) : null;
  const bas = hauteur - 34 - (legende ? legende.hauteur + 6 : 0);
  const y = (valeur) => bas - ((valeur - axe.debut) / (axe.fin - axe.debut)) * (bas - haut);

  // Lignes horizontales du quadrillage, avec leur valeur (le zéro plus marqué).
  axe.valeurs.forEach((valeur, i) => {
    svg.append(element('line', { x1: gauche, x2: droite, y1: y(valeur), y2: y(valeur), stroke: valeur === 0 ? couleurs.discret : couleurs.quadrillage, 'stroke-width': 1 }));
    svg.append(element('text', { x: gauche - 8, y: y(valeur) + 4, 'text-anchor': 'end', 'font-size': 12, fill: couleurs.discret }, etiquettesValeurs[i]));
  });

  // Noms des catégories sous l'axe : un sur deux (ou moins) s'ils se chevaucheraient.
  const nombre = categories.length;
  const bande = (droite - gauche) / nombre;
  const largeurNom = Math.min(110, Math.max(...categories.map((nom) => largeurTexte(nom, 12))) + 8);
  const saut = Math.max(1, Math.ceil(largeurNom / bande));
  categories.forEach((nom, i) => {
    if (i % saut) return;
    svg.append(element('text', { x: gauche + bande * (i + 0.5), y: bas + 20, 'text-anchor': 'middle', 'font-size': 12, fill: couleurs.discret }, couper(nom, bande * saut - 6, 12)));
  });

  const detail = (serie, i, valeur) => `${serie.nom} – ${categories[i]} : ${formaterNombre(valeur)}`;
  if (type === 'colonnes') {
    // Pour chaque catégorie, une colonne par série, côte à côte.
    const largeurColonne = (bande * 0.8) / series.length;
    series.forEach((serie, s) => {
      serie.valeurs.forEach((valeur, i) => {
        if (valeur === null) return;
        const x = gauche + bande * i + bande * 0.1 + largeurColonne * s;
        const zero = y(Math.max(axe.debut, Math.min(axe.fin, 0)));
        const sommet = y(valeur);
        const colonne = element('rect', {
          x: x.toFixed(2),
          y: Math.min(zero, sommet).toFixed(2),
          width: Math.max(1, largeurColonne - (series.length > 1 ? 1 : 0)).toFixed(2),
          height: Math.max(1, Math.abs(sommet - zero)).toFixed(2),
          fill: couleurDe(couleurs, s),
        });
        svg.append(infobulle(colonne, detail(serie, i, valeur)));
      });
    });
  } else {
    // Courbe : une ligne par série, coupée là où une valeur manque ; un point par valeur.
    series.forEach((serie, s) => {
      let trace = '';
      let suite = false;
      serie.valeurs.forEach((valeur, i) => {
        if (valeur === null) {
          suite = false;
          return;
        }
        trace += `${suite ? 'L' : 'M'}${(gauche + bande * (i + 0.5)).toFixed(2)} ${y(valeur).toFixed(2)} `;
        suite = true;
      });
      svg.append(element('path', { d: trace.trim(), fill: 'none', stroke: couleurDe(couleurs, s), 'stroke-width': 2.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
      if (nombre > 60) return; // trop de points : la ligne suffit
      serie.valeurs.forEach((valeur, i) => {
        if (valeur === null) return;
        const point = element('circle', { cx: (gauche + bande * (i + 0.5)).toFixed(2), cy: y(valeur).toFixed(2), r: 3.5, fill: couleurDe(couleurs, s) });
        svg.append(infobulle(point, detail(serie, i, valeur)));
      });
    });
  }
  if (legende) dessinerLegende(svg, legende, couleurs, largeur, bas + 46);
  return { notes: [] };
}

/** Range les noms de la légende en rangées qui tiennent dans la largeur donnée. */
function placerLegende(noms, largeurMax) {
  const rangees = [[]];
  let largeur = 0;
  noms.forEach((nom, index) => {
    const texte = couper(nom, 150, 12);
    const place = 18 + largeurTexte(texte, 12) + 18;
    if (largeur + place > largeurMax && rangees.at(-1).length) {
      rangees.push([]);
      largeur = 0;
    }
    rangees.at(-1).push({ texte, place, index });
    largeur += place;
  });
  return { rangees, hauteur: rangees.length * 20 };
}

/** Légende : un carré de couleur et le nom de chaque série, centrés. */
function dessinerLegende(svg, { rangees }, couleurs, largeur, haut) {
  rangees.forEach((rangee, r) => {
    const total = rangee.reduce((somme, e) => somme + e.place, 0) - 18;
    let x = (largeur - total) / 2;
    const y = haut + r * 20;
    for (const { texte, place, index } of rangee) {
      svg.append(element('rect', { x: x.toFixed(2), y: y - 10, width: 12, height: 12, rx: 2, fill: couleurDe(couleurs, index) }));
      svg.append(element('text', { x: (x + 18).toFixed(2), y, 'font-size': 12, fill: couleurs.texte }, texte));
      x += place;
    }
  });
}

/**
 * Camembert : une part par catégorie (première série), légende avec les
 * pourcentages à droite (ou dessous, sur un dessin étroit).
 */
function dessinerSecteurs(svg, donnees, couleurs, { largeur, hauteur, haut }) {
  const { parts, notes } = partsSecteurs(donnees);
  if (!parts.length) return { notes, message: 'Aucune valeur positive : un camembert ne peut rien montrer ici.' };
  const pas = 26;
  const etroit = largeur < 520;
  const bas = hauteur - 20 - (etroit ? parts.length * pas + 10 : 0);
  const rayon = Math.min(150, (bas - haut) / 2, (largeur - 64) / 2);
  const cx = etroit ? largeur / 2 : 32 + rayon;
  const cy = (haut + bas) / 2;
  const point = (angle, distance = rayon) => [cx + distance * Math.cos(angle), cy + distance * Math.sin(angle)];
  let angle = -Math.PI / 2; // on commence en haut, dans le sens des aiguilles d'une montre
  parts.forEach((part, i) => {
    const fin = angle + part.part * 2 * Math.PI;
    let forme;
    if (parts.length === 1) {
      forme = element('circle', { cx, cy, r: rayon, fill: couleurDe(couleurs, i) });
    } else {
      const [x1, y1] = point(angle);
      const [x2, y2] = point(fin);
      const grandArc = fin - angle > Math.PI ? 1 : 0;
      forme = element('path', {
        d: `M${cx} ${cy} L${x1.toFixed(2)} ${y1.toFixed(2)} A${rayon} ${rayon} 0 ${grandArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`,
        fill: couleurDe(couleurs, i),
        stroke: couleurs.fond,
        'stroke-width': 1.5,
        'stroke-linejoin': 'round',
      });
    }
    svg.append(infobulle(forme, `${part.nom} : ${formaterNombre(part.valeur)} (${pourcentage.format(part.part)})`));
    // Le pourcentage dans la part, si elle est assez grande pour l'écrire.
    if (part.part >= 0.06) {
      const [x, y] = point((angle + fin) / 2, rayon * 0.64);
      svg.append(element('text', { x: x.toFixed(2), y: (y + 5).toFixed(2), 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, fill: couleurs.fond }, pourcentage.format(part.part)));
    }
    angle = fin;
  });
  // Légende : couleur, nom et pourcentage de chaque part.
  const x = etroit ? 40 : cx + rayon + 36;
  let y = etroit ? bas + 30 : cy - ((parts.length - 1) * pas) / 2 + 5;
  parts.forEach((part, i) => {
    svg.append(element('rect', { x, y: y - 11, width: 14, height: 14, rx: 2, fill: couleurDe(couleurs, i) }));
    const texte = `${part.nom || '(sans nom)'} : ${pourcentage.format(part.part)}`;
    svg.append(element('text', { x: x + 22, y, 'font-size': 13, fill: couleurs.texte }, couper(texte, largeur - x - 36, 13)));
    y += pas;
  });
  return { notes };
}
