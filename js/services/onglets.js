// Prévient si Omni-Tableur est ouvert deux fois (deux onglets ou fenêtres).
//
// Les deux exemplaires enregistreraient chacun leur version du classeur :
// le dernier enregistré écraserait l'autre. On affiche donc un avertissement.
// (BroadcastChannel permet aux onglets d'un même site de se parler.)
//
// On écoute aussi l'ancien canal (« tableur-onglets ») : un onglet resté sur
// une version d'avant le renommage est ainsi repéré lui aussi.

const ID = self.CONFIG_APP?.idStockage ?? 'omni-tableur';
const ANCIEN_ID = self.CONFIG_APP?.ancienIdStockage ?? 'tableur';

/** Appelle `surAutreOnglet()` si un autre exemplaire de l'application est ouvert. */
export function surveillerAutresOnglets(surAutreOnglet) {
  if (!('BroadcastChannel' in self)) return;
  for (const nom of [ID, ANCIEN_ID]) {
    const canal = new BroadcastChannel(`${nom}-onglets`);
    canal.addEventListener('message', (evenement) => {
      if (evenement.data === 'bonjour') {
        // Un nouvel exemplaire vient de s'ouvrir : on lui répond, et on prévient ici aussi.
        canal.postMessage('deja-ouvert');
        surAutreOnglet();
      } else if (evenement.data === 'deja-ouvert') {
        surAutreOnglet();
      }
    });
    canal.postMessage('bonjour');
  }
}
