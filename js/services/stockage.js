// Stockage sur l'appareil (rien n'est envoyé sur internet).
//
// - Le classeur est enregistré dans IndexedDB, la base de données du
//   navigateur (elle accepte de gros volumes).
// - Les préférences (thème…) sont dans localStorage, plus simple.
//
// Toutes les applications du site ferrusdantioch.github.io partagent le même
// espace de stockage : tous les noms commencent donc par « tableur ».
// Si IndexedDB n'est pas disponible, le classeur va dans localStorage.

const ID = self.CONFIG_APP?.idStockage ?? 'tableur';
const NOM_BASE = ID;
const VERSION_BASE = 1;
const MAGASIN = 'classeurs';
const CLE_PREFERENCES = `${ID}.preferences`;

// --- Préférences --------------------------------------------------------------

function lirePreferences() {
  try {
    return JSON.parse(localStorage.getItem(CLE_PREFERENCES) || '{}') ?? {};
  } catch {
    return {};
  }
}

export const preferences = {
  lire(cle, defaut) {
    const valeur = lirePreferences()[cle];
    return valeur === undefined ? defaut : valeur;
  },
  ecrire(cle, valeur) {
    try {
      const toutes = lirePreferences();
      toutes[cle] = valeur;
      localStorage.setItem(CLE_PREFERENCES, JSON.stringify(toutes));
    } catch {
      // Stockage plein ou interdit : la préférence ne sera pas gardée.
    }
  },
};

// --- Base de données -----------------------------------------------------------

let promesseBase = null;

function ouvrirBase() {
  if (!promesseBase) {
    promesseBase = new Promise((resoudre, rejeter) => {
      if (!('indexedDB' in self)) {
        rejeter(new Error('IndexedDB indisponible'));
        return;
      }
      const demande = indexedDB.open(NOM_BASE, VERSION_BASE);
      demande.onupgradeneeded = () => {
        const base = demande.result;
        if (!base.objectStoreNames.contains(MAGASIN)) base.createObjectStore(MAGASIN);
      };
      demande.onsuccess = () => resoudre(demande.result);
      demande.onerror = () => rejeter(demande.error);
      demande.onblocked = () => rejeter(new Error('Base de données bloquée par un autre onglet'));
    }).catch((erreur) => {
      promesseBase = null;
      throw erreur;
    });
  }
  return promesseBase;
}

function transaction(mode, action) {
  return ouvrirBase().then(
    (base) =>
      new Promise((resoudre, rejeter) => {
        const echange = base.transaction(MAGASIN, mode);
        const demande = action(echange.objectStore(MAGASIN));
        echange.oncomplete = () => resoudre(demande?.result);
        echange.onerror = () => rejeter(echange.error);
        echange.onabort = () => rejeter(echange.error ?? new Error('Enregistrement interrompu'));
      }),
  );
}

/** Lit un classeur enregistré (objet), ou null s'il n'y en a pas. */
export async function lireClasseur(id = 'principal') {
  try {
    const enregistrement = await transaction('readonly', (magasin) => magasin.get(id));
    return enregistrement?.donnees ?? null;
  } catch {
    try {
      const texte = localStorage.getItem(`${ID}.classeur.${id}`);
      return texte ? JSON.parse(texte).donnees : null;
    } catch {
      return null;
    }
  }
}

/** Enregistre un classeur (objet produit par Classeur.versJSON()). */
export async function ecrireClasseur(donnees, id = 'principal') {
  const enregistrement = { donnees, modifieLe: new Date().toISOString() };
  try {
    await transaction('readwrite', (magasin) => magasin.put(enregistrement, id));
  } catch (erreur) {
    // Solution de secours : localStorage (plus petit, mais presque toujours disponible).
    try {
      localStorage.setItem(`${ID}.classeur.${id}`, JSON.stringify(enregistrement));
    } catch {
      throw erreur;
    }
  }
}

/** Garde de côté un classeur illisible (au lieu de l'écraser). */
export async function mettreDeCote(donnees, id = 'principal') {
  await ecrireClasseur(donnees, `${id}-illisible-${Date.now()}`).catch(() => {});
}

/**
 * Demande au navigateur de ne pas effacer les données quand le disque est
 * plein (Firefox peut afficher une question : répondre « Autoriser »).
 */
export function demanderStockagePersistant() {
  navigator.storage?.persist?.().catch(() => {});
}
