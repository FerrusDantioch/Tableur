// Fenêtres (balises <dialog>) : ouverture, fermeture, confirmation.
//
// Dans le HTML, un bouton portant l'attribut data-fermer ferme sa fenêtre ;
// la valeur de l'attribut devient la « réponse » de la fenêtre
// (ex. data-fermer="effacer").

/** Prépare toutes les fenêtres de la page. `apresFermeture` est appelé à chaque fermeture. */
export function preparerFenetres(apresFermeture) {
  for (const fenetre of document.querySelectorAll('dialog')) {
    fenetre.addEventListener('click', (e) => {
      const bouton = e.target.closest('[data-fermer]');
      if (bouton) {
        fenetre.close(bouton.dataset.fermer);
        return;
      }
      // Un clic sur le voile (en dehors de la fenêtre) la ferme aussi.
      if (e.target === fenetre) {
        const r = fenetre.getBoundingClientRect();
        const dehors = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
        if (dehors) fenetre.close('');
      }
    });
    fenetre.addEventListener('close', () => {
      // Si une autre fenêtre est encore ouverte (menu → aide), on ne fait rien.
      if (!document.querySelector('dialog[open]')) apresFermeture?.();
    });
  }
}

/** Ouvre une fenêtre (au-dessus du reste de la page). */
export function ouvrirFenetre(fenetre) {
  fenetre.returnValue = '';
  if (!fenetre.open) fenetre.showModal();
}

/**
 * Ouvre une fenêtre de confirmation et attend la réponse.
 * @returns {Promise<string>} la valeur data-fermer du bouton choisi ('' si fermée autrement)
 */
export function demander(fenetre) {
  return new Promise((resoudre) => {
    fenetre.addEventListener('close', () => resoudre(fenetre.returnValue), { once: true });
    ouvrirFenetre(fenetre);
  });
}
