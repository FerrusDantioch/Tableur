// Zoom de la grille : de 50 % à 200 %, par pas de 10 %.
//
// Trois façons de zoomer :
//   - les boutons « − » et « + » (en bas, à droite des onglets des feuilles) ;
//     un appui sur le pourcentage revient à 100 % ;
//   - au doigt : pincer (ou écarter) deux doigts sur la grille ;
//   - à l'ordinateur : Ctrl + molette de la souris (ou pincement du pavé tactile).
//
// Le zoom est une préférence de l'appareil (mémorisée) : il ne change ni le
// contenu du classeur, ni les largeurs enregistrées, ni l'export PDF.

export const ZOOM_MIN = 50;
export const ZOOM_MAX = 200;
export const ZOOM_PAS = 10;
export const ZOOM_PAR_DEFAUT = 100;

/** Ramène un pourcentage quelconque à un zoom permis (50 à 200, multiple de 10). */
export function bornerZoom(pourcent) {
  const nombre = Number(pourcent);
  if (!Number.isFinite(nombre)) return ZOOM_PAR_DEFAUT;
  const arrondi = Math.round(nombre / ZOOM_PAS) * ZOOM_PAS;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, arrondi));
}

/** Distance entre deux doigts, et point situé entre eux. */
function mesurerDoigts([a, b]) {
  return {
    distance: Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY),
    centre: { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 },
  };
}

/** Quantité de molette qui correspond à un pas de zoom (un cran de molette de souris). */
const MOLETTE_PAR_PAS = 100;

export class Zoom {
  #pourcent = ZOOM_PAR_DEFAUT;
  #pincement = null; // { ids, cibles, distance, pourcent } au début du geste à deux doigts
  #molette = 0; // molette accumulée (pavé tactile : petits mouvements)

  /**
   * @param {object} options
   * @param {import('./grille.js').Grille} options.grille
   * @param {object} options.preferences  préférences mémorisées (voir services/stockage.js)
   * @param {() => void} options.avantChangement  termine la saisie en cours
   * @param {() => void} options.apresChangement  redessine la sélection
   */
  constructor({ grille, preferences, avantChangement, apresChangement }) {
    this.grille = grille;
    this.preferences = preferences;
    this.avantChangement = avantChangement;
    this.apresChangement = apresChangement;

    const element = (id) => document.getElementById(id);
    this.boutonMoins = element('zoom-moins');
    this.boutonPlus = element('zoom-plus');
    this.valeur = element('zoom-valeur');

    this.boutonMoins.addEventListener('click', () => this.choisir(this.#pourcent - ZOOM_PAS));
    this.boutonPlus.addEventListener('click', () => this.choisir(this.#pourcent + ZOOM_PAS));
    this.valeur.addEventListener('click', () => this.choisir(ZOOM_PAR_DEFAUT));
    // À la souris, ces boutons ne prennent pas le focus (le clavier reste sur la grille).
    for (const bouton of [this.boutonMoins, this.boutonPlus, this.valeur]) {
      bouton.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse') e.preventDefault();
      });
    }

    const racine = grille.racine;
    // Pincement à deux doigts (la suite du geste est écoutée sur les cases
    // touchées, voir #debutPincement).
    racine.addEventListener('touchstart', (e) => this.#debutPincement(e), { passive: true });
    // Ctrl + molette (et pincement du pavé tactile, que le navigateur transmet ainsi).
    racine.addEventListener('wheel', (e) => this.#tournerMolette(e), { passive: false });

    this.choisir(preferences.lire('zoom', ZOOM_PAR_DEFAUT), { memoriser: false });
  }

  /** Zoom actuel, en pourcentage (100 = taille normale). */
  get pourcent() {
    return this.#pourcent;
  }

  /**
   * Change le zoom (le pourcentage est ramené entre 50 et 200, par pas de 10).
   * @param {number} pourcent
   * @param {object} [options]
   * @param {{x: number, y: number}} [options.point]  point de l'écran qui ne doit pas bouger
   * @param {boolean} [options.memoriser]  garder le choix pour la prochaine fois
   */
  choisir(pourcent, { point = null, memoriser = true } = {}) {
    const nouveau = bornerZoom(pourcent);
    if (nouveau !== this.#pourcent) {
      this.avantChangement?.();
      this.#pourcent = nouveau;
      this.grille.changerZoom(nouveau / 100, point);
      this.apresChangement?.();
    }
    if (memoriser) this.preferences.ecrire('zoom', nouveau);
    this.#afficher();
  }

  #afficher() {
    this.valeur.textContent = `${this.#pourcent} %`;
    this.valeur.title = this.#pourcent === ZOOM_PAR_DEFAUT ? 'Zoom : taille normale' : 'Revenir à 100 %';
    this.valeur.setAttribute('aria-label', `Zoom ${this.#pourcent} %. Appuyer pour revenir à 100 %.`);
    this.boutonMoins.disabled = this.#pourcent <= ZOOM_MIN;
    this.boutonPlus.disabled = this.#pourcent >= ZOOM_MAX;
  }

  // --- Deux doigts ---------------------------------------------------------------

  /**
   * Deux doigts posés sur la grille : début du pincement.
   *
   * Le navigateur envoie toujours la suite du geste (mouvements, doigts
   * levés) à la case touchée au départ, même si elle a disparu de la page.
   * Or zoomer redessine la grille : on écoute donc directement ces cases,
   * et on reconnaît les doigts à leur numéro.
   */
  #debutPincement(e) {
    if (this.#pincement) {
      if (this.#doigts(e).length === 2) return; // pincement déjà en cours
      this.#arreterPincement(); // ancien geste resté inachevé
    }
    const doigts = [...e.touches].filter((doigt) => this.grille.racine.contains(doigt.target));
    if (doigts.length !== 2) return;
    const cibles = [...new Set(doigts.map((doigt) => doigt.target))];
    this.#pincement = {
      ids: doigts.map((doigt) => doigt.identifier),
      cibles,
      distance: mesurerDoigts(doigts).distance,
      pourcent: this.#pourcent,
    };
    for (const cible of cibles) {
      // « passive: false » : on peut empêcher le défilement pendant le pincement.
      cible.addEventListener('touchmove', this.#surMouvement, { passive: false });
      cible.addEventListener('touchend', this.#surFin);
      cible.addEventListener('touchcancel', this.#surFin);
    }
  }

  #surMouvement = (e) => this.#pincer(e);
  #surFin = (e) => this.#finPincement(e);

  /** Les deux doigts du pincement en cours (ou moins, si l'un s'est levé). */
  #doigts(e) {
    return [...e.touches].filter((doigt) => this.#pincement?.ids.includes(doigt.identifier));
  }

  #pincer(e) {
    if (!this.#pincement) return;
    const doigts = this.#doigts(e);
    if (doigts.length !== 2) return;
    if (e.cancelable) e.preventDefault(); // pas de défilement pendant le pincement
    const { distance, centre } = mesurerDoigts(doigts);
    if (this.#pincement.distance < 10) return;
    const voulu = this.#pincement.pourcent * (distance / this.#pincement.distance);
    if (bornerZoom(voulu) !== this.#pourcent) this.choisir(voulu, { point: centre });
  }

  #finPincement(e) {
    if (this.#pincement && this.#doigts(e).length < 2) this.#arreterPincement();
  }

  #arreterPincement() {
    for (const cible of this.#pincement.cibles) {
      cible.removeEventListener('touchmove', this.#surMouvement);
      cible.removeEventListener('touchend', this.#surFin);
      cible.removeEventListener('touchcancel', this.#surFin);
    }
    this.#pincement = null;
  }

  // --- Ctrl + molette ----------------------------------------------------------------

  #tournerMolette(e) {
    if (!e.ctrlKey) return;
    // Sans cela, le navigateur agrandirait toute la page.
    e.preventDefault();
    // Molette en lignes (Firefox) ou en pages : converties en pixels.
    const facteur = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? this.grille.racine.clientHeight : 1;
    this.#molette += e.deltaY * facteur;
    const pas = Math.trunc(this.#molette / MOLETTE_PAR_PAS);
    if (pas === 0) return;
    this.#molette -= pas * MOLETTE_PAR_PAS;
    // Molette vers le haut (valeur négative) : on agrandit.
    this.choisir(this.#pourcent - pas * ZOOM_PAS, { point: { x: e.clientX, y: e.clientY } });
  }
}
