// Étape 4 : sauvegarde automatique, thèmes, menu, « À propos », hors ligne.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { demarrerServeur, lancerNavigateur, ouvrirApplication, texteCellule } from './outils.mjs';

const td = (ligne, colonne) => `td[data-ligne="${ligne}"][data-colonne="${colonne}"]`;
const attendreEnregistrement = (page) =>
  page.waitForFunction(() => document.getElementById('etat-sauvegarde').textContent === '✓ Enregistré');
const recharger = async (page) => {
  await page.reload();
  await page.waitForFunction(() => window.tableur !== undefined);
};

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

test('sauvegarde automatique : tout est retrouvé après fermeture', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await page.fill('#titre', 'Mon budget');
  await page.press('#titre', 'Enter');
  await page.keyboard.type('Loyer');
  await page.keyboard.press('Tab');
  await page.keyboard.type('650');
  await page.keyboard.press('Enter');
  await page.click(td(2, 2));
  await page.keyboard.type('=B1*12');
  await page.keyboard.press('Enter');
  await page.click(td(1, 1));
  await page.click('#bouton-gras');
  await page.click('#bouton-fond');
  await page.click('#panneau-fond .pastille[data-fond="jaune"]');
  await page.evaluate(() => window.tableur.classeur.modifierLargeurs(window.tableur.feuille, [1], 180));
  await attendreEnregistrement(page);

  // Nouvelle page (comme une réouverture de l'application).
  const autre = await contexte.newPage();
  autre.erreurs = [];
  autre.on('pageerror', (e) => autre.erreurs.push(e.message));
  await autre.goto(serveur.url);
  await autre.waitForFunction(() => window.tableur !== undefined);
  assert.equal(await autre.inputValue('#titre'), 'Mon budget');
  assert.equal(await autre.title(), 'Mon budget – Tableur');
  assert.equal(await texteCellule(autre, 'A1'), 'Loyer');
  assert.equal(await texteCellule(autre, 'B2'), '7800');
  assert.match(await autre.getAttribute(td(1, 1), 'class'), /gras/);
  assert.equal(await autre.getAttribute(td(1, 1), 'data-fond'), 'jaune');
  assert.equal(await autre.evaluate(() => window.tableur.feuille.largeur(1)), 180);
  assert.deepEqual(autre.erreurs, []);
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('la sauvegarde est immédiate quand l’application passe en arrière-plan', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await page.keyboard.type('vite');
  await page.keyboard.press('Enter');
  // Sans attendre le délai : on simule le passage en arrière-plan.
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await attendreEnregistrement(page);
  await recharger(page);
  assert.equal(await texteCellule(page, 'A1'), 'vite');
  await contexte.close();
});

test('trois thèmes, mémorisés', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  const theme = () => page.evaluate(() => document.documentElement.dataset.theme);
  const fond = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert.equal(await theme(), 'omni');
  assert.equal(await fond(), 'rgb(20, 17, 29)'); // #14111d, fond de l'Omni-système
  await page.click('#bouton-menu');
  const etiquettes = await page.locator('.choix-theme strong').allTextContents();
  assert.deepEqual(etiquettes, ['Omni-système', 'Sombre classique', 'Clair']);
  await page.click('label.choix-theme:has(input[value="sombre"])');
  assert.equal(await theme(), 'sombre');
  assert.equal(await fond(), 'rgb(28, 28, 30)');
  await page.click('label.choix-theme:has(input[value="clair"])');
  assert.equal(await theme(), 'clair');
  assert.equal(await page.getAttribute('meta[name="color-scheme"]', 'content'), 'light');
  await page.keyboard.press('Escape');
  // Le thème est appliqué dès le chargement, avant l'affichage.
  await recharger(page);
  assert.equal(await theme(), 'clair');
  assert.equal(await page.evaluate(() => document.querySelector('input[name="theme"]:checked').value), 'clair');
  await contexte.close();
});

test('menu : lignes et colonnes en plus, aide, à propos', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await page.click('#bouton-menu');
  await page.click('#menu-lignes');
  await page.click('#menu-colonnes');
  assert.match(await page.textContent('#taille-feuille'), /150 lignes × 31 colonnes/);
  assert.ok(await page.$(td(150, 31)));
  await page.click('#menu-aide');
  assert.ok(await page.isVisible('#fenetre-aide'));
  assert.match(await page.textContent('#fenetre-aide'), /=SOMME\(A1:A10\)/);
  await page.keyboard.press('Escape');
  await page.click('#bouton-menu');
  await page.click('#menu-a-propos');
  const texte = await page.textContent('#fenetre-a-propos');
  assert.match(texte, /Application faite par Ferrus Dantioch et Claude/);
  assert.match(texte, /Version 1\.\d+\.\d+/);
  assert.match(texte, /fast-formula-parser/);
  await page.click('#fenetre-a-propos [data-fermer]');
  assert.equal(await page.isVisible('#fenetre-a-propos'), false);
  // Après fermeture, le clavier pilote à nouveau la grille.
  await page.keyboard.type('ok');
  await page.keyboard.press('Enter');
  assert.equal(await texteCellule(page, 'A1'), 'ok');
  await contexte.close();
});

test('nouveau classeur : confirmation, puis annulable', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await page.keyboard.type('précieux');
  await page.keyboard.press('Enter');
  await page.click('#bouton-menu');
  await page.click('#menu-nouveau');
  await page.click('#fenetre-confirmation [data-fermer="garder"]');
  assert.equal(await texteCellule(page, 'A1'), 'précieux');
  await page.click('#bouton-menu');
  await page.click('#menu-nouveau');
  await page.click('#fenetre-confirmation [data-fermer="effacer"]');
  assert.equal(await texteCellule(page, 'A1'), '');
  await page.click('#bouton-annuler');
  assert.equal(await texteCellule(page, 'A1'), 'précieux');
  await contexte.close();
});

test('application installable et utilisable sans connexion', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  // Manifeste valide.
  const manifeste = await page.evaluate(async () => {
    const lien = document.querySelector('link[rel="manifest"]');
    return (await fetch(lien.href)).json();
  });
  assert.equal(manifeste.name, 'Tableur');
  assert.equal(manifeste.display, 'standalone');
  // Le service worker est installé et a tout mis en cache.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.keyboard.type('12');
  await page.keyboard.press('Enter');
  await attendreEnregistrement(page);

  // Coupure du réseau, puis réouverture.
  await contexte.setOffline(true);
  await recharger(page);
  assert.equal(await texteCellule(page, 'A1'), '12');
  await page.click(td(2, 1));
  await page.keyboard.type('=A1*3');
  await page.keyboard.press('Enter');
  assert.equal(await texteCellule(page, 'A2'), '36');
  // Les polices viennent aussi du cache.
  const polices = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family);
  });
  assert.ok(polices.some((f) => f.includes('Literata')), `polices chargées : ${polices}`);
  assert.deepEqual(page.erreurs, []);
  await contexte.setOffline(false);
  await contexte.close();
});
