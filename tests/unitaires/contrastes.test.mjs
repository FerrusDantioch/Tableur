// Vérifie la lisibilité des trois thèmes : le texte doit avoir un contraste
// d'au moins 4,5:1 avec son fond (norme d'accessibilité WCAG AA).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../css/themes.css', import.meta.url), 'utf8');

/** Variables de couleur de chaque thème : { omni: { '--texte': '#e9e4f2', … }, … } */
function lireThemes() {
  const themes = {};
  for (const bloc of css.matchAll(/(?:\[data-theme="(\w+)"\])\s*\{([^}]*)\}/g)) {
    const variables = {};
    for (const [, nom, valeur] of bloc[2].matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})/g)) variables[nom] = valeur;
    themes[bloc[1]] = variables;
  }
  return themes;
}

/** Luminance relative d'une couleur (#rrggbb), selon la formule WCAG. */
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a, b) {
  const [claire, sombre] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (claire + 0.05) / (sombre + 0.05);
}

// Paires [texte, fond] à vérifier dans chaque thème.
const PAIRES = [
  ['--texte', '--fond'],
  ['--texte', '--surface'],
  ['--texte', '--cellule'],
  ['--discret', '--surface'],
  ['--entete-texte', '--entete'],
  ['--entete-surligne-texte', '--entete-surligne'],
  ['--erreur', '--cellule'],
  ['--accent-texte', '--accent'],
  ['--danger-texte', '--danger'],
  ['--texte', '--accent-doux'],
  ...['jaune', 'orange', 'rouge', 'rose', 'violet', 'bleu', 'vert', 'gris'].map((c) => ['--texte', `--fond-${c}`]),
  ...['jaune', 'orange', 'rouge', 'rose', 'violet', 'bleu', 'vert', 'gris'].map((c) => ['--erreur', `--fond-${c}`]),
  // Couleurs du texte choisies par la personne, sur le fond des cellules.
  ...['rouge', 'orange', 'jaune', 'vert', 'bleu', 'violet', 'gris'].map((c) => [`--encre-${c}`, '--cellule']),
];

// Bordures : un trait doit se voir (contraste d'au moins 3:1, norme WCAG pour les éléments graphiques).
const TRAITS = ['--bordure-auto', ...['rouge', 'orange', 'jaune', 'vert', 'bleu', 'violet', 'gris'].map((c) => `--encre-${c}`)];

test('les trois thèmes existent', () => {
  assert.deepEqual(Object.keys(lireThemes()).sort(), ['clair', 'omni', 'sombre']);
});

for (const [nom, variables] of Object.entries(lireThemes())) {
  test(`thème « ${nom} » : contrastes suffisants`, () => {
    for (const [texte, fond] of PAIRES) {
      assert.ok(variables[texte] && variables[fond], `${texte} ou ${fond} manque dans le thème ${nom}`);
      const rapport = contraste(variables[texte], variables[fond]);
      assert.ok(rapport >= 4.5, `${nom} : ${texte} sur ${fond} = ${rapport.toFixed(2)}:1 (minimum 4,5)`);
    }
  });

  test(`thème « ${nom} » : bordures bien visibles`, () => {
    for (const trait of TRAITS) {
      assert.ok(variables[trait], `${trait} manque dans le thème ${nom}`);
      const rapport = contraste(variables[trait], variables['--cellule']);
      assert.ok(rapport >= 3, `${nom} : ${trait} sur --cellule = ${rapport.toFixed(2)}:1 (minimum 3)`);
    }
  });

  test(`thème « ${nom} » : pas de contraste violent (sensibilité à la lumière)`, () => {
    // Pas de blanc pur derrière le texte, ni de rapport maximal noir/blanc.
    for (const fond of ['--fond', '--surface', '--cellule']) assert.notEqual(variables[fond].toLowerCase(), '#ffffff');
    assert.ok(contraste(variables['--texte'], variables['--cellule']) < 19, 'contraste trop violent');
  });
}
