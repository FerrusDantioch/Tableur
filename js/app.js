// Point d'entrée de l'application : crée chaque partie et les relie.
//
// L'application est organisée en trois couches séparées :
//   (a) donnees/   ce que la personne a saisi (classeur, feuilles, cellules) ;
//   (b) calcul/    le calcul des formules ;
//   (c) affichage/ la grille à l'écran, le clavier, la souris et le doigt.
// Ce fichier est le seul à les connaître toutes les trois.

import { Classeur } from './donnees/classeur.js';
import { adresse } from './donnees/adresses.js';
import { interpreterSaisie } from './donnees/saisie.js';
import { MoteurCalcul } from './calcul/moteur.js';
import { formaterNombre, presenter } from './affichage/format.js';
import { Grille } from './affichage/grille.js';
import { Selection } from './affichage/selection.js';
import { Edition } from './affichage/edition.js';
import { Interactions } from './affichage/interactions.js';
import { MiseEnForme } from './affichage/mise-en-forme.js';
import { demander, preparerFenetres } from './affichage/fenetres.js';
import { installerMenu } from './affichage/menu.js';
import { PressePapiers } from './affichage/presse-papiers.js';
import { demanderStockagePersistant, ecrireClasseur, lireClasseur, mettreDeCote, preferences } from './services/stockage.js';
import { SauvegardeAuto } from './services/sauvegarde-auto.js';
import { demarrerServiceWorker } from './services/pwa.js';
import { genererCSV } from './services/export-csv.js';
import { ExportPdf } from './services/export-pdf.js';
import { nomDeFichier, telecharger } from './services/fichiers.js';
import { surveillerAutresOnglets } from './services/onglets.js';

const CONFIG = self.CONFIG_APP;
const element = (id) => document.getElementById(id);

// --- (a) Les données ---------------------------------------------------------
const classeur = new Classeur();
const feuille = classeur.feuilles[0];

// On reprend le classeur enregistré sur l'appareil (s'il y en a un).
let avertissementDemarrage = '';
const enregistre = await lireClasseur();
if (enregistre) {
  try {
    classeur.charger(enregistre);
  } catch (erreur) {
    console.warn('Classeur illisible :', erreur);
    await mettreDeCote(enregistre);
    avertissementDemarrage = 'Le classeur enregistré était illisible : il a été mis de côté et un classeur vide a été ouvert.';
  }
}

// --- (b) Le calcul -------------------------------------------------------------
const moteur = new MoteurCalcul(classeur, feuille);

// --- (c) L'affichage ---------------------------------------------------------

/** Ce qu'affiche une cellule : valeur calculée mise en forme, gras, couleur de fond. */
function presenterCellule(adr) {
  const cellule = feuille.cellule(adr);
  const saisie = interpreterSaisie(cellule?.brut);
  return { ...presenter(moteur.valeur(adr), saisie.style), gras: cellule?.gras, fond: cellule?.fond };
}

const zone = element('zone-grille');
const grille = new Grille({ racine: zone, feuille, presenterCellule });
const selection = new Selection(() => ({ lignes: feuille.lignes, colonnes: feuille.colonnes }));
const edition = new Edition({
  champCellule: element('editeur-cellule'),
  champBarre: element('champ-formule'),
  grille,
  racine: document.body,
});

const boutonAnnuler = element('bouton-annuler');
const boutonRetablir = element('bouton-retablir');
const message = element('message');
const statistiques = element('statistiques');

/**
 * Barre d'état : explication de l'erreur de la cellule active, et résumé
 * (somme, moyenne, nombre) quand plusieurs cellules sont sélectionnées.
 */
function mettreAJourBarreEtat() {
  const { ligne, colonne } = selection.active;
  const vue = presenter(moteur.valeur(adresse(ligne, colonne)));
  message.textContent = vue.explication ? `${vue.texte} — ${vue.explication}` : '';
  message.classList.toggle('erreur', Boolean(vue.explication));

  let resume = '';
  if (!selection.unique) {
    const { nombres, somme, moyenne } = moteur.resumer(selection.plage);
    if (nombres > 0) {
      resume = `Somme : ${formaterNombre(somme)} · Moyenne : ${formaterNombre(moyenne)} · Nombres : ${nombres}`;
    }
  }
  statistiques.textContent = resume;
}

// Créée plus bas (elle a besoin des interactions), mais utilisée dès maintenant.
let miseEnForme = null;

/** Actions partagées entre la barre d'outils et les raccourcis clavier. */
const commandes = {
  annuler() {
    interactions.validerEdition(null, { refocaliser: false });
    const action = classeur.annuler();
    if (action?.selection) selection.choisirPlage(action.selection);
    interactions.focaliser();
  },
  retablir() {
    interactions.validerEdition(null, { refocaliser: false });
    const action = classeur.retablir();
    if (action?.selection) selection.choisirPlage(action.selection);
    interactions.focaliser();
  },
  selectionChangee() {
    mettreAJourBarreEtat();
    miseEnForme?.actualiser();
  },
};

const interactions = new Interactions({
  classeur,
  feuille,
  selection,
  grille,
  edition,
  nomCellule: element('nom-cellule'),
  boutonValider: element('valider-saisie'),
  boutonAnnuler: element('annuler-saisie'),
  commandes,
});

miseEnForme = new MiseEnForme({
  classeur,
  feuille,
  selection,
  grille,
  avantAction: () => interactions.validerEdition(null, { refocaliser: false }),
  apresAction: () => interactions.focaliser(),
  redessinerSelection: () => grille.afficherSelection(selection),
});
commandes.gras = () => miseEnForme.gras();
commandes.redimensionner = (evenement, colonne) => miseEnForme.redimensionner(evenement, colonne);
commandes.ajusterLargeur = (colonnes) => miseEnForme.ajusterLargeur(colonnes);
miseEnForme.actualiser();

// Les boutons de la barre d'outils ne prennent pas le focus : la saisie en
// cours reste ouverte et le clavier continue de piloter la grille.
for (const bouton of document.querySelectorAll('.barre-outils button, .panneau button')) {
  bouton.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') e.preventDefault();
  });
}
boutonAnnuler.addEventListener('click', () => commandes.annuler());
boutonRetablir.addEventListener('click', () => commandes.retablir());

// Copier, couper, coller (Ctrl+C, Ctrl+X, Ctrl+V) quand la grille a le focus.
new PressePapiers({
  classeur,
  feuille,
  selection,
  presenterCellule,
  estActif: () => !edition.enCours && [edition.champCellule, zone].includes(document.activeElement),
});

// --- Titre du classeur -------------------------------------------------------
const champTitre = element('titre');
champTitre.value = classeur.titre;
document.title = `${classeur.titre} – ${CONFIG.nom}`;
// Le titre est enregistré pendant la frappe (même si l'on ferme l'application
// sans quitter le champ). Échap remet le titre d'avant.
let titreAvant = classeur.titre;
champTitre.addEventListener('focus', () => {
  titreAvant = classeur.titre;
});
champTitre.addEventListener('input', () => classeur.renommer(champTitre.value));
champTitre.addEventListener('change', () => {
  champTitre.value = classeur.titre;
});
champTitre.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === 'Escape') {
    e.preventDefault();
    if (e.key === 'Escape') {
      classeur.renommer(titreAvant);
      champTitre.value = classeur.titre;
    }
    interactions.focaliser();
  }
});

// --- Réactions aux modifications du classeur ---------------------------------

// Les cellules à redessiner sont regroupées et redessinées en une fois, juste
// après la modification (quand tous les abonnés ont été prévenus).
const aRedessiner = new Set();
let redessinPrevu = false;
function redessiner(adresses) {
  for (const adr of adresses) aRedessiner.add(adr);
  if (redessinPrevu) return;
  redessinPrevu = true;
  queueMicrotask(() => {
    redessinPrevu = false;
    grille.rafraichirCellules(aRedessiner);
    aRedessiner.clear();
    interactions.actualiser();
  });
}

// Le moteur annonce les cellules dont la valeur a changé (y compris celles
// recalculées en cascade) ; le classeur annonce les changements de mise en forme.
moteur.abonner((evenement) => redessiner(evenement.adresses));

classeur.abonner((evenement) => {
  switch (evenement.type) {
    case 'cellules':
      redessiner(evenement.adresses);
      break;
    case 'largeurs':
      grille.rafraichirLargeurs(evenement.colonnes);
      interactions.actualiser();
      break;
    case 'dimensions':
    case 'feuille':
      grille.construire();
      selection.reborner();
      break;
    case 'titre':
      if (document.activeElement !== champTitre) champTitre.value = classeur.titre;
      document.title = `${classeur.titre} – ${CONFIG.nom}`;
      break;
    case 'historique':
      boutonAnnuler.disabled = !classeur.peutAnnuler;
      boutonRetablir.disabled = !classeur.peutRetablir;
      break;
    default:
      break;
  }
});

// --- Sauvegarde automatique ---------------------------------------------------
const etatSauvegarde = element('etat-sauvegarde');
const TEXTES_SAUVEGARDE = {
  modifie: 'Enregistrement…',
  enregistrement: 'Enregistrement…',
  enregistre: '✓ Enregistré',
  erreur: '⚠ Non enregistré',
};
let premierEnregistrement = true;
const sauvegarde = new SauvegardeAuto({
  classeur,
  enregistrer: (donnees) => ecrireClasseur(donnees),
  surEtat(etat) {
    etatSauvegarde.textContent = TEXTES_SAUVEGARDE[etat];
    etatSauvegarde.classList.toggle('erreur', etat === 'erreur');
    etatSauvegarde.title =
      etat === 'erreur'
        ? 'Le navigateur refuse l’enregistrement (stockage plein ou navigation privée). Une nouvelle tentative aura lieu à la prochaine modification.'
        : 'Chaque modification est enregistrée automatiquement sur cet appareil.';
    if (etat === 'enregistre' && premierEnregistrement) {
      premierEnregistrement = false;
      demanderStockagePersistant();
    }
  },
});
if (enregistre && !avertissementDemarrage) etatSauvegarde.textContent = TEXTES_SAUVEGARDE.enregistre;
if (avertissementDemarrage) {
  message.textContent = avertissementDemarrage;
  message.classList.add('erreur');
}

// --- Menu, fenêtres et application installable ------------------------------
preparerFenetres(() => interactions.focaliser());
installerMenu({
  classeur,
  feuille,
  preferences,
  avantAction: () => interactions.validerEdition(null, { refocaliser: false }),
});

// --- Exports PDF et CSV --------------------------------------------------------

/** Court message dans la barre d'état (disparaît au prochain changement de sélection). */
function signaler(texte) {
  message.textContent = texte;
  message.classList.remove('erreur');
}

const exportPdf = new ExportPdf({
  classeur,
  feuille,
  presenterCellule,
  preferences,
  fenetreAide: element('fenetre-aide-pdf'),
  demander,
  signaler,
});

function exporterCsv() {
  const contenu = genererCSV(feuille, moteur);
  if (!contenu) {
    signaler('Le classeur est vide : il n’y a rien à exporter.');
    return;
  }
  const nom = `${nomDeFichier(classeur.titre)}.csv`;
  telecharger(nom, contenu, 'text/csv;charset=utf-8');
  signaler(`Fichier « ${nom} » enregistré dans les téléchargements.`);
}

const panneauExporter = element('panneau-exporter');
panneauExporter.addEventListener('beforetoggle', (e) => {
  if (e.newState !== 'open') return;
  interactions.validerEdition(null, { refocaliser: false });
  const r = element('bouton-exporter').getBoundingClientRect();
  panneauExporter.style.top = `${r.bottom + 6}px`;
  panneauExporter.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - 300))}px`;
});
element('exporter-pdf').addEventListener('click', () => {
  panneauExporter.hidePopover();
  exportPdf.exporter();
});
element('exporter-csv').addEventListener('click', () => {
  panneauExporter.hidePopover();
  exporterCsv();
  interactions.focaliser();
});
commandes.exporterPdf = () => {
  interactions.validerEdition(null, { refocaliser: false });
  exportPdf.exporter();
};

// --- Divers ----------------------------------------------------------------------

// Taille de fenêtre modifiée (ou téléphone tourné) : le cadre de sélection est recalé.
window.addEventListener('resize', () => interactions.actualiser());

// Avertissement si l'application est ouverte deux fois.
const bandeauOnglets = element('bandeau-onglets');
surveillerAutresOnglets(() => {
  bandeauOnglets.hidden = false;
});
element('bouton-compris').addEventListener('click', () => {
  bandeauOnglets.hidden = true;
  interactions.focaliser();
});

const bandeau = element('bandeau-mise-a-jour');
demarrerServiceWorker({
  surMiseAJour(appliquer) {
    bandeau.hidden = false;
    element('bouton-recharger').onclick = appliquer;
  },
  avantRechargement: () => sauvegarde.maintenant(),
});

interactions.focaliser();

// Accès pour les tests automatiques et le débogage dans la console.
window.tableur = { classeur, feuille, moteur, selection, grille, interactions, sauvegarde, exportPdf, adresse };
