// Commandes de l'onglet « Données » : trier, figer la première ligne,
// importer un fichier CSV. (Import et export du classeur en .json :
// voir sauvegarde-fichier.js.)

import { adresse, lettresColonne, plage as creerPlage, textePlage } from '../donnees/adresses.js';
import { ordreDeTri, sembleTitres, zoneAutour } from '../donnees/tri.js';
import { decoderFichier, feuilleDepuisCSV, nomDepuisFichier } from '../services/import-csv.js';

export class CommandesDonnees {
  /**
   * @param {object} options
   * @param {import('../donnees/classeur.js').Classeur} options.classeur
   * @param {import('./selection.js').Selection} options.selection
   * @param {(feuille: object, adresse: string) => *} options.valeur  valeur calculée d'une cellule
   * @param {() => void} options.avantAction  termine la saisie en cours
   * @param {() => void} options.apresAction  rend le focus à la grille
   * @param {(texte: string, erreur?: boolean) => void} options.signaler
   */
  constructor({ classeur, selection, valeur, avantAction, apresAction, signaler }) {
    this.classeur = classeur;
    this.selection = selection;
    this.valeur = valeur;
    this.avantAction = avantAction;
    this.apresAction = apresAction;
    this.signaler = signaler;

    const element = (id) => document.getElementById(id);
    this.panneauTrier = element('panneau-trier');
    this.description = element('tri-description');
    this.caseTitres = element('tri-titres');
    this.boutonFiger = element('bouton-figer');
    this.champFichier = element('fichier-csv');
    this.tri = null; // tri préparé à l'ouverture du panneau

    this.panneauTrier.addEventListener('beforetoggle', (e) => {
      if (e.newState === 'open') this.#preparerTri();
    });
    this.caseTitres.addEventListener('change', () => this.#decrireTri());
    element('trier-croissant').addEventListener('click', () => this.trier(true));
    element('trier-decroissant').addEventListener('click', () => this.trier(false));

    this.boutonFiger.addEventListener('click', () => this.figer());
    element('importer-csv').addEventListener('click', () => {
      element('panneau-importer').hidePopover();
      this.avantAction();
      this.champFichier.value = '';
      this.champFichier.click();
    });
    this.champFichier.addEventListener('change', () => {
      const fichier = this.champFichier.files?.[0];
      if (fichier) this.importer(fichier);
    });

    classeur.abonner((evenement) => {
      if (['structure', 'active'].includes(evenement.type)) this.actualiser();
    });
    this.actualiser();
  }

  get feuille() {
    return this.classeur.feuilleActive;
  }

  /** Met à jour le bouton « Figer la 1re ligne » (enfoncé si la ligne est figée). */
  actualiser() {
    this.boutonFiger.setAttribute('aria-pressed', String(this.feuille.figee));
  }

  // --- Trier -------------------------------------------------------------------------

  /** Zone à trier, colonne de tri et ligne de titres probable (à l'ouverture du panneau). */
  #preparerTri() {
    const feuille = this.feuille;
    const plage = this.selection.plage;
    const { ligne, colonne } = this.selection.active;
    const bloc = plage.fin.ligne > plage.debut.ligne && plage.fin.colonne > plage.debut.colonne;
    let zone = bloc ? plage : zoneAutour((a) => feuille.brut(a), feuille, ligne, colonne);
    // Un titre fusionné juste au-dessus du tableau (ex. A1:D1) ne fait pas
    // partie des lignes à trier : le tableau commence sous lui.
    if (zone && !bloc) {
      for (let f = this.#fusionEnHaut(zone); f && f.fin.ligne < zone.fin.ligne && f.fin.ligne < ligne; f = this.#fusionEnHaut(zone)) {
        zone = creerPlage({ ligne: f.fin.ligne + 1, colonne: zone.debut.colonne }, zone.fin);
      }
    }
    if (!zone || zone.fin.ligne === zone.debut.ligne) {
      this.tri = null;
      this.description.textContent = 'Rien à trier ici : placez-vous dans un tableau d’au moins deux lignes.';
      this.#activerBoutons(false);
      return;
    }
    const colonneCle = colonne >= zone.debut.colonne && colonne <= zone.fin.colonne ? colonne : zone.debut.colonne;
    const titres =
      (feuille.figee && zone.debut.ligne === 1) ||
      sembleTitres((a) => this.valeur(feuille, a), (a) => feuille.cellule(a), zone, colonneCle);
    this.tri = { zone, colonneCle };
    this.caseTitres.checked = titres;
    this.#activerBoutons(true);
    this.#decrireTri();
  }

  /** Une cellule fusionnée sur la première ligne de la zone, ou null. */
  #fusionEnHaut(zone) {
    const premiereLigne = creerPlage({ ligne: zone.debut.ligne, colonne: zone.debut.colonne }, { ligne: zone.debut.ligne, colonne: zone.fin.colonne });
    return this.classeur.fusionsGenantes(this.feuille, premiereLigne)[0] ?? null;
  }

  #activerBoutons(oui) {
    for (const id of ['trier-croissant', 'trier-decroissant']) document.getElementById(id).disabled = !oui;
    this.caseTitres.disabled = !oui;
  }

  /** Lignes réellement triées (sans la ligne de titres si la case est cochée). */
  #lignesTriees() {
    const { zone } = this.tri;
    const premiere = zone.debut.ligne + (this.caseTitres.checked ? 1 : 0);
    return { premiere, derniere: zone.fin.ligne };
  }

  #decrireTri() {
    if (!this.tri) return;
    const { zone, colonneCle } = this.tri;
    const { premiere, derniere } = this.#lignesTriees();
    const colonnes = `colonnes ${lettresColonne(zone.debut.colonne)} à ${lettresColonne(zone.fin.colonne)}`;
    // Des cellules fusionnées dans les lignes à trier seraient coupées en morceaux.
    const triees = creerPlage({ ligne: premiere, colonne: zone.debut.colonne }, { ligne: derniere, colonne: zone.fin.colonne });
    const genantes = premiere < derniere ? this.classeur.fusionsGenantes(this.feuille, triees) : [];
    let texte = `Trier les lignes ${premiere} à ${derniere} (${colonnes}) selon la colonne ${lettresColonne(colonneCle)}.`;
    if (premiere >= derniere) texte = 'Il faut au moins deux lignes à trier.';
    else if (genantes.length) {
      texte = `Impossible de trier : les lignes ${premiere} à ${derniere} contiennent des cellules fusionnées (${genantes.map(textePlage).join(', ')}). Défusionnez-les d’abord (onglet « Mise en forme »).`;
    }
    this.description.textContent = texte;
    for (const id of ['trier-croissant', 'trier-decroissant']) document.getElementById(id).disabled = premiere >= derniere || genantes.length > 0;
  }

  /** Trie dans l'ordre croissant (ou décroissant). */
  trier(croissant) {
    this.panneauTrier.hidePopover();
    if (!this.tri) return;
    const feuille = this.feuille;
    const { zone, colonneCle } = this.tri;
    const { premiere, derniere } = this.#lignesTriees();
    if (premiere >= derniere) return;
    const lignes = [];
    for (let l = premiere; l <= derniere; l++) lignes.push(l);
    const cles = lignes.map((l) => this.valeur(feuille, adresse(l, colonneCle)));
    const ordre = ordreDeTri(cles, croissant).map((i) => lignes[i]);
    const triee = creerPlage({ ligne: premiere, colonne: zone.debut.colonne }, { ligne: derniere, colonne: zone.fin.colonne });
    const change = this.classeur.reordonnerLignes(feuille, triee, ordre, triee);
    this.selection.choisirPlage(triee, { ligne: premiere, colonne: colonneCle });
    this.signaler(
      change
        ? `Lignes ${premiere} à ${derniere} triées (${croissant ? 'croissant' : 'décroissant'}) selon la colonne ${lettresColonne(colonneCle)}.`
        : 'Les lignes étaient déjà dans cet ordre.',
    );
    this.apresAction();
  }

  // --- Figer la première ligne -------------------------------------------------------

  figer() {
    this.avantAction();
    const figee = !this.feuille.figee;
    const coupee = figee ? this.classeur.fusionCoupeeParLigneFigee(this.feuille) : null;
    if (coupee) {
      this.signaler(
        `Impossible de figer la ligne 1 : la cellule fusionnée ${textePlage(coupee)} serait coupée en deux. Défusionnez-la d’abord (onglet « Mise en forme »).`,
        true,
      );
      this.apresAction();
      return;
    }
    this.classeur.figerPremiereLigne(this.feuille, figee);
    this.actualiser();
    this.signaler(figee ? 'La ligne 1 reste visible quand on fait défiler.' : 'La ligne 1 défile de nouveau avec le reste.');
    this.apresAction();
  }

  // --- Importer un fichier CSV ---------------------------------------------------------

  /** Lit un fichier CSV et le place dans une nouvelle feuille (annulable). */
  async importer(fichier) {
    try {
      const texte = decoderFichier(new Uint8Array(await fichier.arrayBuffer()));
      const resultat = feuilleDepuisCSV(texte);
      if (resultat.lignes === 0) {
        this.signaler(`Le fichier « ${fichier.name} » est vide.`, true);
        return;
      }
      let nom = nomDepuisFichier(fichier.name);
      for (let n = 2; this.classeur.verifierNomFeuille(nom); n++) nom = `${nomDepuisFichier(fichier.name).slice(0, 26)} (${n})`;
      const feuille = this.classeur.ajouterFeuille({ nom, donnees: resultat.donnees });
      this.selection.choisir(1, 1);
      const taille = `${resultat.lignes} ligne${resultat.lignes > 1 ? 's' : ''}, ${resultat.colonnes} colonne${resultat.colonnes > 1 ? 's' : ''}`;
      this.signaler(
        resultat.tronque
          ? `Importé dans la feuille « ${feuille.nom} » (${taille}). Attention : le fichier dépassait 1000 lignes ou 52 colonnes, la suite n’a pas été importée.`
          : `Fichier importé dans la nouvelle feuille « ${feuille.nom} » (${taille}).`,
        resultat.tronque,
      );
    } catch (erreur) {
      console.warn('Import impossible :', erreur);
      this.signaler(`Impossible de lire le fichier « ${fichier.name} ».`, true);
    }
    this.apresAction();
  }
}
