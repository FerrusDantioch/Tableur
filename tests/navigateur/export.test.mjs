// Étape 5 : export CSV et PDF.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { demarrerServeur, lancerNavigateur, ouvrirApplication } from './outils.mjs';

const RESULTATS = fileURLToPath(new URL('../resultats/', import.meta.url));
mkdirSync(RESULTATS, { recursive: true });

/** Vrai si l'outil en ligne de commande existe (pdftotext, pdfinfo). */
function outilDisponible(nom) {
  try {
    execFileSync(nom, ['-v'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/** Remplit un petit budget dans la page. */
async function remplirBudget(page, cellules) {
  await page.evaluate((liste) => {
    const { classeur, feuille } = window.tableur;
    classeur.renommer('Budget de test');
    classeur.modifierCellules(feuille, liste);
  }, cellules);
}

const BUDGET = [
  { adresse: 'A1', brut: 'Poste', gras: true, fond: 'violet' },
  { adresse: 'B1', brut: 'Montant', gras: true, fond: 'violet' },
  { adresse: 'A2', brut: 'Loyer' },
  { adresse: 'B2', brut: '650,50' },
  { adresse: 'A3', brut: 'Courses' },
  { adresse: 'B3', brut: '320' },
  { adresse: 'A4', brut: 'Total', gras: true, fond: 'jaune' },
  { adresse: 'B4', brut: '=SOMME(B2:B3)', gras: true, fond: 'jaune' },
  { adresse: 'C4', brut: '=B4/0' },
];

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

test('export CSV : fichier téléchargé, nommé d’après le titre', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url, { acceptDownloads: true });
  await remplirBudget(page, BUDGET);
  await page.click('#bouton-exporter');
  const [telechargement] = await Promise.all([page.waitForEvent('download'), page.click('#exporter-csv')]);
  assert.equal(telechargement.suggestedFilename(), 'Budget de test.csv');
  const chemin = `${RESULTATS}budget.csv`;
  await telechargement.saveAs(chemin);
  const contenu = readFileSync(chemin, 'utf8');
  assert.equal(
    contenu,
    '﻿Poste;Montant;\r\nLoyer;650,5;\r\nCourses;320;\r\nTotal;970,5;#DIV/0!\r\n',
  );
  assert.match(await page.textContent('#message'), /Budget de test\.csv/);
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('export PDF : explication, impression du tableau seul, nom du fichier', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await remplirBudget(page, BUDGET);
  // On remplace l'impression réelle (fenêtre du système) par un relevé.
  await page.evaluate(() => {
    window.impressions = [];
    window.print = () => {
      const zone = document.getElementById('impression');
      // (La zone est cachée à l'écran : on lit ses cellules une à une.)
      const lignes = [...zone.querySelectorAll('h1, tr')].map((e) =>
        e.tagName === 'TR' ? [...e.cells].map((td) => td.textContent).join('\t') : e.textContent,
      );
      window.impressions.push({ titre: document.title, texte: lignes.join('\n'), classes: zone.className });
    };
  });
  await page.click('#bouton-exporter');
  await page.click('#exporter-pdf');
  assert.ok(await page.isVisible('#fenetre-aide-pdf'), 'l’explication s’affiche la première fois');
  await page.check('#fenetre-aide-pdf input[type="checkbox"]');
  await page.click('#fenetre-aide-pdf [data-fermer="continuer"]');
  await page.waitForFunction(() => window.impressions.length === 1);
  const [impression] = await page.evaluate(() => window.impressions);
  assert.equal(impression.titre, 'Budget de test'); // nom proposé pour le fichier PDF
  assert.match(impression.texte, /Budget de test/);
  assert.match(impression.texte, /Loyer\s+650,5/);
  assert.match(impression.texte, /Total\s+970,5\s+#DIV\/0!/);
  assert.equal(impression.classes, 'impression'); // tableau étroit : page en hauteur

  // La seconde fois, plus d'explication (case cochée).
  await page.evaluate(() => window.tableur.exportPdf.terminer());
  await page.keyboard.press('Control+p');
  await page.waitForFunction(() => window.impressions.length === 2);
  assert.equal(await page.isVisible('#fenetre-aide-pdf'), false);
  await contexte.close();
});

test('export PDF : vrai fichier PDF (rendu d’impression de Chromium)', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await remplirBudget(page, BUDGET);
  await page.evaluate(() => window.tableur.exportPdf.preparer());
  await page.emulateMedia({ media: 'print' });
  // Rien d'autre que le tableau n'est imprimé.
  const visibles = await page.evaluate(() =>
    [...document.body.children].filter((e) => getComputedStyle(e).display !== 'none').map((e) => e.id),
  );
  assert.deepEqual(visibles, ['impression']);
  // Fond blanc, texte noir à l'impression, même avec le thème sombre.
  const couleurs = await page.evaluate(() => {
    const td = document.querySelector('#impression td');
    const style = getComputedStyle(td);
    return { texte: style.color, fondJaune: getComputedStyle(document.querySelector('#impression td[data-fond="jaune"]')).backgroundColor };
  });
  assert.equal(couleurs.texte, 'rgb(0, 0, 0)');
  assert.equal(couleurs.fondJaune, 'rgb(251, 239, 192)');

  const chemin = `${RESULTATS}budget.pdf`;
  await page.pdf({ path: chemin, preferCSSPageSize: true, printBackground: true });
  const debut = readFileSync(chemin).subarray(0, 5).toString();
  assert.equal(debut, '%PDF-');
  if (outilDisponible('pdftotext')) {
    const texte = execFileSync('pdftotext', ['-layout', chemin, '-'], { encoding: 'utf8' });
    assert.match(texte, /Budget de test/);
    assert.match(texte, /Courses\s+320/);
    assert.match(texte, /Total\s+970,5\s+#DIV\/0!/);
  }
  await contexte.close();
});

test('export PDF : un tableau large passe en paysage', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  const cellules = [];
  for (let c = 0; c < 9; c++) cellules.push({ adresse: `${String.fromCharCode(65 + c)}1`, brut: `Colonne ${c + 1}` });
  await remplirBudget(page, cellules);
  await page.evaluate(() => window.tableur.exportPdf.preparer());
  assert.match(await page.getAttribute('#impression', 'class'), /paysage/);
  const chemin = `${RESULTATS}large.pdf`;
  await page.pdf({ path: chemin, preferCSSPageSize: true });
  if (outilDisponible('pdfinfo')) {
    const infos = execFileSync('pdfinfo', [chemin], { encoding: 'utf8' });
    const [, largeur, hauteur] = /Page size:\s+([\d.]+) x ([\d.]+)/.exec(infos);
    assert.ok(Number(largeur) > Number(hauteur), `page en paysage attendue (${largeur} x ${hauteur})`);
  }
  await contexte.close();
});

test('export d’un classeur vide : message clair', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await page.click('#bouton-exporter');
  await page.click('#exporter-csv');
  assert.match(await page.textContent('#message'), /vide/);
  await page.click('#bouton-exporter');
  await page.click('#exporter-pdf');
  assert.equal(await page.isVisible('#fenetre-aide-pdf'), false);
  assert.match(await page.textContent('#message'), /vide/);
  await contexte.close();
});
