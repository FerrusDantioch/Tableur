// Application installable et hors ligne : enregistrement du service worker
// (sw.js), annonce des mises à jour, installation sur l'appareil.

let invitation = null; // événement « beforeinstallprompt » gardé pour plus tard
const abonnes = new Set();

window.addEventListener('beforeinstallprompt', (evenement) => {
  // Pas de bandeau automatique du navigateur : on installe depuis le menu,
  // quand la personne le décide.
  evenement.preventDefault();
  invitation = evenement;
  abonnes.forEach((fonction) => fonction());
});

window.addEventListener('appinstalled', () => {
  invitation = null;
  abonnes.forEach((fonction) => fonction());
});

/** Vrai si l'application tourne déjà comme application installée. */
export function estInstallee() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

/** Vrai si le navigateur propose l'installation (Chrome, Edge, Brave…). */
export function installationPossible() {
  return invitation !== null;
}

export function surChangementInstallation(fonction) {
  abonnes.add(fonction);
}

/** Ouvre la fenêtre d'installation du navigateur. */
export async function installer() {
  if (!invitation) return false;
  const evenement = invitation;
  invitation = null;
  await evenement.prompt();
  const { outcome } = await evenement.userChoice;
  abonnes.forEach((fonction) => fonction());
  return outcome === 'accepted';
}

/**
 * Enregistre le service worker. Quand une nouvelle version est prête,
 * `surMiseAJour(appliquer)` est appelé ; `appliquer()` enregistre le
 * classeur (`avantRechargement`), installe la nouvelle version et recharge.
 */
export function demarrerServiceWorker({ surMiseAJour, avantRechargement }) {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  let rechargementDemande = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (rechargementDemande) window.location.reload();
  });
  navigator.serviceWorker
    .register('sw.js', { updateViaCache: 'none' })
    .then((enregistrement) => {
      const proposer = (travailleur) =>
        surMiseAJour(async () => {
          rechargementDemande = true;
          await avantRechargement();
          travailleur.postMessage({ type: 'activer' });
        });
      if (enregistrement.waiting && navigator.serviceWorker.controller) proposer(enregistrement.waiting);
      enregistrement.addEventListener('updatefound', () => {
        const nouveau = enregistrement.installing;
        nouveau?.addEventListener('statechange', () => {
          if (nouveau.state === 'installed' && navigator.serviceWorker.controller) proposer(nouveau);
        });
      });
      // Cherche une mise à jour quand l'application revient au premier plan.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') enregistrement.update().catch(() => {});
      });
    })
    .catch((erreur) => console.warn('Service worker non enregistré :', erreur));
}
