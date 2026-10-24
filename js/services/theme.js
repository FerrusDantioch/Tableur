// Thèmes de couleurs (définis dans css/themes.css).
// Au chargement, js/theme-initial.js applique déjà le thème mémorisé avant
// l'affichage ; ce module gère ensuite le choix dans le menu.

export const THEMES = [
  { id: 'omni', nom: 'Omni-système', description: 'Violet sur fond sombre, aux couleurs de l’Omni-système' },
  { id: 'sombre', nom: 'Sombre classique', description: 'Gris neutres sur fond sombre' },
  { id: 'clair', nom: 'Clair', description: 'Fond clair et doux' },
];

export const THEME_PAR_DEFAUT = 'omni';

/** Applique un thème : attribut data-theme et couleur de la barre du navigateur. */
export function appliquerTheme(id) {
  const theme = THEMES.some((t) => t.id === id) ? id : THEME_PAR_DEFAUT;
  const racine = document.documentElement;
  racine.dataset.theme = theme;
  const styles = getComputedStyle(racine);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', styles.getPropertyValue('--surface').trim());
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', theme === 'clair' ? 'light' : 'dark');
  return theme;
}

/**
 * Change de thème depuis le code (classeur importé, par exemple) : applique,
 * mémorise et coche le bon choix dans le menu. Un thème inconnu est ignoré.
 */
export function choisirTheme(id, preferences) {
  if (!THEMES.some((t) => t.id === id)) return;
  appliquerTheme(id);
  preferences.ecrire('theme', id);
  for (const radio of document.querySelectorAll('input[name="theme"]')) radio.checked = radio.value === id;
}

/**
 * Construit le choix du thème (boutons radio avec une pastille d'aperçu)
 * dans `conteneur`, et mémorise le choix.
 */
export function creerChoixTheme({ conteneur, preferences }) {
  const actuel = appliquerTheme(preferences.lire('theme', THEME_PAR_DEFAUT));
  for (const theme of THEMES) {
    const etiquette = document.createElement('label');
    etiquette.className = 'choix-theme';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'theme';
    radio.value = theme.id;
    radio.checked = theme.id === actuel;
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      appliquerTheme(theme.id);
      preferences.ecrire('theme', theme.id);
    });
    // La pastille porte le thème qu'elle représente : ses couleurs viennent
    // directement de themes.css.
    const pastille = document.createElement('span');
    pastille.className = 'apercu-theme';
    pastille.dataset.theme = theme.id;
    pastille.setAttribute('aria-hidden', 'true');
    const textes = document.createElement('span');
    textes.className = 'textes-theme';
    const nom = document.createElement('strong');
    nom.textContent = theme.nom;
    const description = document.createElement('small');
    description.textContent = theme.description;
    textes.append(nom, description);
    etiquette.append(radio, pastille, textes);
    conteneur.append(etiquette);
  }
}
