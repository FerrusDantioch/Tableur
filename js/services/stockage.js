// Stockage sur l'appareil (rien n'est envoyé sur internet).
//
// - Le classeur est enregistré dans IndexedDB, la base de données du
//   navigateur (elle accepte de gros volumes).
// - Les préférences (thème…) sont dans localStorage, plus simple.
//
// Toutes les applications du site ferrusdantioch.github.io partagent le même
// espace de stockage : tous les noms commencent donc par « omni-tableur ».
// Si IndexedDB n'est pas disponible, le classeur va dans localStorage.
//
// Avant le renommage en « Omni-Tableur » (version 2.0.0 et avant), les noms
// commençaient par « tableur ». Au démarrage, ce qui est encore rangé sous
// l'ancien nom est COPIÉ vers le nouveau, la copie est VÉRIFIÉE, et c'est
// seulement ensuite que l'ancien exemplaire est effacé : aucune donnée perdue.

const ID = self.CONFIG_APP?.idStockage ?? 'omni-tableur';
const ANCIEN_ID = self.CONFIG_APP?.ancienIdStockage ?? 'tableur';
const VERSION_BASE = 1;
const MAGASIN = 'classeurs';
const CLE_PREFERENCES = `${ID}.preferences`;

// --- Migration de l'ancien nom (localStorage) -------------------------------------

/**
 * Copie chaque clé localStorage « tableur.… » vers « omni-tableur.… »,
 * vérifie la copie, puis efface l'ancienne. Si la nouvelle clé existe déjà
 * (migration faite, puis ancienne clé réécrite par un vieil onglet), la
 * nouvelle est gardée.
 */
function migrerLocalStorage() {
  try {
    const anciennes = [];
    for (let i = 0; i < localStorage.length; i++) {
      const cle = localStorage.key(i);
      if (cle?.startsWith(`${ANCIEN_ID}.`)) anciennes.push(cle);
    }
    for (const ancienne of anciennes) {
      const nouvelle = ID + ancienne.slice(ANCIEN_ID.length);
      const valeur = localStorage.getItem(ancienne);
      if (localStorage.getItem(nouvelle) === null) localStorage.setItem(nouvelle, valeur);
      // On n'efface l'ancienne que si la nouvelle est bien là.
      if (localStorage.getItem(nouvelle) !== null) localStorage.removeItem(ancienne);
    }
  } catch {
    // Stockage indisponible ou plein : on réessaiera au prochain démarrage.
  }
}

// Fait tout de suite, avant toute lecture des préférences.
migrerLocalStorage();

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

/** Transforme une demande IndexedDB en promesse. */
function attendre(demande) {
  return new Promise((resoudre, rejeter) => {
    demande.onsuccess = () => resoudre(demande.result);
    demande.onerror = () => rejeter(demande.error);
  });
}

/** Attend la fin d'une transaction (tout est alors écrit). */
function terminee(echange) {
  return new Promise((resoudre, rejeter) => {
    echange.oncomplete = () => resoudre();
    echange.onerror = () => rejeter(echange.error);
    echange.onabort = () => rejeter(echange.error ?? new Error('Transaction interrompue'));
  });
}

/**
 * Ouvre une base. Avec `creer: false`, une base qui n'existe pas n'est PAS
 * créée : la promesse donne alors null.
 */
function ouvrir(nom, { creer = true } = {}) {
  return new Promise((resoudre, rejeter) => {
    const demande = indexedDB.open(nom, VERSION_BASE);
    let absente = false;
    demande.onupgradeneeded = (evenement) => {
      if (!creer && evenement.oldVersion === 0) {
        // La base n'existait pas : on annule sa création.
        absente = true;
        demande.transaction.abort();
        return;
      }
      const base = demande.result;
      if (!base.objectStoreNames.contains(MAGASIN)) base.createObjectStore(MAGASIN);
    };
    demande.onsuccess = () => resoudre(demande.result);
    demande.onerror = (evenement) => {
      if (absente) {
        evenement.preventDefault();
        resoudre(null);
      } else {
        rejeter(demande.error);
      }
    };
    demande.onblocked = () => rejeter(new Error('Base de données bloquée par un autre onglet'));
  });
}

/**
 * Copie les classeurs de l'ancienne base « tableur » dans la nouvelle, vérifie
 * la copie, puis supprime l'ancienne base. Sans ancienne base, ne fait rien.
 * En cas de problème, l'ancienne base est laissée intacte (nouvel essai au
 * prochain démarrage).
 */
async function migrerBase(base) {
  let ancienne;
  try {
    // Réponse rapide quand le navigateur sait lister ses bases.
    if (indexedDB.databases) {
      const bases = await indexedDB.databases();
      if (!bases.some((b) => b.name === ANCIEN_ID)) return;
    }
    // Si un vieil onglet bloque l'ancienne base, on n'attend pas plus de
    // 2 secondes : l'application démarre, la migration se fera plus tard.
    const ouverture = ouvrir(ANCIEN_ID, { creer: false });
    const tropLong = new Promise((resoudre) => setTimeout(resoudre, 2000, 'trop-long'));
    ancienne = await Promise.race([ouverture, tropLong]);
    if (ancienne === 'trop-long') {
      ouverture.then((b) => b?.close()).catch(() => {});
      return;
    }
  } catch {
    return;
  }
  if (!ancienne) return;
  try {
    if (!ancienne.objectStoreNames.contains(MAGASIN)) {
      ancienne.close();
      indexedDB.deleteDatabase(ANCIEN_ID);
      return;
    }
    // 1. Lire tout ce que contient l'ancienne base.
    const lecture = ancienne.transaction(MAGASIN, 'readonly');
    const magasinAncien = lecture.objectStore(MAGASIN);
    const [cles, valeurs] = await Promise.all([attendre(magasinAncien.getAllKeys()), attendre(magasinAncien.getAll())]);
    ancienne.close();

    // 2. Copier ce qui manque dans la nouvelle base (« strict » : écrit sur le disque).
    const ecriture = base.transaction(MAGASIN, 'readwrite', { durability: 'strict' });
    const magasin = ecriture.objectStore(MAGASIN);
    const dejaLa = new Set(await attendre(magasin.getAllKeys()));
    cles.forEach((cle, i) => {
      if (!dejaLa.has(cle)) magasin.put(valeurs[i], cle);
    });
    await terminee(ecriture);

    // 3. Vérifier que chaque classeur est bien présent dans la nouvelle base.
    const verification = base.transaction(MAGASIN, 'readonly');
    const presentes = new Set(await attendre(verification.objectStore(MAGASIN).getAllKeys()));
    if (!cles.every((cle) => presentes.has(cle))) return;

    // 4. Seulement maintenant : effacer l'ancienne base. (Si un vieil onglet
    //    l'utilise encore, l'effacement attend qu'il soit fermé.)
    indexedDB.deleteDatabase(ANCIEN_ID);
  } catch (erreur) {
    console.warn('Migration du stockage reportée :', erreur);
    try {
      ancienne.close();
    } catch {
      // déjà fermée
    }
  }
}

let promesseBase = null;

function ouvrirBase() {
  if (!promesseBase) {
    promesseBase = (async () => {
      if (!('indexedDB' in self)) throw new Error('IndexedDB indisponible');
      const base = await ouvrir(ID);
      await migrerBase(base);
      return base;
    })().catch((erreur) => {
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
