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

---

## 1. Ce que l'application sait faire

La barre d'outils est rangée en quatre onglets : **Édition**, **Mise en
forme**, **Bordures**, **Données**. Toucher l'onglet déjà ouvert replie la
barre (plus de place pour la grille sur téléphone). **Annuler**,
**Rétablir**, **À propos** et **Menu** restent toujours visibles en haut.

**Saisie et déplacements**

- Grille de 100 lignes × 26 colonnes (A à Z) au départ, agrandissable depuis
  le menu jusqu'à 1000 lignes × 52 colonnes (AZ). Seules les lignes visibles
  sont dessinées : même une grande feuille reste fluide sur téléphone.
- Texte et nombres à la française : `3,5` (ou `3.5`), `1 234`, `12,50 €`,
  `20 %`, `VRAI` / `FAUX`, dates `23/10/2026`. Une apostrophe force le texte : `'0612`.
- Clavier : flèches, **Tab** (à droite), **Entrée** (en bas), avec **Maj** dans
  l'autre sens ; **F2** ou double-clic pour modifier ; **Échap** pour annuler ;
  **Suppr** pour vider ; **Ctrl + flèche** pour aller au bord.
- Au doigt : un appui sélectionne, un second appui ouvre le clavier ; la
  poignée ronde étend la sélection ; la barre « fx » permet aussi d'écrire.
- Sélection de plages (Maj + flèches, glisser, clic sur un en-tête A/B/C ou 1/2/3).
- Annuler / Rétablir (boutons, **Ctrl + Z**, **Ctrl + Y**), pour toutes les actions.

**Édition** (onglet « Édition »)

- Copier, couper, coller : boutons ou **Ctrl + C / X / V**. Une formule collée
  ailleurs adapte ses références (=A1*2 devient =A2*2 une ligne plus bas).
- Recopier : petit carré en bas à droite de la sélection (souris), ou boutons
  **Recopier en bas / à droite** (**Ctrl + D / Ctrl + R**). Les formules
  s'adaptent et les suites continuent : 1, 2 → 3, 4… ; lundi → mardi… ;
  janvier → février… ; « Semaine 1 » → « Semaine 2 » ; une date → le jour suivant.
- Insérer et supprimer des lignes ou des colonnes : les formules de tout le
  classeur suivent les cellules (`#REF!` si une cellule utilisée disparaît).
- Effacer le contenu (comme **Suppr**), en gardant la mise en forme.

**Formules**

- Une cellule qui commence par `=` est une formule : `+ - * /`, `^`, `%`, `&`,
  comparaisons, références (`=A1+B2`, `$A$1`), plages (`A1:A10`, `A:A`), et
  cellules d'une autre feuille (`=Feuille2!A1`, `='Mes ventes'!B2:B10`).
- Arguments séparés par `;` comme dans Excel en français : `=SI(A1>10;"oui";"non")`.
- Fonctions (noms français) :

  | Domaine | Fonctions |
  |---|---|
  | Calcul | SOMME, MOYENNE, MIN, MAX, NB, NBVAL, ARRONDI, ARRONDI.SUP, ARRONDI.INF, ABS, ENT, MOD, PRODUIT, RACINE, PUISSANCE |
  | Conditions | SI, ET, OU, NON, SIERREUR, NB.SI, SOMME.SI, MOYENNE.SI |
  | Texte | CONCATENER (et `&`), MAJUSCULE, MINUSCULE, NBCAR |
  | Dates | AUJOURDHUI, DATE, ANNEE, MOIS, JOUR |
  | Recherche | RECHERCHEV |

- Critères de NB.SI / SOMME.SI : `">5"`, `"<=2,5"`, `"<>0"`, `"pomme"`,
  `"P*"` (jokers `*` et `?`), `""` (cellules vides), `">=01/01/2026"`.
- Comme Excel en français : le texte se compare sans tenir compte des
  majuscules (`="oui"="Oui"` est VRAI), `&` écrit `2,5` et `VRAI`, et
  `=0,1+0,2=0,3` est VRAI.
- Recalcul automatique dès qu'une cellule change, en cascade, d'une feuille à l'autre.
- Erreurs claires : `#DIV/0!`, `#VALEUR!`, `#REF!`, `#NOM?`, `#N/A`,
  `#ERREUR!`, `#CIRC!` (référence circulaire), `#NOMBRE!`. Quand on
  sélectionne la cellule, une explication en français s'affiche en bas de l'écran.
- La barre du bas montre la somme, la moyenne et le nombre de valeurs de la sélection.

**Mise en forme** (onglets « Mise en forme » et « Bordures »)

- Gras (**Ctrl + B**), italique (**Ctrl + I**), couleur du texte, couleur de
  fond (couleurs douces, adaptées à chaque thème), alignement gauche /
  centre / droite.
- Format des nombres : nombre (`1 234,50`), euros, pourcentage, date, et
  nombre de décimales. Le format ne change que l'affichage.
- Largeur des colonnes (glisser le bord de l'en-tête, double-clic pour
  ajuster au contenu, ou bouton « Largeur »).
- Bordures : toutes, extérieure, haut, bas, gauche, droite, aucune ; trait
  fin ou épais ; couleur au choix. Elles sont aussi dans le PDF.

**Données** (onglet « Données » et onglets des feuilles en bas)

- Plusieurs feuilles : ajouter (**+**), afficher, renommer, supprimer. Chaque
  feuille garde sa sélection et son défilement.
- Trier une colonne (croissant / décroissant) : le tableau autour de la
  cellule active est trié, la ligne de titres est reconnue, les lignes
  restent entières.
- Figer la première ligne (elle reste visible quand on fait défiler).
- Importer un fichier CSV dans une nouvelle feuille ; exporter la feuille
  affichée en **PDF** (avec la mise en forme et les bordures) ou en **CSV**.

**Le reste** : sauvegarde automatique (toutes les feuilles, toute la mise en
forme), trois thèmes (Omni-système, Sombre classique, Clair), aide intégrée
(Menu → Aide), fenêtre « À propos » (version, contact, licence, bibliothèques).

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

**Sur ton téléphone** : le plus simple est de publier l'application (partie 3)
et d'ouvrir son adresse sur le téléphone.

---

## 3. Publier l'application sur GitHub Pages

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

1. Augmente le numéro de version dans `js/config.js` (par exemple `2.0.0` devient `2.0.1`).
2. Envoie les fichiers modifiés sur la branche `main`.
3. Les personnes qui utilisent l'application verront : « Une nouvelle version
   est disponible. Recharger ».

Sans changement de version, les utilisateurs gardent l'ancienne version
(l'application est conservée sur leur appareil pour marcher hors ligne).

---

## 4. Installer l'application sur un appareil

- **Ordinateur (Chrome, Edge)** : Menu d'Omni-Tableur → « Installer l'application
  sur cet appareil » (ou l'icône d'installation dans la barre d'adresse).
- **Android (Chrome, Brave)** : menu du navigateur (⋮) → « Installer
  l'application » ou « Ajouter à l'écran d'accueil ».
- Attention : Chrome sur Android n'installe qu'une application par site, et
  toutes tes applications partagent `ferrusdantioch.github.io`. Si Chrome
  répond « Cette appli est déjà installée », utilise Brave, ou choisis
  « Créer un raccourci ».

---

## 5. Les classeurs et leur sécurité

- Le classeur (toutes ses feuilles, toute la mise en forme, les bordures, la
  feuille affichée) est enregistré **automatiquement** dans le navigateur de
  l'appareil (IndexedDB), moins d'une seconde après chaque modification, et
  aussitôt quand l'application passe en arrière-plan. L'état est indiqué en
  bas à droite (« ✓ Enregistré »).
- Les classeurs créés avec l'ancienne version (1.x) s'ouvrent normalement
  avec la nouvelle : rien n'est perdu.
- Rien ne quitte l'appareil. Si tu effaces les données du site dans le
  navigateur, le classeur disparaît : pour garder une copie, exporte-le en CSV
  ou en PDF.
- Le classeur d'un téléphone et celui d'un ordinateur sont indépendants
  (pas de synchronisation pour l'instant).
- Ouvre Omni-Tableur dans **un seul onglet à la fois** : un bandeau prévient si ce
  n'est pas le cas (sinon un onglet pourrait écraser les modifications de l'autre).
- Sur Firefox, une question peut apparaître (« stocker des données de façon
  persistante ») : réponds « Autoriser ».
- « Menu → Nouveau classeur » efface tout, après confirmation ; le bouton
  « Annuler » permet encore de tout récupérer tant que l'application reste ouverte.

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
  recopie.js             poignée de recopie : formules adaptées, suites 1, 2, 3…
  bordures.js            pose des bordures (toutes, extérieure…) et traits à dessiner
  tri.js                 tri : tableau autour de la cellule, ligne de titres, ordre

js/calcul/               (b) LE CALCUL DES FORMULES
  traduction.js          formules françaises → bibliothèque (SOMME → SUM, « ; » → « , »)
  moteur.js              calcule, suit les dépendances (entre feuilles aussi), recalcule
  fonctions.js           fonctions écrites pour Omni-Tableur (NB.SI, RECHERCHEV, MAJUSCULE…)
  comparaisons.js        comparaisons et critères à la française
  erreurs.js             #DIV/0!, #REF!… et leurs explications
  bibliotheque.js        accès à la bibliothèque fast-formula-parser

js/affichage/            (c) L'AFFICHAGE
  grille.js              dessine la grille (lignes visibles seulement), ligne figée, sélection
  interactions.js        clavier, souris, doigt, poignée de recopie
  edition.js             saisie dans la cellule et dans la barre « fx »
  selection.js           cellule active et plage sélectionnée
  format.js              nombres à la française (3,5 ; 12,50 € ; 23/10/2026)
  barre-outils.js        onglets de la barre d'outils, panneaux
  commandes-edition.js   recopier, insérer, supprimer, effacer
  mise-en-forme.js       gras, italique, couleurs, alignement, formats, largeurs
  outils-bordures.js     onglet « Bordures »
  commandes-donnees.js   trier, figer la 1re ligne, importer un CSV
  onglets-feuilles.js    onglets des feuilles (ajouter, renommer, supprimer)
  presse-papiers.js      copier, couper, coller
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
  bibliothèque, par exemple `MEDIANE: 'MEDIAN'`), puis un test dans
  `tests/unitaires/fonctions.test.mjs`. Vérifie le résultat : si la fonction
  de la bibliothèque ne se comporte pas comme Excel, écris-la dans
  `js/calcul/fonctions.js` (c'est ce qui a été fait pour NB.SI ou RECHERCHEV).
- **Ajouter un fichier** (script, style…) : ajoute-le aussi à la liste
  `FICHIERS` de `sw.js`, sinon il manquera hors ligne (un test le vérifie).
- **Icônes** : `python3 outils/creer-icones.py` (il faut Python et Pillow).

### Vérifier après une modification

- `npm test` : tests des formules, des données, des exports, des contrastes
  et de la liste hors ligne. N'a besoin que de Node.js, version 22 ou plus
  récente (rien d'autre à installer).
- `npm run test:navigateur` : tests dans un vrai navigateur (clavier, souris,
  doigt, onglets, tri, import, sauvegarde, thèmes, hors ligne, exports). Il
  faut d'abord, une seule fois : `npm install` puis `npx playwright install chromium`.

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
  un fichier CSV importé ne peut pas lancer de formule.

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
- Pas de cellules fusionnées, pas de retour à la ligne dans une cellule (un
  texte trop long est coupé avec « … »), pas de tableaux de valeurs (formules matricielles).
- Le tri trie les lignes du tableau entier ; pour trier une partie précise,
  il faut d'abord la sélectionner (plusieurs lignes et colonnes).
- Dates : jour/mois/année seulement (pas d'heures).
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
