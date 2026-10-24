// Initiative : fenêtre « Graphique » (onglet « Données »).

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { demarrerServeur, lancerNavigateur, ouvrirApplication, cliquerOutil } from './outils.mjs';

let serveur;
let navigateur;

before(async () => {
  serveur = await demarrerServeur();
  navigateur = await lancerNavigateur();
});

after(async () => {
  await navigateur?.close();
  serveur?.arreter();
});

/** Un petit budget, avec un titre fusionné au-dessus du tableau. */
async function remplir(page) {
  await page.evaluate(() => {
    const { classeur, feuille } = window.omniTableur;
    const contenus = {
      A1: 'Budget du printemps',
      A2: 'Mois', B2: 'Courses', C2: 'Loisirs',
      A3: 'janvier', B3: '320', C3: '80',
      A4: 'février', B4: '295,5', C4: '120',
      A5: 'mars', B5: '=B4+10', C5: '45',
    };
    classeur.modifierCellules(feuille, Object.entries(contenus).map(([adresse, brut]) => ({ adresse, brut })));
    classeur.fusionner(feuille, { debut: { ligne: 1, colonne: 1 }, fin: { ligne: 1, colonne: 3 } });
  });
}

/** Ce que montre le dessin : nombre de colonnes, de courbes, de parts, et ses textes. */
const dessin = (page) =>
  page.evaluate(() => {
    const svg = document.querySelector('#zone-graphique svg');
    if (!svg) return null;
    return {
      colonnes: svg.querySelectorAll('rect[fill]:not(:first-child)').length,
      courbes: svg.querySelectorAll('path[fill="none"]').length,
      parts: svg.querySelectorAll('path:not([fill="none"])').length,
      textes: [...svg.querySelectorAll('text')].map((t) => t.textContent),
      cadre: svg.getAttribute('viewBox'),
      description: svg.getAttribute('aria-label'),
    };
  });

test('une cellule du tableau suffit : colonnes, courbe, secteurs', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await remplir(page);
  await page.click('td[data-ligne="4"][data-colonne="2"]');
  await cliquerOutil(page, '#bouton-graphique');
  await page.waitForSelector('#fenetre-graphique[open]');
  // Le tableau autour de la cellule, sans le titre fusionné au-dessus.
  assert.equal(await page.inputValue('#graphique-plage'), 'A2:C5');
  assert.equal(await page.inputValue('#graphique-titre'), ''); // deux séries : pas de titre proposé

  // Colonnes : 3 mois × 2 séries, plus les deux carrés de la légende.
  let vu = await dessin(page);
  assert.equal(vu.colonnes, 3 * 2 + 2);
  for (const texte of ['janvier', 'février', 'mars', 'Courses', 'Loisirs']) assert.ok(vu.textes.includes(texte), texte);
  assert.match(vu.description, /colonnes.*Courses, Loisirs/);
  assert.equal(await page.getAttribute('[data-type-graphique="colonnes"]', 'aria-pressed'), 'true');

  // Courbe : une ligne par série.
  await page.click('[data-type-graphique="courbe"]');
  vu = await dessin(page);
  assert.equal(vu.courbes, 2);
  assert.equal(await page.getAttribute('[data-type-graphique="courbe"]', 'aria-pressed'), 'true');

  // Secteurs : une part par mois (première série), avec une remarque.
  await page.click('[data-type-graphique="secteurs"]');
  await page.fill('#graphique-titre', 'Courses');
  vu = await dessin(page);
  assert.equal(vu.parts, 3);
  assert.ok(vu.textes.includes('Courses')); // le titre
  assert.ok(vu.textes.some((t) => /^janvier : \d/.test(t)));
  assert.match(await page.textContent('#note-graphique'), /qu'une série : « Courses »/);
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('cellules tapées à la main : erreur claire, puis graphique ; une seule série donne le titre', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await remplir(page);
  await page.evaluate(() => window.omniTableur.selection.choisirPlage({ debut: { ligne: 2, colonne: 1 }, fin: { ligne: 5, colonne: 2 } }));
  await cliquerOutil(page, '#bouton-graphique');
  assert.equal(await page.inputValue('#graphique-plage'), 'A2:B5');
  assert.equal(await page.inputValue('#graphique-titre'), 'Courses'); // comme Excel

  await page.fill('#graphique-plage', 'n’importe quoi');
  assert.equal(await dessin(page), null);
  assert.match(await page.textContent('#zone-graphique'), /Indiquez des cellules/);
  assert.equal(await page.isDisabled('#graphique-image'), true);

  await page.fill('#graphique-plage', 'a2:a5'); // que du texte
  assert.match(await page.textContent('#zone-graphique'), /Aucun nombre/);

  await page.fill('#graphique-plage', 'c2:c5');
  assert.equal((await dessin(page)).colonnes, 3);
  assert.equal(await page.isDisabled('#graphique-image'), false);
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('« Enregistrer l’image » : un vrai fichier PNG, deux fois plus grand que le dessin', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await remplir(page);
  await page.click('td[data-ligne="3"][data-colonne="1"]');
  await cliquerOutil(page, '#bouton-graphique');
  await page.fill('#graphique-titre', 'Budget');
  const attente = page.waitForEvent('download');
  await page.click('#graphique-image');
  const telechargement = await attente;
  assert.equal(telechargement.suggestedFilename(), 'Budget (graphique).png');
  const png = await readFile(await telechargement.path());
  assert.deepEqual([...png.subarray(1, 4)], [...Buffer.from('PNG')]);
  // Largeur et hauteur de l'image (en-tête du fichier PNG).
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1280, 800]);
  assert.match(await page.textContent('#note-graphique'), /Image enregistrée/);
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('au doigt, sur un téléphone : dessin étroit, fenêtre dans l’écran', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url, {
    viewport: { width: 360, height: 740 },
    hasTouch: true,
    isMobile: true,
  });
  await remplir(page);
  await page.tap('td[data-ligne="3"][data-colonne="2"]');
  await cliquerOutil(page, '#bouton-graphique', { doigt: true });
  await page.waitForSelector('#fenetre-graphique[open]');
  const boite = await page.evaluate(() => document.getElementById('fenetre-graphique').getBoundingClientRect().toJSON());
  assert.ok(boite.left >= 0 && boite.right <= 360, `fenêtre dans l'écran (${boite.left} → ${boite.right})`);
  assert.equal((await dessin(page)).cadre, '0 0 400 440');
  // Les trois boutons de type tiennent dans la fenêtre.
  const debordent = await page.$$eval('[data-type-graphique]', (boutons) => boutons.some((b) => b.scrollWidth > b.clientWidth + 1 || b.getBoundingClientRect().right > 360));
  assert.equal(debordent, false);
  await page.tap('[data-type-graphique="secteurs"]');
  assert.equal((await dessin(page)).parts, 3);
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});
