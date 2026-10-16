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

const CONFIG = self.CONFIG_APP;
const element = (id) => document.getElementById(id);

// --- (a) Les données ---------------------------------------------------------
const classeur = new Classeur();
const feuille = classeur.feuilles[0];

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

// --- Titre du classeur -------------------------------------------------------
const champTitre = element('titre');
champTitre.addEventListener('change', () => classeur.renommer(champTitre.value));
champTitre.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === 'Escape') {
    e.preventDefault();
    if (e.key === 'Escape') champTitre.value = classeur.titre;
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
      champTitre.value = classeur.titre;
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

interactions.focaliser();

// Accès pour les tests automatiques et le débogage dans la console.
window.tableur = { classeur, feuille, moteur, selection, grille, interactions, adresse };
