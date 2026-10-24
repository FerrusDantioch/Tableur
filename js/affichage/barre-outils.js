// La barre d'outils en onglets (Édition, Mise en forme, Bordures, Données)
// et les panneaux qui s'ouvrent sous certains boutons (couleurs, largeur…).
//
// - Un appui sur un onglet montre ses boutons ; un appui sur l'onglet déjà
//   ouvert replie la barre (la grille gagne de la place, utile au téléphone).
// - L'onglet choisi est mémorisé pour la prochaine ouverture.
// - Chaque panneau (attribut « popover ») s'ouvre juste sous son bouton.

/**
 * @param {object} options
 * @param {object} options.preferences  préférences mémorisées (voir services/stockage.js)
 * @param {() => void} options.avantAction  termine la saisie en cours
 * @param {() => void} options.apresAction  rend le focus à la grille
 * @param {() => void} [options.surChangement]  appelé quand la hauteur de la barre change
 */
export function installerBarreOutils({ preferences, avantAction, apresAction, surChangement }) {
  const conteneur = document.querySelector('.outils');
  const onglets = [...conteneur.querySelectorAll('[role="tab"]')];

  const afficher = (groupe, repliee) => {
    for (const onglet of onglets) {
      const choisi = onglet.dataset.groupe === groupe;
      onglet.setAttribute('aria-selected', String(choisi));
      onglet.setAttribute('aria-expanded', String(choisi && !repliee));
      onglet.tabIndex = choisi ? 0 : -1;
      document.getElementById(onglet.getAttribute('aria-controls')).hidden = !choisi || repliee;
    }
    conteneur.classList.toggle('repliee', repliee);
    preferences.ecrire('barreOutils', { groupe, repliee });
    surChangement?.();
  };

  const memoire = preferences.lire('barreOutils', { groupe: 'edition', repliee: false });
  const existe = onglets.some((onglet) => onglet.dataset.groupe === memoire.groupe);
  afficher(existe ? memoire.groupe : 'edition', existe && memoire.repliee === true);

  for (const onglet of onglets) {
    // Les onglets ne prennent pas le focus à la souris : la saisie continue.
    onglet.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') e.preventDefault();
    });
    onglet.addEventListener('click', () => {
      const dejaOuvert = onglet.getAttribute('aria-selected') === 'true' && !conteneur.classList.contains('repliee');
      afficher(onglet.dataset.groupe, dejaOuvert);
    });
    // Au clavier : flèches gauche et droite pour passer d'un onglet à l'autre.
    onglet.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const index = onglets.indexOf(onglet) + (e.key === 'ArrowRight' ? 1 : -1);
      const suivant = onglets[(index + onglets.length) % onglets.length];
      afficher(suivant.dataset.groupe, false);
      suivant.focus();
    });
  }

  // Les boutons de la barre ne prennent pas le focus à la souris : la saisie
  // en cours reste ouverte et le clavier continue de piloter la grille.
  // (Le bouton « Menu », qui ouvre une fenêtre, garde le comportement normal.)
  for (const bouton of document.querySelectorAll('.barre-outils button, .panneau button, #bouton-annuler, #bouton-retablir')) {
    bouton.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') e.preventDefault();
    });
  }

  // Panneaux : placés sous leur bouton ; la saisie en cours est validée à
  // l'ouverture et le focus revient à la grille à la fermeture.
  for (const panneau of document.querySelectorAll('.panneau[popover]')) {
    panneau.addEventListener('beforetoggle', (e) => {
      if (e.newState !== 'open') return;
      avantAction();
      const bouton = document.querySelector(`[popovertarget="${panneau.id}"]`);
      if (!bouton) return;
      const r = bouton.getBoundingClientRect();
      const largeur = Math.min(300, window.innerWidth - 16);
      panneau.style.top = `${r.bottom + 6}px`;
      panneau.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - largeur - 8))}px`;
      // Sur un petit écran, le panneau défile plutôt que de sortir de l'écran.
      panneau.style.maxHeight = `${Math.max(160, window.innerHeight - r.bottom - 14)}px`;
    });
    panneau.addEventListener('toggle', (e) => {
      if (e.newState === 'closed') apresAction();
    });
  }
}

/**
 * Replie la barre d'outils (comme un appui sur l'onglet ouvert). Renvoie
 * l'onglet qui était ouvert, pour le rouvrir plus tard (null si elle était
 * déjà repliée).
 */
export function replierBarreOutils() {
  if (document.querySelector('.outils.repliee')) return null;
  const onglet = document.querySelector('.onglet-outils[aria-selected="true"]');
  onglet?.click();
  return onglet?.dataset.groupe ?? null;
}

/** Ouvre l'onglet d'outils demandé ('edition', 'mise-en-forme', 'bordures', 'donnees'). */
export function ouvrirOngletOutils(groupe) {
  const onglet = document.querySelector(`.onglet-outils[data-groupe="${groupe}"]`);
  if (onglet && (onglet.getAttribute('aria-selected') !== 'true' || document.querySelector('.outils.repliee'))) onglet.click();
}
