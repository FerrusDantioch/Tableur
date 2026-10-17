// Prévient si Tableur est ouvert deux fois (deux onglets ou fenêtres).
//
// Les deux exemplaires enregistreraient chacun leur version du classeur :
// le dernier enregistré écraserait l'autre. On affiche donc un avertissement.
// (BroadcastChannel permet aux onglets d'un même site de se parler.)

const ID = self.CONFIG_APP?.idStockage ?? 'tableur';

/** Appelle `surAutreOnglet()` si un autre exemplaire de l'application est ouvert. */
export function surveillerAutresOnglets(surAutreOnglet) {
  if (!('BroadcastChannel' in self)) return;
  const canal = new BroadcastChannel(`${ID}-onglets`);
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
