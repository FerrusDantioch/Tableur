# Licences des éléments utilisés

Tableur n'utilise que des éléments sous licence libre **permissive** (MIT,
Apache 2.0, SIL Open Font License). Aucun élément sous licence GPL ou
commerciale (HyperFormula a été écarté pour cette raison).

Chaque licence a été vérifiée dans le dépôt GitHub d'origine **et** dans le
paquet téléchargé. Les textes complets sont dans le dossier [`licences/`](licences/),
publié avec l'application (ils sont aussi accessibles depuis « Menu → À propos »).

## Fournis avec l'application

| Élément | Version | Rôle | Licence | Texte |
|---|---|---|---|---|
| [fast-formula-parser](https://github.com/LesterLyu/fast-formula-parser) | 1.0.19 | Lire et calculer les formules | MIT | [licences/fast-formula-parser-MIT.txt](licences/fast-formula-parser-MIT.txt) |
| [Chevrotain](https://github.com/Chevrotain/chevrotain) (inclus dans fast-formula-parser) | 7.0.1 | Outil de lecture des formules | Apache 2.0 | [licences/chevrotain-Apache-2.0.txt](licences/chevrotain-Apache-2.0.txt) |
| [jStat](https://github.com/jstat/jstat) (inclus dans fast-formula-parser) | 1.9.x | Fonctions statistiques | MIT | [licences/jstat-MIT.txt](licences/jstat-MIT.txt) |
| [bessel](https://github.com/SheetJS/bessel) (inclus dans fast-formula-parser) | 1.0.x | Fonctions mathématiques | Apache 2.0 | [licences/bessel-Apache-2.0.txt](licences/bessel-Apache-2.0.txt) |
| [bahttext](https://github.com/jojoee/bahttext) (inclus dans fast-formula-parser) | 1.x | Fonction BAHTTEXT | MIT | [licences/bahttext-MIT.txt](licences/bahttext-MIT.txt) |
| [Oxanium](https://github.com/sevmeyer/oxanium) (police, via Fontsource 5.3.0) | — | Titres et boutons (thème Omni-système) | SIL OFL 1.1 | [licences/police-Oxanium-OFL.txt](licences/police-Oxanium-OFL.txt) |
| [Literata](https://github.com/googlefonts/literata) (police, via Fontsource 5.3.0) | — | Contenu des cellules (thème Omni-système) | SIL OFL 1.1 | [licences/police-Literata-OFL.txt](licences/police-Literata-OFL.txt) |
| [JetBrains Mono](https://github.com/JetBrains/JetBrainsMono) (police, via Fontsource 5.3.0) | — | En-têtes A, B, C… et 1, 2, 3… | SIL OFL 1.1 | [licences/police-JetBrains-Mono-OFL.txt](licences/police-JetBrains-Mono-OFL.txt) |

Remarques :

- `vendor/fast-formula-parser/parser.min.js` est le fichier `build/parser.min.js`
  du paquet npm, **non modifié** ; les quatre bibliothèques marquées « inclus »
  y ont été intégrées par son auteur. Détails dans
  [`vendor/fast-formula-parser/LISEZMOI.txt`](vendor/fast-formula-parser/LISEZMOI.txt).
- La licence Apache 2.0 demande de fournir son texte avec le logiciel (c'est
  fait) et de reproduire un éventuel fichier « NOTICE » : Chevrotain et bessel
  n'en ont pas.
- Les compléments écrits pour l'application (MIN, MAX, MAJUSCULE, NBVAL,
  NB.SI, SOMME.SI, MOYENNE.SI, RECHERCHEV, CONCATENER, AUJOURDHUI, correction
  de MOYENNE, comparaisons et « & » à la française, traduction française)
  sont dans `js/calcul/fonctions.js`, `js/calcul/comparaisons.js` et
  `js/calcul/traduction.js`, sans toucher au fichier de la bibliothèque.

## Éléments propres au projet

- Le logo de l'Omni-système (`assets/logo-omni-systeme.webp`) appartient à
  Ferrus Dantioch (repris de Plume).
- Les icônes de l'application (`icons/`) sont dessinées par le script
  `outils/creer-icones.py` de ce projet.
- Le code de Tableur appartient à Ferrus Dantioch. Il est distribué sous
  licence **Creative Commons BY-NC-ND 4.0** (fichier [`LICENSE`](LICENSE) :
  texte officiel anglais puis traduction française officielle) : utilisation
  et partage à l'identique, en citant l'auteur, sans usage commercial ni
  modification. Les licences des éléments ci-dessus (MIT, Apache 2.0, OFL)
  permettent de les inclure dans ce projet.

## Outils de vérification (non publiés avec l'application)

| Outil | Rôle | Licence |
|---|---|---|
| Node.js (lanceur de tests intégré `node --test`) | Tests des formules et des données | MIT |
| [Playwright](https://github.com/microsoft/playwright) 1.56.1 | Tests dans un vrai navigateur | Apache 2.0 |
| [Pillow](https://github.com/python-pillow/Pillow) (Python) | Création des icônes | MIT-CMU (HPND), permissive |
