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
  nom: 'Tableur',

  // Numéro de version : à augmenter à chaque publication (ex. 1.0.1).
  version: '1.0.1',

  auteurs: 'Ferrus Dantioch et Claude',
  siteOmni: 'https://ferrusdantioch.github.io/omni-systeme/',

  // Identifiant technique du stockage (base de données, préférences, cache).
  // NE PAS CHANGER : les classeurs déjà enregistrés deviendraient invisibles.
  // Il est préfixé partout, car toutes les applications du site
  // ferrusdantioch.github.io partagent le même espace de stockage.
  idStockage: 'tableur',
});
