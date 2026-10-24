// Réglages généraux de l'application : c'est le SEUL endroit où changer le
// nom ou la version.
//
// Ce fichier est un script « classique » (pas un module) : il est lu à la
// fois par la page (index.html) et par le service worker (sw.js), qui s'en
// sert pour nommer sa copie hors ligne. Changer la version ici déclenche donc
// la mise à jour de l'application chez les utilisateurs.

self.CONFIG_APP = Object.freeze({
  // Nom affiché (titre de l'onglet, fenêtre « À propos »).
  // Le fichier manifest.webmanifest contient aussi le nom : le changer aux deux endroits.
  nom: 'Omni-Tableur',

  // Numéro de version : à augmenter à chaque publication (ex. 2.1.1).
  version: '2.2.2',

  auteurs: 'Ferrus Dantioch et Claude',
  siteOmni: 'https://ferrusdantioch.github.io/omni-systeme/',

  // Identifiant technique du stockage (base de données, préférences, cache).
  // NE PAS CHANGER : les classeurs déjà enregistrés deviendraient invisibles.
  // Il est préfixé partout, car toutes les applications du site
  // ferrusdantioch.github.io partagent le même espace de stockage.
  idStockage: 'omni-tableur',

  // Identifiant utilisé avant le renommage en « Omni-Tableur » (version 2.0.0
  // et avant). Au démarrage, les données encore rangées sous ce nom sont
  // copiées vers le nouveau, puis effacées (voir js/services/stockage.js).
  ancienIdStockage: 'tableur',
});
