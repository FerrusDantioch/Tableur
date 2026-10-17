// Applique le thème mémorisé AVANT l'affichage de la page, pour éviter tout
// flash lumineux au démarrage (la page s'ouvre directement dans le bon thème).
// Script classique, très court, chargé dans le <head> de index.html.

(function () {
  var theme = 'omni';
  try {
    var preferences = JSON.parse(localStorage.getItem('tableur.preferences') || '{}');
    if (['omni', 'sombre', 'clair'].indexOf(preferences.theme) !== -1) theme = preferences.theme;
  } catch {
    // Stockage indisponible (navigation privée…) : thème par défaut.
  }
  document.documentElement.setAttribute('data-theme', theme);
  var meta = document.querySelector('meta[name="color-scheme"]');
  if (meta) meta.setAttribute('content', theme === 'clair' ? 'light' : 'dark');
})();
