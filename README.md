# Omni-Tableur — tableur hors ligne

Omni-Tableur est un tableur simple (comme Excel ou Google Sheets, pour les
analyses courantes) qui s'installe sur un ordinateur ou un téléphone Android,
comme une application classique.

- Aucun compte, aucun serveur : les classeurs restent sur l'appareil.
- Fonctionne sans connexion internet, après la première visite.
- À la souris, au clavier et au doigt.
- Application de la « Suite bureautique » de l'Omni-système, avec Plume
  (traitement de texte) et L'Atelier (écriture de romans).
- Créée par Ferrus Dantioch et Claude.

Adresse une fois publiée : `https://ferrusdantioch.github.io/Tableur/`
(dépôt GitHub `FerrusDantioch/Tableur`).

L'application s'appelait « Tableur » jusqu'à la version 2.0.0. L'adresse et le
nom du dépôt sont gardés tels quels : les changer casserait les favoris et
l'application déjà installée sur les appareils (voir partie 6).

**Le plus important** : la partie 1 explique comment ne jamais perdre un
classeur (faire régulièrement un export .json).

---

## 1. Ne pas perdre ses classeurs : les trois façons d'enregistrer

| | **Sauvegarde automatique** | **Export .json** (copie complète) | **Export CSV** (valeurs seulement) |
|---|---|---|---|
| **Comment** | Rien à faire : à chaque modification | Onglet « Données » → **Exporter** → **Exporter le classeur (.json)** | Onglet « Données » → **Exporter** → **Exporter la feuille (.csv)** |
| **Où** | Dans le navigateur de l'appareil | Un fichier `omni-tableur-AAAA-MM-JJ.json` dans les téléchargements, à ranger où tu veux | Un fichier `.csv` dans les téléchargements |
| **Ce qu'il garde** | Tout | **Tout** : toutes les feuilles (noms et ordre), textes et **formules**, mise en forme, bordures, largeurs, ligne figée, cellules fusionnées, règles de couleurs, feuille affichée, thème et zoom | **Une seule feuille**, et seulement les **valeurs** : les formules sont remplacées par leur résultat, sans mise en forme |
| **Pour quoi faire** | Retrouver son travail en rouvrant l'application | Copie de sécurité ; passer d'un appareil à l'autre | Ouvrir le tableau dans Excel, LibreOffice ou Google Sheets |
| **Disparaît si…** | …on efface les données du navigateur, on désinstalle, ou on change d'appareil | …on supprime le fichier soi-même | …on supprime le fichier soi-même |
| **Pour le rouvrir** | Automatique | **Importer** → **Importer un classeur (.json)** | **Importer** → **Importer un CSV** (dans une nouvelle feuille) |

(L'export **PDF**, lui, sert à imprimer ou envoyer un tableau figé : il ne se rouvre pas dans l'application.)

> **Conseil de sécurité** : la sauvegarde automatique reste dans le
> navigateur. Fais **régulièrement un export .json** — par exemple chaque
> semaine, et toujours après une grosse séance de travail — et range le
> fichier **ailleurs que sur l'appareil** (clé USB, cloud, e-mail à
> toi-même). C'est ta vraie copie de secours : avec elle, rien n'est perdu si
> le navigateur est vidé ou si le téléphone change.

**Bon à savoir**

- La sauvegarde automatique a lieu moins d'une seconde après chaque
  modification, et aussitôt quand l'application passe en arrière-plan. L'état
  est indiqué en bas à droite (« ✓ Enregistré »).
- Importer un classeur .json **remplace** le classeur ouvert, après la
  question « Cela remplacera votre classeur actuel. Continuer ? ». Juste
  après, le bouton « Annuler » permet encore de revenir au classeur d'avant.
  Pour garder les deux, exporte d'abord le classeur ouvert.
- Un fichier abîmé, vide, venant d'une autre application ou d'une version
  plus récente d'Omni-Tableur est refusé avec un message clair : le classeur
  ouvert ne change pas.
- Le fichier .json porte un numéro de version de format (`"version": 1`) :
  les versions futures de l'application sauront relire les anciens fichiers.
- Le classeur d'un téléphone et celui d'un ordinateur sont indépendants (pas
  de synchronisation) : le fichier .json sert à passer de l'un à l'autre.
- Rien ne quitte l'appareil sans toi : aucun compte, aucun serveur.
- Les classeurs des versions précédentes (« Tableur » 1.x et 2.0) s'ouvrent
  normalement : au premier lancement d'Omni-Tableur, ils sont copiés sous le
  nouveau nom, vérifiés, puis l'ancien exemplaire est effacé.
- Ouvre Omni-Tableur dans **un seul onglet à la fois** : un bandeau prévient
  si ce n'est pas le cas (sinon un onglet pourrait écraser le travail de l'autre).
- Sur Firefox, une question peut apparaître (« stocker des données de façon
  persistante ») : réponds « Autoriser ».
- « Menu → Nouveau classeur » efface tout, après confirmation ; « Annuler »
  permet encore de tout récupérer tant que l'application reste ouverte.

---

## 2. Toutes les fonctions

La barre d'outils est rangée en quatre onglets : **Édition**, **Mise en
forme**, **Bordures**, **Données**. Toucher l'onglet déjà ouvert replie la
barre (plus de place pour la grille sur téléphone). **Annuler**,
**Rétablir**, **À propos** et **Menu** restent toujours visibles en haut ; le
**zoom** et les **onglets des feuilles** sont en bas.

### Saisir et se déplacer

- Grille de 100 lignes × 26 colonnes (A à Z) au départ, agrandissable depuis
  le menu jusqu'à 1000 lignes × 52 colonnes (AZ). Seules les lignes visibles
  sont dessinées : même une grande feuille reste fluide sur téléphone.
- Texte et nombres à la française : `3,5` (ou `3.5`), `1 234`, `12,50 €`,
  `20 %`, `VRAI` / `FAUX`, dates `23/10/2026`. Une apostrophe force le texte : `'0612`.
- Clavier : flèches, **Tab** (à droite), **Entrée** (en bas), avec **Maj**
  dans l'autre sens ; **F2** ou double-clic pour modifier ; **Échap** pour
  annuler la saisie ; **Ctrl + flèche** pour aller au bord ; case « A1 » en
  haut à gauche : taper une adresse puis Entrée pour y aller.
- Au doigt : un appui sélectionne, un second appui ouvre le clavier ; la
  poignée ronde étend la sélection ; la barre « fx » permet aussi d'écrire.
- Sélectionner : Maj + flèches, glisser, ou toucher un **en-tête** (A, B…
  ou 1, 2…) pour toute la colonne ou toute la ligne (Maj + clic : plusieurs).
  Les panneaux « Insérer » et « Supprimer » ne proposent alors que des
  colonnes, ou que des lignes.
- **Annuler / Rétablir** pour toutes les actions (boutons, **Ctrl + Z**, **Ctrl + Y**).
- **Zoom** de 50 % à 200 % (pas de 10 %) : boutons **−** et **+** en bas à
  droite (un appui sur le pourcentage revient à 100 %), pincement à deux
  doigts sur la grille, ou **Ctrl + molette**. Mémorisé sur l'appareil ; il
  ne change que l'affichage (ni le classeur, ni le PDF).
- La barre du bas montre la somme, la moyenne et le nombre de valeurs de la
  sélection, ou l'explication de l'erreur de la cellule choisie.

### Onglet « Édition »

- **Copier, Couper, Coller** (ou **Ctrl + C / X / V**). Une formule collée
  ailleurs adapte ses références (=A1*2 devient =A2*2 une ligne plus bas).
- **Recopier** : petit carré en bas à droite de la sélection (souris), ou
  **Recopier en bas / à droite** (**Ctrl + D / Ctrl + R**). Les formules
  s'adaptent et les suites continuent : 1, 2 → 3, 4… ; lundi → mardi… ;
  janvier → février… ; « Semaine 1 » → « Semaine 2 » ; une date → le jour suivant.
- **Insérer** et **Supprimer** des lignes ou des colonnes : les formules de
  tout le classeur suivent les cellules (`#REF!` si une cellule utilisée disparaît).
- **Effacer** (ou **Suppr**) : vide les cellules en gardant leur mise en forme.
- **Rechercher** (**Ctrl + F**, ou **Ctrl + H** pour remplacer) : une barre
  s'ouvre sous les outils, avec « Rechercher », « Remplacer par »,
  **Suivant**, **Remplacer**, **Tout remplacer**, le nombre de résultats
  (« 2 sur 5 ») et deux options : « Respecter la casse » et « Dans toutes
  les feuilles ». « Tout remplacer » s'annule d'un seul « Annuler », même
  sur plusieurs feuilles. La recherche porte sur ce qui a été tapé (pour une
  formule, son texte : `SOMME`…).

### Onglet « Mise en forme »

- **Gras** (**Ctrl + B**), **Italique** (**Ctrl + I**), couleur du **Texte**,
  couleur de **Fond** (couleurs douces, adaptées à chaque thème),
  alignement **Gauche / Centre / Droite**.
- **Fusionner** des cellules (idéal pour un titre au-dessus d'un tableau) :
  - seule la cellule en haut à gauche garde son contenu ; si d'autres
    cellules sont remplies, une question est posée avant de les vider ;
  - le texte est centré (sauf alignement déjà choisi) ; les couleurs et les
    bordures s'appliquent à toute la zone fusionnée ;
  - une cellule fusionnée se choisit d'un seul appui, les flèches sautent
    par-dessus ; une formule qui vise une case de la zone (`=B1` quand A1:C1
    est fusionnée) utilise la cellule en haut à gauche ; une plage
    (`=SOMME(A1:C1)`) compte chaque case une seule fois, comme dans Excel ;
  - sur une cellule fusionnée, le bouton devient **Défusionner** ;
  - insérer ou supprimer des lignes ou colonnes agrandit, réduit ou déplace
    la fusion ; trier des lignes qui en contiennent est refusé avec un
    message (un titre fusionné juste au-dessus du tableau reste à sa place) ;
    avec la ligne 1 figée, une fusion ne peut pas déborder de la ligne 1 ;
  - un collage ou une recopie ne cache jamais de texte dans les cases couvertes.
- **Format** des nombres : nombre (`1 234,50`), euros, pourcentage, date,
  et nombre de décimales. Le format ne change que l'affichage : les calculs
  gardent le nombre exact.
- **Largeur** des colonnes (aussi en glissant le bord d'un en-tête ; un
  double-clic l'ajuste au contenu).
- **Conditions** (mise en forme conditionnelle) : colorer des cellules
  selon leur valeur. Une règle = des cellules (ex. `B2:B20`), une condition
  (« supérieure à », « inférieure à », « égale à », « entre », « négative »,
  « contient le texte ») et une couleur de fond et/ou de texte. Plusieurs
  règles par feuille ; la fenêtre les liste, avec **Modifier** et
  **Supprimer**. Les couleurs se recalculent toutes seules quand les valeurs
  changent, suivent les insertions et suppressions de lignes, et
  apparaissent dans le PDF. Si deux règles colorent la même cellule, la
  première de la liste l'emporte.

### Onglet « Bordures »

- **Toutes**, **Extérieure**, **Haut**, **Bas**, **Gauche**, **Droite**,
  **Aucune** ; trait **Fin** ou **Épais** ; **Couleur** au choix. Les
  bordures apparaissent aussi dans le PDF.

### Onglet « Données » et onglets des feuilles

- **Feuilles** (en bas) : ajouter (**+**), afficher, renommer, supprimer.
  Chaque feuille garde sa sélection et son défilement.
- **Trier** (croissant / décroissant) : le tableau autour de la cellule
  active est trié, la ligne de titres est reconnue, les lignes restent entières.
- **Figer la 1<sup>re</sup> ligne** : elle reste visible quand on fait défiler.
- **Importer** : « Importer un classeur (.json) » ou « Importer un CSV ».
- **Exporter** : « Exporter le classeur (.json) », « Exporter la feuille
  (.csv) » ou « Exporter la feuille (.pdf) » (case « Quadrillage gris »).
  Voir la partie 1 pour bien choisir.

### Formules

- Une cellule qui commence par `=` est une formule : `+ - * /`, `^`, `%`,
  `&` (assembler du texte), comparaisons `= <> < > <= >=`, références
  (`=A1+B2`, `$A$1` pour figer), plages (`A1:A10`, colonne entière `A:A`),
  cellules d'une autre feuille (`=Feuille2!A1`, `='Mes ventes'!B2:B10`).
- Les arguments sont séparés par `;`, comme dans Excel en français :
  `=SI(A1>10;"oui";"non")`.
- Recalcul automatique dès qu'une cellule change, en cascade, d'une feuille à l'autre.
- Comme Excel en français : le texte se compare sans tenir compte des
  majuscules (`="oui"="Oui"` est VRAI), `&` écrit `2,5` et `VRAI`, et
  `=0,1+0,2=0,3` est VRAI.

Les **37 fonctions** disponibles (noms français) :

| Fonction | Ce qu'elle fait | Exemple |
|---|---|---|
| SOMME | additionne | `=SOMME(A1:A10)` |
| MOYENNE | moyenne des nombres | `=MOYENNE(B2:B8)` |
| MEDIANE | valeur du milieu (moins sensible qu'une moyenne à une valeur extrême) | `=MEDIANE(1;2;100)` → 2 |
| MIN, MAX | plus petit, plus grand nombre | `=MAX(C1:C20)` |
| NB | compte les cellules qui contiennent un nombre | `=NB(A1:A100)` |
| NBVAL | compte les cellules non vides | `=NBVAL(A1:A100)` |
| PRODUIT | multiplie | `=PRODUIT(A1:A3)` |
| ARRONDI, ARRONDI.SUP, ARRONDI.INF | arrondit (au plus près, au-dessus, en dessous) | `=ARRONDI(A1;2)` |
| ENT | partie entière | `=ENT(7,8)` → 7 |
| ABS | valeur sans le signe | `=ABS(-5)` → 5 |
| MOD | reste d'une division | `=MOD(10;3)` → 1 |
| RACINE | racine carrée | `=RACINE(16)` → 4 |
| PUISSANCE | puissance | `=PUISSANCE(2;10)` → 1024 |
| SI | un résultat ou l'autre selon une condition | `=SI(A1>100;"cher";"ok")` |
| ET, OU, NON | combinent des conditions | `=ET(A1>0;A1<10)` |
| SIERREUR | valeur de secours si le calcul échoue | `=SIERREUR(A1/B1;0)` |
| NB.SI | compte les cellules qui respectent un critère | `=NB.SI(B2:B20;">10")` |
| SOMME.SI, MOYENNE.SI | somme ou moyenne selon un critère | `=SOMME.SI(A2:A9;"Loyer";B2:B9)` |
| NB.SI.ENS | compte les lignes qui respectent **toutes** les conditions | `=NB.SI.ENS(A2:A9;"Courses";B2:B9;">50")` |
| SOMME.SI.ENS, MOYENNE.SI.ENS | somme ou moyenne avec plusieurs conditions (la plage à calculer vient **en premier**) | `=SOMME.SI.ENS(C2:C9;A2:A9;"mars";B2:B9;"Courses")` |
| RECHERCHEV | cherche une valeur dans la 1<sup>re</sup> colonne d'un tableau | `=RECHERCHEV("Poire";A2:C9;3;FAUX)` |
| CONCATENER (et `&`) | assemble des textes | `=A1&" "&B1` |
| MAJUSCULE, MINUSCULE | change la casse | `=MAJUSCULE(A1)` |
| NBCAR | nombre de caractères | `=NBCAR(A1)` |
| AUJOURDHUI | date du jour | `=AUJOURDHUI()` |
| DATE | fabrique une date | `=DATE(2026;10;24)` |
| ANNEE, MOIS, JOUR | parties d'une date | `=MOIS(A1)` |

- Critères de NB.SI / SOMME.SI / MOYENNE.SI (et de leurs versions .ENS) :
  `">5"`, `"<=2,5"`, `"<>0"`, `"pomme"`, `"P*"` (jokers `*` et `?`), `""`
  (cellules vides), `">=01/01/2026"`. Dans une fonction .ENS, toutes les
  plages doivent avoir la même taille (sinon `#VALEUR!`).
- Dates : une date est un nombre de jours (`=B1-A1` donne l'écart en jours).
- Erreurs claires : `#DIV/0!`, `#VALEUR!`, `#REF!`, `#NOM?`, `#N/A`,
  `#ERREUR!`, `#CIRC!` (la formule dépend d'elle-même), `#NOMBRE!`. Une
  explication en français s'affiche en bas de l'écran.

### Menu et le reste

- **Menu** : thème (**Omni-système**, **Sombre classique**, **Clair**),
  taille du tableau (+ 50 lignes, + 5 colonnes), **Aide** (formules et
  raccourcis), installation sur l'appareil, **À propos**, **Nouveau classeur**.
- **À propos** (aussi en haut) : version, auteurs, contact pour les retours,
  licence et bibliothèques utilisées.
- **Titre du classeur** (en haut) : il sert aussi de nom aux fichiers exportés.
- Fonctionne **hors ligne** ; une nouvelle version se signale par un bandeau
  « Recharger ».

### Raccourcis clavier

| Raccourci | Action |
|---|---|
| Ctrl + Z / Ctrl + Y | annuler / rétablir |
| Ctrl + C / X / V | copier / couper / coller |
| Ctrl + D / Ctrl + R | recopier vers le bas / vers la droite |
| Ctrl + B / Ctrl + I | gras / italique |
| Ctrl + F / Ctrl + H | rechercher / remplacer |
| Ctrl + A | tout sélectionner |
| Ctrl + P | exporter en PDF |
| Ctrl + molette | zoom |
| F2 | modifier la cellule |
| Suppr | vider les cellules sélectionnées |

---

## 3. Essayer l'application sur ton ordinateur

Ouvrir `index.html` par un double-clic ne marche pas : le navigateur bloque
les modules JavaScript ouverts depuis un fichier. Il faut un petit serveur web
local. Il est fourni (`outils/serveur.mjs`) et n'a besoin que de Node.js.

**Une seule fois : installer Node.js**

1. Va sur <https://nodejs.org>.
2. Clique sur le bouton de téléchargement marqué « LTS ».
3. Ouvre le fichier téléchargé et clique sur « Suivant » jusqu'à la fin, sans rien changer.

**À chaque essai (Windows)**

1. Ouvre l'Explorateur de fichiers et va dans le dossier `Tableur`.
2. Clique dans la barre d'adresse en haut de la fenêtre (là où le chemin du dossier est écrit).
3. Efface ce qui est écrit, tape `cmd`, puis appuie sur Entrée. Une fenêtre noire s'ouvre.
4. Dans cette fenêtre, tape : `node outils/serveur.mjs` puis appuie sur Entrée.
5. Le message « Application disponible sur http://localhost:8000/Tableur/ » s'affiche.
6. Ouvre Chrome et va à l'adresse `http://localhost:8000/Tableur/`.
7. Pour arrêter : clique dans la fenêtre noire et appuie sur Ctrl+C, puis ferme-la.

**Sur Mac** : ouvre l'application « Terminal », tape `cd ` (avec un espace),
glisse le dossier `Tableur` dans la fenêtre, appuie sur Entrée, puis suis les
étapes 4 à 7 ci-dessus.

**Sur ton téléphone** : le plus simple est de publier l'application (partie 4)
et d'ouvrir son adresse sur le téléphone.

---

## 4. Publier l'application sur GitHub Pages

Le code est sur GitHub, dans le dépôt `FerrusDantioch/Tableur`. La version
publiée est celle de la branche `main` ; le travail de cette mise à jour est
sur la branche `claude/tableur-pwa-spreadsheet-8cspn7`. Tous les chemins de
l'application sont relatifs : elle fonctionne dans le sous-dossier `/Tableur/`.

**Publier cette mise à jour**

1. Connecte-toi sur <https://github.com> et ouvre le dépôt `Tableur`.
2. Un bandeau propose « Compare & pull request » pour la branche de travail :
   clique dessus, puis sur « Create pull request », puis sur « Merge pull
   request » et « Confirm merge ». Le code arrive sur la branche `main`.
   (Tu peux aussi me demander de préparer cette « pull request ».)
3. Attends une à deux minutes, puis ouvre `https://ferrusdantioch.github.io/Tableur/`.
   Si l'application était déjà ouverte, un bandeau propose « Recharger ».

**Si GitHub Pages n'est pas encore activé** : onglet « Settings » du dépôt →
« Pages » (colonne de gauche) → sous « Branch », choisis `main` puis `/ (root)`
→ « Save ».

Le dossier `tests` et le fichier `package.json` sont publiés aussi, mais ne
servent qu'aux vérifications : ils ne gênent pas l'application.

**Publier une mise à jour plus tard**

1. Augmente le numéro de version dans `js/config.js` (par exemple `2.1.0` devient `2.1.1`).
2. Envoie les fichiers modifiés sur la branche `main`.
3. Les personnes qui utilisent l'application verront : « Une nouvelle version
   est disponible. Recharger ».

Sans changement de version, les utilisateurs gardent l'ancienne version
(l'application est conservée sur leur appareil pour marcher hors ligne).

---

## 5. Installer l'application sur un appareil

- **Ordinateur (Chrome, Edge)** : Menu d'Omni-Tableur → « Installer l'application
  sur cet appareil » (ou l'icône d'installation dans la barre d'adresse).
- **Android (Chrome, Brave)** : menu du navigateur (⋮) → « Installer
  l'application » ou « Ajouter à l'écran d'accueil ».
- Attention : Chrome sur Android n'installe qu'une application par site, et
  toutes tes applications partagent `ferrusdantioch.github.io`. Si Chrome
  répond « Cette appli est déjà installée », utilise Brave, ou choisis
  « Créer un raccourci ».

---

## 6. Modifier l'application

### Organisation des fichiers

Le code est séparé en trois couches, pour pouvoir ajouter plus tard des
graphiques ou l'import Excel sans tout refaire :

```
index.html               la page (barres, grille, fenêtres)
manifest.webmanifest     carte d'identité de l'application installable
sw.js                    copie hors ligne de l'application (service worker)

js/config.js             nom, version, auteurs — LE fichier à modifier pour publier une version
js/app.js                assemble toutes les parties (seul fichier qui les connaît toutes)

js/donnees/              (a) LES DONNÉES — ce que tu as saisi
  adresses.js            « B3 » ↔ ligne 3, colonne 2 ; plages A1:C3 ; taille maximale
  saisie.js              comprend ce qui est tapé (nombre, texte, formule, €, %, date)
  classeur.js            le classeur : feuilles, cellules, mise en forme, annuler/rétablir,
                         insertion/suppression de lignes, feuilles, enregistrement
  formules.js            lit et réécrit les références des formules (A1, $A$1, Feuille2!A1…)
  fusions.js             cellules fusionnées : sélection agrandie, insertion et suppression
  regles.js              règles de mise en forme conditionnelle (description, vérification)
  fichier-classeur.js    fichier de sauvegarde complète (.json) : création et vérification
  recopie.js             poignée de recopie : formules adaptées, suites 1, 2, 3…
  recherche.js           rechercher et remplacer (texte cherché, ordre de lecture, remplacements)
  bordures.js            pose des bordures (toutes, extérieure…) et traits à dessiner
  tri.js                 tri : tableau autour de la cellule, ligne de titres, ordre

js/calcul/               (b) LE CALCUL DES FORMULES
  traduction.js          formules françaises → bibliothèque (SOMME → SUM, « ; » → « , »)
  moteur.js              calcule, suit les dépendances (entre feuilles aussi), recalcule
  fonctions.js           fonctions écrites pour Omni-Tableur (NB.SI, RECHERCHEV, MAJUSCULE…)
  comparaisons.js        comparaisons et critères à la française
  conditions.js          mise en forme conditionnelle : la cellule respecte-t-elle la règle ?
  erreurs.js             #DIV/0!, #REF!… et leurs explications
  bibliotheque.js        accès à la bibliothèque fast-formula-parser

js/affichage/            (c) L'AFFICHAGE
  grille.js              dessine la grille (lignes visibles seulement), ligne figée, sélection
  interactions.js        clavier, souris, doigt, poignée de recopie
  edition.js             saisie dans la cellule et dans la barre « fx »
  selection.js           cellule active et plage sélectionnée
  zoom.js                zoom de la grille (boutons, deux doigts, Ctrl + molette)
  format.js              nombres à la française (3,5 ; 12,50 € ; 23/10/2026)
  barre-outils.js        onglets de la barre d'outils, panneaux
  commandes-edition.js   recopier, insérer, supprimer, effacer
  commandes-fusion.js    bouton « Fusionner / Défusionner »
  conditions.js          fenêtre « Mise en forme conditionnelle »
  mise-en-forme.js       gras, italique, couleurs, alignement, formats, largeurs
  outils-bordures.js     onglet « Bordures »
  commandes-donnees.js   trier, figer la 1re ligne, importer un CSV
  onglets-feuilles.js    onglets des feuilles (ajouter, renommer, supprimer)
  presse-papiers.js      copier, couper, coller
  recherche.js           barre « Rechercher et remplacer »
  sauvegarde-fichier.js  boutons « Exporter / Importer un classeur (.json) »
  menu.js, fenetres.js   menu, « À propos » et fenêtres

js/services/             sauvegarde, thèmes, exports PDF et CSV, import CSV, application installable
css/                     apparence (themes.css = toutes les couleurs)
vendor/                  bibliothèque de formules (non modifiée)
fonts/, icons/, assets/  polices, icônes, logo
licences/                textes des licences des bibliothèques et polices
outils/                  serveur local, création des icônes
tests/                   vérifications automatiques
```

### Changements courants

- **Nom ou version** : `js/config.js`. Si tu changes le nom, change-le aussi
  dans `manifest.webmanifest` (un test vérifie que les deux correspondent).
- **Ne change jamais** `idStockage: 'omni-tableur'` dans `js/config.js` : les
  classeurs déjà enregistrés deviendraient invisibles. (Il valait `'tableur'`
  avant le renommage : `js/services/stockage.js` déplace une seule fois les
  données de l'ancien nom vers le nouveau — copie, vérification, puis
  effacement de l'ancien exemplaire.)
- **Ne renomme pas** le dépôt GitHub ni le dossier `Tableur` : l'adresse de
  l'application (`…github.io/Tableur/`) changerait.
- **Ne change jamais** `"id": "/Tableur/"` dans `manifest.webmanifest`. Chrome
  le lit à partir de la racine du site (`https://ferrusdantioch.github.io/`) :
  `"./"` aurait donné à l'application l'identité de la racine, la même que
  d'autres applications du site. Et une application déjà installée dont l'`id`
  change devient, pour Chrome, une autre application.
- **Couleurs** : uniquement dans `css/themes.css` (un bloc par thème). Le test
  `tests/unitaires/contrastes.test.mjs` vérifie que le texte et les bordures restent lisibles.
- **Ajouter une fonction en français** : dans `js/calcul/traduction.js`,
  ajoute une ligne à la liste `FONCTIONS` (nom français → nom anglais de la
  bibliothèque, par exemple `ECARTYPE: 'STDEV.S'`), puis un test dans
  `tests/unitaires/fonctions.test.mjs`. Vérifie le résultat : si la fonction
  de la bibliothèque ne se comporte pas comme Excel, écris-la dans
  `js/calcul/fonctions.js` (c'est ce qui a été fait pour NB.SI ou RECHERCHEV).
- **Ajouter un fichier** (script, style…) : ajoute-le aussi à la liste
  `FICHIERS` de `sw.js`, sinon il manquera hors ligne (un test le vérifie).
- **Icônes** : `python3 outils/creer-icones.py` (il faut Python et Pillow).

### Vérifier après une modification

- `npm test` : tests des formules, des données, des fusions, des règles de
  couleurs, de la recherche, du fichier .json (y compris un classeur complexe
  exporté puis réimporté à l'identique, et des fichiers invalides refusés),
  des exports, des contrastes et de la liste hors ligne. N'a besoin que de
  Node.js, version 22 ou plus récente (rien d'autre à installer).
- `npm run test:navigateur` : tests dans un vrai navigateur, à la souris, au
  clavier et au doigt (téléphone imité) : saisie, onglets, tri, import et
  export, sauvegarde, passage de l'ancien nom au nouveau, zoom, recherche,
  fusion, mise en forme conditionnelle, thèmes, hors ligne, PDF. Il faut
  d'abord, une seule fois : `npm install` puis `npx playwright install chromium`.

---

## 7. Choix techniques (en bref)

- **Site statique pur** : HTML, CSS et JavaScript, sans serveur ni étape de
  construction. Pas de framework : l'application reste simple à lire et à modifier.
- **Formules : fast-formula-parser (licence MIT, vérifiée dans son dépôt)**,
  comparée à hot-formula-parser et formula.js. C'est la plus fidèle à Excel :
  priorités des opérations, `SI` qui ne calcule que la branche choisie
  (`=SI(B1=0;"";A1/B1)` marche), références vers d'autres feuilles, erreurs
  claires ; elle donne aussi la liste des cellules utilisées par chaque
  formule, ce qui permet le recalcul automatique. Ses manques ou écarts avec
  Excel en français sont comblés dans `js/calcul/fonctions.js` (MIN, MAX,
  MAJUSCULE, NB.SI qui comptait le texte, RECHERCHEV sensible aux
  majuscules, `&` qui écrivait « 2.5 » et « TRUE »…), sans toucher au
  fichier de la bibliothèque. hot-formula-parser est abandonnée par ses
  auteurs (remplacée par HyperFormula, sous licence GPL) ; formula.js ne sait
  pas lire une formule, seulement calculer des fonctions.
- **Grille « virtuelle »** : seules les lignes visibles existent dans la page.
  1000 lignes × 52 colonnes s'affichent aussi vite que 100 lignes.
- **PDF par l'impression du navigateur** (« Enregistrer au format PDF »),
  comme dans Plume : hors ligne, texte sélectionnable, aucune bibliothèque.
- **CSV au format Excel français** : `;` entre les colonnes, virgule décimale,
  dates jj/mm/aaaa, UTF-8 avec BOM.
- **Sécurité** : la page ne charge que ses propres fichiers (règle CSP dans
  `index.html`), le contenu des cellules est toujours affiché comme du texte,
  un fichier CSV importé ne peut pas lancer de formule, et un fichier .json
  importé est lu comme de simples données (`JSON.parse`), vérifié en entier
  avant de remplacer quoi que ce soit.

---

## 8. Prêt pour plus tard (non fait pour l'instant)

- **Graphiques** depuis une plage : `moteur.valeursPlage(feuille, "A1:B10")`
  donne les valeurs calculées d'une plage, et `moteur.abonner(…)` prévient à
  chaque changement de valeur. Un module `js/affichage/graphiques.js` pourra
  s'appuyer dessus sans toucher à la grille ni au calcul.
- **Import de fichiers Excel (.xlsx)** : il suffira de lire le fichier (avec
  une bibliothèque sous licence permissive) puis de créer les feuilles avec
  `classeur.ajouterFeuille({ nom, donnees })`, comme le fait déjà l'import CSV.
- **Synchronisation entre appareils** : le classeur se transforme déjà en un
  simple objet (`classeur.versJSON()` / `classeur.charger()`), et tout
  l'enregistrement passe par `js/services/stockage.js`.
- **Fonctions supplémentaires** (SOMMEPROD, RECHERCHEX…) : une ligne dans
  `js/calcul/traduction.js`, et si besoin la fonction dans `js/calcul/fonctions.js`.

## 9. Limites connues

- Un seul classeur à la fois (avec autant de feuilles que l'on veut) ;
  1000 lignes × 52 colonnes au maximum par feuille.
- Pas de retour à la ligne dans une cellule (un texte trop long est coupé
  avec « … »), pas de tableaux de valeurs (formules matricielles).
- Copier une cellule fusionnée colle son contenu, pas la fusion elle-même.
- Le tri trie les lignes du tableau entier ; pour trier une partie précise,
  il faut d'abord la sélectionner (plusieurs lignes et colonnes).
- Dates : jour/mois/année seulement (pas d'heures).
- Mise en forme conditionnelle volontairement simple : des couleurs de fond
  et de texte, sans barres de données ni échelles de couleurs.
- La poignée de recopie se tire à la souris ; au doigt, on utilise les
  boutons « Recopier en bas / à droite ».

---

## 10. Licence

Distribué sous licence **[Creative Commons BY-NC-ND 4.0](LICENSE)**
(Attribution - Utilisation non commerciale - Pas d'Œuvre dérivée), avec le
texte officiel en anglais et sa traduction française officielle.

Ce logiciel peut être utilisé et partagé en copies identiques, gratuitement, à
condition de citer l'auteur (Ferrus Dantioch) et d'indiquer la licence. Il est
interdit de le vendre ou d'en tirer un profit commercial, et de diffuser une
version modifiée. Le logiciel est fourni « en l'état », sans aucune garantie.

Les bibliothèques et polices d'autres auteurs gardent leur propre licence :
voir [LICENCES.md](LICENCES.md).
