// Initiative : retour à la ligne dans une cellule. Le texte continue sur
// plusieurs lignes et la ligne du tableau grandit ; tout le reste (cadres de
// sélection, défilement, ligne figée, zoom, PDF) doit suivre.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { demarrerServeur, lancerNavigateur, ouvrirApplication, cliquerOutil } from './outils.mjs';

const LONG = 'Penser à acheter du pain complet, des tomates bien mûres et du fromage pour samedi';

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

/** Mesures d'une cellule à l'écran : sa case dessinée, le rectangle calculé par la grille, la hauteur de sa ligne. */
function mesurer(page, ligne, colonne) {
  return page.evaluate(
    ([l, c]) => {
      const { grille } = window.omniTableur;
      grille.rendreVisible(l, c);
      const td = grille.td(l, c).getBoundingClientRect();
      const calcule = grille.rectangleEcran(l, c);
      return { haut: td.top, bas: td.bottom, hauteur: td.height, hautCalcule: calcule.top, hauteurCalculee: calcule.height, ligne: grille.hauteurDe(l), normale: grille.hauteurLigne };
    },
    [ligne, colonne],
  );
}

const ecrire = (page, contenus) =>
  page.evaluate((c) => {
    const { classeur, feuille } = window.omniTableur;
    classeur.modifierCellules(feuille, Object.entries(c).map(([adresse, brut]) => ({ adresse, brut })));
  }, contenus);

test('bouton « À la ligne » : la ligne grandit, la sélection et les lignes suivantes suivent, Annuler', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await ecrire(page, { A2: LONG, B2: '42', A3: 'suivante' });
  await page.click('td[data-ligne="2"][data-colonne="1"]');
  await cliquerOutil(page, '#bouton-retour');
  assert.equal(await page.getAttribute('#bouton-retour', 'aria-pressed'), 'true');
  assert.equal(await page.evaluate(() => window.omniTableur.feuille.cellule('A2').retour), true);

  const a2 = await mesurer(page, 2, 1);
  assert.ok(a2.hauteur > 3 * a2.normale, `ligne 2 agrandie (${a2.hauteur} px)`);
  assert.equal(a2.hauteur, a2.ligne);
  assert.ok(Math.abs(a2.haut - a2.hautCalcule) < 1 && Math.abs(a2.hauteur - a2.hauteurCalculee) < 1, 'rectangle calculé = case dessinée');
  // Le cadre de la cellule active entoure toute la cellule agrandie.
  const cadre = await page.evaluate(() => [...document.querySelectorAll('.cadre-actif')].find((e) => !e.hidden).getBoundingClientRect().height);
  assert.ok(Math.abs(cadre - a2.hauteur) < 1, `cadre ${cadre} px`);
  // La ligne 3 commence juste sous la ligne 2, avec la hauteur normale.
  const a3 = await mesurer(page, 3, 1);
  assert.ok(Math.abs(a3.haut - a2.bas) < 1);
  assert.equal(a3.hauteur, a3.normale);
  // Le texte est entièrement visible (rien n'est coupé).
  assert.equal(await page.evaluate(() => { const td = window.omniTableur.grille.td(2, 1); return td.scrollHeight <= td.clientHeight; }), true);

  // Colonne plus large : moins de lignes de texte, la ligne rapetisse.
  await page.evaluate(() => window.omniTableur.classeur.modifierLargeurs(window.omniTableur.feuille, [1], 400));
  const large = await mesurer(page, 2, 1);
  assert.ok(large.hauteur < a2.hauteur && large.hauteur > large.normale, `${large.hauteur} px`);
  // Le texte change : la hauteur suit.
  await ecrire(page, { A2: 'court' });
  assert.equal((await mesurer(page, 2, 1)).hauteur, a2.normale);

  // Annuler (texte, largeur, retour à la ligne) : tout revient comme avant.
  for (let i = 0; i < 2; i++) await page.click('#bouton-annuler');
  assert.ok((await mesurer(page, 2, 1)).hauteur > 3 * a2.normale);
  await page.click('#bouton-annuler');
  assert.equal((await mesurer(page, 2, 1)).hauteur, a2.normale);
  assert.equal(await page.getAttribute('#bouton-retour', 'aria-pressed'), 'false');
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('défilement : beaucoup de lignes hautes, les positions restent exactes', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await page.evaluate((texte) => {
    const { classeur, feuille } = window.omniTableur;
    classeur.agrandir(feuille, { lignes: 200 }); // 300 lignes
    const modifications = [];
    for (let l = 1; l <= 300; l++) {
      modifications.push({ adresse: `A${l}`, brut: l % 3 === 0 ? `${l} ${texte}` : `ligne ${l}`, retour: true });
      modifications.push({ adresse: `B${l}`, brut: String(l) });
    }
    classeur.modifierCellules(feuille, modifications);
  }, LONG);
  for (const ligne of [150, 299, 300, 40]) {
    const m = await mesurer(page, ligne, 2);
    assert.ok(Math.abs(m.haut - m.hautCalcule) < 1 && Math.abs(m.hauteur - m.hauteurCalculee) < 1, `ligne ${ligne} : ${m.haut} / ${m.hautCalcule}`);
    assert.equal(m.hauteur, ligne % 3 === 0 ? m.ligne : m.normale);
    // La cellule sous le doigt est bien celle de cette ligne.
    const sous = await page.evaluate(([l]) => {
      const r = window.omniTableur.grille.td(l, 2).getBoundingClientRect();
      return window.omniTableur.grille.celluleSousPoint(r.left + 5, r.top + r.height / 2);
    }, [ligne]);
    assert.deepEqual(sous, { type: 'cellule', ligne, colonne: 2 });
  }
  // Tout en bas : la dernière ligne est collée à la fin du tableau (pas d'espace en trop).
  const bas = await page.evaluate(() => {
    const zone = window.omniTableur.grille.racine;
    zone.scrollTop = zone.scrollHeight;
    zone.dispatchEvent(new Event('scroll'));
    const derniere = window.omniTableur.feuille.lignes;
    return { fin: window.omniTableur.grille.contenu.querySelector('table.grille').getBoundingClientRect().bottom, ligne: window.omniTableur.grille.td(derniere, 1)?.getBoundingClientRect().bottom };
  });
  assert.ok(Math.abs(bas.fin - bas.ligne) < 1, `${bas.fin} / ${bas.ligne}`);
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('ligne 1 figée, zoom, cellule fusionnée et PDF', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url);
  await ecrire(page, { A1: LONG, A2: 'deux', A3: 'Titre fusionné qui est vraiment très long', A40: 'loin' });
  await page.evaluate(() => {
    const { classeur, feuille } = window.omniTableur;
    classeur.modifierCellules(feuille, [{ adresse: 'A1', retour: true }, { adresse: 'A3', retour: true }]);
    classeur.figerPremiereLigne(feuille, true);
    classeur.fusionner(feuille, { debut: { ligne: 3, colonne: 1 }, fin: { ligne: 4, colonne: 2 } });
  });
  // Ligne 1 figée et haute : elle reste en haut, la ligne 2 commence dessous.
  const a1 = await mesurer(page, 1, 1);
  assert.ok(a1.hauteur > 2 * a1.normale);
  const a2 = await mesurer(page, 2, 1);
  assert.ok(Math.abs(a2.haut - a1.bas) < 1);
  await page.evaluate(() => window.omniTableur.grille.rendreVisible(40, 1));
  const figee = await mesurer(page, 1, 1);
  assert.ok(Math.abs(figee.haut - a1.haut) < 1, 'la ligne 1 reste collée en haut');
  const a40 = await mesurer(page, 40, 1);
  assert.ok(a40.haut >= figee.bas - 1, 'la ligne 40 n’est pas cachée sous la ligne figée');
  // Une fusion ne fait pas grandir ses lignes (comme Excel) ; son texte passe à la ligne dedans.
  assert.equal((await mesurer(page, 3, 1)).ligne, a1.normale);
  assert.equal(await page.evaluate(() => document.querySelector('.cellule-fusionnee').classList.contains('retour')), true);

  // Zoom 150 % : la ligne haute grandit avec le reste.
  await page.evaluate(() => window.omniTableur.zoom.choisir(150));
  const zoome = await mesurer(page, 1, 1);
  assert.ok(zoome.ligne > a1.ligne * 1.2, `${a1.ligne} → ${zoome.ligne}`);
  assert.ok(Math.abs(zoome.hauteur - zoome.ligne) < 1);

  // PDF : la cellule garde le retour à la ligne (la ligne imprimée grandit seule).
  const imprime = await page.evaluate(() => {
    window.omniTableur.exportPdf.preparer();
    const td = document.querySelectorAll('#impression tr')[0].cells[0];
    const resultat = { texte: td.textContent, retour: td.classList.contains('retour') };
    window.omniTableur.exportPdf.terminer();
    return resultat;
  });
  assert.equal(imprime.retour, true);
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('au doigt, sur un téléphone', async () => {
  const { contexte, page } = await ouvrirApplication(navigateur, serveur.url, {
    viewport: { width: 360, height: 740 },
    hasTouch: true,
    isMobile: true,
  });
  await ecrire(page, { A1: LONG });
  await page.tap('td[data-ligne="1"][data-colonne="1"]');
  await cliquerOutil(page, '#bouton-retour', { doigt: true });
  const a1 = await mesurer(page, 1, 1);
  assert.ok(a1.hauteur > 3 * a1.normale, `${a1.hauteur} px`);
  assert.ok(Math.abs(a1.hauteur - a1.hauteurCalculee) < 1);
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});
