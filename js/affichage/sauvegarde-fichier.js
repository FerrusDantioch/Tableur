// « Exporter le classeur (.json) » et « Importer un classeur (.json) » :
// une sauvegarde complète dans un fichier, à garder où l'on veut, pour ne
// rien perdre si l'on vide le navigateur ou si l'on change d'appareil.
//
// À l'import, le fichier est d'abord vérifié en entier (donnees/fichier-classeur.js).
// S'il est invalide, un message l'explique et le classeur actuel ne change
// pas. S'il est valable, on demande une confirmation avant de remplacer le
// classeur ; « Annuler » permet ensuite de revenir au classeur d'avant.

import { TAILLE_MAX_FICHIER, creerFichierClasseur, lireFichierClasseur, nomFichierClasseur } from '../donnees/fichier-classeur.js';
import { telecharger } from '../services/fichiers.js';

export class SauvegardeFichier {
  /**
   * @param {object} options
   * @param {import('../donnees/classeur.js').Classeur} options.classeur
   * @param {() => {zoom?: number, theme?: string}} options.lireAffichage  réglages d'affichage actuels
   * @param {(affichage: {zoom?: number, theme?: string}) => void} options.appliquerAffichage
   * @param {(fenetre: HTMLDialogElement) => Promise<string>} options.demander
   * @param {() => void} options.avantAction  termine la saisie en cours
   * @param {() => void} options.apresAction  rend le focus à la grille
   * @param {(texte: string, erreur?: boolean) => void} options.signaler
   */
  constructor({ classeur, lireAffichage, appliquerAffichage, demander, avantAction, apresAction, signaler }) {
    this.classeur = classeur;
    this.lireAffichage = lireAffichage;
    this.appliquerAffichage = appliquerAffichage;
    this.demander = demander;
    this.avantAction = avantAction;
    this.apresAction = apresAction;
    this.signaler = signaler;

    const element = (id) => document.getElementById(id);
    this.champFichier = element('fichier-classeur');
    this.fenetreConfirmation = element('fenetre-importer-classeur');
    this.resume = element('resume-import');
    this.fenetreErreur = element('fenetre-erreur-fichier');
    this.texteErreur = element('texte-erreur-fichier');

    element('exporter-classeur').addEventListener('click', () => {
      element('panneau-exporter').hidePopover();
      this.avantAction();
      this.exporter();
      this.apresAction();
    });
    element('importer-classeur').addEventListener('click', () => {
      element('panneau-importer').hidePopover();
      this.avantAction();
      this.champFichier.value = '';
      this.champFichier.click();
    });
    this.champFichier.addEventListener('change', () => {
      const fichier = this.champFichier.files?.[0];
      if (fichier) this.importer(fichier);
    });
  }

  /** Télécharge le classeur entier dans un fichier omni-tableur-AAAA-MM-JJ.json. */
  exporter() {
    const config = self.CONFIG_APP;
    const contenu = creerFichierClasseur(this.classeur, {
      affichage: this.lireAffichage(),
      application: `${config?.nom ?? 'Omni-Tableur'} ${config?.version ?? ''}`.trim(),
    });
    const nom = nomFichierClasseur();
    telecharger(nom, JSON.stringify(contenu), 'application/json');
    this.signaler(`Classeur enregistré dans le fichier « ${nom} » (dossier des téléchargements).`);
  }

  /** Lit, vérifie puis (après confirmation) importe un fichier de classeur. */
  async importer(fichier) {
    let resultat;
    if (fichier.size > TAILLE_MAX_FICHIER) {
      resultat = { ok: false, message: 'Ce fichier est beaucoup trop gros pour être un classeur Omni-Tableur.' };
    } else {
      try {
        resultat = lireFichierClasseur(await fichier.text());
      } catch {
        resultat = { ok: false, message: 'Le fichier n’a pas pu être ouvert. Réessayez, ou choisissez un autre fichier.' };
      }
    }
    if (!resultat.ok) {
      this.texteErreur.textContent = resultat.message;
      await this.demander(this.fenetreErreur);
      this.apresAction();
      return;
    }

    const { titre, feuilles } = resultat.resume;
    this.resume.textContent = `Fichier « ${fichier.name} » : classeur « ${titre} », ${feuilles} feuille${feuilles > 1 ? 's' : ''}.`;
    const reponse = await this.demander(this.fenetreConfirmation);
    if (reponse !== 'remplacer') {
      this.signaler('Import abandonné : votre classeur n’a pas changé.');
      this.apresAction();
      return;
    }
    this.classeur.remplacer(resultat.classeur);
    this.appliquerAffichage(resultat.affichage);
    this.signaler(`Classeur « ${titre} » importé (${feuilles} feuille${feuilles > 1 ? 's' : ''}). « Annuler » rend le classeur d’avant.`);
    this.apresAction();
  }
}
