# Omni-Tableur — notes pour Claude

PWA de tableur « Omni-Tableur » (appelée « Tableur » jusqu'à la 2.0.0 ; suite
bureautique de l'Omni-système) en **HTML/CSS/JS pur, modules ES, sans
framework ni compilation**. Code, commentaires et messages de
commit en français, rédigés pour un débutant : garder ce niveau d'explication.
L'utilisateur est novice : toujours lui parler en français, simplement.

## ⚠️ Avant de publier : augmenter la version

`js/config.js` → `version` (ex. `2.0.0` → `2.0.1`). Le service worker (`sw.js`)
nomme son cache avec ce numéro : sans changement, les appareils gardent
l'ancienne version. Tout nouveau fichier de l'application doit aussi aller
dans la liste `FICHIERS` de `sw.js` (le test `tests/unitaires/hors-ligne.test.mjs`
le vérifie). Ne jamais changer `idStockage` (`config.js`) ni `"id": "/Tableur/"`
(`manifest.webmanifest`). Le dépôt et le dossier restent `Tableur` (adresse
GitHub Pages `…/Tableur/`). `ancienIdStockage: 'tableur'` sert à la migration
des données d'avant le renommage (`stockage.js`, `theme-initial.js`,
`onglets.js`, `sw.js`) : ne pas le retirer.

## Architecture (trois couches)

- `js/donnees/` : classeur, feuilles, cellules (objets **gelés** : passer par
  `Classeur.modifierCellules`, jamais les modifier directement), références des
  formules (`formules.js`), recopie, bordures, tri. Toute modification passe par
  le classeur, qui la rend annulable et annonce des événements (`cellules`,
  `structure`, `onglets`, `active`…).
- `js/calcul/` : moteur multi-feuilles (clé de cellule = `idFeuille:adresse`),
  traduction FR → fast-formula-parser. `&` et les comparaisons sont réécrits en
  `INTERNE.CONCAT` / `INTERNE.COMPARER` (voir `fonctions.js`).
- `js/affichage/` : grille **virtuelle** (seules les lignes visibles existent :
  `grille.td(l, c)` peut renvoyer `undefined`), barre d'outils en onglets.
- `js/app.js` relie tout ; `window.omniTableur` sert aux tests.

## Tests

```bash
npm test                                                   # unitaires (Node 22+)
CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:navigateur   # navigateur (Playwright)
```

Ne pas annoncer un travail terminé avant que les deux passent.

## Pièges rencontrés

- Les outils d'écriture de fichiers de Claude transforment les séquences
  `\u` + 4 chiffres hexadécimaux en vrais caractères : écrire ces séquences
  avec un script Python, puis vérifier.
- Chrome : après deux fenêtres `<dialog>` à la suite, le champ de saisie qui
  récupère le focus peut ne plus réagir au clavier ; `fenetres.js` retire puis
  redonne le focus à la fermeture. Le bouton « Menu » ne doit pas empêcher la
  prise de focus.
- Un élément qui bascule `hidden` ne doit pas avoir de `display` dans une règle
  de classe sans `[hidden]` correspondant (`.barre-outils[hidden]`…).
- Playwright : `setInputFiles` avec un chemin contenant des accents échoue en
  silence ; donner le fichier sous forme `{ name, mimeType, buffer }`.

## Licence

Creative Commons BY-NC-ND 4.0 (`LICENSE`, textes officiels EN puis FR, à ne
jamais retoucher). Bibliothèques : MIT / Apache 2.0 / OFL uniquement, listées
dans `LICENCES.md` et dans « À propos ». Aucun CDN, aucun appel réseau (CSP
`default-src 'self'`).

## ⚠️ Plusieurs applications sur `ferrusdantioch.github.io` : limite de Chrome Android

Chrome Android n'installe qu'une seule application par origine : les autres
affichent « Cette appli est déjà installée ». Brave installe tout ; sinon
« Créer un raccourci ». Une même origine partage aussi le stockage : tous les
noms de stockage commencent par `omni-tableur`.
