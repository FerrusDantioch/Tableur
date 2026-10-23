// Le menu (bouton en haut à droite) : thème, taille du tableau, aide,
// installation, « À propos » et nouveau classeur.

import { COLONNES_MAX, LIGNES_MAX } from '../donnees/classeur.js';
import { creerChoixTheme } from '../services/theme.js';
import { estInstallee, installationPossible, installer, surChangementInstallation } from '../services/pwa.js';
import { demander, ouvrirFenetre } from './fenetres.js';

/**
 * @param {object} options
 * @param {import('../donnees/classeur.js').Classeur} options.classeur
 * @param {object} options.preferences
 * @param {() => void} options.avantAction  termine la saisie en cours
 */
export function installerMenu({ classeur, preferences, avantAction }) {
  const element = (id) => document.getElementById(id);
  const fenetreMenu = element('fenetre-menu');
  const tailleFeuille = element('taille-feuille');
  const boutonInstaller = element('menu-installer');

  // Textes de la fenêtre « À propos » tirés de js/config.js.
  const config = self.CONFIG_APP;
  for (const zone of document.querySelectorAll('[data-config]')) zone.textContent = config[zone.dataset.config];
  for (const lien of document.querySelectorAll('[data-config-lien]')) lien.href = config[lien.dataset.configLien];

  creerChoixTheme({ conteneur: element('choix-theme'), preferences });

  const afficherTaille = () => {
    const feuille = classeur.feuilleActive;
    tailleFeuille.textContent = `Taille actuelle : ${feuille.lignes} lignes × ${feuille.colonnes} colonnes (au maximum ${LIGNES_MAX} × ${COLONNES_MAX}).`;
    element('menu-lignes').disabled = feuille.lignes >= LIGNES_MAX;
    element('menu-colonnes').disabled = feuille.colonnes >= COLONNES_MAX;
  };
  classeur.abonner((evenement) => {
    if (['dimensions', 'structure', 'active'].includes(evenement.type)) afficherTaille();
  });

  const afficherInstallation = () => {
    boutonInstaller.hidden = !installationPossible() || estInstallee();
  };
  surChangementInstallation(afficherInstallation);

  element('bouton-menu').addEventListener('click', () => {
    avantAction();
    afficherTaille();
    afficherInstallation();
    ouvrirFenetre(fenetreMenu);
  });

  element('menu-lignes').addEventListener('click', () => {
    classeur.agrandir(classeur.feuilleActive, { lignes: 50 });
    afficherTaille();
  });
  element('menu-colonnes').addEventListener('click', () => {
    classeur.agrandir(classeur.feuilleActive, { colonnes: 5 });
    afficherTaille();
  });

  element('menu-aide').addEventListener('click', () => {
    fenetreMenu.close();
    ouvrirFenetre(element('fenetre-aide'));
  });
  element('menu-a-propos').addEventListener('click', () => {
    fenetreMenu.close();
    ouvrirFenetre(element('fenetre-a-propos'));
  });
  // « À propos » est aussi directement dans la barre du haut.
  element('bouton-a-propos').addEventListener('click', () => {
    avantAction();
    element('adresse-copiee').textContent = '';
    ouvrirFenetre(element('fenetre-a-propos'));
  });

  // « Copier l'adresse » : dans le presse-papiers si le navigateur le permet,
  // sinon l'adresse est sélectionnée pour être copiée à la main.
  element('copier-adresse').addEventListener('click', async () => {
    const adresse = element('adresse-contact').textContent.trim();
    const etat = element('adresse-copiee');
    try {
      await navigator.clipboard.writeText(adresse);
      etat.textContent = 'Adresse copiée : vous pouvez la coller dans votre messagerie.';
    } catch {
      const choix = document.createRange();
      choix.selectNodeContents(element('adresse-contact'));
      const selectionTexte = window.getSelection();
      selectionTexte.removeAllRanges();
      selectionTexte.addRange(choix);
      etat.textContent = 'Adresse sélectionnée : copiez-la (Ctrl+C, ou appui long puis « Copier »).';
    }
  });
  boutonInstaller.addEventListener('click', async () => {
    fenetreMenu.close();
    await installer();
  });

  element('menu-nouveau').addEventListener('click', async () => {
    fenetreMenu.close();
    const reponse = await demander(element('fenetre-confirmation'));
    if (reponse !== 'effacer') return;
    classeur.reinitialiser();
  });
}
