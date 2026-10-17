# Tableur — tableur hors ligne

Tableur est un tableur simple (comme Excel ou Google Sheets, pour les
analyses courantes) qui s'installe sur un ordinateur ou un téléphone Android,
comme une application classique.

- Aucun compte, aucun serveur : les classeurs restent sur l'appareil.
- Fonctionne sans connexion internet, après la première visite.
- À la souris, au clavier et au doigt.
- Application de la « Suite bureautique » de l'Omni-système, avec Plume
  (traitement de texte) et L'Atelier (écriture de romans).
- Faite par Ferrus Dantioch et Claude.

Adresse une fois publiée : `https://ferrusdantioch.github.io/Tableur/`
(dépôt GitHub `FerrusDantioch/Tableur`).

---

## 1. Ce que l'application sait faire

**Saisie et déplacements**

- Grille de 100 lignes × 26 colonnes (A à Z) au départ, agrandissable depuis
  le menu jusqu'à 1000 lignes × 52 colonnes (AZ).
- Texte et nombres à la française : `3,5` (ou `3.5`), `1 234`, `12,50 €`,
  `20 %`, `VRAI` / `FAUX`. Une apostrophe force le texte : `'0612`.
- Clavier : flèches, **Tab** (à droite), **Entrée** (en bas), avec **Maj** dans
  l'autre sens ; **F2** ou double-clic pour modifier ; **Échap** pour annuler ;
  **Suppr** pour vider ; **Ctrl + flèche** pour aller au bord.
- Au doigt : un appui sélectionne, un second appui ouvre le clavier ; la
  poignée ronde étend la sélection ; la barre « fx » permet aussi d'écrire.
- Sélection de plages (Maj + flèches, glisser, clic sur un en-tête A/B/C ou 1/2/3).
- Annuler / Rétablir (boutons, **Ctrl + Z**, **Ctrl + Y**).
- Copier, couper, coller (**Ctrl + C / X / V**), avec adaptation des formules.

**Formules**

- Une cellule qui commence par `=` est une formule : `+ - * /`, `^`, `%`, `&`,
  comparaisons, références (`=A1+B2`, `$A$1`), plages (`A1:A10`, `A:A`).
- Fonctions : **SOMME, MOYENNE, MIN, MAX, NB, SI**, et aussi ET, OU, NON,
  SIERREUR, ARRONDI (.SUP, .INF), ABS, ENT, MOD, PRODUIT, RACINE, PUISSANCE,
  NBCAR, CONCATENER, SOMME.SI, MOYENNE.SI.
- Arguments séparés par `;` comme dans Excel en français : `=SI(A1>10;"oui";"non")`.
- Recalcul automatique dès qu'une cellule change, en cascade.
- Erreurs claires : `#DIV/0!`, `#VALEUR!`, `#REF!`, `#NOM?`, `#ERREUR!`,
  `#CIRC!` (référence circulaire), `#NOMBRE!`. Quand on sélectionne la
  cellule, une explication en français s'affiche en bas de l'écran.
- La barre du bas montre la somme, la moyenne et le nombre de valeurs de la sélection.

**Mise en forme** : gras, 8 couleurs de fond (douces, adaptées à chaque thème),
largeur des colonnes (glisser le bord de l'en-tête, double-clic pour ajuster
au contenu, ou bouton « Largeur »).

**Le reste** : sauvegarde automatique, trois thèmes (Omni-système, Sombre
classique, Clair), aide intégrée (Menu → Aide), page « À propos », export
**PDF** et **CSV** (bouton « Exporter »).

---

## 2. Essayer l'application sur ton ordinateur

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

**Sur ton téléphone** (même réseau Wi-Fi que l'ordinateur) : le plus simple
est de publier l'application (partie 3) et d'ouvrir son adresse sur le téléphone.

---

## 3. Publier l'application sur GitHub Pages

Le code est déjà sur GitHub, dans le dépôt `FerrusDantioch/Tableur`, sur la
branche de travail `ccr-66c70536-x2ea28`. Tous les chemins de l'application
sont relatifs : elle fonctionne dans le sous-dossier `/Tableur/`.

**Première publication**

1. Connecte-toi sur <https://github.com> et ouvre le dépôt `Tableur`.
2. Un bandeau jaune propose « Compare & pull request » pour la branche de
   travail : clique dessus, puis sur « Create pull request », puis sur
   « Merge pull request » et « Confirm merge ». Le code arrive sur la branche `main`.
   (Tu peux aussi me demander de préparer cette « pull request ».)
3. Clique sur l'onglet « Settings » du dépôt, puis sur « Pages » dans la colonne de gauche.
4. Sous « Branch », choisis `main`, puis `/ (root)`, puis clique sur « Save ».
5. Attends une à deux minutes, puis ouvre `https://ferrusdantioch.github.io/Tableur/`.

Le dossier `tests` et le fichier `package.json` sont publiés aussi, mais ne
servent qu'aux vérifications : ils ne gênent pas l'application.

**Publier une mise à jour**

1. Augmente le numéro de version dans `js/config.js` (par exemple `1.0.0` devient `1.0.1`).
2. Envoie les fichiers modifiés sur la branche `main`.
3. Les personnes qui utilisent l'application verront : « Une nouvelle version
   est disponible. Recharger ».

Sans changement de version, les utilisateurs gardent l'ancienne version
(l'application est conservée sur leur appareil pour marcher hors ligne).

---

## 4. Installer l'application sur un appareil

- **Ordinateur (Chrome, Edge)** : Menu de Tableur → « Installer l'application
  sur cet appareil » (ou l'icône d'installation dans la barre d'adresse).
- **Android (Chrome, Brave)** : menu du navigateur (⋮) → « Installer
  l'application » ou « Ajouter à l'écran d'accueil ».
- Attention : Chrome sur Android n'installe qu'une application par site, et
  toutes tes applications partagent `ferrusdantioch.github.io`. Si Chrome
  répond « Cette appli est déjà installée », utilise Brave, ou choisis
  « Créer un raccourci ».

---

## 5. Les classeurs et leur sécurité

- Le classeur est enregistré **automatiquement** dans le navigateur de
  l'appareil (IndexedDB), moins d'une seconde après chaque modification, et
  aussitôt quand l'application passe en arrière-plan. L'état est indiqué en
  bas à droite (« ✓ Enregistré »).
- Rien ne quitte l'appareil. Si tu effaces les données du site dans le
  navigateur, le classeur disparaît : pour garder une copie, exporte-le en CSV
  ou en PDF.
- Le classeur d'un téléphone et celui d'un ordinateur sont indépendants
  (pas de synchronisation pour l'instant).
- Ouvre Tableur dans **un seul onglet à la fois** : un bandeau prévient si ce
  n'est pas le cas (sinon un onglet pourrait écraser les modifications de l'autre).
- Sur Firefox, une question peut apparaître (« stocker des données de façon
  persistante ») : réponds « Autoriser ».
- « Menu → Nouveau classeur » efface tout, après confirmation ; le bouton
  « Annuler » permet encore de tout récupérer tant que l'application reste ouverte.

---

## 6. Modifier l'application

### Organisation des fichiers

Le code est séparé en trois couches, pour pouvoir ajouter plus tard des
graphiques, le tri ou l'import Excel sans tout refaire :

```
index.html               la page (barres, grille, fenêtres)
manifest.webmanifest     carte d'identité de l'application installable
sw.js                    copie hors ligne de l'application (service worker)

js/config.js             nom, version, auteurs — LE fichier à modifier pour publier une version
js/app.js                assemble toutes les parties (seul fichier qui les connaît toutes)

js/donnees/              (a) LES DONNÉES — ce que tu as saisi
  adresses.js            « B3 » ↔ ligne 3, colonne 2 ; plages A1:C3
  saisie.js              comprend ce qui est tapé (nombre, texte, formule, €, %)
  classeur.js            le classeur : cellules, mise en forme, largeurs, annuler/rétablir

js/calcul/               (b) LE CALCUL DES FORMULES
  traduction.js          formules françaises → bibliothèque (SOMME → SUM, « ; » → « , »)
  moteur.js              calcule, suit les dépendances, recalcule en cascade
  fonctions.js           MIN, MAX, MOYENNE complétées
  erreurs.js             #DIV/0!, #REF!… et leurs explications
  bibliotheque.js        accès à la bibliothèque fast-formula-parser

js/affichage/            (c) L'AFFICHAGE
  grille.js              dessine la grille et le cadre de sélection
  interactions.js        clavier, souris, doigt
  edition.js             saisie dans la cellule et dans la barre « fx »
  selection.js           cellule active et plage sélectionnée
  format.js              nombres à la française (3,5 ; 12,50 €)
  mise-en-forme.js       gras, couleurs, largeurs
  presse-papiers.js      copier, couper, coller
  menu.js, fenetres.js   menu et fenêtres

js/services/             sauvegarde, thèmes, exports, application installable
css/                     apparence (themes.css = toutes les couleurs)
vendor/                  bibliothèque de formules (non modifiée)
fonts/, icons/, assets/  polices, icônes, logo
licences/                textes des licences
outils/                  serveur local, création des icônes
tests/                   vérifications automatiques
```

### Changements courants

- **Nom ou version** : `js/config.js`. Si tu changes le nom, change-le aussi
  dans `manifest.webmanifest` (un test vérifie que les deux correspondent).
- **Ne change jamais** `idStockage: 'tableur'` dans `js/config.js` : les
  classeurs déjà enregistrés deviendraient invisibles.
- **Ne change jamais** `"id": "/Tableur/"` dans `manifest.webmanifest`. Chrome
  le lit à partir de la racine du site (`https://ferrusdantioch.github.io/`) :
  `"./"` aurait donné à l'application l'identité de la racine, la même que
  d'autres applications du site. Et une application déjà installée dont l'`id`
  change devient, pour Chrome, une autre application.
- **Couleurs** : uniquement dans `css/themes.css` (un bloc par thème). Le test
  `tests/unitaires/contrastes.test.mjs` vérifie que le texte reste lisible.
- **Ajouter une fonction en français** : dans `js/calcul/traduction.js`,
  ajoute une ligne à la liste `FONCTIONS` (nom français → nom anglais de la
  bibliothèque, par exemple `'NB.SI': 'COUNTIF'`), puis un test dans
  `tests/unitaires/formules.test.mjs`. Vérifie le résultat : certaines
  fonctions de la bibliothèque sont incomplètes (c'est le cas de NB.SI, qui
  compte aussi le texte).
- **Ajouter un fichier** (script, style…) : ajoute-le aussi à la liste
  `FICHIERS` de `sw.js`, sinon il manquera hors ligne (un test le vérifie).
- **Icônes** : `python3 outils/creer-icones.py` (il faut Python et Pillow).

### Vérifier après une modification

- `npm test` : tests des formules, des données, des exports, des contrastes
  et de la liste hors ligne. N'a besoin que de Node.js, version 22 ou plus
  récente (rien d'autre à installer).
- `npm run test:navigateur` : tests dans un vrai navigateur (clavier, souris,
  doigt, sauvegarde, thèmes, hors ligne, exports). Il faut d'abord, une seule
  fois : `npm install` puis `npx playwright install chromium`.

---

## 7. Choix techniques (en bref)

- **Site statique pur** : HTML, CSS et JavaScript, sans serveur ni étape de
  construction. Pas de framework : l'application est assez petite pour s'en
  passer, et elle reste plus simple à lire et à modifier.
- **Formules : fast-formula-parser (licence MIT)**, comparée à
  hot-formula-parser et formula.js. C'est la plus fidèle à Excel (39 cas
  justes sur 51 dans mon comparatif, contre 31) : priorités des opérations,
  `SI` qui ne calcule que la branche choisie (`=SI(B1=0;"";A1/B1)` marche),
  erreurs claires. Elle fournit aussi la liste des cellules utilisées par
  chaque formule, ce qui permet le recalcul automatique. Ses manques (MIN et
  MAX absentes) sont comblés par `js/calcul/fonctions.js`.
  hot-formula-parser est abandonnée par ses auteurs (remplacée par
  HyperFormula, sous licence GPL) ; formula.js ne sait pas lire une formule,
  seulement calculer des fonctions.
- **PDF par l'impression du navigateur** (« Enregistrer au format PDF »),
  comme dans Plume : hors ligne, texte sélectionnable, aucune bibliothèque.
- **CSV au format Excel français** : `;` entre les colonnes, virgule décimale,
  UTF-8 avec BOM.
- **Sécurité** : la page ne charge que ses propres fichiers (règle CSP dans
  `index.html`), le contenu des cellules est toujours affiché comme du texte.

---

## 8. Prêt pour plus tard (non fait pour l'instant)

- **Graphiques** depuis une plage : `moteur.valeursPlage("A1:B10")` donne les
  valeurs calculées de la plage, et `moteur.abonner(…)` prévient à chaque
  changement de valeur. Un module `js/affichage/graphiques.js` pourra
  s'appuyer dessus sans toucher à la grille ni au calcul.
- **Tri et filtres** : ils se feront dans `js/donnees/classeur.js` (déplacer
  des lignes), avec l'annulation déjà en place.
- **Import de fichiers Excel** : il suffira de remplir le classeur avec
  `classeur.charger(…)` ou `classeur.modifierCellules(…)` (bibliothèque à
  choisir, sous licence permissive).
- **Synchronisation entre appareils** : le classeur se transforme déjà en un
  simple objet (`classeur.versJSON()` / `classeur.charger()`), et tout
  l'enregistrement passe par `js/services/stockage.js`.
- Le format d'enregistrement prévoit déjà plusieurs feuilles.

## 9. Limites connues

- Une seule feuille, un seul classeur à la fois ; 1000 lignes × 52 colonnes au maximum.
- Pas de dates (une date tapée reste du texte), pas de cellules fusionnées.
- Quelques petites différences avec Excel : comparaison de texte sensible aux
  majuscules (`="a"="A"` donne FAUX), une cellule vide n'est pas égale à `""`
  dans une comparaison, `SI` accepte trop d'arguments sans erreur.
- Copier / coller : au clavier (Ctrl + C / X / V) ; pas encore de boutons pour le téléphone.
