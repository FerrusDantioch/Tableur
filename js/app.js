// Point d'entrée de l'application : crée chaque partie et les relie.
//
// L'application est organisée en trois couches séparées :
//   (a) donnees/   ce que la personne a saisi (classeur, feuilles, cellules) ;
//   (b) calcul/    le calcul des formules ;
//   (c) affichage/ la grille à l'écran, le clavier, la souris et le doigt.
// Ce fichier est le seul à les connaître toutes les trois.

import { Classeur } from './donnees/classeur.js';
import { adresse, lireAdresse, textePlage } from './donnees/adresses.js';
import { interpreterSaisie } from './donnees/saisie.js';
import { borduresADessiner } from './donnees/bordures.js';
import { MoteurCalcul } from './calcul/moteur.js';
import { couleursConditionnelles } from './calcul/conditions.js';
import { formaterNombre, presenter } from './affichage/format.js';
import { Grille } from './affichage/grille.js';
import { Selection } from './affichage/selection.js';
import { Edition } from './affichage/edition.js';
import { Interactions } from './affichage/interactions.js';
import { MiseEnForme } from './affichage/mise-en-forme.js';
import { CommandesEdition } from './affichage/commandes-edition.js';
import { OutilsBordures } from './affichage/outils-bordures.js';
import { OngletsFeuilles } from './affichage/onglets-feuilles.js';
import { CommandesDonnees } from './affichage/commandes-donnees.js';
import { CommandesFusion } from './affichage/commandes-fusion.js';
import { MiseEnFormeConditionnelle } from './affichage/conditions.js';
import { FenetreGraphique } from './affichage/graphique.js';
import { installerBarreOutils } from './affichage/barre-outils.js';
import { demander, ouvrirFenetre, preparerFenetres } from './affichage/fenetres.js';
import { installerMenu } from './affichage/menu.js';
import { PressePapiers } from './affichage/presse-papiers.js';
import { SauvegardeFichier } from './affichage/sauvegarde-fichier.js';
import { RechercheRemplacement } from './affichage/recherche.js';
import { Zoom } from './affichage/zoom.js';
import { demanderStockagePersistant, ecrireClasseur, lireClasseur, mettreDeCote, preferences } from './services/stockage.js';
import { SauvegardeAuto } from './services/sauvegarde-auto.js';
import { demarrerServiceWorker } from './services/pwa.js';
import { genererCSV } from './services/export-csv.js';
import { ExportPdf } from './services/export-pdf.js';
import { nomDeFichier, telecharger } from './services/fichiers.js';
import { surveillerAutresOnglets } from './services/onglets.js';
import { THEME_PAR_DEFAUT, choisirTheme } from './services/theme.js';

const CONFIG = self.CONFIG_APP;
const element = (id) => document.getElementById(id);

// --- (a) Les données ---------------------------------------------------------
const classeur = new Classeur();

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
const moteur = new MoteurCalcul(classeur);

// --- (c) L'affichage ---------------------------------------------------------

/** La feuille affichée (onglet sélectionné). */
const feuilleActive = () => classeur.feuilleActive;

/**
 * Ce qu'affiche une cellule de la feuille active : valeur calculée mise en
 * forme (format des nombres), gras, italique, retour à la ligne, couleurs,
 * alignement et bordures.
 * Les règles de mise en forme conditionnelle (voir calcul/conditions.js)
 * peuvent remplacer les couleurs : elles sont donc recalculées à chaque
 * dessin de la cellule, c'est-à-dire à chaque changement de sa valeur.
 */
function presenterCellule(adr, ligne, colonne) {
  const feuille = feuilleActive();
  const cellule = feuille.cellule(adr);
  const saisie = interpreterSaisie(cellule?.brut);
  const position = ligne ? { ligne, colonne } : lireAdresse(adr);
  const valeur = moteur.valeur(feuille, adr);
  const vue = presenter(valeur, saisie.style, cellule?.format);
  const conditions = feuille.regles.length
    ? couleursConditionnelles(feuille.regles, position.ligne, position.colonne, valeur, vue.texte)
    : { fond: null, encre: null };
  return {
    ...vue,
    gras: cellule?.gras,
    italique: cellule?.italique,
    retour: cellule?.retour,
    couleur: conditions.encre ?? cellule?.couleur,
    fond: conditions.fond ?? cellule?.fond,
    alignement: cellule?.alignement,
    bordures: borduresADessiner((a) => feuille.cellule(a), position.ligne, position.colonne),
  };
}

const zone = element('zone-grille');
const grille = new Grille({ racine: zone, feuille: feuilleActive(), presenterCellule });
const selection = new Selection(
  () => ({ lignes: feuilleActive().lignes, colonnes: feuilleActive().colonnes }),
  () => feuilleActive().fusions,
);
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

// Message d'une action (« Colonne supprimée », « 2 cellules copiées »…) : il
// reste affiché tant que la sélection ne change pas.
let annonce = null; // { texte, erreur, cle }
const cleSelection = () => `${feuilleActive().id}|${textePlage(selection.plage)}|${selection.active.ligne},${selection.active.colonne}`;

/**
 * Barre d'état : message de la dernière action, ou explication de l'erreur
 * de la cellule active ; et résumé (somme, moyenne, nombre) quand plusieurs
 * cellules sont sélectionnées.
 */
function mettreAJourBarreEtat() {
  const feuille = feuilleActive();
  const { ligne, colonne } = selection.active;
  if (annonce && annonce.cle === cleSelection()) {
    message.textContent = annonce.texte;
    message.classList.toggle('erreur', annonce.erreur);
  } else {
    annonce = null;
    const vue = presenter(moteur.valeur(feuille, adresse(ligne, colonne)));
    message.textContent = vue.explication ? `${vue.texte} — ${vue.explication}` : '';
    message.classList.toggle('erreur', Boolean(vue.explication));
  }

  let resume = '';
  if (!selection.unique) {
    const { nombres, somme, moyenne } = moteur.resumer(feuille, selection.plage);
    if (nombres > 0) {
      resume = `Somme : ${formaterNombre(somme)} · Moyenne : ${formaterNombre(moyenne)} · Nombres : ${nombres}`;
    }
  }
  statistiques.textContent = resume;
}

/** Court message dans la barre d'état (disparaît au prochain changement de sélection). */
function signaler(texte, erreur = false) {
  annonce = { texte, erreur, cle: cleSelection() };
  message.textContent = texte;
  message.classList.toggle('erreur', erreur);
}

// Créés plus bas (ils ont besoin des interactions), mais utilisés dès maintenant.
let miseEnForme = null;
let commandesEdition = null;

/** Actions partagées entre la barre d'outils et les raccourcis clavier. */
const commandes = {
  annuler() {
    interactions.validerEdition(null, { refocaliser: false });
    montrerAction(classeur.annuler());
    interactions.focaliser();
  },
  retablir() {
    interactions.validerEdition(null, { refocaliser: false });
    montrerAction(classeur.retablir());
    interactions.focaliser();
  },
  selectionChangee() {
    mettreAJourBarreEtat();
    miseEnForme?.actualiser();
  },
  effacer: () => commandesEdition.effacer(),
  recopier: (direction) => commandesEdition.recopier(direction),
  recopierPoignee: (source, direction, nombre) => commandesEdition.recopierPoignee(source, direction, nombre),
};

/** Après Annuler / Rétablir : affiche la feuille concernée et sélectionne ce qui a changé. */
function montrerAction(action) {
  if (!action) return;
  if (action.feuille && classeur.feuilles.includes(action.feuille)) classeur.activer(action.feuille);
  if (action.selection) {
    selection.choisirPlage(action.selection);
    grille.rendreVisible(action.selection.debut.ligne, action.selection.debut.colonne);
  }
}

const interactions = new Interactions({
  classeur,
  selection,
  grille,
  edition,
  nomCellule: element('nom-cellule'),
  boutonValider: element('valider-saisie'),
  boutonAnnuler: element('annuler-saisie'),
  commandes,
});

const avantAction = () => interactions.validerEdition(null, { refocaliser: false });
const apresAction = () => interactions.focaliser();

// Zoom de la grille (boutons − et +, deux doigts, Ctrl + molette), mémorisé sur l'appareil.
const zoom = new Zoom({ grille, preferences, avantChangement: avantAction, apresChangement: () => interactions.actualiser() });

miseEnForme = new MiseEnForme({
  classeur,
  selection,
  grille,
  valeurCellule: (adr) => moteur.valeur(feuilleActive(), adr),
  avantAction,
  apresAction,
  redessinerSelection: () => grille.afficherSelection(selection),
});
commandes.gras = () => miseEnForme.gras();
commandes.italique = () => miseEnForme.italique();
commandes.redimensionner = (evenement, colonne) => miseEnForme.redimensionner(evenement, colonne);
commandes.ajusterLargeur = (colonnes) => miseEnForme.ajusterLargeur(colonnes);
miseEnForme.actualiser();

commandesEdition = new CommandesEdition({ classeur, selection, avantAction, apresAction, signaler });
new OutilsBordures({ classeur, selection, preferences, avantAction, apresAction });
new OngletsFeuilles({ classeur, avantAction, apresAction, demander, ouvrirFenetre, signaler });
new CommandesDonnees({ classeur, selection, valeur: (feuille, adr) => moteur.valeur(feuille, adr), avantAction, apresAction, signaler });
new CommandesFusion({ classeur, selection, demander, avantAction, apresAction, signaler });
new MiseEnFormeConditionnelle({ classeur, selection, ouvrirFenetre, avantAction });
const graphique = new FenetreGraphique({
  classeur,
  selection,
  valeur: (adr) => moteur.valeur(feuilleActive(), adr),
  presenterCellule,
  ouvrirFenetre,
  avantAction,
});
const recherche = new RechercheRemplacement({ classeur, selection, grille, avantAction, apresAction, signaler });
commandes.rechercher = (remplacer) => recherche.ouvrir({ remplacer });

installerBarreOutils({ preferences, avantAction, apresAction, surChangement: () => interactions.actualiser() });
boutonAnnuler.addEventListener('click', () => commandes.annuler());
boutonRetablir.addEventListener('click', () => commandes.retablir());

// Copier, couper, coller : Ctrl+C, Ctrl+X, Ctrl+V quand la grille a le focus, ou boutons.
const pressePapiers = new PressePapiers({
  classeur,
  selection,
  presenterCellule,
  estActif: () => !edition.enCours && [edition.champCellule, zone].includes(document.activeElement),
  signaler,
});
for (const [id, action] of [
  ['bouton-copier', () => pressePapiers.copier(false)],
  ['bouton-couper', () => pressePapiers.copier(true)],
  ['bouton-coller', () => pressePapiers.coller()],
]) {
  element(id).addEventListener('click', async () => {
    avantAction();
    await action();
    apresAction();
  });
}

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
moteur.abonner((evenement) => {
  if (evenement.feuille === feuilleActive()) redessiner(evenement.adresses);
});

/** Redessine toute la grille (lignes insérées, tri, ligne figée…). */
function reconstruireGrille() {
  grille.changerFeuille(feuilleActive());
  selection.reborner();
}

// Chaque feuille garde sa sélection et sa position de défilement : en
// revenant sur une feuille, on la retrouve comme on l'avait laissée.
const memoiresFeuilles = new WeakMap();
let feuilleAffichee = feuilleActive();

/** Une autre feuille est affichée (onglet choisi, feuille ajoutée ou supprimée, Annuler…). */
function changerDeFeuille() {
  const nouvelle = feuilleActive();
  if (nouvelle === feuilleAffichee) {
    reconstruireGrille();
    return;
  }
  memoiresFeuilles.set(feuilleAffichee, {
    ancre: { ...selection.ancre },
    bout: { ...selection.bout },
    haut: zone.scrollTop,
    gauche: zone.scrollLeft,
  });
  feuilleAffichee = nouvelle;
  grille.changerFeuille(nouvelle);
  const memoire = memoiresFeuilles.get(nouvelle) ?? { ancre: { ligne: 1, colonne: 1 }, bout: { ligne: 1, colonne: 1 }, haut: 0, gauche: 0 };
  zone.scrollTop = memoire.haut;
  zone.scrollLeft = memoire.gauche;
  selection.restaurer(memoire);
  miseEnForme.actualiser();
}

/**
 * Cellules à redessiner quand des cellules changent : elles-mêmes, et leurs
 * voisines du dessus et de gauche (qui dessinent leurs bordures du haut et de gauche).
 */
function avecVoisines(adresses) {
  const resultat = new Set(adresses);
  for (const adr of adresses) {
    const { ligne, colonne } = lireAdresse(adr);
    if (ligne > 1) resultat.add(adresse(ligne - 1, colonne));
    if (colonne > 1) resultat.add(adresse(ligne, colonne - 1));
  }
  return resultat;
}

classeur.abonner((evenement) => {
  switch (evenement.type) {
    case 'cellules':
      if (evenement.feuille === feuilleActive()) redessiner(avecVoisines(evenement.adresses));
      break;
    case 'largeurs':
      if (evenement.feuille !== feuilleActive()) break;
      grille.rafraichirLargeurs(evenement.colonnes);
      interactions.actualiser();
      break;
    case 'dimensions':
      if (evenement.feuille === feuilleActive()) reconstruireGrille();
      break;
    case 'structure':
      if (evenement.feuilles.includes(feuilleActive())) reconstruireGrille();
      break;
    case 'active':
      changerDeFeuille();
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
if (avertissementDemarrage) signaler(avertissementDemarrage, true);

// --- Menu, fenêtres et application installable ------------------------------
preparerFenetres(() => interactions.focaliser());
installerMenu({ classeur, preferences, avantAction });

// --- Exports PDF et CSV --------------------------------------------------------

const exportPdf = new ExportPdf({
  classeur,
  presenterCellule,
  preferences,
  fenetreAide: element('fenetre-aide-pdf'),
  demander,
  signaler,
});

function exporterCsv() {
  const feuille = feuilleActive();
  const contenu = genererCSV(feuille, moteur);
  if (!contenu) {
    signaler('La feuille est vide : il n’y a rien à exporter.');
    return;
  }
  // Avec plusieurs feuilles, le nom de la feuille est ajouté au nom du fichier.
  const suffixe = classeur.feuilles.length > 1 ? ` - ${feuille.nom}` : '';
  const nom = `${nomDeFichier(classeur.titre + suffixe)}.csv`;
  telecharger(nom, contenu, 'text/csv;charset=utf-8');
  signaler(`Fichier « ${nom} » enregistré dans les téléchargements.`);
}

const panneauExporter = element('panneau-exporter');
// Case « Quadrillage gris dans le PDF » : montre le choix actuel, le mémorise si on la change.
const caseQuadrillage = element('quadrillage-pdf');
panneauExporter.addEventListener('beforetoggle', (e) => {
  if (e.newState === 'open') caseQuadrillage.checked = exportPdf.quadrillage;
});
caseQuadrillage.addEventListener('change', () => {
  exportPdf.quadrillage = caseQuadrillage.checked;
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

// --- Sauvegarde complète dans un fichier (.json) ----------------------------------
// Le fichier garde aussi le thème et le zoom ; ils sont repris à l'import.
const sauvegardeFichier = new SauvegardeFichier({
  classeur,
  lireAffichage: () => ({ zoom: zoom.pourcent, theme: preferences.lire('theme', THEME_PAR_DEFAUT) }),
  appliquerAffichage(affichage) {
    if (affichage.theme) choisirTheme(affichage.theme, preferences);
    if (affichage.zoom !== undefined) zoom.choisir(affichage.zoom);
  },
  demander,
  avantAction,
  apresAction,
  signaler,
});

// --- Divers ----------------------------------------------------------------------

// Taille de fenêtre modifiée (ou téléphone tourné) : le cadre de sélection est recalé.
window.addEventListener('resize', () => interactions.actualiser());

// Retour sur l'application un autre jour : AUJOURDHUI() est recalculée.
let jourOuverture = new Date().toDateString();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || new Date().toDateString() === jourOuverture) return;
  jourOuverture = new Date().toDateString();
  moteur.recalculerVolatiles();
});

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
window.omniTableur = {
  classeur,
  get feuille() {
    return classeur.feuilleActive;
  },
  moteur,
  selection,
  grille,
  interactions,
  sauvegarde,
  exportPdf,
  pressePapiers,
  sauvegardeFichier,
  zoom,
  recherche,
  graphique,
  adresse,
};
