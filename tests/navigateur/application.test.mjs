// Étape 4 : sauvegarde automatique, thèmes, menu, « À propos », hors ligne.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { demarrerServeur, lancerNavigateur, ouvrirApplication, texteCellule, cliquerOutil } from './outils.mjs';

const td = (ligne, colonne) => `td[data-ligne="${ligne}"][data-colonne="${colonne}"]`;
const attendreEnregistrement = (page) =>
  page.waitForFunction(() => document.getElementById('etat-sauvegarde').textContent === '✓ Enregistré');
const recharger = async (page) => {
  await page.reload();
  await page.waitForFunction(() => window.omniTableur !== undefined);
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
  await cliquerOutil(page, '#bouton-gras');
  await cliquerOutil(page, '#bouton-fond');
  await page.click('#panneau-fond .pastille[data-fond="jaune"]');
  await page.evaluate(() => window.omniTableur.classeur.modifierLargeurs(window.omniTableur.feuille, [1], 180));
  await attendreEnregistrement(page);

  // Nouvelle page (comme une réouverture de l'application).
  const autre = await contexte.newPage();
  autre.erreurs = [];
  autre.on('pageerror', (e) => autre.erreurs.push(e.message));
  await autre.goto(serveur.url);
  await autre.waitForFunction(() => window.omniTableur !== undefined);
  assert.equal(await autre.inputValue('#titre'), 'Mon budget');
  assert.equal(await autre.title(), 'Mon budget – Omni-Tableur');
  assert.equal(await texteCellule(autre, 'A1'), 'Loyer');
  assert.equal(await texteCellule(autre, 'B2'), '7800');
  assert.match(await autre.getAttribute(td(1, 1), 'class'), /gras/);
  assert.equal(await autre.getAttribute(td(1, 1), 'data-fond'), 'jaune');
  assert.equal(await autre.evaluate(() => window.omniTableur.feuille.largeur(1)), 180);
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

test('sauvegarde automatique : plusieurs feuilles, mise en forme, bordures, ligne figée', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await page.evaluate(() => {
    const { classeur } = window.omniTableur;
    const premiere = classeur.feuilleActive;
    classeur.modifierCellules(premiere, [
      { adresse: 'A1', brut: 'Total', gras: true, italique: true, couleur: 'bleu', alignement: 'centre' },
      { adresse: 'B1', brut: '1234,5', format: { type: 'euro', decimales: 2 }, bordures: { bas: { style: 'epais', couleur: 'rouge' } } },
    ]);
    classeur.figerPremiereLigne(premiere, true);
    const ventes = classeur.ajouterFeuille({ nom: 'Ventes 2026' });
    classeur.modifierCellules(ventes, [{ adresse: 'A1', brut: '=Feuille1!B1*2' }]);
  });
  await attendreEnregistrement(page);
  await recharger(page);
  // La feuille affichée au moment de fermer est rouverte.
  assert.deepEqual(await page.$$eval('.onglet-feuille', (o) => o.map((e) => `${e.textContent}:${e.getAttribute('aria-selected')}`)), [
    'Feuille1:false',
    'Ventes 2026:true',
  ]);
  assert.equal(await texteCellule(page, 'A1'), '2469');
  await page.click('.onglet-feuille:text-is("Feuille1")');
  const etat = await page.evaluate(() => {
    const { feuille, grille } = window.omniTableur;
    const a1 = grille.td(1, 1);
    const b1 = grille.td(1, 2);
    return {
      figee: feuille.figee,
      classes: a1.className,
      encre: a1.dataset.encre,
      align: a1.dataset.align,
      montant: b1.textContent.replace(/[\u202f\u00a0]/g, ' '),
      bordure: getComputedStyle(b1).borderBottomWidth,
    };
  });
  assert.deepEqual(etat, { figee: true, classes: 'texte gras italique', encre: 'bleu', align: 'centre', montant: '1 234,50 €', bordure: '2px' });
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('À propos : bouton direct, contact, licence et bibliothèques', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url, { permissions: ['clipboard-read', 'clipboard-write'] });
  await page.click('#bouton-a-propos');
  assert.ok(await page.isVisible('#fenetre-a-propos'));
  const texte = await page.textContent('#fenetre-a-propos');
  assert.match(texte, /Omni-Tableur/);
  assert.match(texte, /Version \d+\.\d+\.\d+/);
  assert.match(texte, /Application créée par Ferrus Dantioch et Claude/);
  assert.match(texte, /Un retour, une idée, un problème \?/);
  assert.match(texte, /Creative Commons BY-NC-ND 4\.0/);
  for (const nom of ['fast-formula-parser', 'Chevrotain', 'jStat', 'bessel', 'bahttext', 'Oxanium', 'Literata', 'JetBrains Mono']) assert.match(texte, new RegExp(nom));
  // Lien qui ouvre la messagerie, avec l'objet déjà rempli ; adresse affichée en clair.
  assert.equal(
    await page.getAttribute('#lien-contact', 'href'),
    'mailto:omni-systeme.choking513@passmail.net?subject=Retour%20sur%20Omni-Tableur',
  );
  assert.equal(await page.textContent('#adresse-contact'), 'omni-systeme.choking513@passmail.net');
  await page.click('#copier-adresse');
  await page.waitForFunction(() => document.getElementById('adresse-copiee').textContent !== '');
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'omni-systeme.choking513@passmail.net');
  await page.keyboard.press('Escape');
  assert.equal(await page.isVisible('#fenetre-a-propos'), false);
  await contexte.close();
});

test('menu : lignes et colonnes en plus, aide, à propos', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await page.click('#bouton-menu');
  await page.click('#menu-lignes');
  await page.click('#menu-colonnes');
  assert.match(await page.textContent('#taille-feuille'), /150 lignes × 31 colonnes/);
  assert.ok(await page.$('th.entete-colonne[data-colonne="31"]'));
  // La ligne 150 n'est dessinée qu'une fois arrivée à l'écran (grille virtuelle).
  await page.evaluate(() => window.omniTableur.grille.rendreVisible(150, 31));
  assert.ok(await page.$(td(150, 31)));
  await page.click('#menu-aide');
  assert.ok(await page.isVisible('#fenetre-aide'));
  assert.match(await page.textContent('#fenetre-aide'), /=SOMME\(A1:A10\)/);
  await page.keyboard.press('Escape');
  await page.click('#bouton-menu');
  await page.click('#menu-a-propos');
  const texte = await page.textContent('#fenetre-a-propos');
  assert.match(texte, /Application créée par Ferrus Dantioch et Claude/);
  assert.match(texte, /Version \d+\.\d+\.\d+/);
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
  // La fenêtre se ferme juste après le clic (événement « close ») : on attend l'effacement.
  await page.waitForFunction(() => window.omniTableur.classeur.titre === 'Sans titre' && !window.omniTableur.classeur.feuilles[0].brut('A1'));
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
  assert.equal(manifeste.name, 'Omni-Tableur');
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

test('titre enregistré pendant la frappe ; Échap remet l’ancien', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await page.click('#titre');
  await page.keyboard.press('Control+a');
  await page.keyboard.type('Comptes');
  // Sans quitter le champ : le titre est déjà pris en compte et enregistré.
  await attendreEnregistrement(page);
  assert.equal(await page.evaluate(() => window.omniTableur.classeur.titre), 'Comptes');
  await page.keyboard.press('Enter');
  await page.click('#titre');
  await page.keyboard.press('Control+a');
  await page.keyboard.type('Brouillon');
  await page.keyboard.press('Escape');
  assert.equal(await page.inputValue('#titre'), 'Comptes');
  await attendreEnregistrement(page);
  await recharger(page);
  assert.equal(await page.inputValue('#titre'), 'Comptes');
  await contexte.close();
});

test('avertissement si l’application est ouverte deux fois', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  assert.equal(await page.isVisible('#bandeau-onglets'), false);
  const seconde = await contexte.newPage();
  await seconde.goto(serveur.url);
  await seconde.waitForFunction(() => window.omniTableur !== undefined);
  await seconde.waitForSelector('#bandeau-onglets', { state: 'visible' });
  await page.waitForSelector('#bandeau-onglets', { state: 'visible' });
  await seconde.click('#bouton-compris');
  assert.equal(await seconde.isVisible('#bandeau-onglets'), false);
  await contexte.close();
});
